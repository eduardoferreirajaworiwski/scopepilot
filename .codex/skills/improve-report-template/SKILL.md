---
name: improve-report-template
description: Improve the report draft output and templates used by the Report Agent in this Bug Bounty Copilot repository. Use when refining Markdown or JSON exports, tightening language, or improving the evidence-versus-inference boundary without changing the system into an automated vulnerability claimant.
---

# Improve Report Template

## Objective
Refine report output so drafts stay professional, editable, and evidence-led, with explicit distinction between confirmed observations and inferred conclusions.

## When To Use
- When editing the Markdown or JSON report templates.
- When refining section structure for title, summary, impact, reproduction, evidence, or remediation notes.
- When tightening wording so the report does not overstate certainty.
- When improving deterministic offline demo output for the Report Agent.

## When Not To Use
- Do not use for evidence storage schema changes.
- Do not use for scope or approval workflow logic.
- Do not use for frontend-only presentation work unrelated to exported reports.
- Do not use when the task is to add a new agent rather than refine the reporting output.

## Typical Files Impacted
- `app/templates/report_agent/bug_bounty_report.md.tmpl`
- `app/templates/report_agent/bug_bounty_report.json.tmpl`
- `app/schemas/report_agent.py`
- `app/services/report_agent.py`
- `tests/test_report_agent.py`
- `docs/report_agent.md`
- `README.md` if the main reporting flow changes

## Tests Expected
- Tests for deterministic offline output.
- Tests for Markdown and JSON export integrity.
- Tests that evidence stays distinct from inference in rendered output.
- Tests for missing optional fields and graceful fallback behavior.
- Tests confirming professional, non-exaggerated language remains intact.

## Workflow
1. Read the current report schemas, service, and templates before editing any template text.
2. Preserve the contract between structured report input and exported output.
3. Keep evidence sections tied to concrete artifacts, not model speculation.
4. Label inference or analyst interpretation explicitly when present.
5. Maintain editable templates rather than hardcoding large output strings in Python.
6. Update tests and docs together when the exported structure changes.

## Implementation Notes
- Do not present a vulnerability as confirmed unless the input evidence supports that claim.
- Prefer concise, operator-friendly wording over marketing language.
- Keep remediation notes practical and clearly separated from proof material.
- Preserve deterministic output in offline mode for demos and regression tests.
