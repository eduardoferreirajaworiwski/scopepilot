import hashlib
import re
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from typing import Any, Protocol

from sqlalchemy import desc, or_, select
from sqlalchemy.orm import Session

from app.db.models import Evidence, Finding, FlowSnapshot, ReportDraft
from app.schemas.evidence_store import (
    DecisionSnapshotCreate,
    EvidenceRecordCreate,
    EvidenceStoreQueryResult,
    FlowSnapshotCreate,
    ReportDraftCreate,
)
from app.schemas.models import EvidenceRead, FindingRead


@dataclass
class SanitizationRules:
    sensitive_keys: tuple[str, ...] = (
        "authorization",
        "cookie",
        "set-cookie",
        "password",
        "passwd",
        "secret",
        "token",
        "api_key",
        "apikey",
        "x-api-key",
        "access_token",
        "refresh_token",
        "session",
        "session_id",
    )


class SensitiveDataSanitizer:
    _ASSIGNMENT_RE = re.compile(
        r"(?i)\b(password|passwd|secret|token|api[_-]?key|authorization|cookie|session(?:_id)?)\b\s*[:=]\s*([^\s,;]+)"
    )
    _BEARER_RE = re.compile(r"(?i)\bbearer\s+[a-z0-9\-._~+/]+=*")

    def __init__(self, rules: SanitizationRules | None = None) -> None:
        self.rules = rules or SanitizationRules()

    def sanitize(self, value: Any) -> Any:
        if value is None:
            return None
        if isinstance(value, datetime):
            return value.isoformat()
        if isinstance(value, Enum):
            return value.value
        if isinstance(value, Mapping):
            return {str(key): self._sanitize_mapping_value(str(key), item) for key, item in value.items()}
        if isinstance(value, Sequence) and not isinstance(value, (str, bytes, bytearray)):
            return [self.sanitize(item) for item in value]
        if isinstance(value, bytes):
            return "[REDACTED_BINARY]"
        if isinstance(value, str):
            return self._sanitize_text(value)
        return value

    def _sanitize_mapping_value(self, key: str, value: Any) -> Any:
        if self._is_sensitive_key(key):
            return "[REDACTED]"
        return self.sanitize(value)

    def _sanitize_text(self, value: str) -> str:
        redacted = self._ASSIGNMENT_RE.sub(lambda match: f"{match.group(1)}=[REDACTED]", value)
        redacted = self._BEARER_RE.sub("Bearer [REDACTED]", redacted)
        return redacted

    def _is_sensitive_key(self, key: str) -> bool:
        normalized = key.strip().lower()
        return any(term == normalized or term in normalized for term in self.rules.sensitive_keys)


class EvidenceStoreRepository(Protocol):
    def store_snapshot(self, payload: FlowSnapshotCreate) -> FlowSnapshot: ...

    def store_decision_snapshot(self, payload: DecisionSnapshotCreate) -> FlowSnapshot: ...

    def store_raw_evidence(self, payload: EvidenceRecordCreate) -> Evidence: ...

    def store_report_draft(self, payload: ReportDraftCreate) -> ReportDraft: ...

    def get_by_program(self, program_id: int) -> EvidenceStoreQueryResult: ...

    def get_by_target(self, target_id: int) -> EvidenceStoreQueryResult: ...

    def get_by_finding(self, finding_id: int) -> EvidenceStoreQueryResult: ...


