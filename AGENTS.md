# AGENTS Guide

Humans steer; agents execute. Keep this file short; use `docs/` for detail.

## Hard constraints

- Do not comment code unless explicitly requested.
- Do not commit, publish, or release unless explicitly instructed.
- Import from `react` only for hooks/types; avoid `import React`.
- Never run `playwright install` or `bun x playwright install`.
- Never type WordPress credentials in a browser; use cached Playwright auth.

## Docs map

- `README.md` — public usage and options.
- `docs/README.md` — docs index.
- `docs/ARCHITECTURE.md` — structure and invariants.
- `docs/COMMANDS.md` — commands, tests, browser workflow.
- `docs/RELEASE.md` — release flow and recovery.
- `docs/AGENT_WORKFLOW.md` — agent workflow.

## Operating loop

1. Read the relevant docs before editing.
2. Inspect code and tests directly.
3. Make focused changes.
4. Validate narrowly, then broadly when needed.
5. Update docs with behavior changes.
6. Handoff with changes, validation, and unverified items.

## Style and validation

- 4-space indent. Single quotes in TS.
- Prefer string transforms in `src/transforms/` unless an AST is needed.
- Keep `src/runtime/block-hmr.ts` free of ambient WP types.
- For `src/` changes, run `bun run test` and `bun run typecheck`.
- For transform/HMR changes, run `bun run test:e2e:hmr` or a documented `playwright-cli` smoke.
