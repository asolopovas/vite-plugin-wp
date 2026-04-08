# @asolopovas/vite-plugin-wp

[![npm](https://img.shields.io/npm/v/@asolopovas/vite-plugin-wp.svg)](https://www.npmjs.com/package/@asolopovas/vite-plugin-wp)
[![license](https://img.shields.io/npm/l/@asolopovas/vite-plugin-wp.svg)](./LICENSE)

Vite plugin for WordPress block and theme development. Rewrites `@wordpress/*` imports to `wp.*` globals, shims `react`/`react-dom` to `wp.element`, and enables block-level HMR inside the editor.

> ⚠️ **Experimental — AI-assisted.** Works for the author's wp-vite-blocks setup but isn't battle-tested. Expect breaking changes; pin the version and file issues with reproductions.

## Features

- `@wordpress/*` → `wp.*` global rewriting (build-time)
- `react` / `react-dom` → `wp.element` shim (dev + build)
- Block-level HMR for `registerBlockType` entries
- Hot file writer for PHP asset loaders (`static/build/hot`)
- `VITE_MODE` auto-sync in `.env` on dev start/stop
- `lodash-es` shim backed by the WP lodash global

## Requirements

- Vite `>=8` · Node `>=20`
- A WordPress page that exposes the usual `wp.*` globals

## Install

```bash
bun add -D @asolopovas/vite-plugin-wp
# or: npm i -D @asolopovas/vite-plugin-wp
```

## Usage

```ts
import { defineConfig } from 'vite'
import wpPlugin from '@asolopovas/vite-plugin-wp'

export default defineConfig({
    plugins: [
        wpPlugin({
            input: ['src/styles/blocks.css', 'src/blocks/index.ts'],
        }),
    ],
})
```

`vite` (dev) writes a `hot` file and transforms imports on the fly. `vite build` emits a manifest and rewrites `@wordpress/*` to `wp.*` in chunks.

Files matched as block entries (those calling `registerBlockType`) are wrapped so edits re-register only the touched block — no full reload.

## Options

| Option              | Type                 | Default            | Description                                                            |
| ------------------- | -------------------- | ------------------ | ---------------------------------------------------------------------- |
| `input`             | `string \| string[]` | —                  | Forwarded to `build.rollupOptions.input`.                              |
| `outDir`            | `string`             | `static/build`     | Vite output directory.                                                 |
| `manifest`          | `string \| boolean`  | `manifest.json`    | Manifest filename, or `false` to disable.                              |
| `assetsInlineLimit` | `number`             | `0`                | Keep assets as files by default so PHP loaders can resolve them.       |
| `base`              | `string`             | —                  | Public base path (forwarded to Vite `base`).                           |
| `debugHmr`          | `boolean`            | `false`            | Log block HMR events to `console`.                                     |
| `hmrDebounceMs`     | `number`             | `100`              | Debounce window for block re-registration.                             |
| `envFile`           | `string`             | `.env`             | Path for the `VITE_MODE` sync.                                         |
| `syncViteMode`      | `boolean`            | `true`             | Toggle the `VITE_MODE` sync sub-plugin.                                |
| `hotFile`           | `string`             | `static/build/hot` | Dev-server hot file path.                                              |

## License

MIT
