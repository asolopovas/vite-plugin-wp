import { fixMemberAliases } from '../utils/strings.js'

type ImportReplacementTransform = { pattern: RegExp; replacement: string }
type ImportReplacerTransform = {
    pattern: RegExp
    replacer: (substring: string, ...args: string[]) => string
}
type ImportTransform = ImportReplacementTransform | ImportReplacerTransform

const REACT_IMPORT_TRANSFORMS: ImportTransform[] = [
    {
        pattern: /import\s+(\w+)\s*,\s*{([^}]+)}\s+from\s+['"]react['"];?/g,
        replacer: (_: string, name: string, members: string) => {
            const fixedMembers = fixMemberAliases(members)
            return `const ${name} = wp.element;\nconst {${fixedMembers}} = wp.element;`
        },
    },
    {
        pattern: /import\s+\*\s+as\s+React\s+from\s+['"]react['"];?/g,
        replacement: 'const React = wp.element;',
    },
    {
        pattern: /import\s+React\s+from\s+['"]react['"];?/g,
        replacement: 'const React = wp.element;',
    },
    {
        pattern: /import\s+{([^}]+)}\s+from\s+['"]react['"];?/g,
        replacer: (_: string, members: string) => {
            const fixedMembers = fixMemberAliases(members)
            return `const {${fixedMembers}} = wp.element;`
        },
    },
    {
        pattern: /import\s+(\w+)\s*,\s*{([^}]+)}\s+from\s+['"]react-dom['"];?/g,
        replacer: (_: string, name: string, members: string) => {
            const fixedMembers = fixMemberAliases(members)
            return `const ${name} = wp.element;\nconst {${fixedMembers}} = wp.element;`
        },
    },
    {
        pattern: /import\s+\*\s+as\s+ReactDOM\s+from\s+['"]react-dom['"];?/g,
        replacement: 'const ReactDOM = wp.element;',
    },
    {
        pattern: /import\s+ReactDOM\s+from\s+['"]react-dom['"];?/g,
        replacement: 'const ReactDOM = wp.element;',
    },
    {
        pattern: /import\s+{([^}]+)}\s+from\s+['"]react-dom['"];?/g,
        replacer: (_: string, members: string) => {
            const fixedMembers = fixMemberAliases(members)
            return `const {${fixedMembers}} = wp.element;`
        },
    },
]

export function transformReactImports(code: string): string {
    if (!code.includes('react')) return code
    return REACT_IMPORT_TRANSFORMS.reduce((result, t) => {
        if ('replacement' in t) return result.replace(t.pattern, t.replacement)
        return result.replace(t.pattern, t.replacer)
    }, code)
}
