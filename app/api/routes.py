from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.agents.evidence_report import EvidenceReportAgent
from app.agents.hypothesis import HypothesisAgent
from app.agents.recon_analyst import ReconAnalystAgent
from app.agents.scope_guard import ScopeGuardAgent
from app.api.deps import get_db
from app.db.models import (
    Approval,
    DecisionLog,
    Evidence,
    Execution,
    Finding,
    Hypothesis,
    Program,
    ReconRecord,
    Target,
)
from app.schemas.enums import ApprovalStatus, ExecutionStatus, HypothesisStatus
from app.schemas.models import (
    ApprovalDecision,
    ApprovalRead,
    ApprovalRequestCreate,
    DecisionLogRead,
    ExecutionCompleteRequest,
    ExecutionCompleteResponse,
    ExecutionRead,
    ExecutionRequest,
    FindingRead,
    HypothesisCreate,
    HypothesisRead,
    ProgramCreate,
    ProgramRead,
    QueueDispatchRequest,
    QueueSnapshot,
    ReconRecordRead,
    ReconRunRequest,
    ScopePolicy,
    TargetCreate,
    TargetRead,
)
from app.services.approval_workflow import ApprovalWorkflowService
from app.services.decision_log import DecisionLoggerService
from app.services.simple_queue import execution_queue

router = APIRouter(prefix="/api", tags=["Bug Bounty Copilot"])

scope_guard_agent = ScopeGuardAgent()
recon_agent = ReconAnalystAgent()
hypothesis_agent = HypothesisAgent()
evidence_agent = EvidenceReportAgent()


def _get_program_or_404(db: Session, program_id: int) -> Program:
    program = db.get(Program, program_id)
    if program is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Programa não encontrado.")
    return program


def _get_target_or_404(db: Session, target_id: int) -> Target:
    target = db.get(Target, target_id)
    if target is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Target não encontrado.")
    return target


def _get_hypothesis_or_404(db: Session, hypothesis_id: int) -> Hypothesis:
    hypothesis = db.get(Hypothesis, hypothesis_id)
    if hypothesis is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Hipótese não encontrada.")
    return hypothesis


def _get_approval_or_404(db: Session, approval_id: int) -> Approval:
    approval = db.get(Approval, approval_id)
    if approval is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Aprovação não encontrada.")
    return approval


def _get_execution_or_404(db: Session, execution_id: int) -> Execution:
    execution = db.get(Execution, execution_id)
    if execution is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Execução não encontrada.")
    return execution


@router.get("/health")
def healthcheck() -> dict[str, str]:
    return {"status": "ok"}


@router.post("/programs", response_model=ProgramRead, status_code=status.HTTP_201_CREATED)
def create_program(payload: ProgramCreate, db: Session = Depends(get_db)) -> Program:
    existing = db.scalar(select(Program).where(Program.name == payload.name))
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Já existe programa com este nome.")

    program = Program(
        name=payload.name,
        description=payload.description,
        owner=payload.owner,
        scope_policy=payload.scope_policy.model_dump(),
    )
    db.add(program)
    db.flush()

    decision_logger = DecisionLoggerService(db)
    decision_logger.log(
        event_type="program_created",
        entity_type="program",
        entity_id=program.id,
        actor=payload.owner,
        decision="accepted",
        reason="Programa registrado com política de escopo inicial.",
        metadata={"scope_policy": payload.scope_policy.model_dump()},
    )
    db.commit()
    db.refresh(program)
    return program


@router.get("/programs", response_model=list[ProgramRead])
def list_programs(db: Session = Depends(get_db)) -> list[Program]:
    return list(db.scalars(select(Program).order_by(desc(Program.created_at))))


