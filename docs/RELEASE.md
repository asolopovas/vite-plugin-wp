# Release

Do not release unless explicitly instructed.

## Targets

Each release runs `make check`, tags `vX.Y.Z`, publishes to npm, and creates a GitHub release. Patch/minor/major targets also bump, commit, and push `main` first.

| Task | Command |
|---|---|
| Patch | `make release-patch` |
| Minor | `make release-minor` |
| Major | `make release-major` |
| Current version | `make release` |

## Recovery targets

Use only for recovery or explicit user requests.

- `make bump LEVEL=patch|minor|major`
- `make tag`
- `make publish`
- `make gh-release`

## Rules

- Never bypass `make check` or use `--no-verify`.
- Do not publish unless the user says release/publish.
- The user supplies npm 2FA as `OTP=<code>`.
- Never paste, invent, or request an npm token.
- `prepublishOnly` runs build, tests, and typecheck.

## Idempotency

- Existing local/remote tags are skipped.
- Already-published npm versions are skipped.
- Existing GitHub releases are skipped.

If a release fails, fix the input and rerun the same target. Example: after a bad OTP, rerun `make release OTP=<code>`. Do not delete tags to restart.

## Manual publish

Only when explicitly requested: bump `package.json`, validate, and publish with the user-provided OTP. Commit only if asked.
