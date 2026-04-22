---
name: add-agent-module
description: Add a new bounded agent module to this Bug Bounty Copilot repository with typed inputs and outputs, explicit approval boundaries, audit logging, and tests. Use when introducing a new agent responsibility or extending an existing agent with a distinct workflow.
---

# Add Agent Module

## Objective
Introduce one agent with a narrow responsibility, explicit interfaces, and clear integration points with Scope Guard, Approval Workflow, and the Evidence Store.

## When To Use
- When adding a new agent under `app/agents/`.
- When creating a new typed schema and service pair for agent-specific logic.
- When splitting a growing module into a clearer agent boundary.
- When adding a deterministic or mock execution path for development and tests.

## When Not To Use
- Do not use for one-off rule changes inside an existing module.
- Do not use for frontend-only work.
- Do not use for template-only report adjustments.
- Do not use when the task is only to expose an existing service through a new API route.

## Typical Files Impacted
- `app/agents/<agent_name>.py`
- `app/schemas/<agent_name>.py`
- `app/services/<agent_name>.py`
- `app/adapters/` when external tools or provider boundaries are involved
- `app/api/routes.py` if the agent is invoked through the API
- `tests/test_<agent_name>.py`
- `docs/architecture.md` and `README.md` if the main flow changes

## Tests Expected
- Schema validation tests for required and invalid fields.
- Service tests for deterministic behavior on structured inputs.
- Approval-gate tests when the agent can propose a sensitive next step.
- Mock or offline mode tests when the agent supports development without external systems.
- API integration tests if the agent is exposed through FastAPI endpoints.

## Workflow
1. Inspect adjacent agents, schemas, and services before adding a new module boundary.
2. Define strongly typed request and response models first.
3. Keep the agent responsible for analysis or orchestration, not for hidden side effects.
4. Route any sensitive next step through Scope Guard and Approval Workflow rather than executing directly.
5. Emit or preserve enough structured data for `decision_log` and evidence persistence.
6. Add tests in the same change and update `README.md` if the top-level flow changed.

## Implementation Notes
- Prefer one agent, one responsibility.
- Keep outputs factual and structured so downstream modules can audit them.
- Separate hypothesis generation from execution planning.
- Prefer repository-native services and adapters over embedding external logic inside the agent.
- Avoid adding new dependencies unless there is a concrete need the existing stack cannot cover.
