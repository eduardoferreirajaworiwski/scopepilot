# AGENTS.md

## Purpose
This repository builds a **Bug Bounty Copilot** for **authorized programs only**.

The system must be:
- human-in-the-loop
- secure by default
- auditable
- explainable
- defensive in architecture and behavior

Codex must optimize for a product that helps humans reason, review, approve, execute, and document work inside explicit program scope. Codex must not drift into autonomous offensive automation.

## Product Intent
The platform is an internal copilot for authorized bug bounty operations with explicit scope controls.

Core flow:
1. `program`
2. `target`
3. `hypothesis`
4. `approval`
5. `execution`
6. `evidence`
7. `finding`

These stages must remain clearly separated in code, data models, and UX.

## Mandatory Rules
- Never assume implicit authorization.
- Always require explicit per-program scope.
- Never execute actions outside declared scope.
- Always separate hypothesis from execution.
- Every sensitive execution requires explicit human approval.
- Every action must create an audit trail.
- Prefer modular architecture over tightly coupled orchestration.
- Prefer strongly typed, explainable code.
- Always update `README.md` when the main flow changes.
- Always create or update tests when critical logic changes.
- Avoid heavy dependencies unless there is a concrete justification.

## Security Principles
- Default to deny. If scope, approval, or provenance is unclear, block the action in code and surface the reason.
- Treat program scope as a first-class security boundary, not as UI decoration.
- Never encode logic that performs destructive, aggressive, or high-risk automation by default.
- Sensitive operations must be gated by explicit approval records, not by inferred state.
- Preserve separation between planning and execution. Suggesting a test path is not equivalent to authorization to run it.
- Prefer passive or non-invasive workflows unless the architecture explicitly models approval and scope checks for stronger actions.
- Do not bypass scope checks for internal tools, adapters, background jobs, or admin paths.
- Do not store secrets, tokens, or sensitive evidence in logs.
- Make risky behavior obvious in code. Hidden side effects are unacceptable.

## Engineering Principles
- Keep the architecture modular. Separate API, domain services, agents, adapters, persistence, and frontend concerns.
- Prefer explicit domain models and typed schemas over ad hoc dictionaries.
- Keep business rules in services or domain modules, not spread across route handlers and UI code.
- Make approval state transitions explicit and testable.
- Favor small, composable modules that can be audited independently.
- Use structured logging and deterministic state transitions wherever possible.
- Choose simple infrastructure for the MVP: FastAPI, SQLite, Pydantic, and lightweight queues if needed.
- Introduce complexity only when it reduces concrete risk or removes a real bottleneck.

## Agent Modeling Principles
Agents in this repository are responsibility-bounded components, not freeform autonomous actors.

### Scope Guard Agent
- Owns scope validation and safety gating.
- Must validate targets against explicit program scope.
- Must validate proposed execution plans before they can proceed.
- Must fail closed when scope data is incomplete or ambiguous.

### Recon Analyst Agent
- Owns recon analysis and safe collection planning.
- Should prefer passive recon in the default path.
- Must not silently expand into active execution behavior.
- Must record what was observed, how it was observed, and under which target/program context.

### Hypothesis Agent
- Owns generation and refinement of hypotheses.
- Must never perform execution as part of hypothesis generation.
- Output should be explainable, reviewable, and tied to available evidence or recon context.

### Approval Workflow
- Owns explicit human decision points.
- Approval records must identify who requested, who approved or rejected, when, and why.
- Approval state must be durable and auditable.
- Approval must be checked again before sensitive execution, not only at request time.

### Evidence and Report Agent
- Owns evidence normalization, finding generation, and reporting artifacts.
- Must preserve provenance from execution to evidence to finding.
- Should not mutate or hide raw evidence without traceability.

## Adapter Policy
- Adapters are integration boundaries for external tools and services.
- Each adapter must have a narrow, explicit responsibility.
- Adapters must be replaceable and isolated behind clear interfaces or protocols.
- Default adapter behavior should be safe, limited, and easy to mock in tests.
- Any adapter capable of sensitive actions must expose those actions explicitly in code.
- Avoid adapters that combine discovery, execution, and reporting in one layer.
- Prefer dry-run, passive, or mock-safe behavior in the MVP unless the flow explicitly models stronger approvals.
- New external dependencies or tools must have a clear justification in code review and documentation.

