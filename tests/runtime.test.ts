import { describe, expect, it } from 'bun:test'
import { JSDOM } from 'jsdom'
import * as fs from 'fs'
import * as path from 'path'
import { applyBlockHmr } from '../src/runtime/block-hmr.js'

const TEMPLATE_PATH = path.resolve(__dirname, '..', 'src/templates/wp-block-hmr.js')
const FUNCTIONS_START_MARKER = 'function setupRegisterGuard()'
const EDITOR_CSS_PATH = '/src/styles/vite-blocks-editor.css'

type BlockInEditor = { name: string; clientId: string }
type AttributeUpdate = { clientId: string; attrs: Record<string, unknown> }
type RegisterCall = { name: string; settings: any }
type WindowMock = {
    wp: {
        blocks: {
            getBlockType: () => Record<string, unknown> | null
            unregisterBlockType?: (name: string) => void
            registerBlockType?: (name: string, settings: Record<string, unknown>) => void
        }
        data: any
    }
}
type MockSetup = {
    windowMock: WindowMock
    updates: AttributeUpdate[]
    registerCalls: RegisterCall[]
    unregisterCalls: string[]
}
type HmrFunctions = {
    processCssHmrUpdates: (doc: Document, updates: Array<{ path: string; type?: string } | string>) => Promise<void>
    processHmrUpdates: (doc: Document, updates: Array<{ path: string; type: string }>) => void
    injectCssFallback: (doc: Document, updates: Array<{ path: string } | string>, origin: string) => void
    processJsHmrUpdate: (doc: Document, path: string) => void
    applyBlockHmrFromPath: (path: string) => void
}

let blockIndex = 0
const createUniqueBlockName = () => `test/block-${blockIndex++}`
const createNoopComponent = () => () => null

function buildWindowMock(currentBlockType: Record<string, unknown> | null, blocksInEditor: BlockInEditor[]): MockSetup {
    let current = currentBlockType
    const registerCalls: RegisterCall[] = []
    const unregisterCalls: string[] = []
    const updates: AttributeUpdate[] = []

    const blocks = {
        getBlockType: () => current,
        unregisterBlockType: (name: string) => {
            unregisterCalls.push(name)
            current = null
        },
        registerBlockType: (name: string, settings: Record<string, unknown>) => {
            registerCalls.push({ name, settings })
            current = settings
        },
    }

    const data = {
        select: (store: string) =>
            store === 'core/block-editor' ? { getBlocks: () => blocksInEditor } : null,
        dispatch: (store: string) =>
            store === 'core/block-editor'
                ? {
                    updateBlockAttributes: (clientId: string, attrs: Record<string, unknown>) => {
                        updates.push({ clientId, attrs })
                    },
                }
                : null,
    }

    return {
        windowMock: { wp: { blocks, data } },
        updates,
        registerCalls,
        unregisterCalls,
    }
}

function withGlobalWp<T>(windowMock: WindowMock, fn: () => T): T {
    const previousWp = (globalThis as { wp?: unknown }).wp
    ;(globalThis as { wp: unknown }).wp = windowMock.wp
    try {
        return fn()
    } finally {
        ;(globalThis as { wp: unknown }).wp = previousWp
    }
}

