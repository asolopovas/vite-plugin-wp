import { defineConfig } from 'vite'
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
