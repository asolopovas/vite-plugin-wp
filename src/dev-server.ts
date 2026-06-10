import * as fs from 'fs'
import * as path from 'path'
import type { ConfigEnv, Plugin, UserConfig, ViteDevServer } from 'vite'
import { DEFAULT_DEV_SERVER_HOST, DEFAULT_DEV_SERVER_PORT } from './constants.js'
import { onProcessExit } from './utils.js'

const serverEpochs = new Map<string, number>()

function nextEpoch(key: string): number {
    const epoch = (serverEpochs.get(key) ?? 0) + 1
    serverEpochs.set(key, epoch)
    return epoch
}

export function hotFilePlugin(hotFile: string, baseDir: string): Plugin {
    const absoluteHotFile = path.isAbsolute(hotFile) ? hotFile : path.resolve(baseDir, hotFile)
    let isBuild = false

    const cleanup = () => {
        if (fs.existsSync(absoluteHotFile)) {
            fs.unlinkSync(absoluteHotFile)
        }
    }

    return {
        name: 'vite-plugin-wp:hot-file',
        config(_config: UserConfig, env: ConfigEnv) {
            isBuild = env.command === 'build'
        },
        buildStart() {
            if (isBuild) cleanup()
        },
        configureServer(server: ViteDevServer) {
            const epoch = nextEpoch(absoluteHotFile)

            const distDir = path.dirname(absoluteHotFile)
            if (!fs.existsSync(distDir)) {
                fs.mkdirSync(distDir, { recursive: true })
            }

            const port = server.config.server.port || DEFAULT_DEV_SERVER_PORT
            const configHost = server.config.server.host || DEFAULT_DEV_SERVER_HOST
            const host = configHost === '0.0.0.0' || configHost === true ? 'localhost' : configHost
            fs.writeFileSync(absoluteHotFile, `http://${host}:${port}`)

            server.httpServer?.once('close', () => {
                if (serverEpochs.get(absoluteHotFile) === epoch) cleanup()
            })
            onProcessExit(cleanup)
        },
    }
}

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
            const epoch = nextEpoch(absoluteEnvFile)

            setEnvViteMode('development')

            server.httpServer?.once('close', () => {
                if (serverEpochs.get(absoluteEnvFile) === epoch) restore()
            })
            onProcessExit(restore)
        },
    }
}
