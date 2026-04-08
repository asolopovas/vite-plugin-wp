import { test as base, expect, Page, FrameLocator, Locator } from '@playwright/test'
import type { Browser, BrowserContext, BrowserContextOptions } from '@playwright/test'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const PLUGIN_ROOT = path.resolve(__dirname, '..')
const FIXTURE_ROOT = path.join(PLUGIN_ROOT, 'tests/fixtures/host-plugin')

export const DEFAULT_WP_HOST = 'http://localhost:8888'
export const DEFAULT_ADMIN_USER = 'admin'
export const DEFAULT_ADMIN_PASSWORD = 'password'

export type AssetInfo = {
    scriptSrcs: (string | null)[]
    linkHrefs: (string | null)[]
    hasDevAssets: boolean
}

export type CanvasLike = { locator(selector: string): Locator }

export type TestFixtures = {
    wpHost: string
    editorPage: Page
    assetInfo: AssetInfo
    jsErrors: string[]
    wpCanvas: CanvasLike
}

const IGNORED_ERRORS = [
    'favicon.ico', '404', 'Failed to load resource', 'net::ERR_FAILED',
    "'contentDocument' as it is null", 'beforeunload', 'Blocked attempt to show a',
    'ResizeObserver loop', 'createRoot() on a container that has already been passed',
]

const EDITOR_CANVAS_SELECTOR = 'iframe[name="editor-canvas"]'

export function resolveWpHost(): string {
    const host = process.env.WP_HOST ?? DEFAULT_WP_HOST
    return host.replace(/\/$/, '')
}

export function resolveProjectRoot(): string {
    return path.resolve(process.env.WP_PROJECT_ROOT ?? FIXTURE_ROOT)
}

export function resolvePluginRoot(): string {
    return PLUGIN_ROOT
}

export function getAuthStatePath(): string {
    const explicit = process.env.WP_TEST_AUTH_PATH
    if (explicit) return path.resolve(explicit)
    return path.join(PLUGIN_ROOT, 'tests/.meta/wp-env-user.json')
}

export function getMetaDir(): string {
    return path.join(PLUGIN_ROOT, 'tests/.meta')
}

export async function hasEditorCanvasIframe(page: Page): Promise<boolean> {
    return await page.locator(EDITOR_CANVAS_SELECTOR).count() > 0
}

export async function createCanvasLike(page: Page): Promise<CanvasLike> {
    const useIframe = await hasEditorCanvasIframe(page)
    if (useIframe) {
        const iframe = page.frameLocator(EDITOR_CANVAS_SELECTOR)
        return { locator: (selector: string) => iframe.locator(selector) }
    }
    return { locator: (selector: string) => page.locator(selector) }
}

function shouldIgnoreError(msg: string, extraIgnoredErrors: string[] = []): boolean {
    return [...IGNORED_ERRORS, ...extraIgnoredErrors].some(pattern => msg.includes(pattern))
}

export function createJsErrorCollector(page: Page, extraIgnoredErrors: string[] = []): string[] {
    const errors: string[] = []
    page.on('console', msg => {
        if (msg.type() === 'error' && !shouldIgnoreError(msg.text(), extraIgnoredErrors)) {
            errors.push(msg.text())
        }
    })
    page.on('pageerror', err => {
        if (!shouldIgnoreError(err.message, extraIgnoredErrors)) errors.push(err.message)
    })
    return errors
}

async function waitForBlockEditorReady(page: Page): Promise<void> {
    await expect.poll(async () => {
        return page.evaluate(() => {
            const wp = (window as any).wp
            const select = wp?.data?.select
            if (!select) return false
            const blockEditor = select('core/block-editor')
            if (!blockEditor || typeof blockEditor.getBlocks !== 'function') return false

            const guideClose = document.querySelector(
                '.components-guide__container button[aria-label="Close"]'
            ) as HTMLButtonElement | null
            guideClose?.click()

            if (document.querySelector('.editor-post-locked-modal')) {
                document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
            }
            return true
        })
    }).toBe(true)
}

export async function bootEditor(page: Page, wpHost: string, postId?: number): Promise<void> {
    const url = postId
        ? `${wpHost}/wp-admin/post.php?post=${postId}&action=edit`
        : `${wpHost}/wp-admin/post-new.php`

    await page.goto(url, { waitUntil: 'load' })

    const takeOver = page.getByRole('link', { name: 'Take over' })
    if (await takeOver.isVisible().catch(() => false)) {
        page.on('dialog', d => d.accept())
        await takeOver.click()
    }

    await waitForBlockEditorReady(page)

    await expect(
        page.locator(EDITOR_CANVAS_SELECTOR)
            .or(page.locator('.editor-styles-wrapper'))
            .or(page.locator('.block-editor-writing-flow'))
    ).toBeVisible()

    await page.evaluate(() => {
        const wp = (window as any).wp
        if (wp?.data?.select('core/edit-post')?.isFeatureActive('welcomeGuide')) {
            wp.data.dispatch('core/edit-post').toggleFeature('welcomeGuide')
        }
    })

    if (postId) {
        await page.evaluate(() => {
            (window as any).wp.data.dispatch('core/block-editor').resetBlocks([])
        })
    }
}

export const test = base.extend<TestFixtures>({
    wpHost: async ({}, use) => {
        await use(resolveWpHost())
    },

    jsErrors: async ({ page }, use) => {
        await use(createJsErrorCollector(page))
    },

    editorPage: async ({ page, wpHost }, use) => {
        await bootEditor(page, wpHost)
        await use(page)
    },

    assetInfo: async ({ editorPage }, use) => {
        const scriptSrcs = await editorPage.$$eval('script[src]', els => els.map(el => el.getAttribute('src')))
        const linkHrefs = await editorPage.$$eval('link[href]', els => els.map(el => el.getAttribute('href')))
        const vitePort = process.env.VITE_PORT ?? '5173'
        const hasDevAssets = [...scriptSrcs, ...linkHrefs].some(s => s?.includes(`localhost:${vitePort}`))
        await use({ scriptSrcs, linkHrefs, hasDevAssets })
    },

    wpCanvas: async ({ editorPage }, use) => {
        await use(await createCanvasLike(editorPage))
    },
})

export { expect }

export async function createAuthContext(
    browser: Browser,
    contextOptions: BrowserContextOptions = {}
): Promise<BrowserContext> {
    return browser.newContext({ storageState: getAuthStatePath(), ...contextOptions })
}

export async function createAuthPage(
    browser: Browser,
    contextOptions: BrowserContextOptions = {}
): Promise<Page> {
    const ctx = await createAuthContext(browser, contextOptions)
    return ctx.newPage()
}

export async function insertTestBlock(page: Page, canvas: FrameLocator | CanvasLike): Promise<boolean> {
    const inserted = await page.evaluate(() => {
        const wp = (window as any).wp
        if (!wp?.blocks?.createBlock || !wp?.data?.dispatch) return false
        wp.data.dispatch('core/block-editor').insertBlocks(wp.blocks.createBlock('test/block'))
        return true
    })

    if (inserted) {
        await expect(canvas.locator('.wp-block-test-block').first()).toBeVisible()
    }
    return inserted
}

export function modifySourceFile(
    filePath: string,
    marker: string,
    find: string = 'Test Block'
): { original: string; restore: () => void } {
    const original = fs.readFileSync(filePath, 'utf-8')
    fs.writeFileSync(filePath, original.replace(`>${find}<`, `>${marker}<`), 'utf-8')
    return {
        original,
        restore: () => fs.writeFileSync(filePath, original, 'utf-8'),
    }
}
