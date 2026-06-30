import {
    HMR_DEBOUNCE_PLACEHOLDER,
    HMR_DEP_ACCEPT_PLACEHOLDER,
    HMR_ENTRY_CSS_PLACEHOLDER,
    HMR_EXPORT_LINE_PLACEHOLDER,
    HMR_LOGGER_PLACEHOLDER,
    JS_LIKE_EXTENSION,
    TEMPLATE_PATHS,
} from '../constants.js'
import { createTemplateLoader } from '../utils.js'

const loadInjectionTemplate = createTemplateLoader(TEMPLATE_PATHS.blockHmrInjection)

function symbolPatterns(name: string) {
    return {
        decl: new RegExp(`\\bexport\\s+const\\s+${name}\\b|\\bconst\\s+${name}\\b`),
        defaultImport: new RegExp(`\\bimport\\s+${name}\\s+from\\b`),
        namedImport: new RegExp(`\\bimport\\s*{[^}]*\\b${name}\\b[^}]*}\\s+from\\b`),
        defaultSource: new RegExp(`import\\s+${name}\\s+from\\s+['"]([^'"]+)['"]`),
        namedSource: new RegExp(`import\\s*{[^}]*\\b${name}\\b[^}]*}\\s+from\\s+['"]([^'"]+)['"]`),
        exportedDecl: new RegExp(`\\bexport\\s+(?:const|function|class)\\s+${name}\\b`),
        exportedList: new RegExp(`\\bexport\\s*{\\s*[^}]*\\b${name}\\b[^}]*}\\s*;?`),
    }
}

type SymbolPatterns = ReturnType<typeof symbolPatterns>

const META = symbolPatterns('meta')
const EDIT = symbolPatterns('edit')
const SAVE = symbolPatterns('save')
const SYMBOLS: Array<[string, SymbolPatterns]> = [
    ['meta', META],
    ['edit', EDIT],
    ['save', SAVE],
]

const BACKSLASH_RE = /\\/g

function hasSymbol(patterns: SymbolPatterns, code: string): boolean {
    return patterns.decl.test(code) || patterns.defaultImport.test(code) || patterns.namedImport.test(code)
}

function isInternalImport(spec: string): boolean {
    if (spec.startsWith('@wordpress/')) return false
    return spec.startsWith('.') || spec.startsWith('@') || spec.startsWith('/')
}

function findImportSource(code: string, patterns: SymbolPatterns): string | null {
    for (const re of [patterns.defaultSource, patterns.namedSource]) {
        const match = code.match(re)
        if (match?.[1] && isInternalImport(match[1])) return match[1]
    }
    return null
}

function shouldInjectBlockHmr(code: string, id: string): boolean {
    if (!code.includes('registerBlockType')) return false

    const cleanId = id.split('?')[0]
    if (!JS_LIKE_EXTENSION.test(cleanId)) return false

    const normalizedId = cleanId.replace(BACKSLASH_RE, '/')
    const isBlockSrc = normalizedId.includes('/src/blocks/') || normalizedId.startsWith('src/blocks/')
    if (!isBlockSrc) return false

    if (code.includes('__wpvApplyBlockHmr') || code.includes('__wpvSetupBlockHmr')) return false

    if (!hasSymbol(META, code)) return false
    if (!hasSymbol(EDIT, code)) return false
    if (!hasSymbol(SAVE, code)) return false

    return true
}

function isBlockIndexModule(code: string, id: string): boolean {
    if (!code.includes('registerBlockType')) return false
    const cleanId = id.split('?')[0]
    if (!JS_LIKE_EXTENSION.test(cleanId)) return false
    const normalizedId = cleanId.replace(BACKSLASH_RE, '/')
    return normalizedId.includes('/src/blocks/') || normalizedId.startsWith('src/blocks/')
}

function generateDependencyAcceptCode(editImport: string | null, saveImport: string | null): string {
    const depImports: string[] = []
    let editIndex: number | null = null
    let saveIndex: number | null = null

    if (editImport) {
        editIndex = depImports.length
        depImports.push(editImport)
    }
    if (saveImport) {
        saveIndex = depImports.length
        depImports.push(saveImport)
    }

    if (depImports.length === 0) return ''

    const depsList = depImports.map((dep) => `'${dep}'`).join(', ')
    const editExpr = editIndex !== null ? `mods?.[${editIndex}]?.default ?? mods?.[${editIndex}]?.edit ?? edit` : 'edit'
    const saveExpr = saveIndex !== null ? `mods?.[${saveIndex}]?.default ?? mods?.[${saveIndex}]?.save ?? save` : 'save'

    return `
        const __wpvBlockDeps = [${depsList}]
        import.meta.hot.accept(__wpvBlockDeps, (mods) => {
            try {
                const nextEdit = ${editExpr}
                const nextSave = ${saveExpr}
                __wpvApplyBlockHmr({ meta, edit: nextEdit, save: nextSave })
            } catch (e) { __wpvHmrLogger.warn?.('[wp-vite] HMR dependency apply failed', e) }
        })
`
}

function generateMissingExports(code: string): string {
    const exportList = SYMBOLS.filter(
        ([, patterns]) => !patterns.exportedDecl.test(code) && !patterns.exportedList.test(code)
    ).map(([name]) => name)

    return exportList.length > 0 ? `export { ${exportList.join(', ')} }\n` : ''
}

