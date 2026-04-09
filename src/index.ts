import * as path from 'path'
import type { ConfigEnv, Plugin, UserConfig } from 'vite'
import { isBlockIndexEntry, JS_LIKE_EXTENSION, PACKAGE_ROOT } from './constants.js'
import {
    configureBuild,
    configureDefines,
    configureDevServer,
    configureOptimizeDeps,
    configureResolve,
} from './config.js'
import { envModePlugin } from './env-mode.js'
import { hmrFilterPlugin } from './hmr-filter.js'
import { hotFilePlugin } from './hot-file.js'
import { resolveOptions, type WpPluginOptions } from './options.js'
import { addHmrCode, injectBlockHmrForBlocks } from './transforms/block-hmr.js'
import { injectIndexDepsAccept } from './transforms/index-deps.js'
import { transformReactImports } from './transforms/react-imports.js'
import { rewriteWordpressImportsToGlobals, transformWordpressImports } from './transforms/wp-imports.js'
import { generateContentHash } from './utils/hash.js'

export type { WpPluginOptions } from './options.js'

export default function vitePluginWp(options: WpPluginOptions = {}): Plugin[] {
    const resolved = resolveOptions(options)
    const baseDir = process.cwd()
    const transformCache = new Map<string, string>()
    const hmrLogger = resolved.debugHmr
        ? 'console'
        : '{ log: () => {}, warn: () => {}, debug: () => {} }'

    let isBuild = false

    const VIRTUAL_BLOCK_HMR = 'virtual:vite-plugin-wp/block-hmr'
    const RESOLVED_BLOCK_HMR = '\0' + VIRTUAL_BLOCK_HMR
    const blockHmrFile = path.join(PACKAGE_ROOT, 'dist/runtime/block-hmr.js')

    const corePlugin: Plugin = {
        name: 'vite-plugin-wp',
        resolveId(id: string) {
            if (id === VIRTUAL_BLOCK_HMR) return RESOLVED_BLOCK_HMR
        },
        async load(id: string) {
            if (id === RESOLVED_BLOCK_HMR) {
                const fs = await import('fs/promises')
                return fs.readFile(blockHmrFile, 'utf-8')
            }
        },
        config(config: UserConfig, env: ConfigEnv) {
            isBuild = env.command === 'build'
            configureResolve(config, baseDir)
            configureDevServer(config)
            configureOptimizeDeps(config)
            if (isBuild) {
                configureDefines(config)
                configureBuild(config, resolved)
            }
        },
        async transform(code: string, id: string) {
            if (isBuild) return

            const cleanId = id.split('?')[0]
            if (!JS_LIKE_EXTENSION.test(cleanId)) return

            const cacheKey = `${id}:${generateContentHash(code)}`
            const cached = transformCache.get(cacheKey)
            if (cached) return { code: cached, map: null }

            let result = code

            if (isBlockIndexEntry(cleanId)) {
                result = await addHmrCode(result, hmrLogger, resolved.hmrDebounceMs)
            }

            result = transformWordpressImports(result)
            result = transformReactImports(result)
            result = await injectBlockHmrForBlocks(result, cleanId, hmrLogger)
            result = injectIndexDepsAccept(result, cleanId, hmrLogger, isBuild)

            transformCache.set(cacheKey, result)
            return { code: result, map: null }
        },
        renderChunk(code: string) {
            if (!isBuild) return null
            const rewritten = rewriteWordpressImportsToGlobals(code)
            return rewritten ? { code: rewritten, map: null } : null
        },
    }

    const plugins: Plugin[] = [
        corePlugin,
        hotFilePlugin(resolved.hotFile, baseDir),
        hmrFilterPlugin(baseDir),
    ]

    if (resolved.syncViteMode) {
        plugins.push(envModePlugin(resolved.envFile, baseDir))
    }

    return plugins
}

export { vitePluginWp }
