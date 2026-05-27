# Architecture

This repository is intentionally small, explicit, and agent-legible. Prefer clear file boundaries, deterministic transforms, and tests that encode behavior over broad prose instructions.

## Stack

- **Bun** is the package manager and runtime. The package is ESM-only via `"type": "module"`.
- **tsup** builds the Node plugin from `src/index.ts` to `dist/index.js` and separately bundles `src/runtime/block-hmr.ts` to `dist/runtime/block-hmr.js`.
- **Vite 8** is the peer dependency. The exported plugin composes several smaller Vite plugins.
- **Playwright Test** runs e2e coverage against a real WordPress install that loads the host-plugin fixture.
- Unit tests run with `bun test` under `tests/`.

## Plugin Composition

`wpPlugin(options)` returns four sub-plugins:

1. **corePlugin** — string-level import rewriting, block HMR injection, and virtual module resolution.
2. **hotFilePlugin** — writes the dev server URL for PHP loaders.
3. **hmrFilterPlugin** — prevents CSS-to-JS HMR cascades.
4. **envModePlugin** — syncs `VITE_MODE` to `.env` during dev.

Transforms in `src/transforms/` are regex-based, not AST-based. Keep this intentional unless a case truly needs an AST walker.

## Source Layout

- `src/index.ts` — main plugin composer; returns the plugin array from `wpPlugin(options)`.
- `src/core.ts` — core transform, render chunk rewrite, and virtual module loading.
- `src/hot-file.ts` — dev hot-file lifecycle.
- `src/hmr-filter.ts` — CSS HMR filtering.
- `src/env-mode.ts` — `VITE_MODE` sync.
- `src/config.ts`, `src/constants.ts`, `src/options.ts` — options, defaults, and shared constants.
- `src/transforms/` — string transforms for `@wordpress/*`, `react`, `react-dom`, and lodash shims.
- `src/templates/` — per-block HMR wrapper templates and editor HMR client.
- `src/runtime/block-hmr.ts` — browser-side helper exposed through `virtual:vite-plugin-wp/block-hmr`.
- `src/shims/` — module shim files for lodash and WordPress-provided globals.
- `tests/` — unit tests, runtime tests, Playwright setup/teardown, and helpers.
- `tests/fixtures/host-plugin/` — real WordPress plugin fixture consumed by e2e tests.
- `tests/fixtures/Test/` — snapshot of the Test block used to keep the plugin repo self-documenting.

## Performance Invariants

Violating these can bring back `[PLUGIN_TIMINGS]` warnings.

- `corePlugin.transform` returns early when `isBuild` is true. At build time, this plugin should not run per-module transforms; investigate `renderChunk` and the `config` hook first.
- `rewriteWordpressImportsToGlobals` runs on full concatenated chunks that can be hundreds of KB. Keep regexes linear.
- Do not collapse the current dual-clause and single-clause WordPress import patterns into one nested pattern with `[^}]*` inner branches.
- Guard hot-path regex passes with cheap substring checks first, such as `@wordpress/`, `react`, and `registerBlockType`.
- Keep RegExp literals at module scope. Avoid `new RegExp(...)` inside per-module or per-chunk functions.
- Preserve early exits for code paths that cannot match a transform.

## Virtual Modules

- `virtual:vite-plugin-wp/block-hmr` is resolved by the plugin's `resolveId` hook and loaded from `dist/runtime/block-hmr.js`.
- Do not rewrite template imports to `/@id/...` literals. Vite import analysis will try to statically resolve the string.
- Always import the bare virtual id.
- Runtime code must not depend on ambient WP types because it ships as a bundled ES module.

## Architecture and Taste Rules

- Keep the flat `src/` structure with small modules. Do not reintroduce a god file.
- Encode important behavior in tests, fixtures, and build scripts so future agents can validate changes directly.
- Prefer boring, inspectable abstractions over opaque helpers that agents cannot reason about locally.
- When adding an invariant, prefer a mechanical check or focused test over prose alone.
- If docs and implementation disagree, treat the implementation and tests as evidence, then update the docs or fix the code so the system is coherent again.

## Gutenberg Source

If Gutenberg internals are needed, check `~/src/gutenberg` first. If missing, clone it with:

```bash
git clone --depth=1 https://github.com/WordPress/gutenberg.git ~/src/gutenberg
```
