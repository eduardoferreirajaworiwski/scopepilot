class HypothesisAgent:
    def propose(self, target_identifier: str, recon_summary: str | None = None) -> dict:
        title = f"Potential misconfiguration on {target_identifier}"
        description = (
            "Hypothesis generated from passive recon signals. "
            "Investigate authorization boundaries, exposed endpoints, and "
            "input validation behavior under approved scope constraints."
        )

        if recon_summary:
            description = f"{description}\n\nRecon context: {recon_summary}"

        return {"title": title, "description": description}

