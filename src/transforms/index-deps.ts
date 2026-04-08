import * as path from 'path'
import { isBlockIndexEntry } from '../constants.js'

function extractRelativeImports(code: string): Set<string> {
    const importRegex = /import\s+(?:[^'"\n]+\s+from\s+)?['"](\.[^'"\n]+)['"];?/g
    const deps = new Set<string>()
    let match: RegExpExecArray | null

    while ((match = importRegex.exec(code)) !== null) {
        const spec = match[1]
        if (spec.startsWith('./') || spec.startsWith('../')) {
            deps.add(spec)
        }
    }

    return deps
}

export function injectIndexDepsAccept(code: string, id: string, hmrLogger: string, isBuild: boolean): string {
    if (isBuild) return code
    if (!isBlockIndexEntry(id)) return code
    if (code.includes('wpv-accept-deps')) return code

    const deps = extractRelativeImports(code)
    if (deps.size === 0) return code

    const importerFsPath = id.startsWith('/@fs/') ? id.slice('/@fs'.length) : id
    const importerDir = path.dirname(importerFsPath)

    const depsList = Array.from(deps)
        .map((spec) => `'/@fs${path.resolve(importerDir, spec)}'`)
        .join(', ')

    return code + `
var __wpvHmrLogger = __wpvHmrLogger ?? ${hmrLogger};
if (import.meta.hot) {
  import.meta.hot.accept([${depsList}], (mods) => {
    __wpvHmrLogger.debug?.('[wp-vite] HMR: accepted block dependency update', mods?.length ?? 0)
  })
}
`
}
