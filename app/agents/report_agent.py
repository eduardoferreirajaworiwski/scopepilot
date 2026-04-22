from app.schemas.report_agent import ReportAgentInput, ReportAgentMode, ReportAgentOutput
from app.services.report_agent import ReportAgentService


class ReportAgent:
    def __init__(self, mode: ReportAgentMode = ReportAgentMode.OFFLINE_DETERMINISTIC) -> None:
        self.service = ReportAgentService(mode=mode)

    def generate(self, payload: ReportAgentInput) -> ReportAgentOutput:
        return self.service.generate(payload)

