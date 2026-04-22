---
name: add-approval-endpoint
description: Add or refine a FastAPI endpoint for the human approval workflow in this Bug Bounty Copilot repository. Use when extending pending, approve, reject, or related operator-driven approval behaviors while preserving the formal execution gate.
---

# Add Approval Endpoint

## Objective
Extend the approval API without weakening the rule that sensitive execution remains blocked until a human decision reaches the approved state.

## When To Use
- When adding a new approval listing, detail, approve, reject, or expire endpoint.
- When exposing additional approval metadata needed by operators.
- When adjusting response schemas for approval state inspection.
- When wiring a new service operation into the existing approval workflow.

## When Not To Use
- Do not use for scope rules that do not change the approval API surface.
- Do not use for frontend-only approval UI changes.
- Do not use for background execution logic that bypasses operator review.
- Do not use when the task belongs in evidence persistence rather than the approval gate.

## Typical Files Impacted
- `app/api/routes.py`
- `app/api/deps.py`
- `app/schemas/models.py`
- `app/services/approval_workflow.py`
- `app/services/decision_log.py`
- `tests/test_approval_api.py`
- `README.md` if the main operator flow changes

## Tests Expected
- Integration tests for listing pending approvals.
- Integration tests for approve and reject transitions.
- Tests for invalid state transitions and unknown request IDs.
- Tests that execution remains blocked without an approved decision.
- Tests that operator identity, timestamp, and rationale are present in responses or persisted state.

## Workflow
1. Read the current approval models and service transitions before editing the route layer.
2. Reuse `ApprovalRequest` and `ApprovalDecision` semantics instead of inventing parallel state.
3. Keep endpoint handlers thin and move transition logic into `approval_workflow`.
4. Return explicit error responses for blocked, duplicate, or invalid transitions.
5. Preserve structured decision data so audit and evidence layers can snapshot the decision cleanly.
6. Update tests and `README.md` if the user-visible approval flow changed.

## Implementation Notes
- Never allow an endpoint to imply approval by omission or by default values.
- Preserve explicit operator attribution on every decision.
- Keep state transitions finite and auditable: `pending`, `approved`, `rejected`, `expired`.
- Favor idempotent read endpoints and narrowly scoped write endpoints.
