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

The file is cleaned up automatically when the dev server stops.

<details>
<summary>Example ViteAssets PHP loader</summary>

```php
<?php

class ViteAssets
{
    public string $manifestDir;
    public string $manifestPath;
    public bool $isDev = false;
    public array $assets = [];
    public string $baseUrl;
    public array $assetQueue = [];
    public array $manifest = [];

    public function __construct(array $assets, string $manifestDir = __DIR__ . '/../static/build')
    {
        $this->assets       = $assets;
        $this->manifestDir  = $manifestDir;
        $this->isDev        = $this->checkDevMode();
        $this->manifestPath = "{$this->manifestDir}/manifest.json";

        if (!$this->isDev) {
            $this->parseManifest();
        }

        $this->baseUrl = $this->isDev
            ? 'http://localhost:' . (getenv('VITE_PORT') ?: '5173')
            : $this->resolveBaseUrl();

        $this->prepareAssetQueue();
    }

    public function register(): void
    {
        add_filter('script_loader_tag', [$this, 'filterScriptLoaderTag'], 10, 2);

        foreach ($this->assetQueue as $asset) {
            if (in_array($asset['type'], ['js', 'ts', 'jsx', 'tsx'])) {
                wp_enqueue_script(
                    $asset['handle'], $asset['src'], $asset['dependencies'],
                    $this->isDev ? (string) time() : null, $asset['in_footer']
                );
            } elseif ($asset['type'] === 'css') {
                wp_enqueue_style(
                    $asset['handle'], $asset['src'], $asset['dependencies'],
                    $this->isDev ? (string) time() : null
                );
            }
        }
    }

    public function filterScriptLoaderTag(string $tag, string $handle): string
    {
        foreach ($this->assetQueue as $asset) {
            if ($handle === $asset['handle'] && in_array($asset['type'], ['js', 'ts', 'jsx', 'tsx'])) {
                if (!str_contains($tag, 'type="module"') && !str_contains($tag, "type='module'")) {
                    return str_replace('<script ', '<script type="module" ', $tag);
                }
            }
        }
        return $tag;
    }

    private function prepareAssetQueue(): void
    {
        if ($this->isDev) {
            $hasScript = false;
            foreach ($this->assets as $key => $value) {
                [$name, $options] = is_int($key) ? [$value, []] : [$key, $value];
                $ext = strtolower(pathinfo($name, PATHINFO_EXTENSION));
                if (in_array($ext, ['js', 'ts', 'jsx', 'tsx'])) $hasScript = true;
                $this->addAsset($name, "{$this->baseUrl}/{$name}", $options);
            }
            if ($hasScript) {
                $this->assetQueue['vite-client'] = [
                    'type' => 'js', 'handle' => 'vite-client',
                    'src' => "{$this->baseUrl}/@vite/client",
                    'dependencies' => [], 'in_footer' => false,
                ];
            }
        } else {
            foreach ($this->assets as $key => $value) {
                [$name, $options] = is_int($key) ? [$value, []] : [$key, $value];
                if (isset($this->manifest[$name])) {
                    $this->processImportTree($name);
                    $src = "{$this->baseUrl}/{$this->manifest[$name]['file']}";
                } else {
                    $src = "{$this->baseUrl}/{$name}";
                }
                $this->addAsset($name, $src, $options);
            }
        }
    }

    private function processImportTree(string $name, array &$seen = []): void
    {
        if (isset($seen[$name]) || !isset($this->manifest[$name])) return;
        $seen[$name] = true;
        $entry = $this->manifest[$name];

        foreach ($entry['imports'] ?? [] as $import) {
            $this->processImportTree($import, $seen);
            if (isset($this->manifest[$import]['file'])) {
                $this->addAsset($import, "{$this->baseUrl}/{$this->manifest[$import]['file']}");
            }
        }
        foreach ($entry['css'] ?? [] as $css) {
            $this->addAsset($css, "{$this->baseUrl}/{$css}");
        }
    }

    private function addAsset(string $name, string $src, array $options = []): void
    {
        $ext = strtolower(pathinfo($name, PATHINFO_EXTENSION));
        $this->assetQueue[$name] = [
            'type'         => str_contains($ext, 'css') ? 'css' : $ext,
            'handle'       => $options['handle'] ?? pathinfo($name, PATHINFO_FILENAME),
            'src'          => $src,
            'dependencies' => $options['dependencies'] ?? [],
            'in_footer'    => $options['in_footer'] ?? true,
        ];
    }

    private function parseManifest(): void
    {
        if (!file_exists($this->manifestPath)) return;
        $this->manifest = json_decode(file_get_contents($this->manifestPath), true) ?: [];
    }

    private function checkDevMode(): bool
    {
        $mode = getenv('VITE_MODE') ?: ($_ENV['VITE_MODE'] ?? 'production');
        return strtolower(trim($mode)) === 'development';
    }

    private function resolveBaseUrl(): string
    {
        $dir = realpath($this->manifestDir) ?: $this->manifestDir;
        if (function_exists('get_site_url')) {
            return untrailingslashit(
                str_replace($_SERVER['DOCUMENT_ROOT'] ?? '', get_site_url(), $dir)
            );
        }
        return $dir;
    }
}
```

**Usage:**

```php
// Dev:  enqueues from http://localhost:5173/src/blocks/index.ts + injects @vite/client
// Prod: resolves hashed filenames from static/build/manifest.json

add_action('enqueue_block_editor_assets', function () {
    (new ViteAssets([
        'src/blocks/index.ts' => [
            'handle'       => 'my-blocks',
            'dependencies' => ['wp-element', 'wp-blocks', 'wp-block-editor'],
        ],
    ]))->register();
});

add_action('admin_enqueue_scripts', function (string $hook) {
    if ($hook !== 'options-media.php') return;
    (new ViteAssets([
        'src/admin/settings.tsx' => [
            'handle'       => 'my-settings',
            'dependencies' => ['wp-element', 'wp-components', 'wp-api-fetch'],
        ],
    ]))->register();
});
```

</details>

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
