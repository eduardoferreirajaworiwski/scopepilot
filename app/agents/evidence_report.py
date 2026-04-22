from app.db.models import Execution, Hypothesis


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

