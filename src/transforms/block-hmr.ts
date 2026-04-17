import {
    HMR_DEP_ACCEPT_PLACEHOLDER,
    HMR_EXPORT_LINE_PLACEHOLDER,
    HMR_LOGGER_PLACEHOLDER,
    JS_LIKE_EXTENSION,
    TEMPLATE_PATHS,
} from '../constants.js'
import { createTemplateLoader } from '../utils/templates.js'

const loadInjectionTemplate = createTemplateLoader(TEMPLATE_PATHS.blockHmrInjection)

const EDIT_SYMBOL_DECL_RE = /\bexport\s+const\s+edit\b|\bconst\s+edit\b/
const EDIT_SYMBOL_DEFAULT_IMPORT_RE = /\bimport\s+edit\s+from\b/
const EDIT_SYMBOL_NAMED_IMPORT_RE = /\bimport\s*{[^}]*\bedit\b[^}]*}\s+from\b/
const SAVE_SYMBOL_DECL_RE = /\bexport\s+const\s+save\b|\bconst\s+save\b/
const SAVE_SYMBOL_DEFAULT_IMPORT_RE = /\bimport\s+save\s+from\b/
const SAVE_SYMBOL_NAMED_IMPORT_RE = /\bimport\s*{[^}]*\bsave\b[^}]*}\s+from\b/

const EDIT_DEFAULT_SOURCE_RE = /import\s+edit\s+from\s+['"]([^'"]+)['"]/
const EDIT_NAMED_SOURCE_RE = /import\s*{[^}]*\bedit\b[^}]*}\s+from\s+['"]([^'"]+)['"]/
const SAVE_DEFAULT_SOURCE_RE = /import\s+save\s+from\s+['"]([^'"]+)['"]/
const SAVE_NAMED_SOURCE_RE = /import\s*{[^}]*\bsave\b[^}]*}\s+from\s+['"]([^'"]+)['"]/

const META_DECL_RE = /\bexport\s+const\s+meta\b|\bconst\s+meta\b/
const BACKSLASH_RE = /\\/g

function hasEditSymbol(code: string): boolean {
    return EDIT_SYMBOL_DECL_RE.test(code)
        || EDIT_SYMBOL_DEFAULT_IMPORT_RE.test(code)
        || EDIT_SYMBOL_NAMED_IMPORT_RE.test(code)
}

function hasSaveSymbol(code: string): boolean {
    return SAVE_SYMBOL_DECL_RE.test(code)
        || SAVE_SYMBOL_DEFAULT_IMPORT_RE.test(code)
        || SAVE_SYMBOL_NAMED_IMPORT_RE.test(code)
}

function isInternalImport(spec: string): boolean {
    if (spec.startsWith('@wordpress/')) return false
    return spec.startsWith('.') || spec.startsWith('@') || spec.startsWith('/')
}

function findImportSource(code: string, defaultRe: RegExp, namedRe: RegExp): string | null {
    const defaultMatch = code.match(defaultRe)
    if (defaultMatch?.[1] && isInternalImport(defaultMatch[1])) {
        return defaultMatch[1]
    }

    const namedMatch = code.match(namedRe)
    if (namedMatch?.[1] && isInternalImport(namedMatch[1])) {
        return namedMatch[1]
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

    if (!META_DECL_RE.test(code)) return false
    if (!hasEditSymbol(code)) return false
    if (!hasSaveSymbol(code)) return false

    return true
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

    const depsList = depImports.map(dep => `'${dep}'`).join(', ')
    const editExpr = editIndex !== null
        ? `mods?.[${editIndex}]?.default ?? mods?.[${editIndex}]?.edit ?? edit`
        : 'edit'
    const saveExpr = saveIndex !== null
        ? `mods?.[${saveIndex}]?.default ?? mods?.[${saveIndex}]?.save ?? save`
        : 'save'

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

const EXPORTED_META_DECL_RE = /\bexport\s+(?:const|function|class)\s+meta\b/
const EXPORTED_META_LIST_RE = /\bexport\s*{\s*[^}]*\bmeta\b[^}]*}\s*;?/
const EXPORTED_EDIT_DECL_RE = /\bexport\s+(?:const|function|class)\s+edit\b/
const EXPORTED_EDIT_LIST_RE = /\bexport\s*{\s*[^}]*\bedit\b[^}]*}\s*;?/
const EXPORTED_SAVE_DECL_RE = /\bexport\s+(?:const|function|class)\s+save\b/
const EXPORTED_SAVE_LIST_RE = /\bexport\s*{\s*[^}]*\bsave\b[^}]*}\s*;?/

function generateMissingExports(code: string): string {
    const exportList: string[] = []

    if (!EXPORTED_META_DECL_RE.test(code) && !EXPORTED_META_LIST_RE.test(code)) exportList.push('meta')
    if (!EXPORTED_EDIT_DECL_RE.test(code) && !EXPORTED_EDIT_LIST_RE.test(code)) exportList.push('edit')
    if (!EXPORTED_SAVE_DECL_RE.test(code) && !EXPORTED_SAVE_LIST_RE.test(code)) exportList.push('save')

    return exportList.length > 0 ? `export { ${exportList.join(', ')} }\n` : ''
}

export async function injectBlockHmrForBlocks(
    code: string,
    id: string,
    hmrLogger: string,
): Promise<string> {
    if (!shouldInjectBlockHmr(code, id)) return code

    const editImport = findImportSource(code, EDIT_DEFAULT_SOURCE_RE, EDIT_NAMED_SOURCE_RE)
    const saveImport = findImportSource(code, SAVE_DEFAULT_SOURCE_RE, SAVE_NAMED_SOURCE_RE)
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

const loadHmrTemplate = createTemplateLoader(TEMPLATE_PATHS.hmr)

export async function addHmrCode(code: string, hmrLogger: string, hmrDebounceMs: number): Promise<string> {
    const template = await loadHmrTemplate()
    const hmrCode = template
        .replaceAll(HMR_LOGGER_PLACEHOLDER, hmrLogger)
        .replaceAll('__WPV_HMR_DEBOUNCE_MS__', String(hmrDebounceMs))
    return hmrCode + '\n' + code
}