function loadHmrFunctions(window: Window, document: Document): HmrFunctions {
    const rawTemplate = fs.readFileSync(TEMPLATE_PATH, 'utf-8')
    const functionsStart = rawTemplate.indexOf(FUNCTIONS_START_MARKER)
    if (functionsStart === -1) throw new Error('wp-block-hmr template marker not found')

    let utilities = rawTemplate.slice(functionsStart)

    utilities = utilities.replace(
        /function getViteOrigin\(\)\s*\{[\s\S]*?return[^}]*\}\s*\}/,
        'function getViteOrigin() { return window.location.origin; }'
    )

    utilities = utilities.replace(
        /async function expandCssUpdatePaths\(doc, updatePaths, origin\)\s*\{[\s\S]*?\n\s*return \{ effectivePaths:[^}]+\}\s*\}/,
        `async function expandCssUpdatePaths(doc, updatePaths, origin) {
    return { effectivePaths: updatePaths, importPaths: [] };
}`
    )

    utilities = utilities.replace(/(\W)fetch\(/g, '$1window.fetch(')

    const factory = new Function(
        'window',
        'document',
        `
        var __wpvHmrLogger = { log: () => {}, warn: () => {}, debug: () => {} };
        var __wpvHmrDebounceMs = 100;
        var __wpvHmrEntryStylesheet = '/src/styles/vite-blocks-editor.css';
        ${utilities}
        return { processCssHmrUpdates, processHmrUpdates, injectCssFallback, processJsHmrUpdate, applyBlockHmrFromPath };
        `
    )

    return factory(window, document) as HmrFunctions
}

describe('applyBlockHmr', () => {
    it('returns early when required wp blocks APIs are missing', () => {
        const block = { meta: { name: createUniqueBlockName() }, edit: () => null, save: () => null }
        const windowMock = { wp: { blocks: { getBlockType: () => ({}) }, data: {} } } as unknown as WindowMock

        expect(() => withGlobalWp(windowMock, () => applyBlockHmr(block))).not.toThrow()
    })

    it('updates attributes when edit/save are unchanged', () => {
        const name = createUniqueBlockName()
        const edit = createNoopComponent()
        const save = createNoopComponent()
        const currentBlock = { edit, save, attributes: { foo: { type: 'string', default: 'a' } } }
        const blocksInEditor = [
            { name, clientId: 'a' },
            { name: 'other/block', clientId: 'b' },
            { name, clientId: 'c' },
        ]
        const setup = buildWindowMock(currentBlock, blocksInEditor)

        withGlobalWp(setup.windowMock, () => {
            applyBlockHmr({ meta: { name }, edit, save })
        })

        expect(setup.unregisterCalls.length).toBe(0)
        expect(setup.registerCalls.length).toBe(0)
        expect(setup.updates.length).toBe(2)
        expect(typeof setup.updates[0]?.attrs.__hmrTimestamp).toBe('number')
    })

    it('re-registers block when edit/save change and merges attributes', () => {
        const name = createUniqueBlockName()
        const currentBlock = {
            edit: createNoopComponent(),
            save: createNoopComponent(),
            attributes: { foo: { type: 'string', default: 'a' } },
        }
        const nextEdit = createNoopComponent()
        const nextSave = createNoopComponent()
        const setup = buildWindowMock(currentBlock, [{ name, clientId: 'a' }])

        withGlobalWp(setup.windowMock, () => {
            applyBlockHmr({ meta: { name }, edit: nextEdit, save: nextSave })
        })

        expect(setup.unregisterCalls.length).toBe(1)
        expect(setup.registerCalls.length).toBe(1)
        const registered = setup.registerCalls[0]
        expect(registered?.settings?.edit).toBe(nextEdit)
        expect(registered?.settings?.save).toBe(nextSave)
        expect((registered?.settings?.attributes as Record<string, { default?: string }>)?.foo?.default).toBe('a')
        expect((registered?.settings?.attributes as Record<string, { type?: string }>)?.__hmrTimestamp?.type).toBe('number')
        expect(setup.updates.length).toBe(1)
    })
})

