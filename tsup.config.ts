import { defineConfig } from 'tsup'

export default defineConfig([
    {
        entry: { index: 'src/index.ts' },
        format: ['esm'],
        dts: true,
        sourcemap: true,
        clean: true,
        target: 'node20',
        splitting: false,
        treeshake: true,
        external: ['vite'],
    },
    {
        entry: { 'runtime/block-hmr': 'src/runtime/block-hmr.ts' },
        format: ['esm'],
        dts: false,
        sourcemap: true,
        clean: false,
        target: 'es2020',
        splitting: false,
        treeshake: true,
    },
])
