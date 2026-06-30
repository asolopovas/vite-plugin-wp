# Quality Score

## Purpose

The quality bar for the package and the gates that enforce it, including the
no-comments policy.

## Source of truth

- Gate commands: `docs/COMMANDS.md`.
- Style defaults and constraints: `AGENTS.md`.

## Current state

Quality is enforced mechanically, not by prose.

- Quality gate: `bun run quality` runs format, lint, type check, build, and unit
  tests. Release gate: `make check` (`bun run check`).
- No-comments gate: do not add code comments unless asked. The only comments kept
  in `src/` are verified functional directives — string-transform sentinels
  (`/* __wpv... */`, `/*__WPV_HMR_*__*/`), `/* @vite-ignore */`, and a single
  required `oxlint-disable` for an intentional NUL-prefixed regex.
- Style: 4-space indent, single quotes in TS, focused diffs; ESM-only.
- Coverage expectations: unit tests for transforms; e2e fixtures for
  WordPress/HMR; type checks for API boundaries.

## Validation

- `bun run quality` passes (format, lint, typecheck, build, unit tests).
- `bun run lint` enforces the comment/style rules (oxlint).
- Transform/HMR changes additionally pass `bun run test:e2e:hmr`.

## Links

- `docs/COMMANDS.md` — exact gate commands.
- `ARCHITECTURE.md` — performance invariants to preserve.
