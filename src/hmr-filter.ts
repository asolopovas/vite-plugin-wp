import * as path from 'path'
import type { EnvironmentModuleNode, HmrContext, HotUpdateOptions, ModuleNode, Plugin, ViteDevServer } from 'vite'
import { JS_LIKE_EXTENSION } from './constants.js'
import { generateContentHash } from './utils/hash.js'

const EDITOR_CSS_REL = 'src/styles/vite-blocks-editor.css'
const EDITOR_CSS_URL = '/src/styles/vite-blocks-editor.css'

export function hmrFilterPlugin(baseDir: string): Plugin {
    const cssContentHashes = new Map<string, string>()
    const cssOutputHashes = new Map<string, string>()
    const editorCssPath = path.resolve(baseDir, EDITOR_CSS_REL)
    const BACKSLASH_RE = /\\/g
    const normalizedEditorCss = editorCssPath.replace(BACKSLASH_RE, '/')

    function filterOutEditorCssModules<T extends { id: string | null; file: string | null; type?: string }>(
        modules: T[],
    ): T[] {
        return modules.filter((mod) => {
            const modFile = (mod.file || mod.id || '').replace(BACKSLASH_RE, '/')
            const modUrl = ((mod as { url?: string }).url || '').replace(BACKSLASH_RE, '/')
            const isCss = modFile.endsWith('.css') || modUrl.endsWith('.css') || mod.type === 'css'
            if (!isCss) return true
            const matchesEditorCss = [modFile, modUrl].some((value) =>
                value.includes(normalizedEditorCss) || value.includes(EDITOR_CSS_URL)
            )
            return !matchesEditorCss
        })
    }

    async function filterHotUpdateModules<T extends { id: string | null; file: string | null; type?: string }>(
        ctx: { file: string; modules: T[]; read: () => string | Promise<string>; server: ViteDevServer },
    ): Promise<T[] | void> {
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
            void server.transformRequest(EDITOR_CSS_URL)
                .then((result) => {
                    if (result?.code) {
                        cssOutputHashes.set(EDITOR_CSS_URL, generateContentHash(result.code))
                    }
                })
                .catch(() => { })
        },
        hotUpdate: (ctx: HotUpdateOptions): Promise<EnvironmentModuleNode[] | void> =>
            filterHotUpdateModules(ctx),
        handleHotUpdate: (ctx: HmrContext): Promise<ModuleNode[] | void> =>
            filterHotUpdateModules(ctx),
    }
}