## Logging and Audit Policy
- All meaningful state transitions must be logged with structured logs.
- Logs should include actor, entity type, entity id, event type, decision, and reason when available.
- Audit trails must be stored durably in application data, not only emitted to stdout.
- Log events should make it possible to reconstruct who did what, when, and under which scope context.
- Do not log secrets, credentials, session tokens, or raw sensitive payloads unnecessarily.
- Prefer JSON logs and stable event names.
- Logging must support later forensic review, not only debugging during development.

## Evidence Storage Policy
- Evidence must remain linked to program, target, hypothesis, approval context, and execution.
- Preserve provenance. It must be clear which execution produced which evidence.
- Distinguish raw evidence from interpreted findings.
- Do not overwrite evidence without an audit trail.
- Prefer immutable or append-oriented evidence records where practical.
- Store references to artifacts explicitly when evidence lives outside the database.
- Retention and sensitivity concerns should be visible in the model design, even in the MVP.

## UX Policy
- The UI must optimize for clarity over novelty.
- Users must be able to see the current stage: hypothesis, approval, execution, evidence, or finding.
- Sensitive actions must be reviewable before execution.
- Approval state and scope status must be obvious in the interface.
- Show decision history and rationale in a way a human can inspect quickly.
- Do not hide blocked states. Explain why something is out of scope, rejected, or awaiting approval.
- Preserve human review as a primary control, not as an afterthought.
- Avoid workflows that make execution feel automatic when it is not.

## Testing Expectations
- Critical logic requires tests.
- Critical logic includes at least:
  - scope validation
  - approval gating
  - execution gating
  - audit logging triggers
  - evidence-to-finding linkage
- When modifying critical logic, add or update tests in the same change.
- Prefer fast, deterministic tests with clear fixtures and explicit assertions.
- Mock adapters rather than invoking real external tools in tests.

## Documentation Expectations
- Update `README.md` whenever the main user flow, setup flow, core guarantees, or primary endpoints change.
- Update architecture docs when boundaries, responsibilities, or trust assumptions change.
- Keep documentation aligned with actual code paths. Documentation drift is a defect.

## Dependency Policy
- Avoid heavy frameworks or orchestration layers without strong justification.
- Prefer the standard library or existing project dependencies when they are sufficient.
- Any new dependency should have a clear reason:
  - security
  - correctness
  - maintainability
  - measurable productivity
- Do not add dependencies that hide critical control flow or reduce auditability.

## Preferred Implementation Shape
- `app/api`: transport and request/response wiring
- `app/services`: business rules and workflow orchestration
- `app/agents`: bounded agent logic by responsibility
- `app/adapters`: external tool boundaries
- `app/db`: persistence models and database plumbing
- `app/schemas`: typed contracts and validation
- `app/frontend`: operator-facing UI with clear review states
- `docs/`: architecture and security rationale

## Change Review Checklist
Before finishing a change, Codex should verify:
1. Does this preserve explicit scope by program?
2. Does this keep hypothesis separate from execution?
3. Does every sensitive action still require explicit human approval?
4. Does the change create or preserve auditability?
5. Is the logic strongly typed and explainable?
6. Did `README.md` change if the main flow changed?
7. Were tests added or updated for critical logic?
8. Did the change avoid unnecessary dependency weight?

## Anti-Patterns
- Implicit approval through convenience flags or default states
- Hidden execution in helper methods, adapters, or background tasks
- Mixing recon, hypothesis, approval, and execution into one opaque module
- Storing only final findings without preserving evidence provenance
- UI flows that obscure why an action is blocked
- Adding "smart" automation that weakens human review or auditability
- Coupling business rules to frontend-only validation

## Current Stack Guidance
Unless there is a strong reason to change it, prefer:
- FastAPI for backend APIs
- Pydantic for typed contracts
- SQLite for MVP persistence
- SQLAlchemy for persistence modeling
- Structured JSON logging
- Simple queueing mechanisms before introducing heavier infrastructure

The system should stay understandable by a small engineering team doing security-sensitive work.
