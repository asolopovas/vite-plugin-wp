# @asolopovas/vite-plugin-wp

[![npm](https://img.shields.io/npm/v/@asolopovas/vite-plugin-wp.svg)](https://www.npmjs.com/package/@asolopovas/vite-plugin-wp)
[![license](https://img.shields.io/npm/l/@asolopovas/vite-plugin-wp.svg)](./LICENSE)

Vite plugin for WordPress block/theme builds. It rewrites `@wordpress/*` imports to `wp.*`, shims React/lodash to WordPress globals, writes a dev hot file, syncs `VITE_MODE`, and enables per-block editor HMR.

## Requirements

- Node `>=20`
- Vite `>=8`
- WordPress page with standard `wp.*` globals

## Install

```bash
npm i -D @asolopovas/vite-plugin-wp
bun add -D @asolopovas/vite-plugin-wp
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

Your PHP loader should:

- In dev, read `static/build/hot` and enqueue `@vite/client` plus entries from that URL.
- In prod, read `static/build/manifest.json` and enqueue built assets.
- Enqueue JS entries and `@vite/client` as `type="module"` scripts.

## Behavior

| Feature | Behavior |
|---|---|
| WP imports | `@wordpress/*` becomes `wp.*`; `@wordpress/icons` stays bundled |
| React/lodash | `react`, `react-dom`, `react/jsx-runtime`, `lodash`, `lodash-es` resolve to shims |
| Block HMR | Entries containing `blocks/index`, `editor`, or `vite-blocks` get `registerBlockType` HMR wrappers |
| Hot file | `vite dev` writes the dev server URL to `static/build/hot` and removes it on exit |
| Env sync | `vite dev` sets `VITE_MODE=development` in `.env` and restores `production` on exit |
| Aliases | Adds `@src`, `@store`, `@blocks`, `@icons`, `@lib` |

Dev import rewrites happen in `transform`; build rewrites happen in `renderChunk` so WordPress packages stay external.

## Options

| Option | Type | Default | Description |
|---|---|---|---|
| `input` | `string \| string[]` | Vite/Rollup default | Rollup entry points |
| `outDir` | `string` | `static/build` | Build output directory |
| `manifest` | `string \| boolean` | `manifest.json` | Vite manifest setting |
| `assetsInlineLimit` | `number` | `0` | Keep assets as files for PHP/manifest loading |
| `base` | `string` | Vite default | Asset URL prefix |
| `debugHmr` | `boolean` | `false` | Log block HMR events |
| `hmrDebounceMs` | `number` | `100` | Block re-register debounce |
| `envFile` | `string` | `.env` | Env sync target |
| `syncViteMode` | `boolean` | `true` | Toggle `VITE_MODE` sync |
| `hotFile` | `string` | `static/build/hot` | Dev-server URL file |

## Full config

```ts
import { defineConfig } from 'vite'
import wpPlugin from '@asolopovas/vite-plugin-wp'

export default defineConfig({
    plugins: [
        wpPlugin({
            input: [
                'src/styles/editor.css',
                'src/styles/frontend.css',
                'src/blocks/index.ts',
            ],
            outDir: 'assets/dist',
            hotFile: 'assets/dist/hot',
            base: '/wp-content/plugins/my-plugin/assets/dist/',
            debugHmr: true,
        }),
    ],
})
```

```ts
import { registerBlockType } from '@wordpress/blocks'
import { useBlockProps } from '@wordpress/block-editor'
import { useState } from 'react'
import metadata from './my-block/block.json'
import Edit from './my-block/edit'
import save from './my-block/save'

registerBlockType(metadata.name, { edit: Edit, save })
```

## Repository docs

See `AGENTS.md` and `docs/README.md`.

## Status

Experimental. Pin versions and report issues with reproductions.

## License

MIT
