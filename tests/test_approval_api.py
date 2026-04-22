import unittest
from datetime import UTC, datetime, timedelta

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.deps import get_db
from app.api.routes import router as api_router
from app.db.database import Base
from app.services.simple_queue import execution_queue


class ApprovalApiIntegrationTests(unittest.TestCase):
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
        cls.app = FastAPI()
        cls.app.include_router(api_router)

        def override_get_db():
            db = cls.SessionLocal()
            try:
                yield db
            finally:
                db.close()

        cls.app.dependency_overrides[get_db] = override_get_db
        cls.client = TestClient(cls.app)

    def setUp(self) -> None:
        Base.metadata.drop_all(bind=self.engine)
        Base.metadata.create_all(bind=self.engine)
        execution_queue.clear()

    def tearDown(self) -> None:
        execution_queue.clear()

    def _bootstrap_hypothesis(self) -> dict[str, int]:
        program_response = self.client.post(
            "/api/programs",
            json={
                "name": "Authorized Program",
                "owner": "security-team",
                "description": "Program for integration testing.",
                "scope_policy": {
                    "allowed_domains": ["*.example.com"],
                    "denied_domains": ["admin.example.com"],
                    "forbidden_techniques": ["sqlmap"],
                },
            },
        )
        self.assertEqual(program_response.status_code, 201)
        program_id = program_response.json()["id"]

        target_response = self.client.post(
            "/api/targets",
            json={
                "program_id": program_id,
                "identifier": "api.example.com",
                "target_type": "domain",
                "created_by": "operator",
            },
        )
        self.assertEqual(target_response.status_code, 201)
        target_id = target_response.json()["id"]
        self.assertTrue(target_response.json()["in_scope"])

        hypothesis_response = self.client.post(
            "/api/hypotheses",
            json={
                "target_id": target_id,
                "created_by": "analyst",
                "severity": "medium",
            },
        )
        self.assertEqual(hypothesis_response.status_code, 201)
        hypothesis_id = hypothesis_response.json()["id"]

        return {
            "program_id": program_id,
            "target_id": target_id,
            "hypothesis_id": hypothesis_id,
        }

    def test_pending_approval_blocks_execution_until_approved(self) -> None:
        ids = self._bootstrap_hypothesis()

        blocked_execution = self.client.post(
            "/api/executions",
            json={
                "hypothesis_id": ids["hypothesis_id"],
                "requested_by": "operator",
                "action_plan": "Validate the observed endpoint with one bounded request.",
                "technique": "manual_verification",
            },
        )
        self.assertEqual(blocked_execution.status_code, 400)

        request_response = self.client.post(
            f"/api/hypotheses/{ids['hypothesis_id']}/approvals",
            json={
                "requested_by": "analyst",
                "rationale": "Structured recon suggests a bounded manual verification step.",
            },
        )
        self.assertEqual(request_response.status_code, 201)
        approval_id = request_response.json()["id"]
        self.assertEqual(request_response.json()["status"], "pending")

        pending_response = self.client.get("/api/approvals/pending")
        self.assertEqual(pending_response.status_code, 200)
        self.assertEqual(len(pending_response.json()), 1)
        self.assertEqual(pending_response.json()[0]["id"], approval_id)

        approve_response = self.client.post(
            f"/api/approvals/{approval_id}/approve",
            json={
                "approver": "security-lead",
                "rationale": "Approved for bounded validation inside declared scope.",
            },
        )
        self.assertEqual(approve_response.status_code, 200)
        self.assertEqual(approve_response.json()["status"], "approved")
        self.assertEqual(approve_response.json()["approver"], "security-lead")

        execution_response = self.client.post(
            "/api/executions",
            json={
                "hypothesis_id": ids["hypothesis_id"],
                "requested_by": "operator",
                "action_plan": "Validate the observed endpoint with one bounded request.",
                "technique": "manual_verification",
            },
        )
        self.assertEqual(execution_response.status_code, 201)
        self.assertEqual(execution_response.json()["status"], "queued")
        self.assertEqual(execution_response.json()["approved_by"], "security-lead")

    def test_rejected_approval_prevents_execution(self) -> None:
        ids = self._bootstrap_hypothesis()

        request_response = self.client.post(
            f"/api/hypotheses/{ids['hypothesis_id']}/approvals",
            json={
                "requested_by": "analyst",
                "rationale": "Need a decision before any validation attempt.",
            },
        )
        self.assertEqual(request_response.status_code, 201)
        approval_id = request_response.json()["id"]

        reject_response = self.client.post(
            f"/api/approvals/{approval_id}/reject",
            json={
                "approver": "security-lead",
                "rationale": "Rejected until stronger evidence is available.",
            },
        )
        self.assertEqual(reject_response.status_code, 200)
        self.assertEqual(reject_response.json()["status"], "rejected")

        pending_response = self.client.get("/api/approvals/pending")
        self.assertEqual(pending_response.status_code, 200)
        self.assertEqual(pending_response.json(), [])

        execution_response = self.client.post(
            "/api/executions",
            json={
                "hypothesis_id": ids["hypothesis_id"],
                "requested_by": "operator",
                "action_plan": "Attempt a bounded validation step.",
                "technique": "manual_verification",
            },
        )
        self.assertEqual(execution_response.status_code, 400)
        self.assertIn("rejeitou", execution_response.json()["detail"])

    def test_expired_approval_is_removed_from_pending_and_cannot_unlock_execution(self) -> None:
        ids = self._bootstrap_hypothesis()

        expired_at = (datetime.now(UTC) - timedelta(minutes=5)).isoformat()
        request_response = self.client.post(
            f"/api/hypotheses/{ids['hypothesis_id']}/approvals",
            json={
                "requested_by": "analyst",
                "rationale": "This approval request should expire immediately in the test.",
                "expires_at": expired_at,
            },
        )
        self.assertEqual(request_response.status_code, 201)
        approval_id = request_response.json()["id"]

        pending_response = self.client.get("/api/approvals/pending")
        self.assertEqual(pending_response.status_code, 200)
        self.assertEqual(pending_response.json(), [])

        all_approvals = self.client.get("/api/approvals")
        self.assertEqual(all_approvals.status_code, 200)
        self.assertEqual(all_approvals.json()[0]["status"], "expired")

        approve_response = self.client.post(
            f"/api/approvals/{approval_id}/approve",
            json={
                "approver": "security-lead",
                "rationale": "Too late, this request has already expired.",
            },
        )
        self.assertEqual(approve_response.status_code, 409)

        execution_response = self.client.post(
            "/api/executions",
            json={
                "hypothesis_id": ids["hypothesis_id"],
                "requested_by": "operator",
                "action_plan": "Attempt a bounded validation step.",
                "technique": "manual_verification",
            },
        )
        self.assertEqual(execution_response.status_code, 400)
        self.assertIn("expirou", execution_response.json()["detail"])


if __name__ == "__main__":
    unittest.main()
