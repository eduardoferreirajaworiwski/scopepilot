from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


def _normalize_str_list(value: Any) -> list[str]:
    if value is None:
        return []
    if isinstance(value, str):
        items = [value]
    else:
        items = list(value)

    normalized: list[str] = []
    seen: set[str] = set()
    for item in items:
        cleaned = str(item).strip().lower()
        if not cleaned or cleaned in seen:
            continue
        normalized.append(cleaned)
        seen.add(cleaned)
    return normalized


class ProgramPolicyLimits(BaseModel):
    max_requests_per_minute: int = Field(
        default=30,
        ge=1,
        description="Hard limit for request throughput. Above this value the action is blocked.",
    )
    manual_approval_request_rate: int = Field(
        default=10,
        ge=1,
        description="Actions above this rate require explicit manual approval.",
    )
    max_targets_per_execution: int = Field(
        default=1,
        ge=1,
        description="Maximum number of targets a single execution can touch.",
    )
    manual_approval_techniques: list[str] = Field(
        default_factory=lambda: [
            "active_scan",
            "auth_testing",
            "content_discovery",
            "fuzzing",
            "manual_verification",
            "payload_injection",
        ]
    )

    @field_validator("manual_approval_techniques", mode="before")
    @classmethod
    def normalize_manual_approval_techniques(cls, value: Any) -> list[str]:
        return _normalize_str_list(value)

    @model_validator(mode="after")
    def validate_thresholds(self) -> "ProgramPolicyLimits":
        if self.manual_approval_request_rate > self.max_requests_per_minute:
            raise ValueError(
                "manual_approval_request_rate cannot exceed max_requests_per_minute."
            )
        return self


class ProgramPolicy(BaseModel):
    model_config = ConfigDict(extra="ignore")

    allowed_domains: list[str] = Field(
        default_factory=list,
        description="Explicit program allowlist. No target is in scope without a matching rule.",
    )
    denied_domains: list[str] = Field(
        default_factory=list,
        description="High-priority denylist. These rules override the allowlist.",
    )
    forbidden_techniques: list[str] = Field(
        default_factory=list,
        description="Techniques that must be blocked automatically.",
    )
    limits: ProgramPolicyLimits = Field(default_factory=ProgramPolicyLimits)
    notes: str | None = None

    @field_validator("allowed_domains", "denied_domains", "forbidden_techniques", mode="before")
    @classmethod
    def normalize_string_fields(cls, value: Any) -> list[str]:
        return _normalize_str_list(value)


class ProposedAction(BaseModel):
    target_identifier: str = Field(min_length=2, max_length=255)
    target_type: str = Field(default="domain", min_length=2, max_length=50)
    technique: str = Field(default="manual_verification", min_length=2, max_length=80)
    description: str = Field(default="", max_length=2000)
    request_rate_per_minute: int = Field(default=1, ge=1)
    target_count: int = Field(default=1, ge=1)
    state_changing: bool = False
    requires_authentication: bool = False

    @field_validator("technique")
    @classmethod
    def normalize_technique(cls, value: str) -> str:
        return value.strip().lower()


class TargetValidationResult(BaseModel):
    in_scope: bool
    code: str
    message: str
    normalized_target: str | None = None
    matched_rule: str | None = None


class ManualApprovalResult(BaseModel):
    requires_manual_approval: bool
    code: str
    message: str
    reasons: list[str] = Field(default_factory=list)


class ActionBlockResult(BaseModel):
    blocked: bool
    code: str
    message: str
    reasons: list[str] = Field(default_factory=list)


class ActionValidationResult(BaseModel):
    allowed: bool
    blocked: bool
    requires_manual_approval: bool
    code: str
    message: str
    reasons: list[str] = Field(default_factory=list)

