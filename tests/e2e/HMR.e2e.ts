import fs from 'fs'
import path from 'path'

import {
    test,
    expect,
    insertTestBlock,
    modifySourceFile,
    bootEditor,
    createCanvasLike,
    resolveProjectRoot,
} from '../test-utils'

const PROJECT_ROOT = resolveProjectRoot()
const SOURCE_FILE = process.env.WP_TEST_BLOCK_SOURCE
    ?? path.join(PROJECT_ROOT, 'src/blocks/Test/index.tsx')
const CSS_SOURCE_FILE = process.env.WP_TEST_BLOCK_CSS
    ?? path.join(PROJECT_ROOT, 'src/styles/test.css')
const HMR_STYLESHEET = '/src/styles/vite-blocks-editor.css'
const HMR_TIMEOUT = 15000
const HMR_HOST = `localhost:${process.env.VITE_PORT ?? '5173'}`

test.describe('HMR @dev @hmr', () => {
    test.beforeAll(() => {
        if (process.env.VITE_MODE !== 'development') {
            throw new Error('HMR integration tests require VITE_MODE=development.')
        }
        if (!fs.existsSync(SOURCE_FILE)) {
            throw new Error(`HMR source fixture not found at ${SOURCE_FILE}. Set WP_PROJECT_ROOT or WP_TEST_BLOCK_SOURCE.`)
        }
        if (!fs.existsSync(CSS_SOURCE_FILE)) {
            throw new Error(`HMR css fixture not found at ${CSS_SOURCE_FILE}. Set WP_PROJECT_ROOT or WP_TEST_BLOCK_CSS.`)
        }
    })
    test.describe.configure({ mode: 'serial' })

    test('updates block content on edit change', async ({ editorPage, wpCanvas, assetInfo }) => {
        if (!assetInfo.hasDevAssets) {
            throw new Error('Dev assets not detected in editor page.')
        }

        const inserted = await insertTestBlock(editorPage, wpCanvas)
        expect(inserted).toBe(true)

        const block = wpCanvas.locator('.wp-block-test-block').first()
        const marker = `Test Block HMR ${Date.now()}`
        const { restore } = modifySourceFile(SOURCE_FILE, marker)

        try {
            await expect(block).toContainText(marker, { timeout: HMR_TIMEOUT })
        } finally {
            restore()
        }
    })

    test('refreshes editor stylesheet with minimal requests', async ({ editorPage, wpHost }) => {
        const hmrPage = await editorPage.context().newPage()
        const requests: string[] = []
        const hmrRequests: string[] = []

        hmrPage.on('requestfinished', req => {
            const url = req.url()
            requests.push(url)
            if (url.includes(HMR_HOST)) {
                hmrRequests.push(url)
            }
        })

        await bootEditor(hmrPage, wpHost)

        const canvas = await createCanvasLike(hmrPage)
        const inserted = await insertTestBlock(hmrPage, canvas)
        expect(inserted).toBe(true)

        const scriptSrcs = await hmrPage.$$eval('script[src]', els => els.map(el => el.getAttribute('src')))
        const linkHrefs = await hmrPage.$$eval('link[href]', els => els.map(el => el.getAttribute('href')))
        const hasDevAssets = [...scriptSrcs, ...linkHrefs].some(src => src?.includes(HMR_HOST))
        expect(hasDevAssets).toBe(true)

        const baselineRequests = [...requests]
        const baselineHmrRequests = [...hmrRequests]
        const parentRequestCounts: number[] = []
        const originalCss = fs.readFileSync(CSS_SOURCE_FILE, 'utf-8')
        const replaceColor = (css: string, color: string) =>
            css.replace(/background-color:\s*[^;]+;/, `background-color: ${color} !important;`)
        const block = canvas.locator('.hmr-test').first()
        await expect(block).toBeVisible()
        const isExpectedColor = async (expected: string) => {
            return block.evaluate((el, color) => {
                const doc = el.ownerDocument
                const temp = doc.createElement('div')
                temp.style.backgroundColor = color
                doc.body.appendChild(temp)
                const normalized = window.getComputedStyle(temp).backgroundColor
                doc.body.removeChild(temp)
                return window.getComputedStyle(el).backgroundColor === normalized
            }, expected)
        }
        const waitForColor = async (expected: string) => {
            const start = Date.now()
            while ((Date.now() - start) < HMR_TIMEOUT) {
                if (await isExpectedColor(expected)) return
                await hmrPage.waitForTimeout(100)
            }

            const debug = await hmrPage.evaluate(() => {
                const updates = (window as any).__wpvLastHmrUpdates || []
                const iframe = document.querySelector('iframe[name="editor-canvas"]') as HTMLIFrameElement | null
                const doc = iframe?.contentDocument
                const links = Array.from(doc?.querySelectorAll('link[rel="stylesheet"]') || [])
                    .map(link => link.getAttribute('href'))
                const hmrLinks = Array.from(doc?.querySelectorAll('link[data-wpv-hmr-path]') || [])
                    .map(link => link.getAttribute('href'))
                const styleIds = Array.from(doc?.querySelectorAll('style[id]') || [])
                    .map(style => style.getAttribute('id'))
                return { updates, links, hmrLinks, styleIds }
            })
            const blockInfo = await block.evaluate((el) => ({
                className: el.getAttribute('class') || '',
                docUrl: el.ownerDocument?.URL || '',
                background: window.getComputedStyle(el).backgroundColor,
            }))
            throw new Error(`HMR color did not update to ${expected}. Block: ${JSON.stringify(blockInfo)}. Debug: ${JSON.stringify(debug)}`)
        }
        const parentStylesheetRequestsCount = () => hmrRequests.filter(url => url.includes(HMR_STYLESHEET)).length
        const waitForParentStylesheetRequest = async (beforeCount: number) => {
            const start = Date.now()
            while ((Date.now() - start) < HMR_TIMEOUT) {
                if (parentStylesheetRequestsCount() > beforeCount) return true
                await hmrPage.waitForTimeout(100)
            }
            return false
        }
        const applyColor = async (color: string) => {
            const beforeParentRequests = parentStylesheetRequestsCount()
            const writeCss = () => {
                fs.writeFileSync(
                    CSS_SOURCE_FILE,
                    `${replaceColor(originalCss, color)}\n/* hmr-${Date.now()} */\n`,
                    'utf-8'
                )
            }
            writeCss()
            const requestSeen = await waitForParentStylesheetRequest(beforeParentRequests)
            if (!requestSeen) {
                writeCss()
                await waitForParentStylesheetRequest(beforeParentRequests)
            }
            await waitForColor(color)
            await hmrPage.waitForTimeout(600)
            const afterParentRequests = parentStylesheetRequestsCount()
            parentRequestCounts.push(afterParentRequests - beforeParentRequests)
        }

        try {
            await applyColor('green')
            await applyColor('blue')
            await applyColor('orange')
            await hmrPage.waitForTimeout(200)
        } finally {
            fs.writeFileSync(CSS_SOURCE_FILE, originalCss, 'utf-8')
        }

        const newRequests = requests.slice(baselineRequests.length)
        const newHmrRequests = hmrRequests.slice(baselineHmrRequests.length)
        const parentStylesheetRequests = newHmrRequests.filter(url => url.includes(HMR_STYLESHEET))
        const expectedUpdates = 3
        const maxParentRequests = expectedUpdates

        if (parentStylesheetRequests.length > maxParentRequests) {
            const uniqueHmrRequests = Array.from(new Set(newHmrRequests))
            const uniqueAllRequests = Array.from(new Set(newRequests))
            console.log('HMR CSS update triggered unexpected dev-server requests:', uniqueHmrRequests)
            console.log('All new requests during CSS update:', uniqueAllRequests)
        }

        expect(parentStylesheetRequests.length).toBeLessThanOrEqual(maxParentRequests)
        expect(parentRequestCounts).toEqual([1, 1, 1])

        await hmrPage.close()
    })
})
