from typing import Protocol


class ReconToolAdapter(Protocol):
    def collect(self, target_identifier: str, target_type: str) -> dict:
        """Collect passive recon metadata for a target."""

