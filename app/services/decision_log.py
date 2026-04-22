import logging
from typing import Any

from sqlalchemy.orm import Session

from app.db.models import DecisionLog


class DecisionLoggerService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.logger = logging.getLogger("bugbountycopilot.audit")

    def log(
        self,
        *,
        event_type: str,
        entity_type: str,
        entity_id: int | None,
        actor: str,
        decision: str,
        reason: str,
        metadata: dict[str, Any] | None = None,
    ) -> None:
        payload = metadata or {}
        entry = DecisionLog(
            event_type=event_type,
            entity_type=entity_type,
            entity_id=entity_id,
            actor=actor,
            decision=decision,
            reason=reason,
            metadata_json=payload,
        )
        self.db.add(entry)

        self.logger.info(
            "decision_recorded",
            extra={
                "event_type": event_type,
                "entity_type": entity_type,
                "entity_id": entity_id,
                "actor": actor,
                "decision": decision,
                "reason": reason,
                "metadata": payload,
            },
        )

