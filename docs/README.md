# Repository Docs

This directory is the durable knowledge base for `@asolopovas/vite-plugin-wp`. Keep `AGENTS.md` short and use these files for details that future agents need to discover.

## Index

- `ARCHITECTURE.md` — stack, plugin composition, source layout, performance invariants, virtual modules, and Gutenberg source policy.
- `COMMANDS.md` — local commands, e2e bootstrap, Playwright/browser workflow, and validation expectations.
- `RELEASE.md` — release automation, npm/GitHub publishing rules, and idempotent recovery steps.
- `AGENT_WORKFLOW.md` — agent-first operating model, planning, documentation hygiene, feedback loops, and entropy control.

## Maintenance Rule

When code, commands, fixtures, or release behavior changes, update the relevant doc in the same change. Prefer a small accurate doc over a large stale manual.
