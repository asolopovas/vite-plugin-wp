import * as fs from 'fs'

export const kebabToCamel = (str: string): string => str.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())

export const fixMemberAliases = (members: string): string => members.replace(/\s+as\s+/g, ': ')

export const wordpressPackageToGlobal = (pkg: string): string => 'wp.' + kebabToCamel(pkg)

export function generateContentHash(content: string): string {
    let hash = 0
    for (let i = 0; i < content.length; i++) {
        hash = (hash << 5) - hash + content.charCodeAt(i)
        hash = hash & hash
    }
    return Math.abs(hash).toString(16).substring(0, 8)
}

export function createTemplateLoader(templatePath: string): () => Promise<string> {
    let pending: Promise<string> | null = null

    return () => {
        pending ??= fs.promises.readFile(templatePath, 'utf8').catch((err) => {
            pending = null
            throw err
        })
        return pending
    }
}

type Callback = () => void

const callbacks = new Set<Callback>()
let installed = false

function runAll(): void {
    for (const cb of callbacks) {
        try {
            cb()
        } catch {}
    }
    callbacks.clear()
}

export function onProcessExit(callback: Callback): void {
    callbacks.add(callback)
    if (installed) return
    installed = true

    const onSignal = () => {
        runAll()
        process.exit(0)
    }
    process.once('SIGINT', onSignal)
    process.once('SIGTERM', onSignal)
    process.once('SIGHUP', onSignal)
    process.once('exit', runAll)
}
