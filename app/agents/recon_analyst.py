from app.adapters.base import ReconToolAdapter
from app.adapters.mock_tools import MockReconToolAdapter


class ReconAnalystAgent:
    def __init__(self, adapter: ReconToolAdapter | None = None) -> None:
        self.adapter = adapter or MockReconToolAdapter()

    def run(self, target_identifier: str, target_type: str) -> dict:
        return self.adapter.collect(target_identifier=target_identifier, target_type=target_type)

