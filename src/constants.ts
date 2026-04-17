import * as path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export const PACKAGE_ROOT = path.resolve(__dirname, '..')

export const TEMPLATE_PATHS = {
    hmr: path.join(PACKAGE_ROOT, 'src/templates/wp-block-hmr.js'),
    blockHmrInjection: path.join(PACKAGE_ROOT, 'src/templates/wp-block-hmr-injection.js'),
}

export const SHIM_PATHS = {
    react: path.join(PACKAGE_ROOT, 'src/shims/react-shim.js'),
    reactDom: path.join(PACKAGE_ROOT, 'src/shims/react-dom-shim.js'),
    reactJsxRuntime: path.join(PACKAGE_ROOT, 'src/shims/react-jsx-runtime-shim.js'),
    lodash: path.join(PACKAGE_ROOT, 'src/shims/lodash-shim.js'),
}

export const PROJECT_ALIASES = {
    src: 'src',
    store: 'src/store',
    blocks: 'src/blocks',
    icons: 'src/icons',
    lib: 'src/lib',
} as const

export const RESOLVE_ALIASES: Array<{ find: string | RegExp; key: keyof typeof PROJECT_ALIASES | keyof typeof SHIM_PATHS }> = [
    { find: '@src', key: 'src' },
    { find: '@store', key: 'store' },
    { find: '@blocks', key: 'blocks' },
    { find: '@icons', key: 'icons' },
    { find: '@lib', key: 'lib' },
    { find: /^react$/, key: 'react' },
    { find: /^react-dom$/, key: 'reactDom' },
    { find: 'react/jsx-runtime', key: 'reactJsxRuntime' },
    { find: /^lodash-es$/, key: 'lodash' },
    { find: /^lodash$/, key: 'lodash' },
]

export const OPTIMIZE_DEPS_EXCLUDE = [
    '@wordpress/blocks',
    '@wordpress/element',
    '@wordpress/block-editor',
    '@wordpress/components',
    '@wordpress/i18n',
    'react',
    'react-dom',
    'lodash',
    'lodash-es',
]

export const OPTIMIZE_DEPS_ENTRIES = [
    'src/blocks/**/*.tsx',
    'src/blocks/**/*.ts',
    'src/blocks/**/*.js',
    'src/blocks/**/*.jsx',
]

export const DEFAULT_DEV_SERVER_HOST = 'localhost'
export const DEFAULT_DEV_SERVER_PORT = 5173

export const WORDPRESS_BUNDLED_PACKAGES = new Set(['icons'])
export const WORDPRESS_EXTERNAL_REGEX = /^@wordpress\/(?!icons$)/

export const ROLLUP_GLOBALS_MAP: Record<string, string> = {
    react: 'React',
    'react-dom': 'ReactDOM',
    jquery: 'jQuery',
    moment: 'moment',
}

export const ROLLUP_EXTERNAL_DEFAULT = [
    WORDPRESS_EXTERNAL_REGEX,
    'jquery',
    'moment',
]

export const BLOCK_INDEX_MARKERS = ['blocks/index', 'editor', 'vite-blocks']
export const JS_LIKE_EXTENSION = /\.(jsx|tsx?|js)$/

export const HMR_LOGGER_PLACEHOLDER = '__WPV_HMR_LOGGER__'
export const HMR_DEBOUNCE_PLACEHOLDER = '__WPV_HMR_DEBOUNCE_MS__'
export const HMR_EXPORT_LINE_PLACEHOLDER = '/*__WPV_HMR_EXPORT_LINE__*/'
export const HMR_DEP_ACCEPT_PLACEHOLDER = '/*__WPV_HMR_DEP_ACCEPT__*/'

export function isBlockIndexEntry(id: string): boolean {
    return BLOCK_INDEX_MARKERS.some((marker) => id.includes(marker))
}
