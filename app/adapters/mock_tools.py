from app.adapters.base import ReconToolAdapter


class MockReconToolAdapter(ReconToolAdapter):
    def collect(self, target_identifier: str, target_type: str) -> dict:
        observations = [
            f"Passive DNS lookup indicates historical subdomains for {target_identifier}.",
            f"TLS metadata for {target_identifier} exposes certificate SAN entries.",
            f"Public archive sources reference endpoints related to target type '{target_type}'.",
        ]

        return {
            "summary": (
                "Recon run completed using safe passive techniques only. "
                "No active or intrusive action was executed."
            ),
            "observations": observations,
        }

