# @asolopovas/vite-plugin-wp

> ⚠️ **Experimental — AI-assisted code.** This plugin was substantially written with the help of an LLM. It works for the author's own wp-vite-blocks setup, but it is not battle-tested across diverse WordPress/Vite projects and may contain bugs or rough edges. Expect breaking changes. Use at your own risk, pin the version, and please file issues with reproductions.

Vite plugin for WordPress block and theme development.

## Features

- Transforms `@wordpress/*` imports to `wp.*` globals
- Shims `react`/`react-dom` to `wp.element`
- Block-level HMR for `registerBlockType` entries
- Hot file writer for WordPress asset loader integration
- Auto-syncs `VITE_MODE` in `.env` when the dev server starts/stops

## Install

```bash
bun add -D @asolopovas/vite-plugin-wp
# or
npm i -D @asolopovas/vite-plugin-wp
```

## Usage

```ts
import { defineConfig } from 'vite'
import wpPlugin from '@asolopovas/vite-plugin-wp'

export default defineConfig({
    plugins: [
        wpPlugin({
            input: [
                'src/styles/blocks.css',
                'src/blocks/index.ts',
            ],
        }),
    ],
})
```

## Options

| Option              | Type                  | Default                   |
| ------------------- | --------------------- | ------------------------- |
| `input`             | `string \| string[]`  | —                         |
| `outDir`            | `string`              | `static/build`            |
| `manifest`          | `string \| boolean`   | `manifest.json`           |
| `assetsInlineLimit` | `number`              | `0`                       |
| `base`              | `string`              | —                         |
| `debugHmr`          | `boolean`             | `false`                   |
| `hmrDebounceMs`     | `number`              | `100`                     |
| `envFile`           | `string`              | `<cwd>/.env`              |
| `syncViteMode`      | `boolean`             | `true`                    |
| `hotFile`           | `string`              | `static/build/hot`        |

## License

MIT
