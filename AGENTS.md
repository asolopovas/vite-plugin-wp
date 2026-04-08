# AGENTS Guide for @asolopovas/vite-plugin-wp

Follow unless the user gives explicit overrides.

## Hard Constraints

- Do not comment the code. No comments unless explicitly requested.
- Do not commit unless explicitly instructed.
- Do not publish to npm unless explicitly instructed.
- Import from `react` only when needed for hooks/types; avoid `import React`.
- Never run `playwright install` / `bun x playwright install`. Use `playwright-cli` for manual browser work; if the e2e scripts complain about a missing `chromium_headless_shell-*`, stop and tell the user.
- Never type WordPress credentials into the browser. Reuse the cached state file from the consumer project (`make auth` in `wp-vite-blocks`, or any host that produced `~/.config/playwright-cli/auth/<host>.json`).

## Stack

- **Bun** (package manager + runtime). ESM-only (`"type": "module"`).
- **tsup** for building the plugin (`src/index.ts` → `dist/index.js`, plus runtime bundle `dist/runtime/block-hmr.js`).
- **Vite 8** peer dep. The plugin composes several sub-plugins (core transform, hot-file writer, HMR filter, env-mode sync).
- **Playwright Test** for e2e against a real WordPress install that loads a block plugin exercising this Vite plugin.
- Unit tests via `bun test` under `tests/`.

## Layout

- `src/index.ts` — main plugin composer; returns the plugin array from `wpPlugin(options)`.
- `src/core.ts` / `src/hot-file.ts` / `src/hmr-filter.ts` / `src/env-mode.ts` — sub-plugins.
- `src/transforms/` — string transforms (`@wordpress/*` → `wp.*`, react → `wp.element`, lodash shim).
- `src/templates/` — per-block HMR wrapper templates and the editor HMR client.
- `src/runtime/block-hmr.ts` — browser-side helper exposed via the virtual module `virtual:vite-plugin-wp/block-hmr`. Bundled separately by tsup.
- `src/shims/` — module shim files for lodash-es and friends.
- `tests/` — unit tests (`*.test.ts` run with `bun test`) and e2e (`tests/e2e/*.e2e.ts` run with Playwright).
- `tests/fixtures/Test/` — snapshot of the Test block that the e2e suite exercises. Kept here so the plugin repo is self-documenting; the live block that wp-env serves lives in the consumer project.

## Commands

Prefer the `Makefile` targets — they wrap the common flows. `make help` prints the menu and current `package.json` version.

| Task | Command |
|---|---|
| Install deps | `make install` (= `bun install`) |
| Build (one-shot) | `make build` (= `bun run build`) |
| Build (watch) | `make dev` (= `bun run dev`) |
| Unit tests | `make test` (= `bun run test`) |
| Type check | `make typecheck` (= `bun run typecheck`) |
| Release gate | `make check` (test + typecheck + build) |
| Clean `dist/` | `make clean` |
| E2E (HMR + smoke) | `bun run test:e2e` |
| E2E (prod only) | `bun run test:e2e:prod` |
| E2E (HMR/@dev only) | `bun run test:e2e:hmr` |

## Releasing

Releases are automated through the `Makefile`. Each release runs `make check`, creates a `vX.Y.Z` git tag, publishes to npm, and creates a GitHub release with auto-generated notes.

| Task | Command | What it does |
|---|---|---|
| Patch release (0.1.2 → 0.1.3) | `make release-patch` | `npm version patch` → commit → push `main` → check → tag → publish → `gh release create` |
| Minor release | `make release-minor` | same as above with `minor` |
| Major release | `make release-major` | same as above with `major` |
| Re-release current version | `make release` | Skips the bump/commit step. Useful when the version was already bumped by hand (e.g. during a compounded refactor) and you just need to ship it. |

**Low-level targets** (only reach for these if something went wrong mid-release):

- `make bump LEVEL=patch|minor|major` — bumps `package.json` without touching git.
- `make tag` — creates and pushes `v$(version)`.
- `make publish` — `npm publish` of the current version.
- `make gh-release` — `gh release create v$(version) --generate-notes`.

**Rules:**

- Never bypass `make check`. The release target runs it before tagging; do not use `--no-verify` or skip it manually.
- Do not publish unless explicitly instructed. "Commit and push" is not the same as "release".
- npm uses 2FA — if `make publish` fails with E403, the user will supply a fresh token; do not paste your own.
- If a release fails partway (e.g. tag created but `npm publish` failed), finish the pieces individually (`make publish`, then `make gh-release`). Do NOT delete the tag — `gh release create` against the existing tag is fine.

### Running e2e against a consumer

The plugin's e2e suite assumes a live WordPress install with a block plugin that uses `@asolopovas/vite-plugin-wp` and registers the Test block (`test/block`). The typical host is `wp-vite-blocks`.

Required env:

| Var | Purpose | Example |
|---|---|---|
| `WP_HOST` | URL of the running WP install | `http://example.test` |
| `WP_PROJECT_ROOT` | Absolute path to the consumer plugin (has `src/blocks/Test/index.tsx`, `src/styles/test.css`) | `/home/andrius/www/example.test/wp-content/plugins/wp-vite-blocks` |
| `WP_TEST_AUTH_PATH` | Playwright storage state file | `~/.config/playwright-cli/auth/example.test.json` (auto-detected if omitted) |
| `VITE_PORT` | Dev server port (default `5173`) | `5173` |
| `VITE_MODE` | Auto-resolved from `--grep @dev` / `@prod`; override only for debugging | `development` |
| `WP_TEST_BLOCK_SOURCE` | Override for the block file the HMR test mutates | (defaults to `$WP_PROJECT_ROOT/src/blocks/Test/index.tsx`) |
| `WP_TEST_BLOCK_CSS` | Override for the CSS file the HMR test mutates | (defaults to `$WP_PROJECT_ROOT/src/styles/test.css`) |

