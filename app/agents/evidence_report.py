from app.db.models import Execution, Finding, Hypothesis


class EvidenceReportAgent:
    def build_finding(self, hypothesis: Hypothesis, execution: Execution) -> dict:
        title = f"Validated finding from hypothesis #{hypothesis.id}"
        description = (
            "Finding created after approved execution.\n\n"
            f"Hypothesis: {hypothesis.title}\n"
            f"Execution summary: {execution.output_summary or 'N/A'}"
        )
        return {
            "title": title,
            "description": description,
            "severity": hypothesis.severity,
            "status": "new",
        }

    def build_report_draft(
        self,
        hypothesis: Hypothesis,
        execution: Execution,
        finding: Finding,
        *,
        evidence_count: int,
    ) -> dict:
        narrative = (
            "Draft report generated from approved workflow artifacts. "
            "This narrative requires human review before external use.\n\n"
            f"Hypothesis: {hypothesis.title}\n"
            f"Finding: {finding.title}\n"
            f"Execution summary: {execution.output_summary or 'N/A'}\n"
            f"Evidence items: {evidence_count}"
        )
        return {
            "title": f"Draft report for finding #{finding.id}",
            "narrative": narrative,
            "generated_by": "evidence_report_agent",
            "status": "draft",
        }
