from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.enums import (
    ApprovalStatus,
    ExecutionStatus,
    FindingStatus,
    HypothesisStatus,
    RequiredApprovalLevel,
)
from app.schemas.scope_guard import ProgramPolicy


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


ScopePolicy = ProgramPolicy


class ProgramCreate(BaseModel):
    name: str = Field(min_length=3, max_length=150)
    description: str = ""
    owner: str = Field(min_length=2, max_length=120)
    scope_policy: ProgramPolicy = Field(default_factory=ProgramPolicy)


class ProgramRead(ORMModel):
    id: int
    name: str
    description: str
    owner: str
    scope_policy: dict
    created_at: datetime


class TargetCreate(BaseModel):
    program_id: int
    identifier: str = Field(min_length=2, max_length=255)
    target_type: str = Field(min_length=2, max_length=50)
    created_by: str = Field(min_length=2, max_length=120)


class TargetRead(ORMModel):
    id: int
    program_id: int
    identifier: str
    target_type: str
    created_by: str
    in_scope: bool
    scope_reason: str
    created_at: datetime


class ReconRunRequest(BaseModel):
    target_id: int
    analyst: str = Field(min_length=2, max_length=120)


class ReconRecordRead(ORMModel):
    id: int
    target_id: int
    analyst: str
    summary: str
    observations: list
    created_at: datetime


class HypothesisCreate(BaseModel):
    target_id: int
    created_by: str = Field(min_length=2, max_length=120)
    title: str | None = Field(default=None, max_length=180)
    description: str | None = None
    severity: str = "medium"
    recon_record_id: int | None = None


class HypothesisRead(ORMModel):
    id: int
    hypothesis_id: int = Field(validation_alias="id")
    program_id: int
    target_id: int
    recon_record_id: int | None
    title: str
    description: str
    rationale: str = Field(validation_alias="description")
    confidence: float
    suggested_next_step: str
    required_approval_level: RequiredApprovalLevel
    severity: str
    created_by: str
    status: HypothesisStatus
    created_at: datetime
    updated_at: datetime


class ApprovalRequestCreate(BaseModel):
    requested_by: str = Field(min_length=2, max_length=120)


class ApprovalDecision(BaseModel):
    status: Literal["approved", "rejected"]
    approver: str = Field(min_length=2, max_length=120)
    reason: str = Field(min_length=3)


class ApprovalRead(ORMModel):
    id: int
    hypothesis_id: int
    requested_by: str
    approver: str | None
    status: ApprovalStatus
    decision_reason: str | None
    created_at: datetime
    decided_at: datetime | None


class ExecutionRequest(BaseModel):
    hypothesis_id: int
    requested_by: str = Field(min_length=2, max_length=120)
    action_plan: str = Field(min_length=8)
    technique: str = Field(default="manual_verification", min_length=2, max_length=80)
    request_rate_per_minute: int = Field(default=1, ge=1)
    target_count: int = Field(default=1, ge=1)
    state_changing: bool = False
    requires_authentication: bool = False


class QueueDispatchRequest(BaseModel):
    operator: str = Field(min_length=2, max_length=120)


class EvidenceInput(BaseModel):
    evidence_type: str = Field(min_length=2, max_length=50)
    content: str = Field(min_length=2)
    artifact_uri: str | None = Field(default=None, max_length=255)


class FindingInput(BaseModel):
    title: str = Field(min_length=3, max_length=180)
    description: str = Field(min_length=5)
    severity: str = "medium"
    status: FindingStatus = FindingStatus.NEW


class ExecutionCompleteRequest(BaseModel):
    actor: str = Field(min_length=2, max_length=120)
    output_summary: str = Field(min_length=5)
    evidence: list[EvidenceInput] = Field(default_factory=list)
    finding: FindingInput | None = None


class ExecutionRead(ORMModel):
    id: int
    hypothesis_id: int
    requested_by: str
    approved_by: str | None
    status: ExecutionStatus
    action_plan: str
    output_summary: str | None
    created_at: datetime
    started_at: datetime | None
    completed_at: datetime | None


class EvidenceRead(ORMModel):
    id: int
    execution_id: int
    evidence_type: str
    content: str
    artifact_uri: str | None
    created_at: datetime


class FindingRead(ORMModel):
    id: int
    program_id: int
    target_id: int
    hypothesis_id: int
    execution_id: int
    title: str
    description: str
    severity: str
    status: FindingStatus
    created_at: datetime


class ExecutionCompleteResponse(BaseModel):
    execution: ExecutionRead
    finding: FindingRead
    evidence_count: int


class DecisionLogRead(ORMModel):
    id: int
    event_type: str
    entity_type: str
    entity_id: int | None
    actor: str
    decision: str
    reason: str
    metadata_json: dict
    created_at: datetime


class QueueSnapshot(BaseModel):
    queued_execution_ids: list[int]
