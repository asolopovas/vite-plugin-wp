# Architecture

## Purpose

System map for the plugin: modules, plugin composition, the build model, and the
performance and virtual-module invariants that changes must preserve.

## Source of truth

- Code under `src/` is canonical; this page maps it, it does not duplicate it.
- Public behavior and options: `README.md`.
- Commands and validation: `docs/COMMANDS.md`.

## Current state

Small modules, string transforms, and mechanical checks are the main design
constraints.

### Stack

- Bun runtime/package manager; ESM package.
- `tsup` builds `src/index.ts` and `src/runtime/block-hmr.ts`.
- Vite `>=8` peer dependency.
- `bun test` for unit tests; Playwright/wp-env for WordPress e2e.

### Plugin composition

`wpPlugin(options)` returns:

1. `corePlugin` — import rewrites, block HMR injection, virtual module loading.
2. `hotFilePlugin` — dev server URL file for PHP loaders.
3. `hmrFilterPlugin` — CSS-to-JS HMR cascade filter.
4. `envModePlugin` — optional `VITE_MODE` sync.

### Source map

| Area | Files |
|---|---|
| Entry/config | `src/index.ts`, `src/config.ts`, `src/constants.ts` |
| Dev bridge | `src/dev-server.ts`, `src/hmr-filter.ts` |
| Transforms | `src/transforms/` |
| Shared helpers | `src/utils.ts` |
| HMR runtime/templates | `src/runtime/block-hmr.ts`, `src/templates/` |
| Shims | `src/shims/` |
| Tests/fixtures | `tests/`, `tests/fixtures/host-plugin/` |

### Build model

- Dev transforms JS-like files only.
- Production rewrites happen in `renderChunk` so WP packages stay external.
- `@wordpress/icons` stays bundled.
- React/lodash imports resolve to shims.
- Runtime HMR ships as `dist/runtime/block-hmr.js`.

### Virtual module

- Bare id: `virtual:vite-plugin-wp/block-hmr`.
- Resolved id: NUL-prefixed Rollup virtual id.
- Load source from `dist/runtime/block-hmr.js`.
- Do not rewrite template imports to `/@id/...`.
- Runtime code must not require ambient WP types.

## Validation

Performance invariants — keep these true when editing hot paths:

- `corePlugin.transform` returns early during build.
- Keep hot-path regexes linear and module-scoped.
- Guard expensive passes with substring checks.
- Preserve early exits for impossible matches.
- Do not merge WordPress import regexes into one nested pattern.

Prove changes with `bun run test` and `bun run typecheck`; transform/HMR changes
also need `bun run test:e2e:hmr` (see `docs/COMMANDS.md`). Prefer tests, scripts,
and fixtures over prose-only rules; repeated review feedback should become a
check or a doc update.

## Links

- `AGENTS.md` — agent rules and source map.
- `QUALITY_SCORE.md` — quality bar and no-comments gate.
- `docs/COMMANDS.md` — commands, tests, e2e.
- `PLANS.md` — roadmap and exec plans.
