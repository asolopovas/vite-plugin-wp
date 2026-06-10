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

## Release notes

`gh-release` resolves notes in this order:

1. `NOTES_FILE=path` — a markdown file. Best for structured notes; no shell-escaping limits.
2. `NOTES="..."` — inline one-liner. Plain text only; use `NOTES_FILE` for backticks or markdown.
3. neither — `--generate-notes` (auto from merged PRs/commits).

Pass the arg to any release task, e.g. `make release-patch NOTES_FILE=notes.md`.

Keep notes concise: lead with the user-facing change and why, group as Added/Fixed/Changed/Internal, link issues/PRs. Example `notes.md`:

```
### Changed
- Consolidated `src/` modules to cut file fragmentation (no behavior change).

### Fixed
- e2e uses the installed Chrome channel instead of the bundled headless shell.
```

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
