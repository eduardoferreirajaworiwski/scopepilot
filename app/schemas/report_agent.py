from enum import Enum

from pydantic import BaseModel, ConfigDict, Field


class ReportAgentMode(str, Enum):
    OFFLINE_DETERMINISTIC = "offline_deterministic"


class ReportProgramContextInput(BaseModel):
    program_id: int | None = None
    name: str = Field(min_length=2, max_length=150)
    policy_summary: str | None = Field(default=None, max_length=500)
    submission_guidance: str | None = Field(default=None, max_length=500)


class ReportFindingInput(BaseModel):
    finding_id: int | None = None
    title: str = Field(min_length=3, max_length=180)
    severity: str = Field(min_length=2, max_length=30)
    asset_identifier: str = Field(min_length=2, max_length=255)
    description: str = Field(min_length=5, max_length=4000)


class ReportEvidenceInput(BaseModel):
    label: str = Field(min_length=2, max_length=80)
    observation: str = Field(min_length=3, max_length=2000)
    source: str = Field(min_length=2, max_length=120)
    artifact_uri: str | None = Field(default=None, max_length=255)
    inference: str | None = Field(default=None, max_length=1000)


class ReportImpactInput(BaseModel):
    confirmed_impact: str = Field(min_length=3, max_length=2000)
    business_context: str | None = Field(default=None, max_length=1000)
    analyst_inference: str | None = Field(default=None, max_length=1000)


class ReportStepInput(BaseModel):
    order: int = Field(ge=1)
    action: str = Field(min_length=3, max_length=1000)
    expected_result: str = Field(min_length=3, max_length=1000)
    evidence_labels: list[str] = Field(default_factory=list)


class ReportAgentInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    finding: ReportFindingInput
    evidence: list[ReportEvidenceInput] = Field(min_length=1)
    impact: ReportImpactInput
    steps: list[ReportStepInput] = Field(min_length=1)
    program_context: ReportProgramContextInput
    remediation_notes_hint: str | None = Field(default=None, max_length=1000)


class ReportEvidenceSection(BaseModel):
    label: str
    evidence_statement: str
    inference_statement: str | None = None
    source: str
    artifact_uri: str | None = None


class ReportStepOutput(BaseModel):
    order: int
    action: str
    expected_result: str
    evidence_labels: list[str] = Field(default_factory=list)


class ReportAgentOutput(BaseModel):
    title: str
    summary: str
    impact: str
    steps_to_reproduce: list[ReportStepOutput]
    evidence: list[ReportEvidenceSection]
    remediation_notes: str
    markdown_export: str
    json_export: str

