from app.schemas.scope_guard import (
    ActionBlockResult,
    ActionValidationResult,
    ManualApprovalResult,
    ProgramPolicy,
    ProposedAction,
    TargetValidationResult,
)
from app.services.scope_guard import ScopeGuardService


class ScopeGuardAgent:
    def __init__(self, service: ScopeGuardService | None = None) -> None:
        self.service = service or ScopeGuardService()

    def validate_target(
        self,
        scope_policy: ProgramPolicy,
        identifier: str,
        target_type: str,
    ) -> TargetValidationResult:
        return self.service.validate_target_in_scope(
            scope_policy,
            identifier=identifier,
            target_type=target_type,
        )

    def requires_manual_approval(
        self,
        scope_policy: ProgramPolicy,
        action: ProposedAction,
    ) -> ManualApprovalResult:
        return self.service.requires_manual_approval(scope_policy, action=action)

    def block_prohibited_action(
        self,
        scope_policy: ProgramPolicy,
        action: ProposedAction,
    ) -> ActionBlockResult:
        return self.service.block_prohibited_action(scope_policy, action=action)

    def validate_action(
        self,
        scope_policy: ProgramPolicy,
        action: ProposedAction,
    ) -> ActionValidationResult:
        return self.service.validate_action(scope_policy, action=action)
