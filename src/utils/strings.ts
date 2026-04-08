export const kebabToCamel = (str: string): string =>
    str.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())

export const fixMemberAliases = (members: string): string =>
    members.replace(/\s+as\s+/g, ': ')

export const wordpressPackageToGlobal = (pkg: string): string =>
    'wp.' + kebabToCamel(pkg)
