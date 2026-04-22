import unittest

from pydantic import ValidationError

from app.schemas.enums import RequiredApprovalLevel
from app.schemas.hypothesis_engine import (
    HypothesisAssetInput,
    HypothesisContextInput,
    HypothesisEngineInput,
    HypothesisEngineOutput,
    HypothesisEvidenceInput,
    HypothesisProgramInput,
)
from app.services.hypothesis_engine import HypothesisEngineService


class HypothesisEngineSchemaTests(unittest.TestCase):
    def test_input_requires_at_least_one_evidence_item(self) -> None:
        with self.assertRaises(ValidationError):
            HypothesisEngineInput(
                asset=HypothesisAssetInput(identifier="api.example.com", asset_type="domain"),
                evidence=[],
                context=HypothesisContextInput(summary="Recon summary"),
                program=HypothesisProgramInput(name="Authorized Program"),
            )

    def test_output_confidence_must_be_between_zero_and_one(self) -> None:
        with self.assertRaises(ValidationError):
            HypothesisEngineOutput(
                hypothesis_id="hyp-1",
                title="Potential issue",
                rationale="This is an investigatory hypothesis.",
                confidence=1.5,
                suggested_next_step="Request approval for a bounded validation step.",
                required_approval_level=RequiredApprovalLevel.ANALYST,
            )

    def test_tags_are_normalized_to_lowercase(self) -> None:
        context = HypothesisContextInput(summary="Summary", tags=["Authenticated_Surface", "  API "])
        self.assertEqual(context.tags, ["authenticated_surface", "api"])


class HypothesisEngineRuleTests(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = HypothesisEngineService()
        self.base_payload = HypothesisEngineInput(
            asset=HypothesisAssetInput(
                asset_id=10,
                identifier="api.example.com",
                asset_type="domain",
                in_scope=True,
            ),
            evidence=[
                HypothesisEvidenceInput(
                    evidence_type="endpoint_exposure",
                    summary="Archive data references an internal-looking API route.",
                    source="recon_record",
                    signal_strength=0.8,
                    attributes={"path": "/internal/v1/users"},
                ),
                HypothesisEvidenceInput(
                    evidence_type="technology_disclosure",
                    summary="Response metadata identifies a public-facing application stack.",
                    source="recon_record",
                    signal_strength=0.6,
                ),
            ],
            context=HypothesisContextInput(
                summary="Passive recon found externally reachable application paths.",
                tags=["api"],
            ),
            program=HypothesisProgramInput(
                program_id=1,
                name="Authorized Program",
                owner="security-team",
            ),
        )

    def test_mock_mode_generates_structured_hypothesis(self) -> None:
        draft = self.engine.generate(self.base_payload)

        self.assertTrue(draft.title.startswith("Potential"))
        self.assertIn("not a confirmed vulnerability", draft.rationale.lower())
        self.assertGreaterEqual(draft.confidence, 0.0)
        self.assertLessEqual(draft.confidence, 1.0)
        self.assertTrue(len(draft.suggested_next_step) > 10)

    def test_sensitive_context_requires_security_lead_approval(self) -> None:
        payload = self.base_payload.model_copy(
            update={
                "context": HypothesisContextInput(
                    summary="Authenticated application paths were identified during passive recon.",
                    tags=["authenticated_surface"],
                )
            }
        )

        draft = self.engine.generate(payload)
        self.assertEqual(draft.required_approval_level, RequiredApprovalLevel.SECURITY_LEAD)

    def test_build_output_attaches_hypothesis_id(self) -> None:
        draft = self.engine.generate(self.base_payload)
        output = self.engine.build_output(hypothesis_id=42, draft=draft)

        self.assertEqual(output.hypothesis_id, "42")
        self.assertEqual(output.title, draft.title)
        self.assertEqual(output.required_approval_level, draft.required_approval_level)


if __name__ == "__main__":
    unittest.main()
