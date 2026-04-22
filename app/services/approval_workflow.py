from datetime import UTC, datetime

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import Approval, Hypothesis
from app.schemas.enums import ApprovalStatus, HypothesisStatus
from app.services.decision_log import DecisionLoggerService


class ApprovalWorkflowService:
    def __init__(self, db: Session, decision_logger: DecisionLoggerService) -> None:
        self.db = db
        self.decision_logger = decision_logger

    def request(self, hypothesis: Hypothesis, requested_by: str) -> Approval:
        if hypothesis.status == HypothesisStatus.EXECUTED.value:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Hipótese já executada; nova aprovação não é permitida.",
            )

        pending = self.db.scalar(
            select(Approval).where(
                Approval.hypothesis_id == hypothesis.id,
                Approval.status == ApprovalStatus.PENDING.value,
            )
        )
        if pending:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Já existe aprovação pendente para esta hipótese.",
            )

        approval = Approval(
            hypothesis_id=hypothesis.id,
            requested_by=requested_by,
            status=ApprovalStatus.PENDING.value,
        )
        hypothesis.status = HypothesisStatus.PENDING_APPROVAL.value

        self.db.add(approval)
        self.decision_logger.log(
            event_type="approval_requested",
            entity_type="hypothesis",
            entity_id=hypothesis.id,
            actor=requested_by,
            decision="pending",
            reason="Hipótese enviada para validação humana.",
            metadata={
                "hypothesis_status": hypothesis.status,
                "required_approval_level": hypothesis.required_approval_level,
                "confidence": hypothesis.confidence,
                "suggested_next_step": hypothesis.suggested_next_step,
            },
        )
        return approval

    def decide(self, approval: Approval, approver: str, status_value: str, reason: str) -> Approval:
        if approval.status != ApprovalStatus.PENDING.value:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Aprovação já decidida anteriormente.",
            )

        hypothesis = self.db.get(Hypothesis, approval.hypothesis_id)
        if hypothesis is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Hipótese vinculada à aprovação não encontrada.",
            )

        approval.approver = approver
        approval.status = status_value
        approval.decision_reason = reason
        approval.decided_at = datetime.now(UTC)

        if status_value == ApprovalStatus.APPROVED.value:
            hypothesis.status = HypothesisStatus.APPROVED.value
            decision = "approved"
        else:
            hypothesis.status = HypothesisStatus.REJECTED.value
            decision = "rejected"

        self.decision_logger.log(
            event_type="approval_decided",
            entity_type="approval",
            entity_id=approval.id,
            actor=approver,
            decision=decision,
            reason=reason,
            metadata={
                "hypothesis_id": hypothesis.id,
                "new_hypothesis_status": hypothesis.status,
            },
        )
        return approval
