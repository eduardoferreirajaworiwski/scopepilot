import unittest

from app.schemas.scope_guard import ProgramPolicy, ProgramPolicyLimits, ProposedAction
from app.services.scope_guard import ScopeGuardService


class ScopeGuardServiceTests(unittest.TestCase):
    def setUp(self) -> None:
        self.service = ScopeGuardService()
        self.policy = ProgramPolicy(
            allowed_domains=["example.com", "*.example.com"],
            denied_domains=["admin.example.com"],
            forbidden_techniques=["sqlmap", "destructive"],
            limits=ProgramPolicyLimits(
                max_requests_per_minute=20,
                manual_approval_request_rate=5,
                max_targets_per_execution=1,
                manual_approval_techniques=["manual_verification", "authenticated_testing"],
            ),
        )

    def test_allowlist_accepts_exact_match(self) -> None:
        result = self.service.validate_target_in_scope(
            self.policy,
            identifier="example.com",
            target_type="domain",
        )

        self.assertTrue(result.in_scope)
        self.assertEqual(result.code, "scope_guard.in_scope")
        self.assertEqual(result.matched_rule, "example.com")

    def test_denylist_overrides_allowlist(self) -> None:
        result = self.service.validate_target_in_scope(
            self.policy,
            identifier="admin.example.com",
            target_type="domain",
        )

        self.assertFalse(result.in_scope)
        self.assertEqual(result.code, "scope_guard.denied_domain")
        self.assertEqual(result.matched_rule, "admin.example.com")

    def test_wildcard_allows_subdomain(self) -> None:
        result = self.service.validate_target_in_scope(
            self.policy,
            identifier="api.example.com",
            target_type="domain",
        )

        self.assertTrue(result.in_scope)
        self.assertEqual(result.matched_rule, "*.example.com")

    def test_forbidden_technique_is_blocked(self) -> None:
        action = ProposedAction(
            target_identifier="api.example.com",
            technique="sqlmap",
            description="Attempt sqlmap validation against one target.",
        )

        result = self.service.block_prohibited_action(self.policy, action=action)

        self.assertTrue(result.blocked)
        self.assertEqual(result.code, "scope_guard.forbidden_technique")

    def test_sensitive_action_requires_manual_approval(self) -> None:
        action = ProposedAction(
            target_identifier="api.example.com",
            technique="manual_verification",
            description="Bounded authenticated verification",
            request_rate_per_minute=6,
            requires_authentication=True,
        )

        result = self.service.requires_manual_approval(self.policy, action=action)

        self.assertTrue(result.requires_manual_approval)
        self.assertEqual(result.code, "scope_guard.manual_approval_required")
        self.assertGreaterEqual(len(result.reasons), 2)


if __name__ == "__main__":
    unittest.main()
