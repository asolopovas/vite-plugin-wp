import { WORDPRESS_BUNDLED_PACKAGES } from '../constants.js'
import { fixMemberAliases, kebabToCamel, wordpressPackageToGlobal } from '../utils/strings.js'

type ImportReplacementTransform = { pattern: RegExp; replacement: string }
type ImportReplacerTransform = {
    pattern: RegExp
    replacer: (substring: string, ...args: string[]) => string
}
type ImportTransform = ImportReplacementTransform | ImportReplacerTransform

const WORDPRESS_IMPORT_TRANSFORMS: ImportTransform[] = [
    {
        pattern: /import\s+{([^}]+)}\s+from\s+['"]@wordpress\/([\w-]+)['"];?/g,
        replacer: (match: string, members: string, pkg: string) => {
            if (WORDPRESS_BUNDLED_PACKAGES.has(pkg)) return match
            const wpProp = kebabToCamel(pkg)
            const fixedMembers = fixMemberAliases(members)
            return `const {${fixedMembers}} = wp.${wpProp};`
        },
    },
    {
        pattern: /import\s+(\w+)\s+from\s+['"]@wordpress\/([\w-]+)['"];?/g,
        replacer: (match: string, name: string, pkg: string) => {
            if (WORDPRESS_BUNDLED_PACKAGES.has(pkg)) return match
            const wpProp = kebabToCamel(pkg)
            return `const ${name} = wp.${wpProp};`
        },
    },
    {
        pattern: /import\s+\*\s+as\s+(\w+)\s+from\s+['"]@wordpress\/([\w-]+)['"];?/g,
        replacer: (match: string, name: string, pkg: string) => {
            if (WORDPRESS_BUNDLED_PACKAGES.has(pkg)) return match
            const wpProp = kebabToCamel(pkg)
            return `const ${name} = wp.${wpProp};`
        },
    },
]

export function transformWordpressImports(code: string): string {
    return WORDPRESS_IMPORT_TRANSFORMS.reduce((result, t) => {
        if ('replacement' in t) return result.replace(t.pattern, t.replacement)
        return result.replace(t.pattern, t.replacer)
    }, code)
}

export function rewriteWordpressImportsToGlobals(code: string): string | null {
    if (!code.includes('@wordpress/')) return null

    const importPattern = /import\s*(?:(\*\s+as\s+\w+|\w+|\{[^}]*\})(?:\s*,\s*(\*\s+as\s+\w+|\w+|\{[^}]*\}))?)\s*from\s*['"]@wordpress\/([\w-]+)['"];?/g

    let didRewrite = false
    const out = code.replace(importPattern, (_match: string, first: string, second: string | undefined, pkg: string) => {
        if (WORDPRESS_BUNDLED_PACKAGES.has(pkg)) return _match
        didRewrite = true
        const global = wordpressPackageToGlobal(pkg)
        const decls: string[] = []
        const handle = (clause: string) => {
            if (clause.startsWith('*')) {
                const name = clause.replace(/^\*\s+as\s+/, '').trim()
                decls.push(`const ${name}=${global};`)
            } else if (clause.startsWith('{')) {
                const inner = clause.slice(1, -1).trim()
                if (inner) decls.push(`const{${fixMemberAliases(inner)}}=${global};`)
            } else {
                decls.push(`const ${clause.trim()}=${global};`)
            }
        }
        handle(first)
        if (second) handle(second)
        return decls.join('')
    })

    return didRewrite ? out : null
}
