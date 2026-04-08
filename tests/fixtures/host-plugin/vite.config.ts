import { defineConfig } from 'vite'
// Inside the plugin repo: import the plugin from its own dist/ build (run `bun run build` first).
import wpPlugin from '../../../dist/index.js'

export default defineConfig({
    server: {
        watch: {
            usePolling: true,
            interval: 200,
        },
    },
    plugins: [
        ...wpPlugin({
            input: ['src/vite-blocks.ts'],
        }),
    ],
})
