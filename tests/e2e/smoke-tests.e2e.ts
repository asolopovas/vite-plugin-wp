import { test as base, expect } from '@playwright/test'
import { resolveWpHost, bootEditor, createAuthPage, createJsErrorCollector } from '../test-utils'

base.describe('Asset Loading @prod', () => {
    base.describe.configure({ mode: 'parallel' })

    base('backend assets load correctly without dev mode', async ({ browser }) => {
        const wpHost = resolveWpHost()
        const page = await createAuthPage(browser)

        const jsErrors = createJsErrorCollector(page, [
            'jQuery is not defined',
            '$ is not a function',
            'acf is not defined',
            'media.template is not a function',
            "Cannot read properties of undefined (reading 'post')",
        ])

        await bootEditor(page, wpHost)

        const scriptSrcs = await page.$$eval('script[src]', els => els.map(el => el.getAttribute('src')))
        const linkHrefs = await page.$$eval('link[href]', els => els.map(el => el.getAttribute('href')))
        const hasDevAssets = [...scriptSrcs, ...linkHrefs].some(s => s?.includes('localhost:517'))

        expect(hasDevAssets).toBe(false)

        expect(jsErrors, `JS errors: ${ jsErrors.join('\n') }`).toHaveLength(0)

        expect(scriptSrcs.find(s => s?.includes('/static/build') && s?.endsWith('.js'))).toBeTruthy()
        expect(linkHrefs.find(h => h?.includes('/static/build') && h?.endsWith('.css'))).toBeTruthy()

        expect(await page.$$eval('script[type="module"]', s => s.length)).toBeGreaterThan(0)

        const cssHref = linkHrefs.find(h =>
            h?.includes('/static/build') &&
            /-[a-zA-Z0-9_-]+\.css/.test(h)
        )

        expect(cssHref).toBeTruthy()
        const cssContent = await page.request.get(cssHref!).then(r => r.text())
        expect(cssContent).not.toContain('@import "./shared.css"')

        await expect(page.locator('script[src*="@vite/client"]')).toHaveCount(0)

        await page.context().close()
    })

    base('frontend assets load correctly without dev mode', async ({ browser }) => {
        const wpHost = resolveWpHost()
        const page = await createAuthPage(browser)

        await page.goto(wpHost, { waitUntil: 'domcontentloaded' })

        const frontendLinkHrefs = await page.$$eval('link[href]', els => els.map(el => el.getAttribute('href')))
        const frontendHasDevAssets = frontendLinkHrefs.some(h => h?.includes('localhost:517'))

        expect(frontendHasDevAssets).toBe(false)

        const frontendCssHref = frontendLinkHrefs.find(h =>
            h?.includes('/static/build') &&
            /-[a-zA-Z0-9_-]+\.css/.test(h) &&
            !h?.includes('editor')
        )
        expect(frontendCssHref).toBeTruthy()

        const frontendCssContent = await page.request.get(frontendCssHref!).then(r => r.text())
        expect(frontendCssContent).not.toContain('@import "./shared.css"')

        await page.context().close()
    })
})
