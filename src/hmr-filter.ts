import * as fs from 'fs'
import * as path from 'path'
import type { EnvironmentModuleNode, HmrContext, HotUpdateOptions, ModuleNode, Plugin, ViteDevServer } from 'vite'
import { JS_LIKE_EXTENSION } from './constants.js'
import { generateContentHash } from './utils.js'

const CSS_IMPORT_RE = /@import\s+(?:url\()?\s*["']([^"']+)["']/g
const PARTIAL_RELOAD_WINDOW_MS = 1500

function collectCssImportDeps(entryFile: string, backslashRe: RegExp): Set<string> {
    const deps = new Set<string>()
    const visited = new Set<string>()

    const walk = (file: string): void => {
        const resolved = path.resolve(file)
        if (visited.has(resolved)) return
        visited.add(resolved)

        let content: string
        try {
            content = fs.readFileSync(resolved, 'utf8')
        } catch {
            return
        }

        const dir = path.dirname(resolved)
        CSS_IMPORT_RE.lastIndex = 0
        let match: RegExpExecArray | null
        while ((match = CSS_IMPORT_RE.exec(content)) !== null) {
            const spec = match[1]
            if (!spec.startsWith('.') && !spec.startsWith('/')) continue
            const depPath = path.resolve(dir, spec)
            if (!fs.existsSync(depPath)) continue
            deps.add(depPath.replace(backslashRe, '/'))
            walk(depPath)
        }
    }

    walk(entryFile)
    return deps
}

export function hmrFilterPlugin(baseDir: string, editorCss: string): Plugin {
    const EDITOR_CSS_URL = editorCss.startsWith('/') ? editorCss : `/${editorCss}`
    const cssContentHashes = new Map<string, string>()
    const cssOutputHashes = new Map<string, string>()
    const editorCssPath = path.resolve(baseDir, EDITOR_CSS_URL.slice(1))
    const BACKSLASH_RE = /\\/g
    const normalizedEditorCss = editorCssPath.replace(BACKSLASH_RE, '/')

    function filterOutEditorCssModules<T extends { id: string | null; file: string | null; type?: string }>(
        modules: T[]
    ): T[] {
        return modules.filter((mod) => {
            const modFile = (mod.file || mod.id || '').replace(BACKSLASH_RE, '/')
            const modUrl = ((mod as { url?: string }).url || '').replace(BACKSLASH_RE, '/')
            const isCss = modFile.endsWith('.css') || modUrl.endsWith('.css') || mod.type === 'css'
            if (!isCss) return true
            const matchesEditorCss = [modFile, modUrl].some(
                (value) => value.includes(normalizedEditorCss) || value.includes(EDITOR_CSS_URL)
            )
            return !matchesEditorCss
        })
    }

    async function filterHotUpdateModules<T extends { id: string | null; file: string | null; type?: string }>(ctx: {
        file: string
        modules: T[]
        read: () => string | Promise<string>
        server: ViteDevServer
    }): Promise<T[] | void> {
        const cleanFile = ctx.file.split('?')[0]

        if (path.resolve(cleanFile) === editorCssPath) {
            const content = await ctx.read()
            const nextHash = generateContentHash(content)
            const prevHash = cssContentHashes.get(editorCssPath)
            cssContentHashes.set(editorCssPath, nextHash)
            return prevHash && prevHash === nextHash ? [] : undefined
        }

        if (JS_LIKE_EXTENSION.test(cleanFile)) {
            let cssResult: { code?: string } | null = null
            try {
                cssResult = await ctx.server.transformRequest(EDITOR_CSS_URL)
            } catch {
                cssResult = null
            }
            if (cssResult?.code) {
                const nextHash = generateContentHash(cssResult.code)
                const prevHash = cssOutputHashes.get(EDITOR_CSS_URL)
                cssOutputHashes.set(EDITOR_CSS_URL, nextHash)
                if (prevHash && prevHash === nextHash) {
                    return filterOutEditorCssModules(ctx.modules)
                }
            }
        }
    }

    return {
        name: 'vite-plugin-wp:hmr-filter',
        enforce: 'post',
        configureServer(server) {
            void server
                .transformRequest(EDITOR_CSS_URL)
                .then((result) => {
                    if (result?.code) {
                        cssOutputHashes.set(EDITOR_CSS_URL, generateContentHash(result.code))
                    }
                })
                .catch(() => {})

            let editorCssDeps = collectCssImportDeps(editorCssPath, BACKSLASH_RE)
            let pendingPartialChangeAt = 0

            const onCssWatch = (file: string): void => {
                const normalized = path.resolve(file).replace(BACKSLASH_RE, '/')
                if (!normalized.endsWith('.css')) return
                editorCssDeps = collectCssImportDeps(editorCssPath, BACKSLASH_RE)
                if (editorCssDeps.has(normalized)) pendingPartialChangeAt = Date.now()
            }
            server.watcher.prependListener('change', onCssWatch)
            server.watcher.prependListener('add', onCssWatch)
            server.watcher.prependListener('unlink', onCssWatch)

            const invalidateEditorEntry = (): void => {
                for (const env of Object.values(server.environments ?? {})) {
                    const graph = env?.moduleGraph
                    const mods = graph?.getModulesByFile?.(editorCssPath)
                    if (!mods) continue
                    for (const mod of mods) graph!.invalidateModule(mod, new Set(), Date.now(), true)
                }
            }

            const editorEntryUpdate = () => ({
                type: 'update' as const,
                updates: [
                    {
                        type: 'js-update' as const,
                        path: EDITOR_CSS_URL,
                        acceptedPath: EDITOR_CSS_URL,
                        timestamp: Date.now(),
                        explicitImportRequired: false,
                        isWithinCircularImport: false,
                    },
                ],
            })

            type HotChannel = { send?: (...args: unknown[]) => void; __wpvHmrWrapped?: boolean }

            const isFullReload = (payload: unknown): boolean =>
                !!payload && typeof payload === 'object' && (payload as { type?: string }).type === 'full-reload'

            const wrapHotSend = (channel: HotChannel | undefined): void => {
                if (!channel || typeof channel.send !== 'function' || channel.__wpvHmrWrapped) return
                const original = channel.send.bind(channel)
                channel.send = (...args: unknown[]): void => {
                    if (isFullReload(args[0]) && Date.now() - pendingPartialChangeAt < PARTIAL_RELOAD_WINDOW_MS) {
                        pendingPartialChangeAt = 0
                        invalidateEditorEntry()
                        original(editorEntryUpdate())
                        return
                    }
                    original(...args)
                }
                channel.__wpvHmrWrapped = true
            }

            for (const env of Object.values(server.environments ?? {})) wrapHotSend(env?.hot as HotChannel)
            wrapHotSend(server.hot as HotChannel)
            wrapHotSend((server as { ws?: HotChannel }).ws)
        },
        hotUpdate: (ctx: HotUpdateOptions): Promise<EnvironmentModuleNode[] | void> => filterHotUpdateModules(ctx),
        handleHotUpdate: (ctx: HmrContext): Promise<ModuleNode[] | void> => filterHotUpdateModules(ctx),
    }
}
