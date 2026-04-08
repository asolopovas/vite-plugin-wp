import * as fs from 'fs'
import * as path from 'path'
import type { ConfigEnv, Plugin, UserConfig, ViteDevServer } from 'vite'
import { DEFAULT_DEV_SERVER_HOST, DEFAULT_DEV_SERVER_PORT } from './constants.js'

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
            const distDir = path.dirname(absoluteHotFile)
            if (!fs.existsSync(distDir)) {
                fs.mkdirSync(distDir, { recursive: true })
            }

            const port = server.config.server.port || DEFAULT_DEV_SERVER_PORT
            const configHost = server.config.server.host || DEFAULT_DEV_SERVER_HOST
            const host = configHost === '0.0.0.0' || configHost === true ? 'localhost' : configHost
            fs.writeFileSync(absoluteHotFile, `http://${host}:${port}`)

            server.httpServer?.on('close', cleanup)
            process.on('SIGTERM', cleanup)
            process.on('SIGINT', cleanup)
        },
    }
}