Typical invocation:

```bash
# In the consumer project:
bun run dev                  # starts Vite, flips VITE_MODE=development in .env

# In this repo:
WP_HOST=http://example.test \
WP_PROJECT_ROOT=/home/andrius/www/example.test/wp-content/plugins/wp-vite-blocks \
bun run test:e2e:hmr
```

The e2e harness does **not** start Vite, wp-env, or auth for you. Run `bun run dev` in the consumer and generate an auth state file first (e.g. `make auth` in `wp-vite-blocks`).

### Running single tests

- Bun file / grep: `bun test tests/plugin.test.ts` · `bun test --grep "transform"`
- Playwright spec / title: `bun x playwright test tests/e2e/HMR.e2e.ts --grep @dev`

## Publishing

- `prepublishOnly` runs `bun run build && bun run test && bun run typecheck`. Never bypass it.
- Bump `version` in `package.json`. Commit. Then `npm publish`.
- npm uses 2FA — the user will supply a token if prompted.

## Style

- 4-space indent. Single quotes in TS. Keep diffs focused.
- Flat `src/` with small modules. Do NOT re-introduce a god file.
- Prefer string-level transforms in `src/transforms/` over AST walkers unless the case truly needs one.
- Runtime (`src/runtime/block-hmr.ts`) must have no dependency on ambient WP types — it ships as a bundled ES module consumed via the virtual module.

### Virtual modules

- `virtual:vite-plugin-wp/block-hmr` — resolved by the plugin's `resolveId` hook, loaded from `dist/runtime/block-hmr.js`. Do NOT rewrite template imports to `/@id/...` literals; vite's import-analysis will try to statically resolve the string. Always import the bare virtual id.

## Gutenberg Source

If you need Gutenberg source files (block internals, component implementations, etc.), check `~/src/gutenberg` first. If missing: `git clone --depth=1 https://github.com/WordPress/gutenberg.git ~/src/gutenberg`.

## Browser (playwright-cli)

Sessions are named with `-s=<name>` and persist across invocations; chain commands with `&&`.

### Auth + bootstrap

`make auth` in the consumer project writes a cached state file to `~/.config/playwright-cli/auth/<host>.json`. Load that in playwright-cli sessions:

```bash
playwright-cli -s=dbg open 'http://example.test/wp-login.php'
playwright-cli -s=dbg state-load ~/.config/playwright-cli/auth/example.test.json
playwright-cli -s=dbg goto 'http://example.test/wp-admin/post.php?post=<ID>&action=edit'
```

### Commands

```bash
playwright-cli -s=dbg open <url>         # launch + navigate
playwright-cli -s=dbg goto <url>         # navigate within healthy session
playwright-cli -s=dbg snapshot           # writes .playwright-cli/page-*.yml (refs)
playwright-cli -s=dbg fill <ref> <text>
playwright-cli -s=dbg click <ref>
playwright-cli -s=dbg eval '<fn>'        # MUST return JSON.stringify(...)
playwright-cli -s=dbg state-load <file>
playwright-cli -s=dbg state-save <file>
playwright-cli -s=dbg close
```

### Fast path

- Prefer `eval` over `snapshot`. One `eval` returning one JSON object beats several small checks.
- Confirm HMR client in the page: `eval '() => JSON.stringify({ vite: !!document.querySelector("script[src*=\"@vite/client\"]"), blocks: wp.blocks.getBlockTypes().length })'`.
- `goto`/`reload` can hang after a dev build — `close` and `open` fresh instead of retrying.

### HMR / dev-server verification (when the Playwright harness is unavailable)

The Playwright Test harness needs `chromium_headless_shell-*` which we never install locally. To verify HMR by hand against a consumer:

```bash
# in the consumer project:
sed -i 's/^VITE_MODE=production$/VITE_MODE=development/' .env
nohup bun run dev > /tmp/wpvb-dev.log 2>&1 &
curl -s "http://example.test/wp-admin/admin-ajax.php?action=check_vite_dev_mode"
make auth

# then with playwright-cli:
playwright-cli -s=hmr open 'http://example.test/wp-login.php'
playwright-cli -s=hmr state-load ~/.config/playwright-cli/auth/example.test.json
playwright-cli -s=hmr goto 'http://example.test/wp-admin/post.php?post=<ID>&action=edit'
playwright-cli -s=hmr eval '() => JSON.stringify({ vite: !!document.querySelector("script[src*=\"@vite/client\"]"), blocks: wp.blocks.getBlockTypes().length })'
```

Restore `.env` (`VITE_MODE=production`) and `kill` the backgrounded `vite` PID before handoff.

## Validation Before Handoff

- Ran `bun run test` and `bun run typecheck` for any `src/` change.
- Ran `bun run test:e2e:hmr` (or at minimum a playwright-cli smoke) for any transform/HMR change.
- Did not publish without explicit instruction.
- No forbidden changes (no unsolicited commit, no added code comments).
