# Frontend

## Purpose

Record the browser-executed code this package ships.

## Source of truth

- `ARCHITECTURE.md` — virtual module and HMR runtime details.

## Current state

Not applicable as an application frontend — there is no app, router, or UI state
here. The only browser-executed code is the block-HMR runtime injected into a
consumer's dev build: `src/runtime/block-hmr.ts` (built to
`dist/runtime/block-hmr.js`) plus the templates in `src/templates/`. It must stay
free of ambient WordPress types and is loaded via the
`virtual:vite-plugin-wp/block-hmr` module.

## Validation

- `bun run test:e2e:hmr` exercises the runtime in the block editor.

## Links

- `ARCHITECTURE.md` — virtual module and build model.
- `docs/COMMANDS.md` — HMR e2e and manual browser checks.
