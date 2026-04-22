import json
from pathlib import Path
from string import Template

from app.schemas.report_agent import (
    ReportAgentInput,
    ReportAgentMode,
    ReportAgentOutput,
    ReportEvidenceSection,
    ReportStepOutput,
)


class ReportAgentService:
    def __init__(
        self,
        mode: ReportAgentMode = ReportAgentMode.OFFLINE_DETERMINISTIC,
        template_dir: Path | None = None,
    ) -> None:
        self.mode = mode
        self.template_dir = template_dir or (Path(__file__).resolve().parent.parent / "templates" / "report_agent")

    def generate(self, payload: ReportAgentInput) -> ReportAgentOutput:
        if self.mode != ReportAgentMode.OFFLINE_DETERMINISTIC:
            raise ValueError(f"Unsupported report agent mode: {self.mode}")

        evidence_sections = self._build_evidence_sections(payload)
        steps = self._build_steps(payload)
        summary = self._build_summary(payload)
        impact = self._build_impact(payload)
        remediation_notes = self._build_remediation_notes(payload)

        export_payload = {
            "title": payload.finding.title,
            "summary": summary,
            "impact": impact,
            "steps_to_reproduce": [item.model_dump() for item in steps],
            "evidence": [item.model_dump() for item in evidence_sections],
            "remediation_notes": remediation_notes,
        }
        markdown_export = self._render_markdown(export_payload)
        json_export = self._render_json(export_payload)

        return ReportAgentOutput(
            title=payload.finding.title,
            summary=summary,
            impact=impact,
            steps_to_reproduce=steps,
            evidence=evidence_sections,
            remediation_notes=remediation_notes,
            markdown_export=markdown_export,
            json_export=json_export,
        )

    def _build_evidence_sections(self, payload: ReportAgentInput) -> list[ReportEvidenceSection]:
        sections: list[ReportEvidenceSection] = []
        for item in payload.evidence:
            inference = None
            if item.inference:
                inference = f"Inference: {item.inference}"
            sections.append(
                ReportEvidenceSection(
                    label=item.label,
                    evidence_statement=f"Evidence: {item.observation}",
                    inference_statement=inference,
                    source=item.source,
                    artifact_uri=item.artifact_uri,
                )
            )
        return sections

    def _build_steps(self, payload: ReportAgentInput) -> list[ReportStepOutput]:
        ordered_steps = sorted(payload.steps, key=lambda item: (item.order, item.action))
        return [
            ReportStepOutput(
                order=item.order,
                action=item.action,
                expected_result=item.expected_result,
                evidence_labels=item.evidence_labels,
            )
            for item in ordered_steps
        ]

    def _build_summary(self, payload: ReportAgentInput) -> str:
        return (
            f"This draft describes finding '{payload.finding.title}' for program "
            f"'{payload.program_context.name}'. Confirmed evidence is listed explicitly below. "
            "Any analyst interpretation is marked as inference and should be reviewed by a human before submission."
        )

    def _build_impact(self, payload: ReportAgentInput) -> str:
        parts = [f"Evidence-backed impact: {payload.impact.confirmed_impact}"]
        if payload.impact.business_context:
            parts.append(f"Program context: {payload.impact.business_context}")
        if payload.impact.analyst_inference:
            parts.append(f"Inference: {payload.impact.analyst_inference}")
        return " ".join(parts)

    def _build_remediation_notes(self, payload: ReportAgentInput) -> str:
        if payload.remediation_notes_hint:
            return (
                "Suggested remediation notes based on structured input: "
                f"{payload.remediation_notes_hint}"
            )
        return (
            "Suggested remediation notes: review the affected control boundary, validate authorization "
            "logic on the referenced asset, and remove or restrict the behavior demonstrated by the evidence."
        )

    def _render_markdown(self, export_payload: dict) -> str:
        template = Template((self.template_dir / "bug_bounty_report.md.tmpl").read_text(encoding="utf-8"))
        evidence_markdown = "\n".join(self._evidence_to_markdown(item) for item in export_payload["evidence"])
        steps_markdown = "\n".join(self._steps_to_markdown(item) for item in export_payload["steps_to_reproduce"])
        return template.substitute(
            title=export_payload["title"],
            summary=export_payload["summary"],
            impact=export_payload["impact"],
            steps_markdown=steps_markdown,
            evidence_markdown=evidence_markdown,
            remediation_notes=export_payload["remediation_notes"],
        )

    def _render_json(self, export_payload: dict) -> str:
        template = Template((self.template_dir / "bug_bounty_report.json.tmpl").read_text(encoding="utf-8"))
        return template.substitute(
            title=json.dumps(export_payload["title"]),
            summary=json.dumps(export_payload["summary"]),
            impact=json.dumps(export_payload["impact"]),
            steps_json=json.dumps(export_payload["steps_to_reproduce"], indent=2, sort_keys=True),
            evidence_json=json.dumps(export_payload["evidence"], indent=2, sort_keys=True),
            remediation_notes=json.dumps(export_payload["remediation_notes"]),
        )

    def _evidence_to_markdown(self, item: dict) -> str:
        lines = [
            f"### {item['label']}",
            f"- {item['evidence_statement']}",
            f"- Source: {item['source']}",
        ]
        if item.get("artifact_uri"):
            lines.append(f"- Artifact: {item['artifact_uri']}")
        if item.get("inference_statement"):
            lines.append(f"- {item['inference_statement']}")
        return "\n".join(lines)

    def _steps_to_markdown(self, item: dict) -> str:
        evidence_suffix = ""
        if item["evidence_labels"]:
            evidence_suffix = f" Evidence references: {', '.join(item['evidence_labels'])}."
        return (
            f"{item['order']}. Action: {item['action']}\n"
            f"   Expected result: {item['expected_result']}{evidence_suffix}"
        )

