import unittest
from datetime import UTC, datetime

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.database import Base
from app.db.models import Approval, Execution, Finding, Hypothesis, Program, Target
from app.repositories.evidence_store import SqlAlchemyEvidenceStoreRepository
from app.schemas.evidence_store import (
    DecisionSnapshotCreate,
    EvidenceRecordCreate,
    FlowSnapshotCreate,
    FlowStage,
    ReportDraftCreate,
    SnapshotType,
)
from app.schemas.enums import ApprovalStatus, ExecutionStatus, HypothesisStatus


class EvidenceStoreRepositoryTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
            future=True,
        )
        cls.SessionLocal = sessionmaker(
            bind=cls.engine,
            autoflush=False,
            autocommit=False,
            future=True,
        )

    def setUp(self) -> None:
        Base.metadata.drop_all(bind=self.engine)
        Base.metadata.create_all(bind=self.engine)
        self.db = self.SessionLocal()
        self.repo = SqlAlchemyEvidenceStoreRepository(self.db)
        self.refs = self._seed_flow_entities()

    def tearDown(self) -> None:
        self.db.close()

    def _seed_flow_entities(self) -> dict[str, int]:
        program = Program(
            name=f"Program-{datetime.now(UTC).timestamp()}",
            description="Evidence store test program.",
            owner="security-team",
            scope_policy={"allowed_domains": ["*.example.com"]},
        )
        self.db.add(program)
        self.db.flush()

        target = Target(
            program_id=program.id,
            identifier="api.example.com",
            target_type="domain",
            created_by="operator",
            in_scope=True,
            scope_reason="Matched allowlist.",
        )
        self.db.add(target)
        self.db.flush()

        hypothesis = Hypothesis(
            program_id=program.id,
            target_id=target.id,
            title="Potential exposed endpoint risk",
            description="Investigatory hypothesis only.",
            confidence=0.74,
            suggested_next_step="Request approval for bounded verification.",
            required_approval_level="security_lead",
            severity="medium",
            created_by="analyst",
            status=HypothesisStatus.APPROVED.value,
        )
        self.db.add(hypothesis)
        self.db.flush()

        approval = Approval(
            hypothesis_id=hypothesis.id,
            requested_by="analyst",
            request_rationale="Need review before validation.",
            approver="security-lead",
            status=ApprovalStatus.APPROVED.value,
            decision_reason="Approved for bounded work.",
            decided_at=datetime.now(UTC),
        )
        self.db.add(approval)
        self.db.flush()

        execution = Execution(
            hypothesis_id=hypothesis.id,
            requested_by="operator",
            approved_by="security-lead",
            status=ExecutionStatus.COMPLETED.value,
            action_plan="Perform one minimal validation request.",
            output_summary="Validation completed with sanitized output.",
            started_at=datetime.now(UTC),
            completed_at=datetime.now(UTC),
        )
        self.db.add(execution)
        self.db.flush()

        finding = Finding(
            program_id=program.id,
            target_id=target.id,
            hypothesis_id=hypothesis.id,
            execution_id=execution.id,
            title="Validated finding",
            description="A finding linked to sanitized evidence.",
            severity="medium",
            status="new",
        )
        self.db.add(finding)
        self.db.commit()

        return {
            "program_id": program.id,
            "target_id": target.id,
            "hypothesis_id": hypothesis.id,
            "approval_id": approval.id,
            "execution_id": execution.id,
            "finding_id": finding.id,
        }

    def test_store_snapshot_sanitizes_secret_fields(self) -> None:
        self.repo.store_snapshot(
            FlowSnapshotCreate(
                program_id=self.refs["program_id"],
                target_id=self.refs["target_id"],
                hypothesis_id=self.refs["hypothesis_id"],
                stage=FlowStage.HYPOTHESIS,
                snapshot_type=SnapshotType.REQUEST,
                actor="analyst",
                payload={
                    "authorization": "Bearer live-token",
                    "nested": {"api_key": "abc123"},
                    "body": "password=hunter2 token=xyz",
                },
            )
        )
        self.db.commit()

        result = self.repo.get_by_program(self.refs["program_id"])
        self.assertEqual(len(result.snapshots), 1)
        payload = result.snapshots[0].payload_json
        self.assertEqual(payload["authorization"], "[REDACTED]")
        self.assertEqual(payload["nested"]["api_key"], "[REDACTED]")
        self.assertIn("password=[REDACTED]", payload["body"])
        self.assertIn("token=[REDACTED]", payload["body"])

    def test_store_decision_snapshot_is_queryable_by_target(self) -> None:
        self.repo.store_decision_snapshot(
            DecisionSnapshotCreate(
                program_id=self.refs["program_id"],
                target_id=self.refs["target_id"],
                hypothesis_id=self.refs["hypothesis_id"],
                approval_id=self.refs["approval_id"],
                stage=FlowStage.APPROVAL,
                actor="security-lead",
                decision="approved",
                rationale="Approved after reviewing sanitized request details.",
                state={"status": "approved", "authorization": "Bearer opaque-token"},
            )
        )
        self.db.commit()

        result = self.repo.get_by_target(self.refs["target_id"])
        self.assertEqual(len(result.snapshots), 1)
        snapshot = result.snapshots[0]
        self.assertEqual(snapshot.stage, "approval")
        self.assertEqual(snapshot.snapshot_type, "decision")
        self.assertEqual(snapshot.payload_json["decision"], "approved")
        self.assertEqual(snapshot.payload_json["state"]["authorization"], "[REDACTED]")

    def test_decision_snapshot_preserves_execution_stage(self) -> None:
        self.repo.store_decision_snapshot(
            DecisionSnapshotCreate(
                program_id=self.refs["program_id"],
                target_id=self.refs["target_id"],
                hypothesis_id=self.refs["hypothesis_id"],
                execution_id=self.refs["execution_id"],
                stage=FlowStage.EXECUTION,
                actor="operator",
                decision="blocked",
                rationale="Execution was blocked before dispatch.",
                state={"status": "queued"},
            )
        )
        self.db.commit()

        result = self.repo.get_by_target(self.refs["target_id"])
        execution_snapshot = next(
            snapshot for snapshot in result.snapshots if snapshot.execution_id == self.refs["execution_id"]
        )
        self.assertEqual(execution_snapshot.stage, "execution")
        self.assertEqual(execution_snapshot.snapshot_type, "decision")

    def test_store_raw_evidence_and_report_draft_separately(self) -> None:
        self.repo.store_snapshot(
            FlowSnapshotCreate(
                program_id=self.refs["program_id"],
                target_id=self.refs["target_id"],
                hypothesis_id=self.refs["hypothesis_id"],
                execution_id=self.refs["execution_id"],
                stage=FlowStage.EXECUTION,
                snapshot_type=SnapshotType.RESPONSE,
                actor="operator",
                payload={"status": "completed"},
            )
        )
        self.repo.store_raw_evidence(
            EvidenceRecordCreate(
                program_id=self.refs["program_id"],
                target_id=self.refs["target_id"],
                hypothesis_id=self.refs["hypothesis_id"],
                execution_id=self.refs["execution_id"],
                finding_id=self.refs["finding_id"],
                evidence_type="http_capture",
                content="response=200 password=supersecret",
                artifact_uri="artifact://capture/1",
            )
        )
        self.repo.store_report_draft(
            ReportDraftCreate(
                program_id=self.refs["program_id"],
                target_id=self.refs["target_id"],
                hypothesis_id=self.refs["hypothesis_id"],
                execution_id=self.refs["execution_id"],
                finding_id=self.refs["finding_id"],
                title="Draft report",
                narrative="Draft narrative with token=opaque that should be sanitized.",
                generated_by="evidence_report_agent",
            )
        )
        self.db.commit()

        result = self.repo.get_by_finding(self.refs["finding_id"])
        self.assertEqual(len(result.findings), 1)
        self.assertEqual(len(result.evidence), 1)
        self.assertEqual(len(result.report_drafts), 1)
        self.assertGreaterEqual(len(result.snapshots), 1)
        self.assertIn("password=[REDACTED]", result.evidence[0].content)
        self.assertEqual(len(result.evidence[0].content_sha256), 64)
        self.assertIn("token=[REDACTED]", result.report_drafts[0].narrative)


if __name__ == "__main__":
    unittest.main()