@router.post("/targets", response_model=TargetRead, status_code=status.HTTP_201_CREATED)
def create_target(payload: TargetCreate, db: Session = Depends(get_db)) -> Target:
    program = _get_program_or_404(db, payload.program_id)
    scope_policy = ScopePolicy.model_validate(program.scope_policy or {})
    in_scope, scope_reason = scope_guard_agent.validate_target(
        scope_policy=scope_policy,
        identifier=payload.identifier,
        target_type=payload.target_type,
    )

    target = Target(
        program_id=payload.program_id,
        identifier=payload.identifier,
        target_type=payload.target_type,
        created_by=payload.created_by,
        in_scope=in_scope,
        scope_reason=scope_reason,
    )
    db.add(target)
    db.flush()

    decision_logger = DecisionLoggerService(db)
    decision_logger.log(
        event_type="target_scope_validation",
        entity_type="target",
        entity_id=target.id,
        actor=payload.created_by,
        decision="allowed" if in_scope else "blocked",
        reason=scope_reason,
        metadata={"program_id": program.id, "identifier": payload.identifier},
    )
    db.commit()
    db.refresh(target)
    return target


@router.get("/programs/{program_id}/targets", response_model=list[TargetRead])
def list_program_targets(program_id: int, db: Session = Depends(get_db)) -> list[Target]:
    _get_program_or_404(db, program_id)
    return list(
        db.scalars(
            select(Target)
            .where(Target.program_id == program_id)
            .order_by(desc(Target.created_at))
        )
    )


@router.post("/recon/run", response_model=ReconRecordRead, status_code=status.HTTP_201_CREATED)
def run_recon(payload: ReconRunRequest, db: Session = Depends(get_db)) -> ReconRecord:
    target = _get_target_or_404(db, payload.target_id)
    if not target.in_scope:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Target fora do escopo. Motivo: {target.scope_reason}",
        )

    recon_result = recon_agent.run(target_identifier=target.identifier, target_type=target.target_type)
    recon = ReconRecord(
        target_id=target.id,
        analyst=payload.analyst,
        summary=recon_result["summary"],
        observations=recon_result["observations"],
    )
    db.add(recon)
    db.flush()

    decision_logger = DecisionLoggerService(db)
    decision_logger.log(
        event_type="recon_completed",
        entity_type="recon_record",
        entity_id=recon.id,
        actor=payload.analyst,
        decision="executed",
        reason="Recon passivo concluído em alvo validado.",
        metadata={"target_id": target.id, "observations_count": len(recon_result["observations"])},
    )
    db.commit()
    db.refresh(recon)
    return recon


@router.get("/targets/{target_id}/recon", response_model=list[ReconRecordRead])
def list_target_recon(target_id: int, db: Session = Depends(get_db)) -> list[ReconRecord]:
    _get_target_or_404(db, target_id)
    return list(
        db.scalars(
            select(ReconRecord)
            .where(ReconRecord.target_id == target_id)
            .order_by(desc(ReconRecord.created_at))
        )
    )


@router.post("/hypotheses", response_model=HypothesisRead, status_code=status.HTTP_201_CREATED)
def create_hypothesis(payload: HypothesisCreate, db: Session = Depends(get_db)) -> Hypothesis:
    target = _get_target_or_404(db, payload.target_id)
    if not target.in_scope:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Hipótese bloqueada: target fora de escopo. Motivo: {target.scope_reason}",
        )

    recon_summary: str | None = None
    if payload.recon_record_id is not None:
        recon_record = db.get(ReconRecord, payload.recon_record_id)
        if recon_record is None or recon_record.target_id != target.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Recon record inválido para este target.",
            )
        recon_summary = recon_record.summary

    generated = hypothesis_agent.propose(target_identifier=target.identifier, recon_summary=recon_summary)
    title = payload.title or generated["title"]
    description = payload.description or generated["description"]

    hypothesis = Hypothesis(
        program_id=target.program_id,
        target_id=target.id,
        recon_record_id=payload.recon_record_id,
        title=title,
        description=description,
        severity=payload.severity,
        created_by=payload.created_by,
        status=HypothesisStatus.DRAFT.value,
    )
    db.add(hypothesis)
    db.flush()

    decision_logger = DecisionLoggerService(db)
    decision_logger.log(
        event_type="hypothesis_created",
        entity_type="hypothesis",
        entity_id=hypothesis.id,
        actor=payload.created_by,
        decision="created",
        reason="Hipótese registrada aguardando aprovação humana.",
        metadata={"target_id": target.id, "severity": payload.severity},
    )
    db.commit()
    db.refresh(hypothesis)
    return hypothesis


