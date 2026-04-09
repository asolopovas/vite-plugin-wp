# @asolopovas/vite-plugin-wp

[![npm](https://img.shields.io/npm/v/@asolopovas/vite-plugin-wp.svg)](https://www.npmjs.com/package/@asolopovas/vite-plugin-wp)
[![license](https://img.shields.io/npm/l/@asolopovas/vite-plugin-wp.svg)](./LICENSE)

Vite plugin for WordPress block and theme development. Replaces `@wordpress/*` imports with `wp.*` globals, shims `react`/`react-dom`/`lodash-es` to their WP-provided counterparts, and enables per-block HMR in the editor.

## Requirements

- Vite `>=8` / Node `>=20`
- A WordPress page that exposes the standard `wp.*` globals

## Install

```bash
npm i -D @asolopovas/vite-plugin-wp
# or
bun add -D @asolopovas/vite-plugin-wp
```

## Quick start

```ts
// vite.config.ts
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

## What it does

### Import rewriting

| Source import | Rewritten to | When |
|---|---|---|
| `@wordpress/blocks` | `wp.blocks` | dev + build |
| `@wordpress/block-editor` | `wp.blockEditor` | dev + build |
| `@wordpress/icons` | kept as-is (bundled) | - |
| `react` / `react-dom` | `wp.element` | dev + build (via shim) |
| `lodash-es` / `lodash` | WP lodash global | dev + build (via shim) |

During **dev**, imports are rewritten at the transform stage. During **build**, `@wordpress/*` imports are rewritten in `renderChunk` so the output references `wp.*` globals directly - no bundling of WP packages.

### Block HMR

Files whose path contains `blocks/index`, `editor`, or `vite-blocks` are treated as block entry points. When such a file calls `registerBlockType`, the plugin wraps it so edits re-register only the changed block without a full page reload.

```ts
// src/blocks/index.ts - auto-detected as block entry
import { registerBlockType } from '@wordpress/blocks'
import metadata from './block.json'
import Edit from './edit'
import save from './save'

registerBlockType(metadata.name, { edit: Edit, save })
// ^ HMR wrapper injected automatically
```

### Hot file

During `vite dev`, a file is written to `static/build/hot` (configurable) containing the dev server URL (e.g. `http://localhost:5173`). Your PHP asset loader reads this file to decide whether to enqueue from the dev server or from the build manifest.

```php
// Example PHP loader
$hot = __DIR__ . '/static/build/hot';
if (file_exists($hot)) {
    $url = trim(file_get_contents($hot));
    wp_enqueue_script('my-block', $url . '/src/blocks/index.ts');
} else {
    // Read from manifest.json and enqueue built assets
}
```

The file is cleaned up automatically when the dev server stops.

### VITE_MODE env sync

On `vite dev` start, sets `VITE_MODE=development` in your `.env` file. Restores it to `production` on exit. Your PHP can read this to toggle behavior. Disable with `syncViteMode: false`.

### Resolve aliases

The plugin registers these path aliases automatically:

| Alias | Resolves to |
|---|---|
| `@src` | `src` |
| `@store` | `src/store` |
| `@blocks` | `src/blocks` |
| `@icons` | `src/icons` |
| `@lib` | `src/lib` |

## Options

| Option | Type | Default | Description |
|---|---|---|---|
| `input` | `string \| string[]` | - | Entry points for Rollup (CSS, block index files, etc.) |
| `outDir` | `string` | `static/build` | Directory where built assets and manifest are written |
| `manifest` | `string \| boolean` | `manifest.json` | Name of the manifest file PHP reads to resolve asset URLs, or `false` to skip |
| `assetsInlineLimit` | `number` | `0` | Vite normally inlines small assets (images, fonts) as base64 strings into your JS/CSS. That breaks WordPress because PHP needs to enqueue each asset by URL from the manifest. `0` disables inlining so every asset gets its own file and manifest entry |
| `base` | `string` | - | URL prefix for asset paths (e.g. `/wp-content/plugins/my-plugin/assets/dist/`) |
| `debugHmr` | `boolean` | `false` | Print block HMR register/unregister events to the browser console |
| `hmrDebounceMs` | `number` | `100` | Wait time (ms) before re-registering a block after an HMR update, prevents rapid consecutive re-renders |
| `envFile` | `string` | `.env` | Path to the env file where `VITE_MODE` is written during dev |
| `syncViteMode` | `boolean` | `true` | Write `VITE_MODE=development` to `envFile` on dev start and restore to `production` on exit |
| `hotFile` | `string` | `static/build/hot` | File written during dev containing the dev server URL, read by PHP to decide between dev and built assets |

## Full example

```ts
// vite.config.ts
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
// src/blocks/index.ts
import { registerBlockType } from '@wordpress/blocks'
import { useBlockProps } from '@wordpress/block-editor'
import { useState } from 'react'
// All three imports above resolve to WP globals - nothing is bundled.

import metadata from './my-block/block.json'
import Edit from './my-block/edit'
import save from './my-block/save'

registerBlockType(metadata.name, { edit: Edit, save })
```


## Status

> **Experimental - AI-assisted.** Works for the author's wp-vite-blocks setup but isn't battle-tested. Expect breaking changes; pin the version and file issues with reproductions.

## License

MIT
