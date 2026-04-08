export type WpPluginOptions = {
    input?: string | string[]
    outDir?: string
    manifest?: string | boolean
    assetsInlineLimit?: number
    base?: string
    debugHmr?: boolean
    hmrDebounceMs?: number
    syncViteMode?: boolean
    envFile?: string
    hotFile?: string
}

export type ResolvedWpPluginOptions = Required<
    Omit<WpPluginOptions, 'input' | 'base' | 'manifest'>
> & {
    input?: string | string[]
    base?: string
    manifest: string | boolean
}

const DEFAULTS = {
    outDir: 'static/build',
    manifest: 'manifest.json' as string | boolean,
    assetsInlineLimit: 0,
    debugHmr: false,
    hmrDebounceMs: 100,
    syncViteMode: true,
    envFile: '.env',
    hotFile: 'static/build/hot',
}

export function resolveOptions(options: WpPluginOptions = {}): ResolvedWpPluginOptions {
    return {
        input: options.input,
        base: options.base,
        outDir: options.outDir ?? DEFAULTS.outDir,
        manifest: options.manifest ?? DEFAULTS.manifest,
        assetsInlineLimit: options.assetsInlineLimit ?? DEFAULTS.assetsInlineLimit,
        debugHmr: options.debugHmr ?? DEFAULTS.debugHmr,
        hmrDebounceMs: options.hmrDebounceMs ?? DEFAULTS.hmrDebounceMs,
        syncViteMode: options.syncViteMode ?? DEFAULTS.syncViteMode,
        envFile: options.envFile ?? DEFAULTS.envFile,
        hotFile: options.hotFile ?? DEFAULTS.hotFile,
    }
}
