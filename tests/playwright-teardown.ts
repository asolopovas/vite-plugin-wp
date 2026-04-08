import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'
import { resolvePlaywrightArgs } from './playwright-args'
import { getMetaDir, resolvePluginRoot, resolveProjectRoot } from './test-utils'

const PLUGIN_ROOT = resolvePluginRoot()
const FIXTURE_ROOT = resolveProjectRoot()
const META_DIR = getMetaDir()

const VITE_PID_FILE = path.join(META_DIR, 'vite.pid')
const HOT_FILE = path.join(FIXTURE_ROOT, 'static/build/hot')

function stopViteProcess(): void {
    if (!fs.existsSync(VITE_PID_FILE)) return
    try {
        const pid = Number(fs.readFileSync(VITE_PID_FILE, 'utf-8').trim())
        if (pid && !Number.isNaN(pid)) {
            try { process.kill(-pid, 'SIGTERM') } catch (e: any) {
                if (e.code !== 'ESRCH') {
                    try { process.kill(pid, 'SIGTERM') } catch {}
                }
            }
        }
    } finally {
        try { fs.unlinkSync(VITE_PID_FILE) } catch {}
    }
    try { fs.unlinkSync(HOT_FILE) } catch {}
}

function stopWpEnv(): void {
    if (process.env.WP_ENV_KEEP_RUNNING !== '0') return
    const { isProdRun, isDevRun } = resolvePlaywrightArgs()
    if (isProdRun && !isDevRun) return
    try {
        execSync('bun x wp-env stop', { cwd: PLUGIN_ROOT, stdio: 'inherit' })
    } catch {}
}

async function globalTeardown() {
    stopViteProcess()
    stopWpEnv()
}

export default globalTeardown
