# Commands

Prefer `make` targets when available.

## Common

| Task | Command |
|---|---|
| Help/version | `make help` |
| Install | `make install` or `bun install` |
| Build | `make build` or `bun run build` |
| Watch build | `make dev` or `bun run dev` |
| All tests | `make test` |
| Unit tests | `make test-unit` or `bun run test` |
| Type check | `make typecheck` or `bun run typecheck` |
| Lint | `make lint` or `bun run lint` |
| Format | `bun run format` / `bun run format:check` |
| Quality gate | `bun run quality` (format, lint, type check, build, unit tests) |
| Release gate | `make check` or `bun run check` |
| Clean | `make clean` |
| All e2e | `bun run test:e2e` |
| HMR e2e | `bun run test:e2e:hmr` |
| Prod e2e | `bun run test:e2e:prod` |
| Start wp-env | `bun run wp-env:start` |
| Stop wp-env | `bun run wp-env:stop` |
| Build fixture | `bun run fixture:build` |
| Fixture dev server | `bun run fixture:dev` |

## Single tests

```bash
bun test tests/plugin.test.ts
bun test --grep "transform"
bun x playwright test tests/e2e/HMR.e2e.ts --grep @dev
```

## E2E

The Playwright suite uses `.wp-env.json` and mounts `tests/fixtures/host-plugin/` as a WordPress plugin. It builds `dist/` if needed, starts wp-env, runs fixture dev/build flows, caches auth at `tests/.meta/wp-env-user.json`, and checks the fixture ajax mode endpoint.

| Var | Default |
|---|---|
| `WP_HOST` | `http://localhost:8888` |
| `WP_PROJECT_ROOT` | `tests/fixtures/host-plugin` |
| `WP_TEST_AUTH_PATH` | `tests/.meta/wp-env-user.json` |
| `WP_ENV_USER` / `WP_ENV_PASSWORD` | `admin` / `password` |
| `VITE_PORT` | `5173` |
| `WP_TEST_FORCE_BUILD` | unset |
| `WP_TEST_SKIP_BUILD` | unset |
| `WP_ENV_KEEP_RUNNING` | unset; set `0` to stop in teardown |

Never run Playwright browser installers. If a command reports a missing `chromium_headless_shell-*`, stop and tell the user.

## Manual browser checks

Use `playwright-cli` with cached auth; never type credentials.

```bash
playwright-cli -s=hmr open 'http://example.test/wp-login.php'
playwright-cli -s=hmr state-load ~/.config/playwright-cli/auth/example.test.json
playwright-cli -s=hmr goto 'http://example.test/wp-admin/post.php?post=<ID>&action=edit'
playwright-cli -s=hmr eval '() => JSON.stringify({ vite: !!document.querySelector("script[src*=\"@vite/client\"]"), blocks: wp.blocks.getBlockTypes().length })'
playwright-cli -s=hmr close
```

For consumer-project HMR checks: set `VITE_MODE=development`, start `bun run dev`, run the browser check, then restore `VITE_MODE=production` and stop the dev server.

## Validation before handoff

- Docs-only: check markdown, links, and commands.
- `src/` changes: `bun run test`, `bun run typecheck`, and relevant quality checks (`bun run lint`, `bun run format:check`).
- Transform/HMR changes: `bun run test:e2e:hmr` or a documented `playwright-cli` smoke.
- Release tooling: run the narrow dry-run or script path.
- Report skipped validation and why.