@router.get("/hypotheses", response_model=list[HypothesisRead])
def list_hypotheses(db: Session = Depends(get_db)) -> list[Hypothesis]:
    return list(db.scalars(select(Hypothesis).order_by(desc(Hypothesis.created_at))))


@router.post(
    "/hypotheses/{hypothesis_id}/approvals",
    response_model=ApprovalRead,
    status_code=status.HTTP_201_CREATED,
)
def request_hypothesis_approval(
    hypothesis_id: int,
    payload: ApprovalRequestCreate,
    db: Session = Depends(get_db),
) -> Approval:
    hypothesis = _get_hypothesis_or_404(db, hypothesis_id)
    decision_logger = DecisionLoggerService(db)
    workflow = ApprovalWorkflowService(db, decision_logger)
    approval = workflow.request(hypothesis, requested_by=payload.requested_by)
    db.commit()
    db.refresh(approval)
    return approval


@router.get("/approvals", response_model=list[ApprovalRead])
def list_approvals(db: Session = Depends(get_db)) -> list[Approval]:
    return list(db.scalars(select(Approval).order_by(desc(Approval.created_at))))


@router.post("/approvals/{approval_id}/decide", response_model=ApprovalRead)
def decide_approval(
    approval_id: int,
    payload: ApprovalDecision,
    db: Session = Depends(get_db),
) -> Approval:
    approval = _get_approval_or_404(db, approval_id)
    decision_logger = DecisionLoggerService(db)
    workflow = ApprovalWorkflowService(db, decision_logger)
    updated = workflow.decide(
        approval=approval,
        approver=payload.approver,
        status_value=payload.status,
        reason=payload.reason,
    )
    db.commit()
    db.refresh(updated)
    return updated


@router.post("/executions", response_model=ExecutionRead, status_code=status.HTTP_201_CREATED)
def request_execution(payload: ExecutionRequest, db: Session = Depends(get_db)) -> Execution:
    hypothesis = _get_hypothesis_or_404(db, payload.hypothesis_id)
    target = _get_target_or_404(db, hypothesis.target_id)
    if not target.in_scope:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Execução negada por escopo. Motivo: {target.scope_reason}",
        )
    if hypothesis.status != HypothesisStatus.APPROVED.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Execução só é permitida para hipóteses aprovadas.",
        )

    latest_approval = db.scalar(
        select(Approval)
        .where(Approval.hypothesis_id == hypothesis.id)
        .order_by(desc(Approval.created_at))
    )
    if latest_approval is None or latest_approval.status != ApprovalStatus.APPROVED.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Execução bloqueada: aprovação humana válida não encontrada.",
        )

    plan_is_safe, plan_reason = scope_guard_agent.validate_action_plan(payload.action_plan)
    execution_status = ExecutionStatus.QUEUED.value if plan_is_safe else ExecutionStatus.BLOCKED.value

    execution = Execution(
        hypothesis_id=hypothesis.id,
        requested_by=payload.requested_by,
        approved_by=latest_approval.approver,
        status=execution_status,
        action_plan=payload.action_plan,
    )
    db.add(execution)
    db.flush()

    if plan_is_safe:
        execution_queue.enqueue(execution.id)

    decision_logger = DecisionLoggerService(db)
    decision_logger.log(
        event_type="execution_requested",
        entity_type="execution",
        entity_id=execution.id,
        actor=payload.requested_by,
        decision="queued" if plan_is_safe else "blocked",
        reason=plan_reason,
        metadata={
            "hypothesis_id": hypothesis.id,
            "approved_by": latest_approval.approver,
        },
    )

    db.commit()
    db.refresh(execution)
    return execution


@router.get("/executions", response_model=list[ExecutionRead])
def list_executions(db: Session = Depends(get_db)) -> list[Execution]:
    return list(db.scalars(select(Execution).order_by(desc(Execution.created_at))))


@router.get("/executions/queue", response_model=QueueSnapshot)
def queue_snapshot() -> QueueSnapshot:
    return QueueSnapshot(queued_execution_ids=execution_queue.snapshot())


