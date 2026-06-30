# Product Sense

## Purpose

Who this plugin is for, the job it does, and what it deliberately does not do.

## Source of truth

- Public behavior and options: `README.md`.

## Current state

- Users: developers building WordPress block/theme assets with Vite.
- Job: give those projects a working Vite dev loop against WordPress — rewrite
  `@wordpress/*` imports to `wp.*` globals, shim React/lodash to WP globals,
  write a dev hot file for the PHP loader, sync `VITE_MODE`, and enable per-block
  editor HMR — while keeping WordPress packages external in production builds.
- Tradeoff: string transforms over AST for speed and small surface area; the
  plugin trusts standard `wp.*` globals to exist on the page.
- Non-goals: it is not a general WordPress build system, not a theme/plugin
  scaffolder, and not a PHP asset loader — the consuming project supplies the PHP
  that reads the hot file and manifest.

## Validation

- Behavior claims here match the README behavior/options tables.

## Links

- `README.md` — usage, behavior, and options.
- `ARCHITECTURE.md` — how the job is implemented.
