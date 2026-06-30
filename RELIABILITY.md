# Reliability

## Purpose

Failure modes and recovery for the plugin's local side effects and its release
flow. There are no runtime SLOs to track.

## Source of truth

- Release/recovery targets: `docs/RELEASE.md`.
- Commands and e2e: `docs/COMMANDS.md`.

## Current state

As a build-time library, the plugin has no service SLOs. The reliability concerns
are local side effects and release idempotency.

- Dev side effects: `vite dev` writes `static/build/hot` and sets
  `VITE_MODE=development` in `.env`; both are reverted on clean exit. A crash can
  leave the hot file present or `.env` set to `development`.
- Recovery from a dirty dev exit: remove the stale hot file and restore
  `VITE_MODE=production` in the configured `.env`.
- Release idempotency: existing local/remote tags, already-published npm
  versions, and existing GitHub releases are skipped, so a failed release is
  recovered by rerunning the same target — never by deleting tags.

## Validation

- `bun run test:e2e` exercises dev/build flows including hot-file and mode sync.
- Reruns of a failed `make release-*` target are safe (idempotent).

## Links

- `docs/RELEASE.md` — recovery targets and idempotency rules.
- `SECURITY.md` — secret handling during release.
