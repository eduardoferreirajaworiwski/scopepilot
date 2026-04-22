from enum import Enum

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.schemas.enums import RequiredApprovalLevel


StructuredValue = str | int | float | bool


class HypothesisEngineMode(str, Enum):
    MOCK = "mock"


class HypothesisAssetInput(BaseModel):
    asset_id: int | None = None
    identifier: str = Field(min_length=2, max_length=255)
    asset_type: str = Field(min_length=2, max_length=50)
    in_scope: bool = True


class HypothesisEvidenceInput(BaseModel):
    evidence_type: str = Field(min_length=2, max_length=80)
    summary: str = Field(min_length=3, max_length=500)
    source: str = Field(min_length=2, max_length=120)
    signal_strength: float = Field(default=0.5, ge=0.0, le=1.0)
    attributes: dict[str, StructuredValue] = Field(default_factory=dict)


class HypothesisContextInput(BaseModel):
    summary: str = Field(default="", max_length=1000)
    tags: list[str] = Field(default_factory=list)
    notes: str | None = Field(default=None, max_length=1000)

    @field_validator("tags", mode="before")
    @classmethod
    def normalize_tags(cls, value: list[str] | str | None) -> list[str]:
        if value is None:
            return []
        if isinstance(value, str):
            value = [value]
        return [item.strip().lower() for item in value if str(item).strip()]


class HypothesisProgramInput(BaseModel):
    program_id: int | None = None
    name: str = Field(min_length=2, max_length=150)
    owner: str | None = Field(default=None, max_length=120)
    scope_summary: str | None = Field(default=None, max_length=500)


class HypothesisEngineInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    asset: HypothesisAssetInput
    evidence: list[HypothesisEvidenceInput] = Field(min_length=1)
    context: HypothesisContextInput
    program: HypothesisProgramInput


class HypothesisDraft(BaseModel):
    title: str = Field(min_length=3, max_length=180)
    rationale: str = Field(min_length=10, max_length=4000)
    confidence: float = Field(ge=0.0, le=1.0)
    suggested_next_step: str = Field(min_length=10, max_length=1000)
    required_approval_level: RequiredApprovalLevel


class HypothesisEngineOutput(HypothesisDraft):
    hypothesis_id: str = Field(min_length=1, max_length=64)

