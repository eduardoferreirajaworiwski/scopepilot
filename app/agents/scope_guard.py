from urllib.parse import urlparse

from app.schemas.models import ScopePolicy


class ScopeGuardAgent:
    _DEFAULT_FORBIDDEN_ACTION_TERMS = (
        "ddos",
        "dos",
        "flood",
        "bruteforce",
        "delete",
        "drop table",
        "overwrite",
        "exfiltrate",
        "malware",
        "ransom",
    )

    def validate_target(self, scope_policy: ScopePolicy, identifier: str, target_type: str) -> tuple[bool, str]:
        value = identifier.lower().strip()
        forbidden_terms = [term.lower() for term in scope_policy.forbidden_keywords]

        for keyword in forbidden_terms:
            if keyword and keyword in value:
                return False, f"Target bloqueado por política: keyword proibida '{keyword}'."

        allowed_domains = [domain.lower().strip() for domain in scope_policy.allowed_domains if domain.strip()]
        if target_type.lower() in {"domain", "url", "hostname"} and allowed_domains:
            host = self._extract_host(identifier)
            if not host:
                return False, "Não foi possível extrair host para validação de escopo."
            if not any(self._domain_matches(host, pattern) for pattern in allowed_domains):
                return False, "Host fora do escopo permitido do programa."

        return True, "Target validado como in-scope."

    def validate_action_plan(self, action_plan: str) -> tuple[bool, str]:
        lower_plan = action_plan.lower()
        for term in self._DEFAULT_FORBIDDEN_ACTION_TERMS:
            if term in lower_plan:
                return False, f"Plano bloqueado: termo de risco detectado '{term}'."
        return True, "Plano aprovado no filtro de segurança do Scope Guard."

    def _extract_host(self, identifier: str) -> str:
        candidate = identifier.strip()
        parsed = urlparse(candidate if "://" in candidate else f"https://{candidate}")
        host = parsed.netloc or parsed.path
        return host.split("/")[0].lower()

    def _domain_matches(self, host: str, pattern: str) -> bool:
        if pattern.startswith("*."):
            suffix = pattern[2:]
            return host == suffix or host.endswith(f".{suffix}")
        return host == pattern

