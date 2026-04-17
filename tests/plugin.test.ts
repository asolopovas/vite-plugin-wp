import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import type { ConfigEnv, Plugin, UserConfig, ViteDevServer } from 'vite'
import vitePluginWp from '../src/index.js'

type ObjectHook<T extends (...args: any[]) => any> =
    | T
    | { handler: T; order?: 'pre' | 'post' | null }

type TransformResult = { code: string; map: null } | undefined
type SimpleTransformHook = (code: string, id: string) => TransformResult | Promise<TransformResult>

const testEnv = { command: 'build', mode: 'test' } as ConfigEnv

function getCorePlugin(plugins: Plugin[]): Plugin {
    return plugins[0]
}

function getPluginByName(plugins: Plugin[], name: string): Plugin {
    const found = plugins.find((p) => p.name === name)
    if (!found) throw new Error(`plugin not found: ${name}`)
    return found
}

function getHookHandler<T extends (...args: any[]) => any>(hook: ObjectHook<T> | undefined): T | undefined {
    if (!hook) return
    if (typeof hook === 'function') return hook
    return hook.handler
}

async function runConfigHook(plugins: Plugin[], config: UserConfig): Promise<void> {
    const handler = getHookHandler<(config: UserConfig, env: ConfigEnv) => unknown>(getCorePlugin(plugins).config)
    await handler?.(config, testEnv)
}

function runConfigureServerOn(plugin: Plugin, server: ViteDevServer): void {
    const handler = getHookHandler<(server: ViteDevServer) => unknown>(plugin.configureServer)
    handler?.(server)
}

async function runTransformHook(plugins: Plugin[], code: string, id: string): Promise<TransformResult> {
    const plugin = getCorePlugin(plugins)
    const handler = getHookHandler<SimpleTransformHook>(
        plugin.transform as ObjectHook<SimpleTransformHook> | undefined
    )
    return await handler?.(code, id)
}

