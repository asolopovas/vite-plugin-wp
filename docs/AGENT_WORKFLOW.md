# Agent Workflow

This project follows an agent-first operating model inspired by the February 11, 2026 harness engineering lessons: humans steer, agents execute, and the repository is the system of record.

## Core Principle

Optimize for future agent runs. Anything important that is not visible in the repository might as well not exist to the next agent. Capture durable knowledge in code, tests, scripts, fixtures, or markdown.

## AGENTS.md Is a Map

`AGENTS.md` should stay short and point to deeper docs. Avoid turning it into a monolithic manual. Large instruction blobs crowd out task context, rot quickly, and are hard to verify.

Use progressive disclosure:

1. Start with `AGENTS.md`.
2. Read the linked doc that matches the task.
3. Inspect the relevant code and tests.
4. Update the linked doc if the source of truth changes.

## Depth-First Execution

Break broad goals into small capabilities that unlock the next step.

- Identify the smallest missing capability: docs, test, fixture, script, helper, transform, or browser check.
- Build or fix that capability first.
- Use it to validate the product change.
- Prefer one verified narrow loop over many speculative edits.

When retrying a failed task, ask what was missing from the environment. Do not just retry with a stronger prompt when a doc, test, command, fixture, or guardrail would make the work deterministic.

## Planning

Use lightweight plans for small work and checked-in plans only when they add durable value.

A checked-in plan is appropriate when work spans multiple sessions, crosses several subsystems, or needs a decision log. If plans are added later, place active plans under `docs/plans/active/` and completed plans under `docs/plans/completed/`.

Plans should include:

- Goal and acceptance criteria.
- Relevant docs and files.
- Step list with validation per step.
- Decisions made during implementation.
- Remaining risks or follow-ups.

## Feedback Loops

Agents should use repository tools directly rather than requiring humans to paste context.

- Read files, inspect tests, run narrow commands, and query diagnostics locally.
- For UI/HMR work, drive the app with `playwright-cli` when Playwright Test is unavailable.
- For WordPress editor checks, use cached auth state and never type credentials.
- Treat test failures, browser observations, logs, and generated artifacts as first-class feedback.

A good handoff states the loop that was run and the evidence it produced.

## Agent Legibility

Make the codebase easy for agents to inspect, reason about, and modify.

- Prefer simple modules and explicit names.
- Keep behavior close to tests and fixtures.
- Choose dependencies and abstractions that are inspectable from this repository.
- Avoid one-off helpers when a shared utility or testable abstraction would centralize an invariant.
- Record architectural decisions in markdown when they will matter later.

## Guardrails Over Micromanagement

Do not encode taste only as prose. Promote repeated review feedback into mechanical checks where practical.

Useful guardrails include:

- Unit tests for transform behavior.
- E2E fixtures for WordPress/HMR behavior.
- Type checks for API boundaries.
- Scripts that make release steps idempotent.
- Clear error messages that tell the next agent how to remediate a failure.

Within enforced boundaries, allow local implementation freedom.

## Entropy Control

Agent-generated code tends to copy existing patterns, including weak ones. Keep the seed patterns healthy.

During normal work:

- Remove stale docs instead of preserving contradictory guidance.
- Consolidate duplicated helpers when duplication starts to encode policy.
- Keep fixtures representative of real usage.
- Add regression tests when fixing bugs.
- Update quality or architecture docs when a recurring issue becomes visible.

Small continuous cleanup is preferred over large periodic rewrites.

## Escalation

Escalate to the user when:

- A required secret, credential, OTP, browser install, or publishing permission is missing.
- The task requires product judgment not encoded in the repo.
- Validation cannot run for an environmental reason.
- A change would violate a hard constraint.

Escalations should be specific and include the next command or decision needed from the user.
