import { WORDPRESS_BUNDLED_PACKAGES } from '../constants.js'
import { fixMemberAliases, wordpressPackageToGlobal } from '../utils/strings.js'

const globalNameCache = new Map<string, string>()
const globalFor = (pkg: string): string => {
    let g = globalNameCache.get(pkg)
    if (g === undefined) {
        g = wordpressPackageToGlobal(pkg)
        globalNameCache.set(pkg, g)
    }
    return g
}

const WP_NAMED_RE = /import\s+{([^}]+)}\s+from\s+['"]@wordpress\/([\w-]+)['"];?/g
const WP_DEFAULT_RE = /import\s+(\w+)\s+from\s+['"]@wordpress\/([\w-]+)['"];?/g
const WP_NAMESPACE_RE = /import\s+\*\s+as\s+(\w+)\s+from\s+['"]@wordpress\/([\w-]+)['"];?/g

export function transformWordpressImports(code: string): string {
    if (!code.includes('@wordpress/')) return code
    let result = code
    result = result.replace(WP_NAMED_RE, (match, members: string, pkg: string) => {
        if (WORDPRESS_BUNDLED_PACKAGES.has(pkg)) return match
        return `const {${fixMemberAliases(members)}} = ${globalFor(pkg)};`
    })
    result = result.replace(WP_DEFAULT_RE, (match, name: string, pkg: string) => {
        if (WORDPRESS_BUNDLED_PACKAGES.has(pkg)) return match
        return `const ${name} = ${globalFor(pkg)};`
    })
    result = result.replace(WP_NAMESPACE_RE, (match, name: string, pkg: string) => {
        if (WORDPRESS_BUNDLED_PACKAGES.has(pkg)) return match
        return `const ${name} = ${globalFor(pkg)};`
    })
    return result
}

const WP_SINGLE_CLAUSE_RE = /import\s+(\*\s+as\s+\w+|\w+|\{[^}]*\})\s+from\s+['"]@wordpress\/([\w-]+)['"];?/g
const WP_DUAL_CLAUSE_RE = /import\s+(\w+)\s*,\s*\{([^}]+)\}\s+from\s+['"]@wordpress\/([\w-]+)['"];?/g
const NAMESPACE_STRIP_RE = /^\*\s+as\s+/

function declFor(clause: string, global: string): string {
    if (clause.startsWith('*')) {
        const name = clause.replace(NAMESPACE_STRIP_RE, '').trim()
        return `const ${name}=${global};`
    }
    if (clause.startsWith('{')) {
        const inner = clause.slice(1, -1).trim()
        return inner ? `const{${fixMemberAliases(inner)}}=${global};` : ''
    }
    return `const ${clause.trim()}=${global};`
}

export function rewriteWordpressImportsToGlobals(code: string): string | null {
    if (!code.includes('@wordpress/')) return null

    let didRewrite = false

    let out = code.replace(WP_DUAL_CLAUSE_RE, (match, def: string, named: string, pkg: string) => {
        if (WORDPRESS_BUNDLED_PACKAGES.has(pkg)) return match
        didRewrite = true
        const global = globalFor(pkg)
        return `const ${def.trim()}=${global};const{${fixMemberAliases(named)}}=${global};`
    })

    out = out.replace(WP_SINGLE_CLAUSE_RE, (match, clause: string, pkg: string) => {
        if (WORDPRESS_BUNDLED_PACKAGES.has(pkg)) return match
        didRewrite = true
        return declFor(clause, globalFor(pkg))
    })

    return didRewrite ? out : null
}
