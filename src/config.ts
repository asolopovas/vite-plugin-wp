import * as path from 'path'
import type { UserConfig } from 'vite'
import {
    DEFAULT_DEV_SERVER_HOST,
    OPTIMIZE_DEPS_ENTRIES,
    OPTIMIZE_DEPS_EXCLUDE,
    PROJECT_ALIASES,
    RESOLVE_ALIASES,
    ROLLUP_EXTERNAL_DEFAULT,
    SHIM_PATHS,
} from './constants.js'
import type { ResolvedWpPluginOptions } from './options.js'

function resolveAlias(key: string, baseDir: string): string {
    if (key in SHIM_PATHS) return SHIM_PATHS[key as keyof typeof SHIM_PATHS]
    if (key in PROJECT_ALIASES) {
        return path.resolve(baseDir, PROJECT_ALIASES[key as keyof typeof PROJECT_ALIASES])
    }
    return path.resolve(baseDir, key)
}

function normalizeAliasEntries(
    alias: NonNullable<NonNullable<UserConfig['resolve']>['alias']> | undefined
): Array<{ find: string | RegExp; replacement: string }> {
    if (!alias) return []
    if (Array.isArray(alias)) return alias
    return Object.entries(alias).map(([find, replacement]) => ({ find, replacement }))
}

export function configureResolve(config: UserConfig, baseDir: string): void {
    const existingAliases = normalizeAliasEntries(config.resolve?.alias)
    const pluginAliases = RESOLVE_ALIASES.map(({ find, key }) => ({
        find,
        replacement: resolveAlias(key, baseDir),
    }))

    config.resolve = {
        ...config.resolve,
        alias: [...pluginAliases, ...existingAliases],
    }
}

export function configureDevServer(config: UserConfig): void {
    const existingHmr = typeof config.server?.hmr === 'object' ? config.server.hmr : {}

    config.server = {
        ...config.server,
        cors: true,
        hmr: {
            host: DEFAULT_DEV_SERVER_HOST,
            ...existingHmr,
        },
    }
}

export function configureOptimizeDeps(config: UserConfig): void {
    config.optimizeDeps = {
        ...config.optimizeDeps,
        exclude: [...OPTIMIZE_DEPS_EXCLUDE, ...(config.optimizeDeps?.exclude || [])],
        entries: [...OPTIMIZE_DEPS_ENTRIES, ...(config.optimizeDeps?.entries || [])],
    }
}

export function configureBuild(config: UserConfig, options: ResolvedWpPluginOptions, baseDir: string): void {
    const existingExternal = config.build?.rollupOptions?.external
    const externalArray = Array.isArray(existingExternal) ? existingExternal : []
    const existingInput = config.build?.rollupOptions?.input

    if (config.publicDir === undefined) {
        const publicDirAbs = path.resolve(baseDir, 'public')
        const outDirAbs = path.resolve(baseDir, options.outDir)
        const rel = path.relative(publicDirAbs, outDirAbs)
        if (rel && !rel.startsWith('..') && !path.isAbsolute(rel)) {
            config.publicDir = false
        }
    }

    config.build = {
        ...config.build,
        chunkSizeWarningLimit: 3000,
        rollupOptions: {
            ...config.build?.rollupOptions,
            input: existingInput ?? options.input,
            output: {
                entryFileNames: '[name]-[hash].js',
                chunkFileNames: '[name]-[hash].js',
                assetFileNames: '[name]-[hash].[ext]',
                format: 'es',
                ...config.build?.rollupOptions?.output,
            },
            external: [...ROLLUP_EXTERNAL_DEFAULT, ...externalArray],
        },
        outDir: options.outDir,
        emptyOutDir: true,
        manifest: options.manifest,
        write: true,
        assetsDir: '.',
        assetsInlineLimit: options.assetsInlineLimit,
    }

    if (options.base !== undefined) {
        config.base = config.base ?? options.base
    }
}

export function configureDefines(config: UserConfig): void {
    config.define = {
        'process.env.NODE_ENV': '"development"',
        ...config.define,
    }
}
