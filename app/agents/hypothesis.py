from app.schemas.hypothesis_engine import (
    HypothesisDraft,
    HypothesisEngineInput,
    HypothesisEngineMode,
    HypothesisEngineOutput,
)
from app.services.hypothesis_engine import HypothesisEngineService


class HypothesisAgent:
    def __init__(self, mode: HypothesisEngineMode = HypothesisEngineMode.MOCK) -> None:
        self.service = HypothesisEngineService(mode=mode)

    def generate(self, payload: HypothesisEngineInput) -> HypothesisDraft:
        return self.service.generate(payload)

    def build_output(
        self,
        *,
        hypothesis_id: int | str,
        draft: HypothesisDraft,
    ) -> HypothesisEngineOutput:
        return self.service.build_output(hypothesis_id=hypothesis_id, draft=draft)
