---
name: add-evidence-schema
description: Add or refine an evidence storage schema for this Bug Bounty Copilot repository, including sanitized requests and responses, decision snapshots, findings, and report drafts. Use when changing what the system persists for auditability and reporting.
---

# Add Evidence Schema

## Objective
Expand evidence persistence in a way that remains sanitized, queryable, and portable from SQLite to a future Postgres backend.

## When To Use
- When adding a new evidence record type or snapshot field.
- When extending finding or report-draft persistence.
- When changing repository query filters by program, asset, or finding.
- When formalizing separation between raw evidence and AI-generated narrative.

## When Not To Use
- Do not use for report copy changes that do not affect stored schema.
- Do not use for approval API work that does not change persisted evidence.
- Do not use for ephemeral runtime data that should not be stored.
- Do not use when the change would require storing secrets or unredacted credentials.

## Typical Files Impacted
- `app/schemas/evidence_store.py`
- `app/db/models.py`
- `app/repositories/evidence_store.py`
- `app/services/evidence_store.py`
- `tests/test_evidence_store_repository.py`
- `docs/evidence_store.md`
- `README.md` if the persisted audit flow changes

## Tests Expected
- Repository round-trip tests for new schema fields.
- Query tests for program, asset, and finding filters.
- Tests proving sanitized storage for requests and responses.
- Tests preserving the boundary between raw evidence and generated narrative.
- Tests that remain compatible with SQLite-backed persistence assumptions.

## Workflow
1. Start with typed schema changes in `app/schemas/evidence_store.py`.
2. Map the schema explicitly into `app/db/models.py` and the repository layer.
3. Keep field names stable and descriptive so future migrations are straightforward.
4. Preserve timestamps and decision snapshots as first-class persisted data.
5. Reject or sanitize values that could include secrets before persistence.
6. Update repository tests and docs in the same change.

## Implementation Notes
- Prefer additive schema changes for easier backend migration later.
- Store structured evidence and generated narrative separately.
- Keep repository interfaces backend-agnostic where practical.
- Avoid opaque JSON blobs when a typed field would be clearer and safer.
