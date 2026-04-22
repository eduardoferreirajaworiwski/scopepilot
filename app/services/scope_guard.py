from urllib.parse import urlparse

from app.schemas.scope_guard import (
    ActionBlockResult,
    ActionValidationResult,
    ManualApprovalResult,
    ProgramPolicy,
    ProposedAction,
    TargetValidationResult,
)


class ScopeGuardService:
    def validate_target_in_scope(
        self,
        policy: ProgramPolicy,
        *,
        identifier: str,
        target_type: str,
    ) -> TargetValidationResult:
        normalized_target = self._normalize_target(identifier=identifier, target_type=target_type)
        if not normalized_target:
            return TargetValidationResult(
                in_scope=False,
                code="scope_guard.invalid_target",
                message="Nao foi possivel extrair um host valido do alvo informado.",
            )

        if not policy.allowed_domains:
            return TargetValidationResult(
                in_scope=False,
                code="scope_guard.missing_allowlist",
                message="Programa sem allowlist explicita. Nenhum alvo pode ser tratado como in-scope.",
                normalized_target=normalized_target,
            )

        denied_match = self._match_first(normalized_target, policy.denied_domains)
        if denied_match:
            return TargetValidationResult(
                in_scope=False,
                code="scope_guard.denied_domain",
                message=f"Alvo bloqueado pela denylist do programa: '{denied_match}'.",
                normalized_target=normalized_target,
                matched_rule=denied_match,
            )

        allowed_match = self._match_first(normalized_target, policy.allowed_domains)
        if not allowed_match:
            return TargetValidationResult(
                in_scope=False,
                code="scope_guard.out_of_scope",
                message=(
                    "Alvo fora do escopo permitido do programa. "
                    "Nenhuma regra da allowlist corresponde ao dominio informado."
                ),
                normalized_target=normalized_target,
            )

        return TargetValidationResult(
            in_scope=True,
            code="scope_guard.in_scope",
            message=f"Alvo validado em escopo pela regra '{allowed_match}'.",
            normalized_target=normalized_target,
            matched_rule=allowed_match,
        )

    def requires_manual_approval(
        self,
        policy: ProgramPolicy,
        *,
        action: ProposedAction,
    ) -> ManualApprovalResult:
        reasons: list[str] = []

        if self._matches_technique(action, policy.limits.manual_approval_techniques):
            reasons.append(
                f"Tecnica '{action.technique}' classificada como sensivel pela politica do programa."
            )

        if action.request_rate_per_minute > policy.limits.manual_approval_request_rate:
            reasons.append(
                "Taxa de requisicoes acima do limiar que exige revisao manual."
            )

        if action.state_changing:
            reasons.append("Acao potencialmente altera estado do alvo.")

        if action.requires_authentication:
            reasons.append("Acao interage com fluxo autenticado.")

        if reasons:
            return ManualApprovalResult(
                requires_manual_approval=True,
                code="scope_guard.manual_approval_required",
                message="A acao proposta exige aprovacao manual antes da execucao.",
                reasons=reasons,
            )

        return ManualApprovalResult(
            requires_manual_approval=False,
            code="scope_guard.manual_approval_not_required",
            message="A acao nao aciona regras adicionais de aprovacao manual.",
        )

    def block_prohibited_action(
        self,
        policy: ProgramPolicy,
        *,
        action: ProposedAction,
    ) -> ActionBlockResult:
        if self._matches_technique(action, policy.forbidden_techniques):
            return ActionBlockResult(
                blocked=True,
                code="scope_guard.forbidden_technique",
                message=f"A tecnica '{action.technique}' esta proibida para este programa.",
                reasons=["A tecnica foi listada em forbidden_techniques."],
            )

        if action.request_rate_per_minute > policy.limits.max_requests_per_minute:
            return ActionBlockResult(
                blocked=True,
                code="scope_guard.request_rate_exceeded",
                message=(
                    "A acao excede o limite maximo de requisicoes por minuto definido para o programa."
                ),
                reasons=[
                    (
                        f"request_rate_per_minute={action.request_rate_per_minute} "
                        f"> max_requests_per_minute={policy.limits.max_requests_per_minute}"
                    )
                ],
            )

        if action.target_count > policy.limits.max_targets_per_execution:
            return ActionBlockResult(
                blocked=True,
                code="scope_guard.target_count_exceeded",
                message="A acao toca mais alvos do que o permitido pela politica do programa.",
                reasons=[
                    (
                        f"target_count={action.target_count} "
                        f"> max_targets_per_execution={policy.limits.max_targets_per_execution}"
                    )
                ],
            )

        return ActionBlockResult(
            blocked=False,
            code="scope_guard.action_allowed",
            message="A acao nao viola regras proibidas nem limites duros do programa.",
        )

    def validate_action(
        self,
        policy: ProgramPolicy,
        *,
        action: ProposedAction,
    ) -> ActionValidationResult:
        target_result = self.validate_target_in_scope(
            policy,
            identifier=action.target_identifier,
            target_type=action.target_type,
        )
        if not target_result.in_scope:
            return ActionValidationResult(
                allowed=False,
                blocked=True,
                requires_manual_approval=False,
                code=target_result.code,
                message=target_result.message,
                reasons=[target_result.message],
            )

        block_result = self.block_prohibited_action(policy, action=action)
        if block_result.blocked:
            return ActionValidationResult(
                allowed=False,
                blocked=True,
                requires_manual_approval=False,
                code=block_result.code,
                message=block_result.message,
                reasons=block_result.reasons,
            )

        approval_result = self.requires_manual_approval(policy, action=action)
        if approval_result.requires_manual_approval:
            return ActionValidationResult(
                allowed=True,
                blocked=False,
                requires_manual_approval=True,
                code=approval_result.code,
                message=approval_result.message,
                reasons=approval_result.reasons,
            )

        return ActionValidationResult(
            allowed=True,
            blocked=False,
            requires_manual_approval=False,
            code="scope_guard.allowed",
            message="Alvo e acao validados dentro da politica do programa.",
        )

    def _normalize_target(self, *, identifier: str, target_type: str) -> str | None:
        candidate = identifier.strip()
        if not candidate:
            return None

        if target_type.lower() in {"domain", "hostname", "url"}:
            parsed = urlparse(candidate if "://" in candidate else f"https://{candidate}")
            host = parsed.hostname or parsed.netloc or parsed.path
            normalized = host.strip().lower()
            return normalized or None

        return candidate.lower()

    def _match_first(self, host: str, patterns: list[str]) -> str | None:
        for pattern in patterns:
            if self._domain_matches(host, pattern):
                return pattern
        return None

    def _domain_matches(self, host: str, pattern: str) -> bool:
        normalized_pattern = pattern.strip().lower()
        if not normalized_pattern:
            return False
        if normalized_pattern.startswith("*."):
            suffix = normalized_pattern[2:]
            return host.endswith(f".{suffix}")
        return host == normalized_pattern

    def _matches_technique(self, action: ProposedAction, policy_terms: list[str]) -> bool:
        combined_text = f"{action.technique} {action.description}".lower()
        return any(term in combined_text for term in policy_terms)

