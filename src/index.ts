import * as path from 'path'
import type { ConfigEnv, Plugin, UserConfig } from 'vite'
import { isBlockIndexEntry, JS_LIKE_EXTENSION, PACKAGE_ROOT } from './constants.js'
import {
    configureBuild,
    configureDefines,
    configureDevServer,
    configureOptimizeDeps,
    configureResolve,
    resolveOptions,
    type WpPluginOptions,
} from './config.js'
import { envModePlugin, hotFilePlugin } from './dev-server.js'
import { hmrFilterPlugin } from './hmr-filter.js'
import {
    addHmrCode,
    extractInternalImportSpecs,
    injectBlockHmrForBlocks,
    injectIndexDepsAccept,
    injectPluginHmr,
} from './transforms/block-hmr.js'
import {
    rewriteWordpressImportsToGlobals,
    transformReactImports,
    transformWordpressImports,
} from './transforms/imports.js'
import { generateContentHash } from './utils.js'

export type { WpPluginOptions } from './config.js'

export default function vitePluginWp(options: WpPluginOptions = {}): Plugin[] {
    const resolved = resolveOptions(options)
    const baseDir = process.cwd()
    const TRANSFORM_CACHE_MAX = 1000
    const transformCache = new Map<string, string>()
    const hmrLogger = resolved.debugHmr ? 'console' : '{ log: () => {}, warn: () => {}, debug: () => {} }'

    let isBuild = false

    const normalizedBase = baseDir.replace(/\\/g, '/')
    const projectRelativeId = (id: string): string => {
        const normalized = id.replace(/\\/g, '/')
        return normalized.startsWith(normalizedBase) ? normalized.slice(normalizedBase.length) : normalized
    }

    const VIRTUAL_BLOCK_HMR = 'virtual:vite-plugin-wp/block-hmr'
    const RESOLVED_BLOCK_HMR = '\0' + VIRTUAL_BLOCK_HMR
    const VIRTUAL_BLOCK_HMR_RE = /^virtual:vite-plugin-wp\/block-hmr$/
    // oxlint-disable-next-line no-control-regex -- resolved virtual ids are intentionally NUL-prefixed (Rollup convention)
    const RESOLVED_BLOCK_HMR_RE = /^\u0000virtual:vite-plugin-wp\/block-hmr$/
    const blockHmrFile = path.join(PACKAGE_ROOT, 'dist/runtime/block-hmr.js')

    const corePlugin: Plugin = {
        name: 'vite-plugin-wp',
        resolveId: {
            filter: { id: VIRTUAL_BLOCK_HMR_RE },
            handler(id: string) {
                if (id === VIRTUAL_BLOCK_HMR) return RESOLVED_BLOCK_HMR
            },
        },
        load: {
            filter: { id: RESOLVED_BLOCK_HMR_RE },
            async handler(id: string) {
                if (id === RESOLVED_BLOCK_HMR) {
                    const fs = await import('fs/promises')
                    return fs.readFile(blockHmrFile, 'utf-8')
                }
            },
        },
        config(config: UserConfig, env: ConfigEnv) {
            isBuild = env.command === 'build'
            configureResolve(config, baseDir)
            configureDevServer(config)
            configureOptimizeDeps(config)
            if (isBuild) {
                configureDefines(config)
                configureBuild(config, resolved, baseDir)
            }
        },
        transform: {
            filter: { id: JS_LIKE_EXTENSION },
            async handler(code: string, id: string) {
                if (isBuild) return

                const cleanId = id.split('?')[0]
                if (!JS_LIKE_EXTENSION.test(cleanId)) return

                const cacheKey = `${id}:${generateContentHash(code)}`
                const cached = transformCache.get(cacheKey)
                if (cached) return { code: cached, map: null }
                if (transformCache.size >= TRANSFORM_CACHE_MAX) transformCache.clear()

                let result = code
                const isEntry = isBlockIndexEntry(projectRelativeId(cleanId))

                if (isEntry) {
                    result = await addHmrCode(result, hmrLogger, resolved.hmrDebounceMs, resolved.editorCss)
                }

                result = transformWordpressImports(result)
                result = transformReactImports(result)
                result = await injectBlockHmrForBlocks(result, cleanId, hmrLogger)
                result = injectPluginHmr(result, cleanId)
                if (isEntry) {
                    const fsDeps: string[] = []
                    if (typeof this?.resolve === 'function') {
                        for (const spec of extractInternalImportSpecs(code)) {
                            const resolved = await this.resolve(spec, cleanId)
                            if (resolved?.id && resolved.id.startsWith('/') && !resolved.id.includes('node_modules')) {
                                fsDeps.push('/@fs' + resolved.id.split('?')[0])
                            }
                        }
                    }
                    result = injectIndexDepsAccept(result, fsDeps, hmrLogger)
                }

                transformCache.set(cacheKey, result)
                return { code: result, map: null }
            },
        },
        renderChunk(code: string) {
            if (!isBuild) return null
            if (!code.includes('@wordpress/')) return null
            const rewritten = rewriteWordpressImportsToGlobals(code)
            return rewritten ? { code: rewritten, map: null } : null
        },
    }

    const plugins: Plugin[] = [
        corePlugin,
        hotFilePlugin(resolved.hotFile, baseDir),
        hmrFilterPlugin(baseDir, resolved.editorCss),
    ]

    if (resolved.syncViteMode) {
        plugins.push(envModePlugin(resolved.envFile, baseDir))
    }

    return plugins
}

export { vitePluginWp }
