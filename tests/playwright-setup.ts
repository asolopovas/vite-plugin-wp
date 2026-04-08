import { execSync, spawn, ChildProcess } from 'child_process'
import fs from 'fs'
import path from 'path'
import { chromium } from '@playwright/test'
import { resolvePlaywrightArgs } from './playwright-args'
import { readCache, writeCache } from './cache'
import {
    DEFAULT_ADMIN_PASSWORD,
    DEFAULT_ADMIN_USER,
    getAuthStatePath,
    getMetaDir,
    resolvePluginRoot,
    resolveProjectRoot,
    resolveWpHost,
} from './test-utils'

const { isDevRun, isProdRun, viteMode } = resolvePlaywrightArgs()

const PLUGIN_ROOT = resolvePluginRoot()
const FIXTURE_ROOT = resolveProjectRoot()
const WP_ENV_HOST = resolveWpHost()
const META_DIR = getMetaDir()
const WP_ENV_AUTH_PATH = getAuthStatePath()

const PATHS = {
    pluginDist: path.join(PLUGIN_ROOT, 'dist/index.js'),
    fixtureManifest: path.join(FIXTURE_ROOT, 'static/build/manifest.json'),
    fixtureHotFile: path.join(FIXTURE_ROOT, 'static/build/hot'),
    vitePid: path.join(META_DIR, 'vite.pid'),
}

const SOURCE_PATHS = [
    path.join(FIXTURE_ROOT, 'src'),
    path.join(FIXTURE_ROOT, 'vite.config.ts'),
    path.join(FIXTURE_ROOT, 'package.json'),
    path.join(PLUGIN_ROOT, 'dist'),
]

const VITE_START_TIMEOUT_MS = Number(process.env.VITE_START_TIMEOUT_MS) || 30000
const WP_ENV_TIMEOUT_MS = Number(process.env.WP_ENV_TIMEOUT_MS) || 120000

function log(msg: string): void {
    process.stdout.write(`[e2e-bootstrap] ${msg}\n`)
}

function getLatestMtimeMs(paths: string[]): number {
    let latest = 0
    const stack = [...paths]
    while (stack.length) {
        const current = stack.pop()!
        let stats: fs.Stats
        try { stats = fs.statSync(current) } catch { continue }
        if (stats.isFile()) { latest = Math.max(latest, stats.mtimeMs); continue }
        if (!stats.isDirectory()) continue
        let dir: fs.Dir
        try { dir = fs.opendirSync(current) } catch { continue }
        try {
            let entry: fs.Dirent | null
            while ((entry = dir.readSync())) {
                const childPath = path.join(current, entry.name)
                if (entry.isDirectory()) stack.push(childPath)
                else if (entry.isFile()) {
                    try { latest = Math.max(latest, fs.statSync(childPath).mtimeMs) } catch {}
                }
            }
        } finally { try { dir.closeSync() } catch {} }
    }
    return latest
}

function isFixtureBuildStale(): boolean {
    if (process.env.WP_TEST_SKIP_BUILD === '1') return false
    if (process.env.WP_TEST_FORCE_BUILD === '1') return true
    let manifestMtime = 0
    try { manifestMtime = fs.statSync(PATHS.fixtureManifest).mtimeMs } catch { return true }
    return getLatestMtimeMs(SOURCE_PATHS) > manifestMtime
}

async function fetchStatus(url: string, timeoutMs = 2000): Promise<number> {
    try {
        const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) })
        return res.status
    } catch { return 0 }
}

async function fetchOk(url: string, timeoutMs = 2000): Promise<boolean> {
    const status = await fetchStatus(url, timeoutMs)
    return status >= 200 && status < 400
}

async function waitFor(
    check: () => Promise<boolean>,
    maxWaitMs: number,
    intervalMs = 500
): Promise<boolean> {
    const start = Date.now()
    while (Date.now() - start < maxWaitMs) {
        if (await check()) return true
        await new Promise(r => setTimeout(r, intervalMs))
    }
    return false
}

