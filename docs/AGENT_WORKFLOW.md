# Agent Workflow

Humans steer; agents execute. The repository is the source of truth.

## Operating loop

1. Read `AGENTS.md`, then the linked doc for the task.
2. Inspect files and tests directly.
3. Plan only as much as needed.
4. Make small, verifiable changes.
5. Run the narrowest useful validation first.
6. Update docs when behavior changes.
7. Handoff with changes, validation, and gaps.

## Durable knowledge

Put important knowledge in code, tests, scripts, fixtures, or markdown. Do not rely on chat history.

Use checked-in plans only for work spanning sessions or subsystems. Put active plans in `docs/plans/active/` and completed plans in `docs/plans/completed/`.

## Feedback loops

Use local tools instead of asking humans to paste context:

- Read files and tests.
- Run focused commands.
- Use diagnostics before broad builds.
- Use `playwright-cli` for manual UI/HMR checks.
- Use cached WordPress auth; never type credentials.

## Guardrails

Prefer mechanical checks over prose:

- Unit tests for transforms.
- E2E fixtures for WordPress/HMR.
- Type checks for API boundaries.
- Idempotent release scripts.
- Clear remediation messages.

## Cleanup

Keep seed patterns healthy:

- Remove stale docs.
- Consolidate duplicated policy.
- Keep fixtures realistic.
- Add regression tests for bugs.
- Record architectural decisions only when future work needs them.

## Escalate when

- A secret, OTP, credential, browser install, or publishing permission is missing.
- Product judgment is needed.
- Validation cannot run for environmental reasons.
- A request violates a hard constraint.
