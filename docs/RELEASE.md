# Release and Publishing

Releases are automated through the `Makefile`. Never publish or create release artifacts unless the user explicitly asks.

## Release Targets

Each release runs `make check`, creates a `vX.Y.Z` git tag, publishes to npm, and creates a GitHub release with generated notes.

| Task | Command | What it does |
|---|---|---|
| Patch release | `make release-patch` | `npm version patch`, commit, push `main`, check, tag, publish, GitHub release |
| Minor release | `make release-minor` | Same flow with `minor` |
| Major release | `make release-major` | Same flow with `major` |
| Re-release current version | `make release` | Skips the bump/commit step and ships the current version |

## Low-Level Targets

Use these only to recover from a partially completed release or when the user explicitly asks.

- `make bump LEVEL=patch|minor|major` — bumps `package.json` without touching git.
- `make tag` — creates and pushes `v$(version)`.
- `make publish` — publishes the current version to npm.
- `make gh-release` — creates the GitHub release for `v$(version)`.

## Rules

- Never bypass `make check`.
- Do not use `--no-verify` to skip release checks.
- Do not publish unless explicitly instructed. "Commit and push" is not the same as "release".
- npm uses 2FA. The user supplies the OTP with `make release OTP=<code>` or `make publish OTP=<code>`.
- Never paste or invent an npm token.
- `prepublishOnly` runs `bun run build && bun run test && bun run typecheck`; never bypass it.

## Idempotency and Recovery

Release steps are idempotent:

- `tag` skips work if the tag exists locally or remotely.
- `publish` skips work if the package version already exists on npm.
- `gh-release` skips work if the GitHub release already exists.

If a release fails partway, rerun the same release target with the corrected input. For example, if an OTP was mistyped after the tag was pushed, rerun `make release OTP=<code>`. Do not delete the tag to start over.

## Manual Publishing Notes

Manual publishing is normally unnecessary. If explicitly requested:

1. Bump `version` in `package.json`.
2. Commit the version bump only if the user asked for a commit.
3. Run the required validation.
4. Publish with the user-provided OTP.