function ensurePluginBuilt(): void {
    if (fs.existsSync(PATHS.pluginDist)) return
    log('Building @asolopovas/vite-plugin-wp (dist/ missing)')
    execSync('bun run build', { cwd: PLUGIN_ROOT, stdio: 'inherit' })
}

async function isWpEnvReady(): Promise<boolean> {
    const targets = [
        `${WP_ENV_HOST}/wp-json/`,
        `${WP_ENV_HOST}/?rest_route=/`,
        `${WP_ENV_HOST}/wp-login.php`,
    ]
    for (const url of targets) {
        const status = await fetchStatus(url)
        if (status > 0 && status < 500) return true
    }
    return false
}

async function ensureWpEnvStarted(): Promise<void> {
    if (await isWpEnvReady()) {
        log(`wp-env already running at ${WP_ENV_HOST}`)
        return
    }
    log('Starting wp-env (first boot can take a couple minutes)')
    execSync('bun x wp-env start', { cwd: PLUGIN_ROOT, stdio: 'inherit' })
    const ready = await waitFor(isWpEnvReady, WP_ENV_TIMEOUT_MS)
    if (!ready) throw new Error(`wp-env did not become ready within ${WP_ENV_TIMEOUT_MS / 1000}s`)
}

async function ensureWpEnvRestRoute(): Promise<void> {
    if (await fetchOk(`${WP_ENV_HOST}/wp-json/`)) return
    log('Flushing rewrite rules so REST routes respond')
    try {
        execSync('bun x wp-env run cli wp rewrite structure "/%postname%/" --hard',
            { cwd: PLUGIN_ROOT, stdio: 'inherit' })
        execSync('bun x wp-env run cli wp rewrite flush --hard',
            { cwd: PLUGIN_ROOT, stdio: 'inherit' })
    } catch (e) {
        log(`Warning: rewrite flush failed: ${(e as Error).message}`)
    }
}

async function setupWpEnvAuth(): Promise<void> {
    const username = process.env.WP_ENV_USER ?? DEFAULT_ADMIN_USER
    const password = process.env.WP_ENV_PASSWORD ?? DEFAULT_ADMIN_PASSWORD

    fs.mkdirSync(path.dirname(WP_ENV_AUTH_PATH), { recursive: true })

    const browser = await chromium.launch()
    const context = await browser.newContext({ ignoreHTTPSErrors: true })
    const page = await context.newPage()

    try {
        const loginUrl = `${WP_ENV_HOST}/wp-login.php`
        const loginInput = page.locator('input[name="log"]')

        for (let attempt = 0; attempt < 2; attempt++) {
            await page.goto(loginUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })

            if (await page.locator('#wpadminbar').count()) {
                await context.storageState({ path: WP_ENV_AUTH_PATH })
                log(`Auth state cached at ${WP_ENV_AUTH_PATH}`)
                return
            }

            try {
                await loginInput.waitFor({ state: 'visible', timeout: 5000 })
                break
            } catch {
                if (attempt === 1) throw new Error('Login form did not render')
            }
        }

        await loginInput.fill(username)
        await page.fill('input[name="pwd"]', password)
        await page.click('input[type="submit"][name="wp-submit"]')
        await page.waitForURL('**/wp-admin/**', { timeout: 30000 })

        await context.storageState({ path: WP_ENV_AUTH_PATH })
        log(`Auth state captured at ${WP_ENV_AUTH_PATH}`)
    } finally {
        await context.close()
        await browser.close()
    }
}

async function startViteServer(port: number): Promise<ChildProcess | null> {
    const viteClientUrl = `http://localhost:${port}/@vite/client`
    if (await fetchOk(viteClientUrl)) {
        log(`Vite already running on :${port}`)
        return null
    }
    log(`Starting host-plugin Vite dev server on :${port}`)
    fs.mkdirSync(META_DIR, { recursive: true })
    const logFile = path.join(META_DIR, 'vite-dev.log')
    const out = fs.openSync(logFile, 'w')
    const child = spawn('bun', ['run', 'dev'], {
        cwd: FIXTURE_ROOT,
        detached: true,
        stdio: ['ignore', out, out],
        env: { ...process.env, FORCE_COLOR: '0' },
    })
    if (typeof child.pid === 'number') {
        fs.writeFileSync(PATHS.vitePid, String(child.pid), 'utf-8')
    }
    child.unref()
    const ready = await waitFor(() => fetchOk(viteClientUrl), VITE_START_TIMEOUT_MS)
    if (!ready) throw new Error(`Vite did not start within ${VITE_START_TIMEOUT_MS / 1000}s (see ${logFile})`)
    log(`Vite ready on :${port}`)
    return child
}