describe('wp-block-hmr template utilities', () => {
    it('refreshes Vite stylesheet links with a cache buster', async () => {
        const dom = new JSDOM(
            '<!doctype html><link rel="stylesheet" href="http://localhost:5173/src/styles/vite-blocks-editor.css">',
            { url: 'http://localhost:5173/wp-admin/' }
        )

        const { processCssHmrUpdates } = loadHmrFunctions(dom.window as unknown as Window, dom.window.document)
        await processCssHmrUpdates(dom.window.document, [{ path: EDITOR_CSS_PATH, type: 'css-update' }])

        const link = dom.window.document.querySelector('link[rel="stylesheet"]')
        const href = link?.getAttribute('href') || ''
        expect(href).toContain('vite-blocks-editor.css')
        expect(href).toContain('t=')
    })

    it('injects fallback CSS when no stylesheet links exist', async () => {
        const dom = new JSDOM('<!doctype html><head></head><body></body>', { url: 'http://localhost:5173/wp-admin/' })
        const mockCssContent = '/* mock css */'
        ;(dom.window as any).fetch = async () => ({ ok: true, text: async () => mockCssContent })

        const { processCssHmrUpdates } = loadHmrFunctions(dom.window as unknown as Window, dom.window.document)
        await processCssHmrUpdates(dom.window.document, [{ path: EDITOR_CSS_PATH, type: 'css-update' }])

        const style = dom.window.document.querySelector('#wpv-hmr-css-fallback') as HTMLStyleElement | null
        expect(style).not.toBeNull()
        expect(style?.textContent).toBe(mockCssContent)
    })

    it('dispatches HMR events and applies block updates for edit changes', async () => {
        const sourceDom = new JSDOM('<!doctype html>', { url: 'http://localhost:5173/wp-admin/' })
        const iframeDom = new JSDOM('<!doctype html>', { url: 'http://localhost:5173/wp-admin/' })
        const { processJsHmrUpdate } = loadHmrFunctions(sourceDom.window as unknown as Window, sourceDom.window.document)
        const applyCalls: unknown[] = []
        const docEvents: string[] = []
        const windowEvents: string[] = []
        const previousCustomEvent = (globalThis as { CustomEvent?: typeof CustomEvent }).CustomEvent

        ;(sourceDom.window as any).__wpvBlockHmrApply = (...args: unknown[]) => {
            applyCalls.push(args)
        }
        ;(sourceDom.window as any).__wpvBlockHmrLoader = () =>
            Promise.resolve({ default: () => null, edit: () => null, save: () => null })
        ;(sourceDom.window as any).__wpvBlockMetaByDir = { Container: { name: 'test/block' } }
        ;(sourceDom.window as any).wp = {
            blocks: { getBlockType: () => ({ edit: () => null, save: () => null }) },
        }

        iframeDom.window.document.addEventListener('wp-block-hmr-update', () => docEvents.push('doc'))
        sourceDom.window.addEventListener('wp-block-hmr-update', () => windowEvents.push('window'))

        ;(globalThis as { CustomEvent?: typeof CustomEvent }).CustomEvent = sourceDom.window.CustomEvent
        try {
            processJsHmrUpdate(iframeDom.window.document, '/src/blocks/Container/edit.tsx')
            await new Promise((resolve) => setTimeout(resolve, 0))
        } finally {
            ;(globalThis as { CustomEvent?: typeof CustomEvent }).CustomEvent = previousCustomEvent
        }

        expect(docEvents.length).toBe(1)
        expect(windowEvents.length).toBe(1)
        expect(applyCalls.length).toBe(1)
    })

    it('ignores non-block module paths', async () => {
        const dom = new JSDOM('<!doctype html>', { url: 'http://localhost:5173/wp-admin/' })
        const { applyBlockHmrFromPath } = loadHmrFunctions(dom.window as unknown as Window, dom.window.document)
        const applyCalls: unknown[] = []

        ;(dom.window as any).__wpvBlockHmrApply = (...args: unknown[]) => {
            applyCalls.push(args)
        }
        ;(dom.window as any).__wpvBlockHmrLoader = () =>
            Promise.resolve({ meta: { name: 'test/block' }, edit: () => null, save: () => null })

        applyBlockHmrFromPath('/src/blocks/Container/index.tsx')
        await new Promise((resolve) => setTimeout(resolve, 0))

        expect(applyCalls.length).toBe(0)
    })
})
