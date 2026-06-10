import * as fs from 'fs'
import * as path from 'path'
import type { Plugin } from 'vite'
import { onProcessExit } from './utils/process-exit.js'

const serverEpochs = new Map<string, number>()

export function envModePlugin(envFile: string, baseDir: string): Plugin {
    const absoluteEnvFile = path.isAbsolute(envFile) ? envFile : path.resolve(baseDir, envFile)

    const setEnvViteMode = (mode: 'development' | 'production'): void => {
        if (!fs.existsSync(absoluteEnvFile)) return
        const contents = fs.readFileSync(absoluteEnvFile, 'utf-8')
        const line = `VITE_MODE=${mode}`
        const next = /^VITE_MODE=.*$/m.test(contents)
            ? contents.replace(/^VITE_MODE=.*$/m, line)
            : `${contents.trimEnd()}\n${line}\n`
        if (next !== contents) fs.writeFileSync(absoluteEnvFile, next, 'utf-8')
    }

    const restore = () => setEnvViteMode('production')

    return {
        name: 'vite-plugin-wp:env-mode',
        apply: 'serve',
        configureServer(server) {
            const epoch = (serverEpochs.get(absoluteEnvFile) ?? 0) + 1
            serverEpochs.set(absoluteEnvFile, epoch)

            setEnvViteMode('development')

            server.httpServer?.once('close', () => {
                if (serverEpochs.get(absoluteEnvFile) === epoch) restore()
            })
            onProcessExit(restore)
        },
    }
}
