from collections import Counter

from app.schemas.enums import RequiredApprovalLevel
from app.schemas.hypothesis_engine import (
    HypothesisDraft,
    HypothesisEngineInput,
    HypothesisEngineMode,
    HypothesisEngineOutput,
)


class HypothesisEngineService:
    def __init__(self, mode: HypothesisEngineMode = HypothesisEngineMode.MOCK) -> None:
        self.mode = mode

    def generate(self, payload: HypothesisEngineInput) -> HypothesisDraft:
        if self.mode != HypothesisEngineMode.MOCK:
            raise ValueError(f"Hypothesis engine mode '{self.mode}' is not supported.")
        return self._generate_mock(payload)

    def build_output(
        self,
        *,
        hypothesis_id: int | str,
        draft: HypothesisDraft,
    ) -> HypothesisEngineOutput:
        return HypothesisEngineOutput(
            hypothesis_id=str(hypothesis_id),
            title=draft.title,
            rationale=draft.rationale,
            confidence=draft.confidence,
            suggested_next_step=draft.suggested_next_step,
            required_approval_level=draft.required_approval_level,
        )

    def _generate_mock(self, payload: HypothesisEngineInput) -> HypothesisDraft:
        title = self._build_title(payload)
        confidence = self._calculate_confidence(payload)
        rationale = self._build_rationale(payload, confidence=confidence)
        next_step = self._suggest_next_step(payload)
        approval_level = self._determine_required_approval_level(payload, confidence=confidence)

        return HypothesisDraft(
            title=title,
            rationale=rationale,
            confidence=confidence,
            suggested_next_step=next_step,
            required_approval_level=approval_level,
        )

    def _build_title(self, payload: HypothesisEngineInput) -> str:
        primary_type = Counter(item.evidence_type for item in payload.evidence).most_common(1)[0][0]
        title_by_type = {
            "endpoint_exposure": f"Potential exposed endpoint risk on {payload.asset.identifier}",
            "header_misconfiguration": f"Potential header misconfiguration on {payload.asset.identifier}",
            "technology_disclosure": f"Potential attack surface expansion on {payload.asset.identifier}",
            "dns_exposure": f"Potential external exposure on {payload.asset.identifier}",
        }
        return title_by_type.get(
            primary_type,
            f"Potential security weakness on {payload.asset.identifier}",
        )

    def _calculate_confidence(self, payload: HypothesisEngineInput) -> float:
        evidence_count = len(payload.evidence)
        average_signal = sum(item.signal_strength for item in payload.evidence) / evidence_count

        confidence = 0.35
        confidence += min(0.2, evidence_count * 0.07)
        confidence += average_signal * 0.25

        if payload.context.summary:
            confidence += 0.05
        if payload.context.tags:
            confidence += 0.05
        if payload.asset.in_scope:
            confidence += 0.05

        return round(min(confidence, 0.95), 2)

    def _build_rationale(self, payload: HypothesisEngineInput, *, confidence: float) -> str:
        evidence_fragments = "; ".join(item.summary for item in payload.evidence[:3])
        context_fragment = payload.context.summary or "No additional recon summary was provided."
        return (
            "Structured recon evidence suggests a potential issue that warrants investigation. "
            "This output is an investigatory hypothesis, not a confirmed vulnerability. "
            f"Program: {payload.program.name}. Asset: {payload.asset.identifier}. "
            f"Observed evidence: {evidence_fragments}. Context: {context_fragment}. "
            f"Current confidence: {confidence:.2f}."
        )

    def _suggest_next_step(self, payload: HypothesisEngineInput) -> str:
        evidence_types = {item.evidence_type for item in payload.evidence}
        tags = set(payload.context.tags)

        if "endpoint_exposure" in evidence_types:
            return (
                "Request approval to validate authorization boundaries and input handling on the "
                "exposed endpoint using a single in-scope target."
            )
        if "header_misconfiguration" in evidence_types or "technology_disclosure" in evidence_types:
            return (
                "Request approval to perform a minimal, non-destructive verification of the "
                "observed configuration weakness."
            )
        if "authenticated_surface" in tags:
            return (
                "Request approval to verify authenticated surface controls with a tightly bounded "
                "test plan and explicit reviewer oversight."
            )
        return (
            "Request approval to perform a minimal validation step that checks the strongest "
            "structured evidence without changing target state."
        )

    def _determine_required_approval_level(
        self,
        payload: HypothesisEngineInput,
        *,
        confidence: float,
    ) -> RequiredApprovalLevel:
        tags = set(payload.context.tags)
        if confidence >= 0.75 or "authenticated_surface" in tags or "sensitive_surface" in tags:
            return RequiredApprovalLevel.SECURITY_LEAD
        return RequiredApprovalLevel.ANALYST

