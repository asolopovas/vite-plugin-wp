import fs from 'fs'
import { resolvePlaywrightArgs } from './playwright-args'
import { getAuthStatePath, resolveWpHost } from './test-utils'

const { isDevRun, isProdRun, viteMode } = resolvePlaywrightArgs()

async function verifyViteMode(host: string, expected: string): Promise<void> {
    const url = `${host}/wp-admin/admin-ajax.php?action=check_vite_dev_mode`
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) })
    if (!res.ok) {
        throw new Error(`Failed to verify VITE_MODE via admin-ajax (${res.status}). Is WordPress reachable at ${host}?`)
    }
    const info = await res.json()
    const expectedIsDev = expected === 'development'
    if (Boolean(info?.isDev) !== expectedIsDev) {
        throw new Error(`WordPress VITE_MODE mismatch. Expected ${expected}, got ${info?.isDev ? 'development' : 'production'}.`)
    }
}

async function verifyViteServer(port: number): Promise<void> {
    const url = `http://localhost:${port}/@vite/client`
    try {
        const res = await fetch(url, { signal: AbortSignal.timeout(2000) })
        if (!res.ok) throw new Error(`status ${res.status}`)
    } catch (e: any) {
        throw new Error(
            `Vite dev server not reachable at ${url}. ` +
            `Start it with "bun run dev" in the project under test before running @dev tests (${e.message}).`
        )
    }
}

async function globalSetup() {
    if (isDevRun && viteMode !== 'development') {
        throw new Error('Expected VITE_MODE=development for @dev runs.')
    }
    if (isProdRun && viteMode === 'development') {
        throw new Error('Expected VITE_MODE=production for @prod runs.')
    }

    const host = resolveWpHost()
    await verifyViteMode(host, viteMode)

    if (viteMode === 'development') {
        const port = Number(process.env.VITE_PORT ?? 5173)
        await verifyViteServer(port)
    }

    const authPath = getAuthStatePath()
    if (!fs.existsSync(authPath)) {
        throw new Error(
            `Auth state file not found at ${authPath}. ` +
            `Generate one (e.g. "make auth" in the project under test) or set WP_TEST_AUTH_PATH.`
        )
    }
}

export default globalSetup
