import {
    HMR_DEP_ACCEPT_PLACEHOLDER,
    HMR_EXPORT_LINE_PLACEHOLDER,
    HMR_LOGGER_PLACEHOLDER,
    JS_LIKE_EXTENSION,
    TEMPLATE_PATHS,
} from '../constants.js'
import { createTemplateLoader } from '../utils/templates.js'

const loadInjectionTemplate = createTemplateLoader(TEMPLATE_PATHS.blockHmrInjection)

function hasEditOrSaveSymbol(code: string, name: string): boolean {
    return (
        new RegExp(`\\bexport\\s+const\\s+${name}\\b|\\bconst\\s+${name}\\b`).test(code) ||
        new RegExp(`\\bimport\\s+${name}\\s+from\\b`).test(code) ||
        new RegExp(`\\bimport\\s*{[^}]*\\b${name}\\b[^}]*}\\s+from\\b`).test(code)
    )
}

function isInternalImport(spec: string): boolean {
    if (spec.startsWith('@wordpress/')) return false
    return spec.startsWith('.') || spec.startsWith('@') || spec.startsWith('/')
}

function findImportSource(code: string, localName: string): string | null {
    const defaultRegex = new RegExp(`import\\s+${localName}\\s+from\\s+['"]([^'"]+)['"]`)
    const namedRegex = new RegExp(`import\\s*{[^}]*\\b${localName}\\b[^}]*}\\s+from\\s+['"]([^'"]+)['"]`)

    const defaultMatch = code.match(defaultRegex)
    if (defaultMatch?.[1] && isInternalImport(defaultMatch[1])) {
        return defaultMatch[1]
    }

    const namedMatch = code.match(namedRegex)
    if (namedMatch?.[1] && isInternalImport(namedMatch[1])) {
        return namedMatch[1]
    }

    return null
}

function shouldInjectBlockHmr(code: string, id: string): boolean {
    const cleanId = id.split('?')[0]
    const normalizedId = cleanId.replace(/\\/g, '/')
    const isJsLike = JS_LIKE_EXTENSION.test(cleanId)
    const isBlockSrc = normalizedId.includes('/src/blocks/') || normalizedId.startsWith('src/blocks/')

    if (!isJsLike || !isBlockSrc) return false
    if (!code.includes('registerBlockType')) return false

    const hasMeta = /\bexport\s+const\s+meta\b|\bconst\s+meta\b/.test(code)
    const hasEdit = hasEditOrSaveSymbol(code, 'edit')
    const hasSave = hasEditOrSaveSymbol(code, 'save')

    if (!(hasMeta && hasEdit && hasSave)) return false
    if (code.includes('__wpvApplyBlockHmr') || code.includes('__wpvSetupBlockHmr')) return false

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

function generateMissingExports(code: string): string {
    const exportList: string[] = []

    const hasExportedMeta = /\bexport\s+(?:const|function|class)\s+meta\b/.test(code) ||
        /\bexport\s*{\s*[^}]*\bmeta\b[^}]*}\s*;?/.test(code)
    const hasExportedEdit = /\bexport\s+(?:const|function|class)\s+edit\b/.test(code) ||
        /\bexport\s*{\s*[^}]*\bedit\b[^}]*}\s*;?/.test(code)
    const hasExportedSave = /\bexport\s+(?:const|function|class)\s+save\b/.test(code) ||
        /\bexport\s*{\s*[^}]*\bsave\b[^}]*}\s*;?/.test(code)

    if (!hasExportedMeta) exportList.push('meta')
    if (!hasExportedEdit) exportList.push('edit')
    if (!hasExportedSave) exportList.push('save')

    return exportList.length > 0 ? `export { ${exportList.join(', ')} }\n` : ''
}

export async function injectBlockHmrForBlocks(
    code: string,
    id: string,
    hmrLogger: string,
): Promise<string> {
    if (!shouldInjectBlockHmr(code, id)) return code

    const editImport = findImportSource(code, 'edit')
    const saveImport = findImportSource(code, 'save')
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
