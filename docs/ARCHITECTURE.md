# Architecture

Small modules, string transforms, and tests are the main design constraints.

## Stack

- Bun runtime/package manager.
- ESM package via `"type": "module"`.
- `tsup` builds `src/index.ts` and `src/runtime/block-hmr.ts`.
- Vite `>=8` peer dependency.
- `bun test` for unit tests; Playwright for WordPress e2e.

## Plugin composition

`wpPlugin(options)` returns:

1. `corePlugin` — import rewrites, block HMR injection, virtual module loading.
2. `hotFilePlugin` — dev server URL file for PHP loaders.
3. `hmrFilterPlugin` — blocks CSS-to-JS HMR cascades.
4. `envModePlugin` — syncs `VITE_MODE` when enabled.

## Source map

- `src/index.ts` — plugin composer and core plugin.
- `src/config.ts` — Vite config mutation.
- `src/options.ts` — options and defaults.
- `src/constants.ts` — aliases, externals, markers.
- `src/hot-file.ts` — hot file lifecycle.
- `src/hmr-filter.ts` — CSS HMR filter.
- `src/env-mode.ts` — `.env` sync.
- `src/transforms/` — string transforms.
- `src/templates/` — injected HMR templates.
- `src/runtime/block-hmr.ts` — browser HMR helper.
- `src/shims/` — React/lodash/WP global shims.
- `tests/` — unit, runtime, e2e, helpers.
- `tests/fixtures/host-plugin/` — WordPress plugin fixture.

## Performance invariants

- `corePlugin.transform` returns early during build.
- Build rewrites happen in `renderChunk`.
- Keep chunk regexes linear.
- Guard expensive passes with substring checks.
- Keep hot-path regex literals at module scope.
- Preserve early exits for impossible matches.
- Do not merge the WordPress import regexes into one nested pattern.

## Virtual module

- Bare id: `virtual:vite-plugin-wp/block-hmr`.
- Resolved id: NUL-prefixed Rollup virtual id.
- Load source from `dist/runtime/block-hmr.js`.
- Do not rewrite template imports to `/@id/...`.
- Runtime code must not require ambient WP types.

## Taste rules

- Keep modules small; do not create a god file.
- Prefer tests or scripts over prose-only invariants.
- Prefer boring local abstractions.
- If docs and code disagree, verify with code/tests and fix one.

## Gutenberg source

Use `~/src/gutenberg` when present. If needed:

```bash
git clone --depth=1 https://github.com/WordPress/gutenberg.git ~/src/gutenberg
```
