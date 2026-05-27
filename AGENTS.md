# AGENTS Guide for @asolopovas/vite-plugin-wp

Humans steer; agents execute. Keep this file as the short map for agent runs, not the encyclopedia. When a task touches implementation, tests, release flow, browser automation, or docs, read the linked repository docs first and update them when reality changes.

## Hard Constraints

- Do not comment the code. No comments unless explicitly requested.
- Do not commit unless explicitly instructed.
- Do not publish to npm unless explicitly instructed.
- Import from `react` only when needed for hooks/types; avoid `import React`.
- Never run `playwright install` / `bun x playwright install`. Use `playwright-cli` for manual browser work; if the e2e scripts complain about a missing `chromium_headless_shell-*`, stop and tell the user.
- Never type WordPress credentials into the browser. Reuse the cached state file from the consumer project (`make auth` in `wp-vite-blocks`, or any host that produced `~/.config/playwright-cli/auth/<host>.json`).

## Repository Knowledge Map

- `README.md` — public package usage, options, examples, and project status.
- `docs/README.md` — repository docs index and maintenance rule.
- `docs/ARCHITECTURE.md` — stack, plugin composition, source layout, performance invariants, virtual modules, and Gutenberg source policy.
- `docs/COMMANDS.md` — local commands, e2e bootstrap, Playwright/browser workflow, and validation expectations.
- `docs/RELEASE.md` — release automation, npm/GitHub publishing rules, and idempotent recovery steps.
- `docs/AGENT_WORKFLOW.md` — agent-first operating model, planning, documentation hygiene, feedback loops, and entropy control.

## Agent Operating Loop

1. Read this map, then read the smallest relevant deeper doc before editing.
2. Inspect the code and tests directly; do not rely on hidden context, chat history, or guesses.
3. For non-trivial work, keep a short plan in the conversation or a checked-in plan only when the work spans multiple sessions.
4. Make focused changes that preserve the plugin's architecture and performance invariants.
5. Validate with the narrowest meaningful command first, then broader checks when source behavior changes.
6. If a failure reveals missing docs, tooling, or guardrails, fix the capability instead of just retrying.
7. Before handoff, state what changed, what validation ran, and what remains unverified.

## Agent-Legible Invariants

- Repository-local files are the system of record. Decisions that matter later belong in code, tests, or markdown, not only in chat.
- Prefer mechanical guardrails over prose-only rules: tests, type checks, lint rules, scripts, and explicit fixtures.
- Keep docs cross-linked and current. When implementation behavior changes, update the docs in the same change.
- Keep boundaries strict and modules small. Do not reintroduce a god file or hide behavior behind opaque abstractions.
- Optimize for future agent runs: clear names, colocated tests, deterministic commands, and inspectable fixtures.

## Style and Validation Summary

- 4-space indent. Single quotes in TS. Keep diffs focused.
- Prefer string-level transforms in `src/transforms/` over AST walkers unless the case truly needs one.
- Runtime code in `src/runtime/block-hmr.ts` must stay independent of ambient WP types.
- Run `bun run test` and `bun run typecheck` for any `src/` change.
- Run `bun run test:e2e:hmr` or a documented `playwright-cli` smoke for transform/HMR changes.
- Do not publish, release, or commit unless the user explicitly asks.
