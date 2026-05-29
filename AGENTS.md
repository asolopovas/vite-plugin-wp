# AGENTS Guide

Humans steer; agents execute. Treat the repo as source of truth and keep this file as a map, not a manual.

## Hard constraints

- Do not add code comments unless asked.
- Do not commit, tag, push, publish, or release unless explicitly instructed.
- Import from `react` only for hooks/types; avoid `import React`.
- Never run `playwright install` or `bun x playwright install`; if e2e needs `chromium_headless_shell-*`, stop and report it.
- Never type WordPress credentials in a browser; use cached Playwright auth.

## Docs map

- `README.md` — public usage and options.
- `docs/README.md` — docs index.
- `docs/ARCHITECTURE.md` — structure and invariants.
- `docs/COMMANDS.md` — commands, tests, e2e, browser workflow.
- `docs/RELEASE.md` — release flow and recovery.
- `docs/AGENT_WORKFLOW.md` — agent workflow.
- `docs/EXECUTION_PLANS.md` — checked-in plan template.

## Operating loop

Inspect repo → plan → edit → validate → drive the app/browser when behavior changes → inspect logs/traces → self-review → hand off with results and gaps.

Use `docs/exec-plans/active/` for complex or risky work; move completed plans to `docs/exec-plans/completed/`.

## Defaults

- Bun runtime/package manager; ESM-only.
- 4-space indent, single quotes in TS, focused diffs.
- Prefer string transforms in `src/transforms/`; avoid AST unless necessary.
- Keep `src/runtime/block-hmr.ts` free of ambient WP types.
- For `src/` changes, run `bun run test` and `bun run typecheck`.
- For transform/HMR changes, add `bun run test:e2e:hmr` or a documented `playwright-cli` smoke.
