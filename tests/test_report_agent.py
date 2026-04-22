import json
import unittest

from pydantic import ValidationError

from app.agents.report_agent import ReportAgent
from app.schemas.report_agent import (
    ReportAgentInput,
    ReportEvidenceInput,
    ReportFindingInput,
    ReportImpactInput,
    ReportProgramContextInput,
    ReportStepInput,
)


class ReportAgentSchemaTests(unittest.TestCase):
    def test_requires_evidence_and_steps(self) -> None:
        with self.assertRaises(ValidationError):
            ReportAgentInput(
                finding=ReportFindingInput(
                    title="Validated finding",
                    severity="medium",
                    asset_identifier="api.example.com",
                    description="Finding backed by execution evidence.",
                ),
                evidence=[],
                impact=ReportImpactInput(confirmed_impact="Observed unauthorized data exposure."),
                steps=[],
                program_context=ReportProgramContextInput(name="Authorized Program"),
            )


class ReportAgentDeterministicTests(unittest.TestCase):
    def setUp(self) -> None:
        self.agent = ReportAgent()
        self.payload = ReportAgentInput(
            finding=ReportFindingInput(
                finding_id=10,
                title="Unauthorized endpoint exposure",
                severity="high",
                asset_identifier="api.example.com",
                description="Approved execution showed that a protected endpoint returned sensitive account data.",
            ),
            evidence=[
                ReportEvidenceInput(
                    label="Evidence 1",
                    observation="A bounded request to /v1/account returned another user's profile data.",
                    source="http_capture",
                    artifact_uri="artifact://capture/1",
                    inference="The observed behavior suggests an authorization control gap.",
                ),
                ReportEvidenceInput(
                    label="Evidence 2",
                    observation="A second request reproduced the same behavior with a different record identifier.",
                    source="replay_log",
                ),
            ],
            impact=ReportImpactInput(
                confirmed_impact="Account data belonging to another user was returned to the test session.",
                business_context="The affected endpoint is part of the customer account workflow.",
                analyst_inference="If this behavior is broadly reachable, additional account records may be exposed.",
            ),
            steps=[
                ReportStepInput(
                    order=1,
                    action="Authenticate with the approved test account and request /v1/account?id=2002.",
                    expected_result="The response returns account data that does not belong to the approved test account.",
                    evidence_labels=["Evidence 1"],
                ),
                ReportStepInput(
                    order=2,
                    action="Repeat the request with a second identifier.",
                    expected_result="The response reproduces the same authorization failure.",
                    evidence_labels=["Evidence 2"],
                ),
            ],
            program_context=ReportProgramContextInput(
                program_id=1,
                name="Authorized Program",
                policy_summary="Testing must remain bounded to approved assets and accounts.",
            ),
            remediation_notes_hint="Enforce object-level authorization checks on the affected endpoint.",
        )

    def test_offline_mode_is_deterministic(self) -> None:
        first = self.agent.generate(self.payload)
        second = self.agent.generate(self.payload)

        self.assertEqual(first.model_dump(mode="json"), second.model_dump(mode="json"))

    def test_output_marks_evidence_and_inference_explicitly(self) -> None:
        result = self.agent.generate(self.payload)

        self.assertIn("Confirmed evidence", result.summary)
        self.assertIn("Evidence:", result.evidence[0].evidence_statement)
        self.assertIn("Inference:", result.evidence[0].inference_statement or "")
        self.assertIn("Inference:", result.impact)
        self.assertIn("## Evidence", result.markdown_export)

        exported = json.loads(result.json_export)
        self.assertEqual(exported["title"], "Unauthorized endpoint exposure")
        self.assertEqual(len(exported["evidence"]), 2)
        self.assertEqual(exported["steps_to_reproduce"][0]["order"], 1)
        self.assertIn("Evidence:", exported["evidence"][0]["evidence_statement"])


if __name__ == "__main__":
    unittest.main()
