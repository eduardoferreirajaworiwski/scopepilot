from datetime import UTC, datetime

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base
from app.schemas.enums import ApprovalStatus, ExecutionStatus, FindingStatus, HypothesisStatus


class Program(Base):
    __tablename__ = "programs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(150), unique=True, nullable=False)
    description: Mapped[str] = mapped_column(Text, default="", nullable=False)
    owner: Mapped[str] = mapped_column(String(120), nullable=False)
    scope_policy: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )


class Target(Base):
    __tablename__ = "targets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    program_id: Mapped[int] = mapped_column(ForeignKey("programs.id"), index=True, nullable=False)
    identifier: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    target_type: Mapped[str] = mapped_column(String(50), nullable=False)
    created_by: Mapped[str] = mapped_column(String(120), nullable=False)
    in_scope: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    scope_reason: Mapped[str] = mapped_column(String(255), default="", nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )


class ReconRecord(Base):
    __tablename__ = "recon_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    target_id: Mapped[int] = mapped_column(ForeignKey("targets.id"), index=True, nullable=False)
    analyst: Mapped[str] = mapped_column(String(120), nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    observations: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )


class Hypothesis(Base):
    __tablename__ = "hypotheses"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    program_id: Mapped[int] = mapped_column(ForeignKey("programs.id"), index=True, nullable=False)
    target_id: Mapped[int] = mapped_column(ForeignKey("targets.id"), index=True, nullable=False)
    recon_record_id: Mapped[int | None] = mapped_column(ForeignKey("recon_records.id"), nullable=True)
    title: Mapped[str] = mapped_column(String(180), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    confidence: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    suggested_next_step: Mapped[str] = mapped_column(Text, nullable=False, default="")
    required_approval_level: Mapped[str] = mapped_column(String(40), nullable=False, default="analyst")
    severity: Mapped[str] = mapped_column(String(30), nullable=False, default="medium")
    created_by: Mapped[str] = mapped_column(String(120), nullable=False)
    status: Mapped[str] = mapped_column(
        String(40),
        nullable=False,
        default=HypothesisStatus.DRAFT.value,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
        nullable=False,
    )


class Approval(Base):
    __tablename__ = "approvals"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    hypothesis_id: Mapped[int] = mapped_column(ForeignKey("hypotheses.id"), index=True, nullable=False)
    requested_by: Mapped[str] = mapped_column(String(120), nullable=False)
    request_rationale: Mapped[str] = mapped_column(Text, nullable=False, default="")
    approver: Mapped[str | None] = mapped_column(String(120), nullable=True)
    status: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default=ApprovalStatus.PENDING.value,
    )
    decision_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class Execution(Base):
    __tablename__ = "executions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    hypothesis_id: Mapped[int] = mapped_column(ForeignKey("hypotheses.id"), index=True, nullable=False)
    requested_by: Mapped[str] = mapped_column(String(120), nullable=False)
    approved_by: Mapped[str | None] = mapped_column(String(120), nullable=True)
    status: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default=ExecutionStatus.QUEUED.value,
    )
    action_plan: Mapped[str] = mapped_column(Text, nullable=False)
    output_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class Evidence(Base):
    __tablename__ = "evidence"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    program_id: Mapped[int] = mapped_column(ForeignKey("programs.id"), index=True, nullable=False)
    target_id: Mapped[int] = mapped_column(ForeignKey("targets.id"), index=True, nullable=False)
    hypothesis_id: Mapped[int] = mapped_column(ForeignKey("hypotheses.id"), index=True, nullable=False)
    execution_id: Mapped[int] = mapped_column(ForeignKey("executions.id"), index=True, nullable=False)
    finding_id: Mapped[int | None] = mapped_column(ForeignKey("findings.id"), index=True, nullable=True)
    evidence_type: Mapped[str] = mapped_column(String(50), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    content_format: Mapped[str] = mapped_column(String(30), nullable=False, default="text")
    content_sha256: Mapped[str] = mapped_column(String(64), nullable=False, default="")
    artifact_uri: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )


class Finding(Base):
    __tablename__ = "findings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    program_id: Mapped[int] = mapped_column(ForeignKey("programs.id"), index=True, nullable=False)
    target_id: Mapped[int] = mapped_column(ForeignKey("targets.id"), index=True, nullable=False)
    hypothesis_id: Mapped[int] = mapped_column(ForeignKey("hypotheses.id"), index=True, nullable=False)
    execution_id: Mapped[int] = mapped_column(ForeignKey("executions.id"), index=True, nullable=False)
    title: Mapped[str] = mapped_column(String(180), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    severity: Mapped[str] = mapped_column(String(30), nullable=False)
    status: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default=FindingStatus.NEW.value,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )


class DecisionLog(Base):
    __tablename__ = "decision_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    event_type: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    entity_type: Mapped[str] = mapped_column(String(80), nullable=False)
    entity_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    actor: Mapped[str] = mapped_column(String(120), nullable=False)
    decision: Mapped[str] = mapped_column(String(80), nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    metadata_json: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )


class FlowSnapshot(Base):
    __tablename__ = "flow_snapshots"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    program_id: Mapped[int] = mapped_column(ForeignKey("programs.id"), index=True, nullable=False)
    target_id: Mapped[int | None] = mapped_column(ForeignKey("targets.id"), index=True, nullable=True)
    hypothesis_id: Mapped[int | None] = mapped_column(ForeignKey("hypotheses.id"), index=True, nullable=True)
    approval_id: Mapped[int | None] = mapped_column(ForeignKey("approvals.id"), index=True, nullable=True)
    execution_id: Mapped[int | None] = mapped_column(ForeignKey("executions.id"), index=True, nullable=True)
    finding_id: Mapped[int | None] = mapped_column(ForeignKey("findings.id"), index=True, nullable=True)
    stage: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    snapshot_type: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    actor: Mapped[str | None] = mapped_column(String(120), nullable=True)
    payload_json: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )


class ReportDraft(Base):
    __tablename__ = "report_drafts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    program_id: Mapped[int] = mapped_column(ForeignKey("programs.id"), index=True, nullable=False)
    target_id: Mapped[int] = mapped_column(ForeignKey("targets.id"), index=True, nullable=False)
    hypothesis_id: Mapped[int] = mapped_column(ForeignKey("hypotheses.id"), index=True, nullable=False)
    execution_id: Mapped[int] = mapped_column(ForeignKey("executions.id"), index=True, nullable=False)
    finding_id: Mapped[int] = mapped_column(ForeignKey("findings.id"), index=True, nullable=False)
    title: Mapped[str] = mapped_column(String(180), nullable=False)
    narrative: Mapped[str] = mapped_column(Text, nullable=False)
    generated_by: Mapped[str] = mapped_column(String(120), nullable=False)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="draft")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
        nullable=False,
    )
