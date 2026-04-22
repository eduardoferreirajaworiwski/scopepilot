from dataclasses import dataclass
from datetime import UTC, datetime

from fastapi import HTTPException, status
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.db.models import Approval, Hypothesis, Target
from app.schemas.enums import ApprovalStatus, HypothesisStatus
from app.schemas.evidence_store import FlowStage
from app.schemas.enums import RequiredApprovalLevel
from app.services.decision_log import DecisionLoggerService
from app.services.evidence_store import EvidenceStoreService


@dataclass
class ApprovalGateResult:
    allowed: bool
    message: str
    approval: Approval | None = None
    commit_required: bool = False


class ApprovalWorkflowService:
    _APPROVAL_LEVEL_RANK = {
        RequiredApprovalLevel.ANALYST.value: 1,
        RequiredApprovalLevel.SECURITY_LEAD.value: 2,
    }

    def __init__(
        self,
        db: Session,
        decision_logger: DecisionLoggerService,
        evidence_store: EvidenceStoreService | None = None,
    ) -> None:
        self.db = db
        self.decision_logger = decision_logger
        self.evidence_store = evidence_store or EvidenceStoreService.for_db(db)

    def request(
        self,
        hypothesis: Hypothesis,
        *,
        requested_by: str,
        rationale: str,
        expires_at: datetime | None = None,
    ) -> Approval:
        if hypothesis.status == HypothesisStatus.EXECUTED.value:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Hipótese já executada; nova aprovação não é permitida.",
            )

        self.expire_pending_for_hypothesis(hypothesis)
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
            request_rationale=rationale,
            status=ApprovalStatus.PENDING.value,
            expires_at=expires_at,
        )
        hypothesis.status = HypothesisStatus.PENDING_APPROVAL.value

        self.db.add(approval)
        self.db.flush()
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
                "request_rationale": rationale,
                "expires_at": expires_at.isoformat() if expires_at is not None else None,
            },
        )
        target = self.db.get(Target, hypothesis.target_id)
        self.evidence_store.record_decision(
            program_id=hypothesis.program_id,
            target_id=target.id if target is not None else None,
            hypothesis_id=hypothesis.id,
            approval_id=approval.id,
            actor=requested_by,
            decision=ApprovalStatus.PENDING.value,
            rationale=rationale,
            state={
                "status": ApprovalStatus.PENDING.value,
                "required_approval_level": hypothesis.required_approval_level,
                "confidence": hypothesis.confidence,
                "expires_at": expires_at,
            },
        )
        return approval

    def list_pending(self) -> list[Approval]:
        approvals = list(
            self.db.scalars(
                select(Approval)
                .where(Approval.status == ApprovalStatus.PENDING.value)
                .order_by(desc(Approval.created_at))
            )
        )
        active: list[Approval] = []
        for approval in approvals:
            if self.expire_if_needed(approval):
                continue
            active.append(approval)
        return active

    def approve(
        self,
        approval: Approval,
        *,
        approver: str,
        approver_role: RequiredApprovalLevel,
        rationale: str,
    ) -> Approval:
        return self.decide(
            approval,
            approver=approver,
            approver_role=approver_role,
            status_value=ApprovalStatus.APPROVED.value,
            rationale=rationale,
        )

    def reject(
        self,
        approval: Approval,
        *,
        approver: str,
        approver_role: RequiredApprovalLevel,
        rationale: str,
    ) -> Approval:
        return self.decide(
            approval,
            approver=approver,
            approver_role=approver_role,
            status_value=ApprovalStatus.REJECTED.value,
            rationale=rationale,
        )

    def decide(
        self,
        approval: Approval,
        approver: str,
        approver_role: RequiredApprovalLevel,
        status_value: str,
        rationale: str,
    ) -> Approval:
        if self.expire_if_needed(approval):
            self.db.commit()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Aprovação expirada; solicite uma nova revisão humana.",
            )

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

        if approval.requested_by == approver:
            reason = "O solicitante nao pode decidir sua propria aprovacao."
            self._record_blocked_decision(
                approval=approval,
                hypothesis=hypothesis,
                actor=approver,
                reason=reason,
                metadata={
                    "requested_by": approval.requested_by,
                    "attempted_status": status_value,
                },
            )
            self.db.commit()
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=reason)

        required_level = hypothesis.required_approval_level
        if not self._approval_level_allows(
            approver_role=approver_role.value,
            required_level=required_level,
        ):
            reason = (
                "O papel do aprovador nao atende o nivel minimo exigido para esta hipotese."
            )
            self._record_blocked_decision(
                approval=approval,
                hypothesis=hypothesis,
                actor=approver,
                reason=reason,
                metadata={
                    "required_approval_level": required_level,
                    "approver_role": approver_role.value,
                    "attempted_status": status_value,
                },
            )
            self.db.commit()
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=reason)

        approval.approver = approver
        approval.approver_role = approver_role.value
        approval.status = status_value
        approval.decision_reason = rationale
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
            reason=rationale,
            metadata={
                "hypothesis_id": hypothesis.id,
                "new_hypothesis_status": hypothesis.status,
                "approver_role": approver_role.value,
                "expires_at": approval.expires_at.isoformat() if approval.expires_at is not None else None,
            },
        )
        target = self.db.get(Target, hypothesis.target_id)
        self.evidence_store.record_decision(
            program_id=hypothesis.program_id,
            target_id=target.id if target is not None else None,
            hypothesis_id=hypothesis.id,
            approval_id=approval.id,
            actor=approver,
            decision=decision,
            rationale=rationale,
            stage=FlowStage.APPROVAL,
            state={
                "status": approval.status,
                "hypothesis_status": hypothesis.status,
                "approver_role": approval.approver_role,
                "required_approval_level": hypothesis.required_approval_level,
                "decided_at": approval.decided_at,
            },
        )
        return approval

    def evaluate_execution_gate(self, hypothesis: Hypothesis) -> ApprovalGateResult:
        latest_approval = self.db.scalar(
            select(Approval)
            .where(Approval.hypothesis_id == hypothesis.id)
            .order_by(desc(Approval.created_at))
        )
        if latest_approval is None:
            return ApprovalGateResult(
                allowed=False,
                message="Execucao bloqueada: nenhuma aprovacao humana foi registrada para esta hipotese.",
            )

        commit_required = self.expire_if_needed(latest_approval)
        current_status = latest_approval.status
        if current_status == ApprovalStatus.PENDING.value:
            return ApprovalGateResult(
                allowed=False,
                message="Execucao bloqueada: a solicitacao de aprovacao ainda esta pendente.",
                commit_required=commit_required,
            )
        if current_status == ApprovalStatus.REJECTED.value:
            return ApprovalGateResult(
                allowed=False,
                message="Execucao bloqueada: a ultima decisao humana rejeitou esta hipotese.",
                commit_required=commit_required,
            )
        if current_status == ApprovalStatus.EXPIRED.value:
            return ApprovalGateResult(
                allowed=False,
                message="Execucao bloqueada: a aprovacao humana expirou antes da execucao.",
                commit_required=commit_required,
            )
        if hypothesis.status != HypothesisStatus.APPROVED.value:
            return ApprovalGateResult(
                allowed=False,
                message="Execucao bloqueada: o estado da hipotese nao esta aprovado.",
                commit_required=commit_required,
            )

        return ApprovalGateResult(
            allowed=True,
            message="Aprovacao humana valida encontrada para execucao.",
            approval=latest_approval,
            commit_required=commit_required,
        )

    def expire_pending_for_hypothesis(self, hypothesis: Hypothesis) -> None:
        pending = list(
            self.db.scalars(
                select(Approval).where(
                    Approval.hypothesis_id == hypothesis.id,
                    Approval.status == ApprovalStatus.PENDING.value,
                )
            )
        )
        for approval in pending:
            self.expire_if_needed(approval)

    def expire_if_needed(self, approval: Approval) -> bool:
        if approval.status != ApprovalStatus.PENDING.value:
            return False
        expires_at = self._normalize_datetime(approval.expires_at)
        if expires_at is None or expires_at > datetime.now(UTC):
            return False

        hypothesis = self.db.get(Hypothesis, approval.hypothesis_id)
        approval.status = ApprovalStatus.EXPIRED.value
        approval.decision_reason = "Aprovacao expirada antes de uma decisao humana."
        approval.decided_at = datetime.now(UTC)
        if hypothesis is not None and hypothesis.status == HypothesisStatus.PENDING_APPROVAL.value:
            hypothesis.status = HypothesisStatus.DRAFT.value

        self.decision_logger.log(
            event_type="approval_expired",
            entity_type="approval",
            entity_id=approval.id,
            actor="system",
            decision="expired",
            reason="Aprovacao expirada antes de decisao humana.",
            metadata={
                "hypothesis_id": approval.hypothesis_id,
                "expires_at": expires_at.isoformat() if expires_at is not None else None,
            },
        )
        if hypothesis is not None:
            self.evidence_store.record_decision(
                program_id=hypothesis.program_id,
                target_id=hypothesis.target_id,
                hypothesis_id=approval.hypothesis_id,
                approval_id=approval.id,
                actor="system",
                decision=ApprovalStatus.EXPIRED.value,
                rationale="Aprovacao expirada antes de decisao humana.",
                stage=FlowStage.APPROVAL,
                state={"status": ApprovalStatus.EXPIRED.value, "expires_at": expires_at},
            )
        return True

    def _approval_level_allows(self, *, approver_role: str, required_level: str) -> bool:
        return self._APPROVAL_LEVEL_RANK.get(approver_role, 0) >= self._APPROVAL_LEVEL_RANK.get(
            required_level,
            0,
        )

    def _record_blocked_decision(
        self,
        *,
        approval: Approval,
        hypothesis: Hypothesis,
        actor: str,
        reason: str,
        metadata: dict,
    ) -> None:
        self.decision_logger.log(
            event_type="approval_decision_blocked",
            entity_type="approval",
            entity_id=approval.id,
            actor=actor,
            decision="blocked",
            reason=reason,
            metadata={"hypothesis_id": hypothesis.id, **metadata},
        )
        self.evidence_store.record_decision(
            program_id=hypothesis.program_id,
            target_id=hypothesis.target_id,
            hypothesis_id=hypothesis.id,
            approval_id=approval.id,
            actor=actor,
            decision="blocked",
            rationale=reason,
            stage=FlowStage.APPROVAL,
            state=metadata,
        )

    def _normalize_datetime(self, value: datetime | None) -> datetime | None:
        if value is None:
            return None
        if value.tzinfo is None:
            return value.replace(tzinfo=UTC)
        return value.astimezone(UTC)
