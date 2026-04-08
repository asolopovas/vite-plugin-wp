import * as fs from 'fs'
import * as path from 'path'
import type { Plugin } from 'vite'

export function envModePlugin(envFile: string, baseDir: string): Plugin {
    const absoluteEnvFile = path.isAbsolute(envFile) ? envFile : path.resolve(baseDir, envFile)
    let restored = false

    const setEnvViteMode = (mode: 'development' | 'production'): void => {
        if (!fs.existsSync(absoluteEnvFile)) return
        const contents = fs.readFileSync(absoluteEnvFile, 'utf-8')
        const line = `VITE_MODE=${mode}`
        const next = /^VITE_MODE=.*$/m.test(contents)
            ? contents.replace(/^VITE_MODE=.*$/m, line)
            : `${contents.trimEnd()}\n${line}\n`
        if (next !== contents) fs.writeFileSync(absoluteEnvFile, next, 'utf-8')
    }

    const restore = () => {
        if (restored) return
        restored = true
        setEnvViteMode('production')
    }

    return {
        name: 'vite-plugin-wp:env-mode',
        apply: 'serve',
        configureServer(server) {
            setEnvViteMode('development')
            const onSignal = () => { restore(); process.exit(0) }
            process.once('SIGINT', onSignal)
            process.once('SIGTERM', onSignal)
            process.once('SIGHUP', onSignal)
            process.once('beforeExit', restore)
            process.once('exit', restore)
            server.httpServer?.once('close', restore)
        },
    }
}