export async function injectBlockHmrForBlocks(code: string, id: string, hmrLogger: string): Promise<string> {
    if (!shouldInjectBlockHmr(code, id)) {
        if (
            isBlockIndexModule(code, id) &&
            !code.includes('__wpvBareBlockHmr') &&
            !code.includes('__wpvApplyBlockHmr')
        ) {
            return code + '\n/* __wpvBareBlockHmr */\nif (import.meta.hot) { import.meta.hot.accept(() => {}) }\n'
        }
        return code
    }

    const editImport = findImportSource(code, EDIT)
    const saveImport = findImportSource(code, SAVE)
    const depAcceptCode = generateDependencyAcceptCode(editImport, saveImport)
    const exportLine = generateMissingExports(code)

    const template = await loadInjectionTemplate()
    const normalizedDepAccept = depAcceptCode.startsWith('\n') ? depAcceptCode.slice(1) : depAcceptCode
    const injection = template
        .replaceAll(HMR_LOGGER_PLACEHOLDER, hmrLogger)
        .replace(`${HMR_EXPORT_LINE_PLACEHOLDER}\n`, exportLine)
        .replace(`${HMR_DEP_ACCEPT_PLACEHOLDER}\n`, normalizedDepAccept)

    return code + injection
}

const HOOK_REGISTER_RE = /\badd(Filter|Action)\s*\(\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]/g

function isPluginModule(code: string, id: string): boolean {
    const cleanId = id.split('?')[0]
    if (!JS_LIKE_EXTENSION.test(cleanId)) return false
    const normalizedId = cleanId.replace(BACKSLASH_RE, '/')
    if (!normalizedId.includes('/src/plugins/') && !normalizedId.startsWith('src/plugins/')) return false
    return /\badd(Filter|Action)\s*\(/.test(code)
}

function extractRegisteredHooks(code: string): Array<{ api: string; hook: string; namespace: string }> {
    const hooks: Array<{ api: string; hook: string; namespace: string }> = []
    const seen = new Set<string>()
    let match: RegExpExecArray | null
    HOOK_REGISTER_RE.lastIndex = 0
    while ((match = HOOK_REGISTER_RE.exec(code)) !== null) {
        const api = match[1] === 'Filter' ? 'removeFilter' : 'removeAction'
        const key = `${api}|${match[2]}|${match[3]}`
        if (seen.has(key)) continue
        seen.add(key)
        hooks.push({ api, hook: match[2], namespace: match[3] })
    }
    return hooks
}

export function injectPluginHmr(code: string, id: string): string {
    if (code.includes('__wpvPluginHmr') || code.includes('__wpvApplyBlockHmr') || code.includes('__wpvBareBlockHmr')) {
        return code
    }
    if (!isPluginModule(code, id)) return code

    const hooks = extractRegisteredHooks(code)
    if (hooks.length === 0) return code

    const removals = hooks.map((h) => `h.${h.api}('${h.hook}', '${h.namespace}')`).join('; ')

    return (
        code +
        `
/* __wpvPluginHmr */
if (import.meta.hot) {
  import.meta.hot.accept(() => {})
  import.meta.hot.dispose(() => {
    try {
      const h = typeof window !== 'undefined' && window.wp && window.wp.hooks
      if (h) { ${removals} }
    } catch (e) {}
  })
}
`
    )
}

const loadHmrTemplate = createTemplateLoader(TEMPLATE_PATHS.hmr)

export async function addHmrCode(
    code: string,
    hmrLogger: string,
    hmrDebounceMs: number,
    editorCss: string
): Promise<string> {
    const template = await loadHmrTemplate()
    const hmrCode = template
        .replaceAll(HMR_LOGGER_PLACEHOLDER, hmrLogger)
        .replaceAll(HMR_DEBOUNCE_PLACEHOLDER, String(hmrDebounceMs))
        .replaceAll(HMR_ENTRY_CSS_PLACEHOLDER, editorCss)
    return hmrCode + '\n' + code
}

export function extractInternalImportSpecs(code: string): string[] {
    const importRegex = /import\s+(?:[^'"\n]+\s+from\s+)?['"]([^'"\n]+)['"];?/g
    const specs = new Set<string>()
    let match: RegExpExecArray | null

    while ((match = importRegex.exec(code)) !== null) {
        const spec = match[1]
        if (isInternalImport(spec)) {
            specs.add(spec)
        }
    }

    return Array.from(specs)
}

export function injectIndexDepsAccept(code: string, fsDeps: string[], hmrLogger: string): string {
    if (code.includes('wpv-accept-deps')) return code
    if (fsDeps.length === 0) return code

    const depsList = fsDeps.map((dep) => `'${dep}'`).join(', ')

    return (
        code +
        `
/* wpv-accept-deps */
var __wpvHmrLogger = __wpvHmrLogger ?? ${hmrLogger};
if (import.meta.hot) {
  import.meta.hot.accept([${depsList}], (mods) => {
    __wpvHmrLogger.debug?.('[wp-vite] HMR: accepted block dependency update', mods?.length ?? 0)
  })
}
`
    )
}
