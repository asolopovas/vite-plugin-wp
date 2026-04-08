import * as fs from 'fs'

export function readTemplateFile(templatePath: string): Promise<string> {
    const bun = (globalThis as { Bun?: { file: (p: string) => { text: () => Promise<string> } } }).Bun
    return bun?.file ? bun.file(templatePath).text() : fs.promises.readFile(templatePath, 'utf8')
}

export function createTemplateLoader(templatePath: string): () => Promise<string> {
    let cached: string | null = null
    let pending: Promise<string> | null = null

    return () => {
        if (cached) return Promise.resolve(cached)
        if (pending) return pending
        pending = readTemplateFile(templatePath)
            .then((content) => {
                cached = content
                pending = null
                return content
            })
            .catch((err) => {
                pending = null
                throw err
            })
        return pending
    }
}
