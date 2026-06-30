# Architecture

Small modules, string transforms, and mechanical checks are the main design constraints.

## Stack

- Bun runtime/package manager; ESM package.
- `tsup` builds `src/index.ts` and `src/runtime/block-hmr.ts`.
- Vite `>=8` peer dependency.
- `bun test` for unit tests; Playwright/wp-env for WordPress e2e.

## Plugin composition

`wpPlugin(options)` returns:

1. `corePlugin` — import rewrites, block HMR injection, virtual module loading.
2. `hotFilePlugin` — dev server URL file for PHP loaders.
3. `hmrFilterPlugin` — CSS-to-JS HMR cascade filter.
4. `envModePlugin` — optional `VITE_MODE` sync.

## Source map

| Area | Files |
|---|---|
| Entry/config | `src/index.ts`, `src/config.ts`, `src/constants.ts` |
| Dev bridge | `src/dev-server.ts`, `src/hmr-filter.ts` |
| Transforms | `src/transforms/` |
| Shared helpers | `src/utils.ts` |
| HMR runtime/templates | `src/runtime/block-hmr.ts`, `src/templates/` |
| Shims | `src/shims/` |
| Tests/fixtures | `tests/`, `tests/fixtures/host-plugin/` |

## Build model

- Dev transforms JS-like files only.
- Production rewrites happen in `renderChunk` so WP packages stay external.
- `@wordpress/icons` stays bundled.
- React/lodash imports resolve to shims.
- Runtime HMR ships as `dist/runtime/block-hmr.js`.

## Performance invariants

- `corePlugin.transform` returns early during build.
- Keep hot-path regexes linear and module-scoped.
- Guard expensive passes with substring checks.
- Preserve early exits for impossible matches.
- Do not merge WordPress import regexes into one nested pattern.

## Virtual module

- Bare id: `virtual:vite-plugin-wp/block-hmr`.
- Resolved id: NUL-prefixed Rollup virtual id.
- Load source from `dist/runtime/block-hmr.js`.
- Do not rewrite template imports to `/@id/...`.
- Runtime code must not require ambient WP types.

## Enforcement

Prefer tests, scripts, and fixtures over prose-only rules. Repeated review feedback should become a check or a doc update.
