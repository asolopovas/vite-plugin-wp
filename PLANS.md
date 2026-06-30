# Plans

## Purpose

Roadmap summary and the entry point to checked-in execution plans.

## Source of truth

- Active plans: `docs/exec-plans/active/`.
- Completed plans and validation evidence: `docs/exec-plans/completed/`.
- Accepted debt: `docs/exec-plans/tech-debt-tracker.md`.

## Current state

No formal roadmap. The package is experimental (see `README.md` status). Work is
driven from the repo and tracked per task; there are no active exec plans at
present (`docs/exec-plans/active/` is empty).

Use a lightweight chat plan for small work. Check in an exec plan only for
complex, risky, or multi-session work; move it from `active/` to `completed/`
when done.

### Exec plan template

```md
# <Task>

## Goal

## Scope

## Acceptance criteria

## Progress

## Decisions

## Validation

## Debt
```

Keep plans current while working. Record validation commands and outcomes before
handoff.

## Validation

- Plan files resolve from this page and live under `docs/exec-plans/`.
- Each completed plan records the validation commands it ran.

## Links

- `AGENTS.md` — operating loop.
- `docs/AGENT_WORKFLOW.md` — when to check in a plan.
