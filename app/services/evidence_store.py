from app.repositories.evidence_store import (
    EvidenceStoreRepository,
    SqlAlchemyEvidenceStoreRepository,
)
from app.schemas.evidence_store import (
    DecisionSnapshotCreate,
    EvidenceRecordCreate,
    EvidenceStoreQueryResult,
    FlowSnapshotCreate,
    FlowStage,
    ReportDraftCreate,
    SnapshotType,
)


class EvidenceStoreService:
    def __init__(self, repository: EvidenceStoreRepository) -> None:
        self.repository = repository

    @classmethod
    def for_db(cls, db_session) -> "EvidenceStoreService":
        return cls(SqlAlchemyEvidenceStoreRepository(db_session))

    def record_request(self, *, stage: FlowStage, actor: str | None = None, payload: dict, **refs) -> None:
        self.repository.store_snapshot(
            FlowSnapshotCreate(
                stage=stage,
                snapshot_type=SnapshotType.REQUEST,
                actor=actor,
                payload=payload,
                **refs,
            )
        )

    def record_response(self, *, stage: FlowStage, actor: str | None = None, payload: dict, **refs) -> None:
        self.repository.store_snapshot(
            FlowSnapshotCreate(
                stage=stage,
                snapshot_type=SnapshotType.RESPONSE,
                actor=actor,
                payload=payload,
                **refs,
            )
        )

    def record_decision(
        self,
        *,
        actor: str,
        decision: str,
        rationale: str,
        state: dict,
        stage: FlowStage = FlowStage.APPROVAL,
        **refs,
    ) -> None:
        self.repository.store_decision_snapshot(
            DecisionSnapshotCreate(
                stage=stage,
                actor=actor,
                decision=decision,
                rationale=rationale,
                state=state,
                **refs,
            )
        )

    def store_raw_evidence(self, payload: EvidenceRecordCreate) -> None:
        self.repository.store_raw_evidence(payload)

    def store_report_draft(self, payload: ReportDraftCreate) -> None:
        self.repository.store_report_draft(payload)

    def get_by_program(self, program_id: int) -> EvidenceStoreQueryResult:
        return self.repository.get_by_program(program_id)

    def get_by_target(self, target_id: int) -> EvidenceStoreQueryResult:
        return self.repository.get_by_target(target_id)

    def get_by_finding(self, finding_id: int) -> EvidenceStoreQueryResult:
        return self.repository.get_by_finding(finding_id)