class SqlAlchemyEvidenceStoreRepository:
    def __init__(
        self,
        db: Session,
        sanitizer: SensitiveDataSanitizer | None = None,
    ) -> None:
        self.db = db
        self.sanitizer = sanitizer or SensitiveDataSanitizer()

    def store_snapshot(self, payload: FlowSnapshotCreate) -> FlowSnapshot:
        snapshot = FlowSnapshot(
            program_id=payload.program_id,
            target_id=payload.target_id,
            hypothesis_id=payload.hypothesis_id,
            approval_id=payload.approval_id,
            execution_id=payload.execution_id,
            finding_id=payload.finding_id,
            stage=payload.stage.value,
            snapshot_type=payload.snapshot_type.value,
            actor=payload.actor,
            payload_json=self._sanitize_payload(payload.payload),
        )
        self.db.add(snapshot)
        self.db.flush()
        return snapshot

    def store_decision_snapshot(self, payload: DecisionSnapshotCreate) -> FlowSnapshot:
        return self.store_snapshot(
            FlowSnapshotCreate(
                program_id=payload.program_id,
                target_id=payload.target_id,
                hypothesis_id=payload.hypothesis_id,
                approval_id=payload.approval_id,
                execution_id=payload.execution_id,
                finding_id=payload.finding_id,
                stage=payload.stage,
                snapshot_type="decision",
                actor=payload.actor,
                payload={
                    "decision": payload.decision,
                    "rationale": self.sanitizer.sanitize(payload.rationale),
                    "state": self._sanitize_payload(payload.state),
                },
            )
        )

    def store_raw_evidence(self, payload: EvidenceRecordCreate) -> Evidence:
        sanitized_content = self.sanitizer.sanitize(payload.content)
        record = Evidence(
            program_id=payload.program_id,
            target_id=payload.target_id,
            hypothesis_id=payload.hypothesis_id,
            execution_id=payload.execution_id,
            finding_id=payload.finding_id,
            evidence_type=payload.evidence_type,
            content=sanitized_content,
            content_format=payload.content_format,
            content_sha256=hashlib.sha256(sanitized_content.encode("utf-8")).hexdigest(),
            artifact_uri=self.sanitizer.sanitize(payload.artifact_uri) if payload.artifact_uri else None,
        )
        self.db.add(record)
        self.db.flush()
        return record

    def store_report_draft(self, payload: ReportDraftCreate) -> ReportDraft:
        draft = ReportDraft(
            program_id=payload.program_id,
            target_id=payload.target_id,
            hypothesis_id=payload.hypothesis_id,
            execution_id=payload.execution_id,
            finding_id=payload.finding_id,
            title=self.sanitizer.sanitize(payload.title),
            narrative=self.sanitizer.sanitize(payload.narrative),
            generated_by=payload.generated_by,
            status=payload.status,
        )
        self.db.add(draft)
        self.db.flush()
        return draft

    def get_by_program(self, program_id: int) -> EvidenceStoreQueryResult:
        snapshots = list(
            self.db.scalars(
                select(FlowSnapshot)
                .where(FlowSnapshot.program_id == program_id)
                .order_by(desc(FlowSnapshot.created_at))
            )
        )
        evidence = list(
            self.db.scalars(
                select(Evidence)
                .where(Evidence.program_id == program_id)
                .order_by(desc(Evidence.created_at))
            )
        )
        findings = list(
            self.db.scalars(
                select(Finding)
                .where(Finding.program_id == program_id)
                .order_by(desc(Finding.created_at))
            )
        )
        drafts = list(
            self.db.scalars(
                select(ReportDraft)
                .where(ReportDraft.program_id == program_id)
                .order_by(desc(ReportDraft.created_at))
            )
        )
        return self._build_result(program_id=program_id, snapshots=snapshots, evidence=evidence, findings=findings, report_drafts=drafts)

    def get_by_target(self, target_id: int) -> EvidenceStoreQueryResult:
        snapshots = list(
            self.db.scalars(
                select(FlowSnapshot)
                .where(FlowSnapshot.target_id == target_id)
                .order_by(desc(FlowSnapshot.created_at))
            )
        )
        evidence = list(
            self.db.scalars(
                select(Evidence)
                .where(Evidence.target_id == target_id)
                .order_by(desc(Evidence.created_at))
            )
        )
        findings = list(
            self.db.scalars(
                select(Finding)
                .where(Finding.target_id == target_id)
                .order_by(desc(Finding.created_at))
            )
        )
        drafts = list(
            self.db.scalars(
                select(ReportDraft)
                .where(ReportDraft.target_id == target_id)
                .order_by(desc(ReportDraft.created_at))
            )
        )
        return self._build_result(target_id=target_id, snapshots=snapshots, evidence=evidence, findings=findings, report_drafts=drafts)

    def get_by_finding(self, finding_id: int) -> EvidenceStoreQueryResult:
        finding = self.db.get(Finding, finding_id)
        if finding is None:
            return self._build_result(finding_id=finding_id, snapshots=[], evidence=[], findings=[], report_drafts=[])

        snapshots = list(
            self.db.scalars(
                select(FlowSnapshot)
                .where(
                    or_(
                        FlowSnapshot.finding_id == finding.id,
                        FlowSnapshot.execution_id == finding.execution_id,
                        FlowSnapshot.hypothesis_id == finding.hypothesis_id,
                    )
                )
                .order_by(desc(FlowSnapshot.created_at))
            )
        )
        evidence = list(
            self.db.scalars(
                select(Evidence)
                .where(
                    or_(
                        Evidence.finding_id == finding.id,
                        Evidence.execution_id == finding.execution_id,
                    )
                )
                .order_by(desc(Evidence.created_at))
            )
        )
        drafts = list(
            self.db.scalars(
                select(ReportDraft)
                .where(ReportDraft.finding_id == finding.id)
                .order_by(desc(ReportDraft.created_at))
            )
        )
        return self._build_result(
            finding_id=finding_id,
            snapshots=snapshots,
            evidence=evidence,
            findings=[finding],
            report_drafts=drafts,
        )

    def _sanitize_payload(self, payload: dict[str, Any]) -> dict[str, Any]:
        sanitized = self.sanitizer.sanitize(payload)
        if not isinstance(sanitized, dict):
            return {"value": sanitized}
        return sanitized

    def _build_result(
        self,
        *,
        program_id: int | None = None,
        target_id: int | None = None,
        finding_id: int | None = None,
        snapshots: list[FlowSnapshot],
        evidence: list[Evidence],
        findings: list[Finding],
        report_drafts: list[ReportDraft],
    ) -> EvidenceStoreQueryResult:
        return EvidenceStoreQueryResult(
            program_id=program_id,
            target_id=target_id,
            finding_id=finding_id,
            snapshots=snapshots,
            evidence=[EvidenceRead.model_validate(item) for item in evidence],
            findings=[FindingRead.model_validate(item) for item in findings],
            report_drafts=report_drafts,
        )
