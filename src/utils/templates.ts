import * as fs from 'fs'

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