function buildFixtureIfNeeded(): void {
    if (fs.existsSync(PATHS.fixtureManifest) && !isFixtureBuildStale()) {
        log('Host-plugin fixture build is up-to-date')
        return
    }
    log('Building host-plugin fixture (production)')
    execSync('bun run build', { cwd: FIXTURE_ROOT, stdio: 'inherit' })
}

async function verifyViteMode(expected: string): Promise<void> {
    const url = `${WP_ENV_HOST}/wp-admin/admin-ajax.php?action=check_vite_dev_mode`
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) })
    if (!res.ok) throw new Error(`admin-ajax check failed (${res.status}). Is host-plugin active?`)
    const info = await res.json() as { isDev?: boolean }
    const expectedIsDev = expected === 'development'
    if (Boolean(info?.isDev) !== expectedIsDev) {
        throw new Error(
            `Host-plugin VITE_MODE mismatch. Expected ${expected}, got ${info?.isDev ? 'development' : 'production'}.`
        )
    }
}

async function warmTestResourceCache(): Promise<void> {
    const browser = await chromium.launch()
    const context = await browser.newContext({ storageState: WP_ENV_AUTH_PATH, ignoreHTTPSErrors: true })
    const page = await context.newPage()
    try {
        await page.goto(`${WP_ENV_HOST}/wp-admin/post-new.php`, { waitUntil: 'domcontentloaded', timeout: 30000 })
        const nonceReady = await waitFor(
            () => page.evaluate(() => Boolean((window as any).wpApiSettings?.nonce)),
            5000, 250
        )
        if (!nonceReady) return

        const cache = readCache<{ postId: number }>('test-post.json', { cacheDir: META_DIR })
        let valid = false
        if (cache?.postId) {
            const res = await page.request.get(`${WP_ENV_HOST}/wp-json/wp/v2/posts/${cache.postId}`,
                { failOnStatusCode: false })
            valid = res.ok()
        }
        if (!valid) {
            try {
                const postId = await page.evaluate(async () => {
                    const nonce = (window as any).wpApiSettings?.nonce
                    if (!nonce) return null
                    const res = await fetch('/wp-json/wp/v2/posts', {
                        method: 'POST',
                        headers: { 'X-WP-Nonce': nonce, 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            title: 'E2E Test Post (do not delete)',
                            status: 'draft',
                            content: '',
                        }),
                    })
                    if (!res.ok) return null
                    const data = await res.json()
                    return (data?.id as number) ?? null
                })
                if (postId) writeCache('test-post.json', { postId }, { cacheDir: META_DIR })
            } catch {}
        }
    } finally {
        await context.close()
        await browser.close()
    }
}

async function globalSetup() {
    if (isDevRun && viteMode !== 'development') {
        throw new Error('Expected VITE_MODE=development for @dev runs.')
    }
    if (isProdRun && viteMode === 'development') {
        throw new Error('Expected VITE_MODE=production for @prod runs.')
    }

    fs.mkdirSync(META_DIR, { recursive: true })
    log(`Mode: ${viteMode} | host: ${WP_ENV_HOST}`)

    ensurePluginBuilt()
    await ensureWpEnvStarted()
    await ensureWpEnvRestRoute()

    if (viteMode === 'development') {
        await startViteServer(Number(process.env.VITE_PORT ?? 5173))
    } else {
        if (fs.existsSync(PATHS.fixtureHotFile)) {
            try { fs.unlinkSync(PATHS.fixtureHotFile) } catch {}
        }
        buildFixtureIfNeeded()
    }

    await verifyViteMode(viteMode)
    await setupWpEnvAuth()
    await warmTestResourceCache()
    log('Bootstrap complete')
}

export default globalSetup