@router.post("/executions/queue/next", response_model=ExecutionRead)
def dispatch_next_execution(
    payload: QueueDispatchRequest,
    db: Session = Depends(get_db),
) -> Execution:
    execution_id = execution_queue.pop_next()
    if execution_id is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Fila de execução vazia.")

    execution = _get_execution_or_404(db, execution_id)
    if execution.status != ExecutionStatus.QUEUED.value:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Execução não está em estado queued para despacho.",
        )

    execution.status = ExecutionStatus.RUNNING.value
    execution.started_at = datetime.now(UTC)

    decision_logger = DecisionLoggerService(db)
    decision_logger.log(
        event_type="execution_dispatched",
        entity_type="execution",
        entity_id=execution.id,
        actor=payload.operator,
        decision="running",
        reason="Execução despachada manualmente da fila simples.",
        metadata={},
    )
    db.commit()
    db.refresh(execution)
    return execution


@router.post("/executions/{execution_id}/complete", response_model=ExecutionCompleteResponse)
def complete_execution(
    execution_id: int,
    payload: ExecutionCompleteRequest,
    db: Session = Depends(get_db),
) -> ExecutionCompleteResponse:
    execution = _get_execution_or_404(db, execution_id)
    if execution.status == ExecutionStatus.BLOCKED.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Execução bloqueada não pode ser concluída.",
        )
    if execution.status == ExecutionStatus.COMPLETED.value:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Execução já foi concluída anteriormente.",
        )

    if execution.status == ExecutionStatus.QUEUED.value:
        execution.status = ExecutionStatus.RUNNING.value
        execution.started_at = datetime.now(UTC)

    execution.status = ExecutionStatus.COMPLETED.value
    execution.completed_at = datetime.now(UTC)
    execution.output_summary = payload.output_summary

    evidence_count = 0
    for item in payload.evidence:
        evidence = Evidence(
            execution_id=execution.id,
            evidence_type=item.evidence_type,
            content=item.content,
            artifact_uri=item.artifact_uri,
        )
        db.add(evidence)
        evidence_count += 1

    hypothesis = _get_hypothesis_or_404(db, execution.hypothesis_id)
    target = _get_target_or_404(db, hypothesis.target_id)

    finding_data = (
        payload.finding.model_dump() if payload.finding else evidence_agent.build_finding(hypothesis, execution)
    )
    finding_status = finding_data["status"]
    if hasattr(finding_status, "value"):
        finding_status = finding_status.value
    finding = Finding(
        program_id=hypothesis.program_id,
        target_id=target.id,
        hypothesis_id=hypothesis.id,
        execution_id=execution.id,
        title=finding_data["title"],
        description=finding_data["description"],
        severity=finding_data["severity"],
        status=finding_status,
    )
    db.add(finding)
    db.flush()

    hypothesis.status = HypothesisStatus.EXECUTED.value

    decision_logger = DecisionLoggerService(db)
    decision_logger.log(
        event_type="execution_completed",
        entity_type="execution",
        entity_id=execution.id,
        actor=payload.actor,
        decision="completed",
        reason="Execução concluída com evidências registradas.",
        metadata={"evidence_count": evidence_count},
    )
    decision_logger.log(
        event_type="finding_created",
        entity_type="finding",
        entity_id=finding.id,
        actor=payload.actor,
        decision="recorded",
        reason="Finding gerado a partir de execução aprovada.",
        metadata={"hypothesis_id": hypothesis.id, "execution_id": execution.id},
    )

    db.commit()
    db.refresh(execution)
    db.refresh(finding)

    return ExecutionCompleteResponse(execution=execution, finding=finding, evidence_count=evidence_count)


@router.get("/findings", response_model=list[FindingRead])
def list_findings(db: Session = Depends(get_db)) -> list[Finding]:
    return list(db.scalars(select(Finding).order_by(desc(Finding.created_at))))


@router.get("/audit/decisions", response_model=list[DecisionLogRead])
def list_decisions(db: Session = Depends(get_db)) -> list[DecisionLog]:
    return list(db.scalars(select(DecisionLog).order_by(desc(DecisionLog.created_at))))
