# Security

## Purpose

Threat model, secret handling, and security checks for this build-time plugin.

## Source of truth

- Release/secret rules: `docs/RELEASE.md`.
- Hard constraints: `AGENTS.md`.

## Current state

This is a dev/build-time Vite plugin; it ships no server, auth, or user data
handling. The relevant surface is local secrets and credentials during
development and release.

- npm publish auth lives in `.npmrc` (gitignored; `.npmrc.example` is the
  template). Tokens and 2FA are supplied by the user only — never pasted,
  invented, or requested by agents. 2FA passes through as `OTP=<code>`.
- WordPress credentials are never typed into a browser; e2e and manual checks use
  cached Playwright auth (`tests/.meta/wp-env-user.json`).
- Filesystem side effects are local and scoped: the plugin writes the dev hot
  file (`static/build/hot`) and edits `VITE_MODE` in the configured `.env`.
- `.env` and `.npmrc` are gitignored to keep local config out of the repo.

## Validation

- `npm whoami` must succeed before any publish (precondition in `docs/RELEASE.md`).
- `make check` runs before every release; never bypass it or use `--no-verify`.

## Links

- `docs/RELEASE.md` — release flow and secret rules.
- `RELIABILITY.md` — recovery from interrupted dev side effects.