describe('vitePluginWp', () => {
    let plugins: Plugin[]
    let config: UserConfig
    let mockServer: ViteDevServer
    let tempDir: string
    let originalCwd: string

    beforeEach(() => {
        originalCwd = process.cwd()
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vpwp-'))
        process.chdir(tempDir)

        plugins = vitePluginWp()
        config = {}
        mockServer = {
            config: { server: { port: 5173 } },
            httpServer: { on: () => {}, once: () => {} },
            transformRequest: () => Promise.resolve(null),
        } as unknown as ViteDevServer
    })

    afterEach(() => {
        process.chdir(originalCwd)
        fs.rmSync(tempDir, { recursive: true, force: true })
    })

    describe('plugin creation', () => {
        it('returns the expected plugin set', () => {
            expect(Array.isArray(plugins)).toBe(true)
            expect(plugins.map((p) => p.name)).toEqual([
                'vite-plugin-wp',
                'vite-plugin-wp:hot-file',
                'vite-plugin-wp:hmr-filter',
                'vite-plugin-wp:env-mode',
            ])

            const core = getCorePlugin(plugins)
            expect(typeof core.config).toBe('function')
            expect(typeof (core.transform as { handler: unknown }).handler).toBe('function')
            expect(typeof (core.resolveId as { handler: unknown }).handler).toBe('function')
            expect(typeof (core.load as { handler: unknown }).handler).toBe('function')
        })

        it('can disable the env-mode plugin', () => {
            const noEnv = vitePluginWp({ syncViteMode: false })
            expect(noEnv.find((p) => p.name === 'vite-plugin-wp:env-mode')).toBeUndefined()
        })
    })

    describe('config function', () => {
        beforeEach(async () => {
            await runConfigHook(plugins, config)
        })

        it('configures aliases and externals', () => {
            const alias = config.resolve?.alias as Array<{ find: any; replacement: string }>
            expect(Array.isArray(alias)).toBe(true)
            expect(alias.find((e) => e.find === '@src')).toBeDefined()
            expect(alias.find((e) => e.find === '@store')).toBeDefined()
            expect(alias.find((e) => e.find === '@blocks')).toBeDefined()
            expect(alias.find((e) => e.find instanceof RegExp && e.find.source === '^react$')).toBeDefined()
            expect(alias.find((e) => e.find instanceof RegExp && e.find.source === '^react-dom$')).toBeDefined()

            const external = config.build?.rollupOptions?.external as Array<string | RegExp>
            expect(external).toContain('jquery')
            expect(external.some((ext) => ext instanceof RegExp && ext.test('@wordpress/blocks'))).toBe(true)
            expect(external.some((ext) => ext instanceof RegExp && ext.test('@wordpress/icons'))).toBe(false)
        })

        it('configures build settings', () => {
            const output = config.build?.rollupOptions?.output
            const outputConfig = Array.isArray(output) ? output[0] : output

            expect(config.build?.outDir).toBe('static/build')
            expect(config.build?.manifest).toBe('manifest.json')
            expect(outputConfig?.format).toBe('es')
            expect(outputConfig?.entryFileNames).toBe('[name]-[hash].js')
            const hmr = config.server?.hmr
            expect(typeof hmr === 'object' && hmr ? hmr.host : undefined).toBe('localhost')
            expect(config.optimizeDeps?.exclude).toContain('@wordpress/blocks')
        })
    })

    describe('hot-file plugin', () => {
        it('writes hot file at the configured port', () => {
            const hotPlugin = getPluginByName(plugins, 'vite-plugin-wp:hot-file')
            const cases = [
                { port: 3000, expected: 'http://localhost:3000' },
                { port: undefined, expected: 'http://localhost:5173' },
            ]
            for (const { port, expected } of cases) {
                const testServer = {
                    config: { server: port ? { port } : {} },
                    httpServer: { on: () => {}, once: () => {} },
                    transformRequest: () => Promise.resolve(null),
                } as unknown as ViteDevServer

                runConfigureServerOn(hotPlugin, testServer)
                const hotFile = path.join(tempDir, 'static', 'build', 'hot')
                expect(fs.readFileSync(hotFile, 'utf-8')).toBe(expected)
            }
        })

        it('cleans up hot file on server close', () => {
            const hotPlugin = getPluginByName(plugins, 'vite-plugin-wp:hot-file')
            let closeCb: (() => void) | undefined
            const testServer = {
                ...mockServer,
                httpServer: {
                    on: (event: string, cb: () => void) => {
                        if (event === 'close') closeCb = cb
                    },
                    once: () => {},
                },
            } as unknown as ViteDevServer

            runConfigureServerOn(hotPlugin, testServer)
            const hotFile = path.join(tempDir, 'static', 'build', 'hot')
            expect(fs.existsSync(hotFile)).toBe(true)
            closeCb?.()
            expect(fs.existsSync(hotFile)).toBe(false)
        })
    })

    describe('transform function', () => {
        it('skips non-JS files', async () => {
            const result = await runTransformHook(plugins, 'content', 'file.css')
            expect(result).toBeUndefined()
        })

        it('transforms imports correctly', async () => {
            const cases = [
                { desc: 'WordPress destructuring', input: `import { registerBlockType } from '@wordpress/blocks';`, expected: 'const { registerBlockType } = wp.blocks;' },
                { desc: 'WordPress default', input: `import blocks from '@wordpress/blocks';`, expected: 'const blocks = wp.blocks;' },
                { desc: 'WordPress namespace', input: `import * as blocks from '@wordpress/blocks';`, expected: 'const blocks = wp.blocks;' },
                { desc: 'React default', input: `import React from 'react';`, expected: 'const React = wp.element;' },
                { desc: 'React destructuring', input: `import { useState, useEffect } from 'react';`, expected: 'const { useState, useEffect } = wp.element;' },
                { desc: 'React default + destructuring', input: `import React, { useState, useEffect } from 'react';`, expected: 'const React = wp.element;\nconst { useState, useEffect } = wp.element;' },
                { desc: 'ReactDOM', input: `import ReactDOM from 'react-dom';`, expected: 'const ReactDOM = wp.element;' },
                { desc: 'kebab-case conversion', input: `import { InnerBlocks } from '@wordpress/block-editor';`, expected: 'const { InnerBlocks } = wp.blockEditor;' },
                { desc: 'aliases', input: `import { registerBlockType as register } from '@wordpress/blocks';`, expected: 'const { registerBlockType: register } = wp.blocks;' },
                { desc: 'icons are bundled', input: `import { alignLeft } from '@wordpress/icons';`, expected: `import { alignLeft } from '@wordpress/icons';` },
            ]

            for (const { desc, input, expected } of cases) {
                const result = await runTransformHook(plugins, input, 'test.js')
                expect(result?.code, desc).toContain(expected)
                expect(result?.map).toBeNull()
            }
        })

        it('injects HMR for editor entry files', async () => {
            const code = `console.log('test');`
            const editorResult = await runTransformHook(plugins, code, 'src/blocks/index.ts')
            const utilResult = await runTransformHook(plugins, code, 'src/utils/helper.ts')

            expect(editorResult?.code).toContain('import.meta.hot')
            expect(editorResult?.code).toContain('vite:beforeUpdate')
            expect(utilResult?.code).not.toContain('import.meta.hot')
        })

        it('injects per-block HMR when edit/save are imported', async () => {
            const code = `
import { registerBlockType } from '@wordpress/blocks'
import edit from './edit'
import save from './save'

const meta = { name: 'test/block' }

registerBlockType(meta.name, { ...meta, edit, save })
`
            const result = await runTransformHook(plugins, code, 'src/blocks/container/container.editor.tsx')
            expect(result?.code).toContain('__wpvApplyBlockHmr')
            expect(result?.code).toContain('import.meta.hot')
        })
    })

    describe('virtual block-hmr module', () => {
        it('resolves and loads the virtual id', async () => {
            const core = getCorePlugin(plugins)
            const resolveHandler = getHookHandler<(id: string) => string | undefined>(
                core.resolveId as ObjectHook<(id: string) => string | undefined> | undefined
            )
            const loadHandler = getHookHandler<(id: string) => Promise<string | undefined>>(
                core.load as ObjectHook<(id: string) => Promise<string | undefined>> | undefined
            )

            const resolved = resolveHandler?.('virtual:vite-plugin-wp/block-hmr')
            expect(typeof resolved).toBe('string')
            expect(resolved).toContain('virtual:vite-plugin-wp/block-hmr')

            const code = await loadHandler?.(resolved!)
            expect(typeof code).toBe('string')
            expect(code).toContain('applyBlockHmr')
        })
    })

    describe('config merging', () => {
        it('merges existing config options', async () => {
            const existing: UserConfig = {
                define: { EXISTING: '"value"' },
                resolve: { alias: { existing: '/path' } },
                server: { hmr: { port: 9999 } },
                optimizeDeps: { exclude: ['existing-dep'] },
                build: {
                    rollupOptions: {
                        external: ['existing-external'],
                        output: { entryFileNames: 'custom-[hash].js' },
                    },
                },
            }

            await runConfigHook(plugins, existing)

            expect(existing.define).toHaveProperty('EXISTING')
            const alias = existing.resolve?.alias as Array<{ find: any; replacement: string }>
            expect(alias.find((e) => e.find === 'existing')?.replacement).toBe('/path')
            const hmr = existing.server?.hmr
            expect(typeof hmr === 'object' && hmr && 'port' in hmr ? hmr.port : undefined).toBe(9999)
            expect(existing.optimizeDeps?.exclude).toContain('existing-dep')
            expect(existing.build?.rollupOptions?.external).toContain('existing-external')
        })
    })
})
