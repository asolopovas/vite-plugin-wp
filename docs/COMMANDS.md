# Commands and Validation

Prefer `Makefile` targets when available. They wrap the common flows and keep command names discoverable for future agent runs.

## Common Commands

`make help` prints the menu and the current `package.json` version.

| Task | Command |
|---|---|
| Install deps | `make install` or `bun install` |
| Build once | `make build` or `bun run build` |
| Build in watch mode | `make dev` or `bun run dev` |
| All tests | `make test` |
| Unit tests | `make test-unit` or `bun run test` |
| Type check | `make typecheck` or `bun run typecheck` |
| Lint | `make lint` |
| Release gate | `make check` |
| Clean `dist/` | `make clean` |
| E2E, HMR + prod | `bun run test:e2e` |
| E2E, prod only | `bun run test:e2e:prod` |
| E2E, HMR/@dev only | `bun run test:e2e:hmr` |
| Start wp-env manually | `bun run wp-env:start` |
| Stop wp-env | `bun run wp-env:stop` |
| Build host-plugin fixture | `bun run fixture:build` |
| Run host-plugin Vite dev | `bun run fixture:dev` |

## Running Single Tests

- Bun file: `bun test tests/plugin.test.ts`
- Bun grep: `bun test --grep "transform"`
- Playwright spec/title: `bun x playwright test tests/e2e/HMR.e2e.ts --grep @dev`

## E2E With Self-Contained wp-env

The e2e suite bootstraps a real WordPress environment from `.wp-env.json` and mounts `tests/fixtures/host-plugin/` as a WordPress plugin.

`bun run test:e2e` does the following:

1. Builds `dist/` if missing.
2. Boots `wp-env` idempotently.
3. Starts a background Vite dev server inside the host-plugin fixture for `@dev` runs.
4. Builds the host-plugin fixture for `@prod` runs when sources are newer than the manifest.
5. Captures Playwright auth state through the wp-env default credentials and caches it at `tests/.meta/wp-env-user.json`.
6. Verifies the host-plugin `check_vite_dev_mode` ajax endpoint reports the expected mode.

The host-plugin fixture contains the PHP loader, `block.json`, the Test block source, and a `vite.config.ts` that imports `../../../dist/index.js` to consume the plugin under test.

| Var | Purpose | Default |
|---|---|---|
| `WP_HOST` | wp-env URL | `http://localhost:8888` |
| `WP_PROJECT_ROOT` | Host-plugin fixture dir | `tests/fixtures/host-plugin` |
| `WP_TEST_AUTH_PATH` | Playwright storage state | `tests/.meta/wp-env-user.json` |
| `WP_ENV_USER` / `WP_ENV_PASSWORD` | wp-env admin creds | `admin` / `password` |
| `VITE_PORT` | Dev server port | `5173` |
| `WP_TEST_FORCE_BUILD` | Force fixture rebuild even if manifest looks fresh | unset |
| `WP_TEST_SKIP_BUILD` | Skip fixture build | unset |
| `WP_ENV_KEEP_RUNNING` | Set to `0` to stop wp-env in teardown | unset |

Playwright browsers are not auto-installed by agents. If an e2e command complains about a missing `chromium_headless_shell-*`, stop and tell the user rather than running any install command.

## Browser Work With playwright-cli

Use `playwright-cli` for manual browser checks. Sessions are named with `-s=<name>` and persist across invocations. Chain commands with `&&` when useful.

### Auth and Bootstrap

`make auth` in a consumer project writes a cached state file to `~/.config/playwright-cli/auth/<host>.json`. Load that state instead of typing credentials.

```bash
playwright-cli -s=dbg open 'http://example.test/wp-login.php'
playwright-cli -s=dbg state-load ~/.config/playwright-cli/auth/example.test.json
playwright-cli -s=dbg goto 'http://example.test/wp-admin/post.php?post=<ID>&action=edit'
```

### Useful Commands

```bash
playwright-cli -s=dbg open <url>
playwright-cli -s=dbg goto <url>
playwright-cli -s=dbg snapshot
playwright-cli -s=dbg fill <ref> <text>
playwright-cli -s=dbg click <ref>
playwright-cli -s=dbg eval '<fn>'
playwright-cli -s=dbg state-load <file>
playwright-cli -s=dbg state-save <file>
playwright-cli -s=dbg close
```

`eval` functions must return `JSON.stringify(...)`.

### Fast Path

- Prefer one `eval` returning one JSON object over several snapshots.
- Confirm the HMR client in the page with:

```bash
playwright-cli -s=hmr eval '() => JSON.stringify({ vite: !!document.querySelector("script[src*=\"@vite/client\"]"), blocks: wp.blocks.getBlockTypes().length })'
```

- `goto` and `reload` can hang after a dev build. Close and reopen a fresh session instead of retrying indefinitely.

## HMR / Dev-Server Verification Without Playwright Test

When the Playwright Test harness is unavailable, verify HMR manually against a consumer project.

```bash
sed -i 's/^VITE_MODE=production$/VITE_MODE=development/' .env
nohup bun run dev > /tmp/wpvb-dev.log 2>&1 &
curl -s "http://example.test/wp-admin/admin-ajax.php?action=check_vite_dev_mode"
make auth
```

Then load the cached auth state and inspect the editor:

```bash
playwright-cli -s=hmr open 'http://example.test/wp-login.php'
playwright-cli -s=hmr state-load ~/.config/playwright-cli/auth/example.test.json
playwright-cli -s=hmr goto 'http://example.test/wp-admin/post.php?post=<ID>&action=edit'
playwright-cli -s=hmr eval '() => JSON.stringify({ vite: !!document.querySelector("script[src*=\"@vite/client\"]"), blocks: wp.blocks.getBlockTypes().length })'
```

Restore `.env` to `VITE_MODE=production` and kill the background Vite process before handoff.

## Validation Before Handoff

- For docs-only changes, inspect rendered markdown mentally and confirm links/commands are plausible.
- For `src/` changes, run `bun run test` and `bun run typecheck`.
- For transform or HMR changes, run `bun run test:e2e:hmr` or at minimum a documented `playwright-cli` smoke.
- For release tooling changes, run the narrow script or dry-run path that proves the changed branch.
- Report any skipped validation with the reason.
