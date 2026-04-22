---
name: add-policy-rule
description: Add or refine a policy rule for program scope, approval thresholds, denylist rules, forbidden techniques, or related validation logic in this Bug Bounty Copilot repository. Use when changing Scope Guard behavior, program policy schemas, or policy-driven enforcement and tests.
---

# Add Policy Rule

## Objective
Add or refine one policy rule in the Bug Bounty Copilot so scope enforcement remains explicit, auditable, and fail-closed.

## When To Use
- When adding an allowlist or denylist rule.
- When changing wildcard domain matching behavior.
- When introducing or tightening a forbidden technique rule.
- When adding request-rate or target-count limits.
- When adjusting manual approval thresholds driven by program policy.

## When Not To Use
- Do not use for generic API endpoint work that does not change policy evaluation.
- Do not use for approval workflow changes that are not policy-driven.
- Do not use for frontend-only copy or layout edits.
- Do not use when the task is to add a brand-new domain module unrelated to scope enforcement.

## Typical Files Impacted
- `app/schemas/scope_guard.py`
- `app/services/scope_guard.py`
- `app/agents/scope_guard.py`
- `app/services/decision_log.py`
- `app/api/routes.py`
- `tests/` files covering scope and approval gating
- `README.md` and `docs/architecture.md` if the main flow or guarantees change

## Tests Expected
- Unit tests for allowlist behavior.
- Unit tests for denylist precedence.
- Unit tests for wildcard domain matching.
- Unit tests for forbidden techniques and hard-block rules.
- Unit tests for manual approval threshold behavior when policy changes affect approvals.

## Workflow
1. Read the current policy schema and service implementation before editing.
2. Keep policy inputs strongly typed in Pydantic.
3. Prefer fail-closed behavior when scope data is incomplete or ambiguous.
4. Return explicit codes and human-readable messages for blocked decisions.
5. Update route integration only if the new rule changes runtime gating.
6. Add or update tests in the same change.
7. Update `README.md` if the main policy flow or guarantees changed.

## Implementation Notes
- Treat `ProgramPolicy` as a security boundary, not as a convenience config.
- Denylist rules override allowlist rules.
- Keep rules deterministic and easy to audit.
- Do not hide policy decisions inside helpers without tests.
- Do not introduce behavior that assumes authorization implicitly.

## Repository-Specific Checks
- Preserve explicit separation between target validation, approval need detection, and hard blocking.
- Return structured, human-readable failure reasons so approval and evidence layers can store them.
- Keep policy behavior explainable from stored inputs without hidden side effects.
