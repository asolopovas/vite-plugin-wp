# @asolopovas/vite-plugin-wp

[![npm](https://img.shields.io/npm/v/@asolopovas/vite-plugin-wp.svg)](https://www.npmjs.com/package/@asolopovas/vite-plugin-wp)
[![license](https://img.shields.io/npm/l/@asolopovas/vite-plugin-wp.svg)](./LICENSE)

Vite plugin for WordPress block and theme development. It rewrites `@wordpress/*` imports to `wp.*`, shims React and lodash to WordPress globals, writes a dev hot file, syncs `VITE_MODE`, and enables per-block editor HMR.

## Requirements

- Node `>=20`
- Vite `>=8`
- WordPress page with standard `wp.*` globals

## Install

```bash
npm i -D @asolopovas/vite-plugin-wp
```

```bash
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

- In dev, read `static/build/hot` and enqueue `@vite/client` plus your entries from that URL.
- In prod, read `static/build/manifest.json` and enqueue built assets.
- Enqueue JS entries and `@vite/client` as `type="module"` scripts.

## Behavior

### Imports

| Source | Result |
|---|---|
| `@wordpress/*` except `@wordpress/icons` | `wp.*` global |
| `@wordpress/icons` | bundled |
| `react`, `react-dom` | `wp.element` shim |
| `react/jsx-runtime` | `window.ReactJSXRuntime` shim |
| `lodash`, `lodash-es` | WordPress lodash shim |

Dev rewrites happen in `transform`; build rewrites happen in `renderChunk` so WordPress packages stay external.

### Block HMR

Files containing `blocks/index`, `editor`, or `vite-blocks` are treated as block entries. Calls to `registerBlockType` are wrapped so block edits re-register the changed block without a full reload.

```ts
import { registerBlockType } from '@wordpress/blocks'
import metadata from './block.json'
import Edit from './edit'
import save from './save'

registerBlockType(metadata.name, { edit: Edit, save })
```

### Env and hot file

During `vite dev`, the plugin writes the dev server URL to `static/build/hot` and sets `VITE_MODE=development` in `.env`. On exit it removes the hot file and restores `VITE_MODE=production`. Disable env sync with `syncViteMode: false`.

### Aliases

| Alias | Path |
|---|---|
| `@src` | `src` |
| `@store` | `src/store` |
| `@blocks` | `src/blocks` |
| `@icons` | `src/icons` |
| `@lib` | `src/lib` |

## Options

| Option | Type | Default | Description |
|---|---|---|---|
| `input` | `string \| string[]` | - | Rollup entry points |
| `outDir` | `string` | `static/build` | Build output directory |
| `manifest` | `string \| boolean` | `manifest.json` | Vite manifest setting |
| `assetsInlineLimit` | `number` | `0` | Keep assets as files for PHP/manifest loading |
| `base` | `string` | - | Asset URL prefix |
| `debugHmr` | `boolean` | `false` | Log block HMR events |
| `hmrDebounceMs` | `number` | `100` | Block re-register debounce |
| `envFile` | `string` | `.env` | File updated by env sync |
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

## Repository docs

See `AGENTS.md` and `docs/README.md` for contributor docs.

## Status

Experimental. Pin versions and report issues with reproductions.

## License

MIT
