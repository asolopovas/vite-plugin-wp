import { fixMemberAliases } from '../utils/strings.js'

type ImportTransform = {
    pattern: RegExp
    replace: (substring: string, ...args: string[]) => string
}

function transformsFor(module: string, namespaceName: string): ImportTransform[] {
    const from = `\\s+from\\s+['"]${module}['"];?`
    return [
        {
            pattern: new RegExp(`import\\s+(\\w+)\\s*,\\s*{([^}]+)}${from}`, 'g'),
            replace: (_, name, members) =>
                `const ${name} = wp.element;\nconst {${fixMemberAliases(members)}} = wp.element;`,
        },
        {
            pattern: new RegExp(`import\\s+\\*\\s+as\\s+${namespaceName}${from}`, 'g'),
            replace: () => `const ${namespaceName} = wp.element;`,
        },
        {
            pattern: new RegExp(`import\\s+${namespaceName}${from}`, 'g'),
            replace: () => `const ${namespaceName} = wp.element;`,
        },
        {
            pattern: new RegExp(`import\\s+{([^}]+)}${from}`, 'g'),
            replace: (_, members) => `const {${fixMemberAliases(members)}} = wp.element;`,
        },
    ]
}

const REACT_IMPORT_TRANSFORMS = [...transformsFor('react', 'React'), ...transformsFor('react-dom', 'ReactDOM')]

export function transformReactImports(code: string): string {
    if (!code.includes('react')) return code
    return REACT_IMPORT_TRANSFORMS.reduce((result, t) => result.replace(t.pattern, t.replace), code)
}
