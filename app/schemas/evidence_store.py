from datetime import datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.models import EvidenceRead, FindingRead


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class FlowStage(str, Enum):
    HYPOTHESIS = "hypothesis"
    APPROVAL = "approval"
    EXECUTION = "execution"
    FINDING = "finding"
    REPORT = "report"


class SnapshotType(str, Enum):
    REQUEST = "request"
    RESPONSE = "response"
    DECISION = "decision"


class FlowSnapshotCreate(BaseModel):
    program_id: int
    target_id: int | None = None
    hypothesis_id: int | None = None
    approval_id: int | None = None
    execution_id: int | None = None
    finding_id: int | None = None
    stage: FlowStage
    snapshot_type: SnapshotType
    actor: str | None = Field(default=None, max_length=120)
    payload: dict[str, Any] = Field(default_factory=dict)


class DecisionSnapshotCreate(BaseModel):
    program_id: int
    target_id: int | None = None
    hypothesis_id: int | None = None
    approval_id: int | None = None
    execution_id: int | None = None
    finding_id: int | None = None
    stage: FlowStage = FlowStage.APPROVAL
    actor: str = Field(min_length=2, max_length=120)
    decision: str = Field(min_length=2, max_length=80)
    rationale: str = Field(min_length=3)
    state: dict[str, Any] = Field(default_factory=dict)


class EvidenceRecordCreate(BaseModel):
    program_id: int
    target_id: int
    hypothesis_id: int
    execution_id: int
    finding_id: int | None = None
    evidence_type: str = Field(min_length=2, max_length=50)
    content: str = Field(min_length=1)
    artifact_uri: str | None = Field(default=None, max_length=255)
    content_format: str = Field(default="text", min_length=2, max_length=30)


class ReportDraftCreate(BaseModel):
    program_id: int
    target_id: int
    hypothesis_id: int
    execution_id: int
    finding_id: int
    title: str = Field(min_length=3, max_length=180)
    narrative: str = Field(min_length=5)
    generated_by: str = Field(min_length=2, max_length=120)
    status: str = Field(default="draft", min_length=2, max_length=30)


class FlowSnapshotRead(ORMModel):
    id: int
    program_id: int
    target_id: int | None
    hypothesis_id: int | None
    approval_id: int | None
    execution_id: int | None
    finding_id: int | None
    stage: str
    snapshot_type: str
    actor: str | None
    payload_json: dict
    created_at: datetime


class ReportDraftRead(ORMModel):
    id: int
    program_id: int
    target_id: int
    hypothesis_id: int
    execution_id: int
    finding_id: int
    title: str
    narrative: str
    generated_by: str
    status: str
    created_at: datetime
    updated_at: datetime


class EvidenceStoreQueryResult(BaseModel):
    program_id: int | None = None
    target_id: int | None = None
    finding_id: int | None = None
    snapshots: list[FlowSnapshotRead] = Field(default_factory=list)
    evidence: list[EvidenceRead] = Field(default_factory=list)
    findings: list[FindingRead] = Field(default_factory=list)
    report_drafts: list[ReportDraftRead] = Field(default_factory=list)
