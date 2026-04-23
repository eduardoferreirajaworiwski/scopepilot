#!/usr/bin/env python3
from __future__ import annotations

import argparse
import os
import sys
from datetime import UTC, datetime, timedelta


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Seed a professional demo dataset for the ScopePilot operator frontend.",
    )
    parser.add_argument(
        "--database-url",
        default="sqlite:///./scopepilot_demo.db",
        help="Database URL to seed. Defaults to a dedicated demo SQLite file.",
    )
    parser.add_argument(
        "--reset",
        action="store_true",
        help="Drop and recreate the target database before seeding the demo dataset.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    os.environ["DATABASE_URL"] = args.database_url

    from fastapi import HTTPException
    from sqlalchemy import select

    from app.api.routes import (
        approve_approval,
        complete_execution,
        create_hypothesis,
        create_program,
        create_target,
        dispatch_next_execution,
        reject_approval,
        request_execution,
        request_hypothesis_approval,
        run_recon,
    )
    from app.db.database import Base, SessionLocal, engine, init_db
    from app.db.models import (
        Approval,
        DecisionLog,
        Evidence,
        Execution,
        Finding,
        FlowSnapshot,
        Hypothesis,
        Program,
        ReconRecord,
        ReportDraft,
        Target,
    )
    from app.schemas.enums import FindingStatus, RequiredApprovalLevel
    from app.schemas.models import (
        ApprovalDecision,
        ApprovalRequest,
        EvidenceInput,
        ExecutionCompleteRequest,
        ExecutionRequest,
        FindingInput,
        HypothesisCreate,
        ProgramCreate,
        QueueDispatchRequest,
        ReconRunRequest,
        TargetCreate,
    )
    from app.schemas.scope_guard import ProgramPolicy, ProgramPolicyLimits
    from app.services.simple_queue import execution_queue

    if args.reset:
        execution_queue.clear()
        Base.metadata.drop_all(bind=engine)

    init_db()

    with SessionLocal() as db:
        if not args.reset and db.scalar(select(Program.id).limit(1)) is not None:
            print(
                "Database already contains data. Rerun with --reset or use a dedicated --database-url.",
                file=sys.stderr,
            )
            return 1

        execution_queue.clear()

        now = datetime.now(UTC)

        def expect_http_exception(
            *,
            label: str,
            status_code: int,
            callable_,
        ) -> None:
            try:
                callable_()
            except HTTPException as exc:
                if exc.status_code != status_code:
                    raise RuntimeError(
                        f"{label} returned status {exc.status_code}, expected {status_code}. Detail: {exc.detail}"
                    ) from exc
                return

            raise RuntimeError(f"{label} was expected to raise HTTPException {status_code}.")

        acme = create_program(
            ProgramCreate(
                name="Acme Cloud Public Bug Bounty",
                owner="Offensive Security Operations",
                description=(
                    "Primary external cloud surface with explicit scope controls, strict rate limits, "
                    "and manual approval for any meaningful verification."
                ),
                scope_policy=ProgramPolicy(
                    allowed_domains=["acmecloud.com", "*.acmecloud.com"],
                    denied_domains=["admin.acmecloud.com", "internal.acmecloud.com"],
                    forbidden_techniques=["credential_stuffing", "destructive_write", "mass_scan"],
                    limits=ProgramPolicyLimits(
                        max_requests_per_minute=20,
                        manual_approval_request_rate=5,
                        max_targets_per_execution=1,
                        manual_approval_techniques=[
                            "manual_verification",
                            "active_scan",
                            "auth_testing",
                            "content_discovery",
                            "payload_injection",
                        ],
                    ),
                    notes="Only bounded manual verification is allowed. Preserve tenant isolation and avoid state-changing actions.",
                ),
            ),
            db=db,
        )

        northstar = create_program(
            ProgramCreate(
                name="Northstar Payments Responsible Disclosure",
                owner="Application Security",
                description=(
                    "Customer-facing payments estate with conservative testing limits and explicit review gates for "
                    "pre-auth and session bootstrap paths."
                ),
                scope_policy=ProgramPolicy(
                    allowed_domains=["northstar-pay.com", "*.northstar-pay.com"],
                    denied_domains=["admin.northstar-pay.com"],
                    forbidden_techniques=["destructive_write", "social_engineering", "mass_scan"],
                    limits=ProgramPolicyLimits(
                        max_requests_per_minute=15,
                        manual_approval_request_rate=4,
                        max_targets_per_execution=1,
                        manual_approval_techniques=[
                            "manual_verification",
                            "auth_testing",
                            "content_discovery",
                        ],
                    ),
                    notes="No destructive actions. Preserve session integrity and customer payment state.",
                ),
            ),
            db=db,
        )

        api_target = create_target(
            TargetCreate(
                program_id=acme.id,
                identifier="api.acmecloud.com",
                target_type="web",
                created_by="Maya Patel",
            ),
            db=db,
        )
        status_target = create_target(
            TargetCreate(
                program_id=acme.id,
                identifier="status.acmecloud.com",
                target_type="web",
                created_by="Maya Patel",
            ),
            db=db,
        )
        blocked_acme_target = create_target(
            TargetCreate(
                program_id=acme.id,
                identifier="admin.acmecloud.com",
                target_type="web",
                created_by="Maya Patel",
            ),
            db=db,
        )
        portal_target = create_target(
            TargetCreate(
                program_id=northstar.id,
                identifier="portal.northstar-pay.com",
                target_type="web",
                created_by="Rafael Costa",
            ),
            db=db,
        )
        blocked_northstar_target = create_target(
            TargetCreate(
                program_id=northstar.id,
                identifier="admin.northstar-pay.com",
                target_type="web",
                created_by="Rafael Costa",
            ),
            db=db,
        )

        api_recon = run_recon(
            ReconRunRequest(target_id=api_target.id, analyst="Lina Chen"),
            db=db,
        )
        portal_recon = run_recon(
            ReconRunRequest(target_id=portal_target.id, analyst="Andre Costa"),
            db=db,
        )

        completed_hypothesis = create_hypothesis(
            HypothesisCreate(
                target_id=api_target.id,
                recon_record_id=api_recon.id,
                created_by="Maya Patel",
                severity="high",
                title="Unauthenticated export route reveals tenant metadata in a bounded validation path",
                description=(
                    "Passive recon and archived route references suggest a pre-auth export endpoint may disclose "
                    "tenant identifiers and environment metadata without changing target state. This remains a hypothesis "
                    "until bounded verification confirms the exposure."
                ),
            ),
            db=db,
        )

        rejected_hypothesis = create_hypothesis(
            HypothesisCreate(
                target_id=api_target.id,
                created_by="Zoe Kim",
                severity="medium",
                title="Archived debug route still appears reachable from passive references",
                description=(
                    "Public references to a debug path suggest a historical route may still be exposed. The signal is "
                    "weak and requires review before any validation request is sent."
                ),
            ),
            db=db,
        )

        queued_hypothesis = create_hypothesis(
            HypothesisCreate(
                target_id=status_target.id,
                created_by="Noah Kim",
                severity="medium",
                title="Status API may expose internal incident metadata to unauthenticated users",
                description=(
                    "A public status surface appears to reference incident payload fields that should likely remain "
                    "internal. A single read-only verification request would confirm whether the response leaks more than intended."
                ),
            ),
            db=db,
        )

        running_hypothesis = create_hypothesis(
            HypothesisCreate(
                target_id=portal_target.id,
                created_by="Rafael Costa",
                severity="low",
                title="Session bootstrap response may disclose stack version markers before authentication",
                description=(
                    "The pre-auth bootstrap flow appears to return environment identifiers and framework markers that "
                    "could expand the public attack surface. This is a bounded, low-risk verification candidate."
                ),
            ),
            db=db,
        )

        pending_hypothesis = create_hypothesis(
            HypothesisCreate(
                target_id=portal_target.id,
                recon_record_id=portal_recon.id,
                created_by="Rafael Costa",
                severity="high",
                title="Session bootstrap path may reveal environment segmentation data in pre-auth responses",
                description=(
                    "Passive recon indicates the bootstrap path references internal environment segmentation details. "
                    "A security lead should review a tightly bounded plan before any follow-up validation occurs."
                ),
            ),
            db=db,
        )

        completed_approval = request_hypothesis_approval(
            completed_hypothesis.id,
            ApprovalRequest(
                requested_by="Maya Patel",
                rationale="Single read-only validation against one tenant-safe route to confirm whether metadata is exposed pre-auth.",
                expires_at=now + timedelta(days=7),
            ),
            db=db,
        )
        expect_http_exception(
            label="self approval attempt",
            status_code=403,
            callable_=lambda: approve_approval(
                completed_approval.id,
                ApprovalDecision(
                    approver="Maya Patel",
                    approver_role=RequiredApprovalLevel.SECURITY_LEAD,
                    rationale="Attempting to approve own request should be blocked.",
                ),
                db=db,
            ),
        )
        approve_approval(
            completed_approval.id,
            ApprovalDecision(
                approver="Sofia Ribeiro",
                approver_role=RequiredApprovalLevel.SECURITY_LEAD,
                rationale="Approved for a single bounded verification request with explicit evidence capture.",
            ),
            db=db,
        )

        rejected_approval = request_hypothesis_approval(
            rejected_hypothesis.id,
            ApprovalRequest(
                requested_by="Zoe Kim",
                rationale="Review whether the archived route warrants bounded verification or should be deprioritized.",
                expires_at=now + timedelta(days=5),
            ),
            db=db,
        )
        reject_approval(
            rejected_approval.id,
            ApprovalDecision(
                approver="Noah Kim",
                approver_role=RequiredApprovalLevel.ANALYST,
                rationale="Rejected because the signal is too weak and can be revisited after stronger passive evidence appears.",
            ),
            db=db,
        )

        queued_approval = request_hypothesis_approval(
            queued_hypothesis.id,
            ApprovalRequest(
                requested_by="Noah Kim",
                rationale="Requesting a single read-only response capture to validate whether public incident data exceeds the intended disclosure boundary.",
                expires_at=now + timedelta(days=4),
            ),
            db=db,
        )
        approve_approval(
            queued_approval.id,
            ApprovalDecision(
                approver="Alicia Gomez",
                approver_role=RequiredApprovalLevel.ANALYST,
                rationale="Approved for a low-rate, read-only verification plan against one in-scope target.",
            ),
            db=db,
        )

        running_approval = request_hypothesis_approval(
            running_hypothesis.id,
            ApprovalRequest(
                requested_by="Rafael Costa",
                rationale="Need one bounded bootstrap capture to confirm whether stack identifiers are exposed before login.",
                expires_at=now + timedelta(days=3),
            ),
            db=db,
        )
        approve_approval(
            running_approval.id,
            ApprovalDecision(
                approver="Priya Nair",
                approver_role=RequiredApprovalLevel.ANALYST,
                rationale="Approved because the plan is read-only, single-target, and compatible with the program limits.",
            ),
            db=db,
        )

        pending_approval = request_hypothesis_approval(
            pending_hypothesis.id,
            ApprovalRequest(
                requested_by="Rafael Costa",
                rationale="Security lead review requested before validating a higher-confidence pre-auth segmentation signal.",
                expires_at=now + timedelta(days=2),
            ),
            db=db,
        )

        completed_execution = request_execution(
            ExecutionRequest(
                hypothesis_id=completed_hypothesis.id,
                requested_by="Omar Singh",
                action_plan=(
                    "Issue one read-only request to the suspected export route with a sanitized tenant context and "
                    "capture only headers and redacted response fragments."
                ),
                technique="manual_verification",
                request_rate_per_minute=1,
                target_count=1,
                state_changing=False,
                requires_authentication=False,
            ),
            db=db,
        )
        dispatch_next_execution(QueueDispatchRequest(operator="Leah Park"), db=db)
        complete_execution(
            completed_execution.id,
            ExecutionCompleteRequest(
                actor="Omar Singh",
                output_summary=(
                    "The bounded validation confirmed that the export route returned tenant identifiers and deployment "
                    "metadata in a pre-auth response. No state-changing action was performed."
                ),
                evidence=[
                    EvidenceInput(
                        evidence_type="http_capture",
                        content=(
                            "GET /exports/tenant-summary returned 200. Sanitized body excerpt: "
                            "{tenant_id: redacted, region: eu-west-1, build_channel: release, deployment_ring: canary}."
                        ),
                        artifact_uri="artifact://demo/http-capture/acme-export-route",
                    )
                ],
                finding=FindingInput(
                    title="Pre-auth export route exposes tenant metadata",
                    description=(
                        "A single bounded verification request confirmed that the export route returned tenant identifiers "
                        "and deployment metadata before authentication. The result is evidence-backed and traceable to a "
                        "reviewed execution plan."
                    ),
                    severity="high",
                    status=FindingStatus.REPORTED,
                ),
            ),
            db=db,
        )

        running_execution = request_execution(
            ExecutionRequest(
                hypothesis_id=running_hypothesis.id,
                requested_by="Priya Nair",
                action_plan=(
                    "Capture one pre-auth bootstrap response, store sanitized headers, and confirm whether stack markers "
                    "are externally exposed without progressing the session."
                ),
                technique="manual_verification",
                request_rate_per_minute=1,
                target_count=1,
                state_changing=False,
                requires_authentication=False,
            ),
            db=db,
        )
        dispatch_next_execution(QueueDispatchRequest(operator="Leah Park"), db=db)

        queued_execution = request_execution(
            ExecutionRequest(
                hypothesis_id=queued_hypothesis.id,
                requested_by="Evan Ross",
                action_plan=(
                    "Send one low-rate request to the public status API and compare the visible incident payload against "
                    "the intended public disclosure model."
                ),
                technique="manual_verification",
                request_rate_per_minute=1,
                target_count=1,
                state_changing=False,
                requires_authentication=False,
            ),
            db=db,
        )

        expect_http_exception(
            label="execution request for rejected hypothesis",
            status_code=400,
            callable_=lambda: request_execution(
                ExecutionRequest(
                    hypothesis_id=rejected_hypothesis.id,
                    requested_by="Evan Ross",
                    action_plan="Attempt a bounded read-only request even though the last human decision rejected the hypothesis.",
                    technique="manual_verification",
                    request_rate_per_minute=1,
                    target_count=1,
                    state_changing=False,
                    requires_authentication=False,
                ),
                db=db,
            ),
        )

        timeline = {
            Program: {
                acme.id: now - timedelta(days=6, hours=4),
                northstar.id: now - timedelta(days=4, hours=8),
            },
            Target: {
                api_target.id: now - timedelta(days=5, hours=22),
                status_target.id: now - timedelta(days=5, hours=20),
                blocked_acme_target.id: now - timedelta(days=5, hours=19),
                portal_target.id: now - timedelta(days=4, hours=4),
                blocked_northstar_target.id: now - timedelta(days=4, hours=3),
            },
            ReconRecord: {
                api_recon.id: now - timedelta(days=3, hours=22),
                portal_recon.id: now - timedelta(days=1, hours=8),
            },
            Hypothesis: {
                completed_hypothesis.id: now - timedelta(days=3, hours=20),
                rejected_hypothesis.id: now - timedelta(days=1, hours=10),
                queued_hypothesis.id: now - timedelta(hours=9),
                running_hypothesis.id: now - timedelta(hours=5),
                pending_hypothesis.id: now - timedelta(minutes=55),
            },
            Approval: {
                completed_approval.id: now - timedelta(days=3, hours=19, minutes=20),
                rejected_approval.id: now - timedelta(days=1, hours=9, minutes=30),
                queued_approval.id: now - timedelta(hours=8, minutes=30),
                running_approval.id: now - timedelta(hours=4, minutes=25),
                pending_approval.id: now - timedelta(minutes=35),
            },
            Execution: {
                completed_execution.id: now - timedelta(days=3, hours=18, minutes=45),
                queued_execution.id: now - timedelta(hours=7, minutes=50),
                running_execution.id: now - timedelta(hours=3, minutes=40),
            },
        }

        for model, mapping in timeline.items():
            for entity_id, timestamp in mapping.items():
                entity = db.get(model, entity_id)
                if entity is None:
                    continue
                entity.created_at = timestamp
                if isinstance(entity, Hypothesis):
                    entity.updated_at = timestamp + timedelta(minutes=12)
                if isinstance(entity, Approval):
                    if entity.status == "pending":
                        entity.expires_at = now + timedelta(days=2)
                    else:
                        entity.decided_at = timestamp + timedelta(minutes=20)
                        entity.expires_at = now + timedelta(days=5)
                if isinstance(entity, Execution):
                    if entity.id == completed_execution.id:
                        entity.started_at = timestamp + timedelta(minutes=5)
                        entity.completed_at = timestamp + timedelta(minutes=13)
                    elif entity.id == running_execution.id:
                        entity.started_at = timestamp + timedelta(minutes=15)
                    elif entity.id == queued_execution.id:
                        entity.started_at = None
                        entity.completed_at = None

        completed_finding = db.scalar(
            select(Finding).where(Finding.execution_id == completed_execution.id)
        )
        if completed_finding is None:
            raise RuntimeError("Expected completed execution to create a finding.")
        completed_finding.created_at = now - timedelta(days=3, hours=18, minutes=30)

        report_draft = db.scalar(
            select(ReportDraft).where(ReportDraft.finding_id == completed_finding.id)
        )
        if report_draft is not None:
            report_draft.created_at = now - timedelta(days=3, hours=18, minutes=27)
            report_draft.updated_at = now - timedelta(days=3, hours=18, minutes=26)

        audit_entries = list(db.scalars(select(DecisionLog).order_by(DecisionLog.id)))
        audit_base = now - timedelta(days=6)
        for index, entry in enumerate(audit_entries):
            entry.created_at = audit_base + timedelta(minutes=index * 11)

        snapshots = list(db.scalars(select(FlowSnapshot).order_by(FlowSnapshot.id)))
        snapshot_base = now - timedelta(days=6, minutes=5)
        for index, snapshot in enumerate(snapshots):
            snapshot.created_at = snapshot_base + timedelta(minutes=index * 7)

        evidence_records = list(db.scalars(select(Evidence).order_by(Evidence.id)))
        for index, record in enumerate(evidence_records):
            record.created_at = now - timedelta(days=3, hours=18, minutes=24 - index)

        db.commit()

        programs_count = len(list(db.scalars(select(Program))))
        targets_count = len(list(db.scalars(select(Target))))
        hypotheses_count = len(list(db.scalars(select(Hypothesis))))
        approvals_count = len(list(db.scalars(select(Approval))))
        executions_count = len(list(db.scalars(select(Execution))))
        findings_count = len(list(db.scalars(select(Finding))))
        audit_count = len(audit_entries)

    print("ScopePilot demo dataset ready.")
    print(f"Database URL: {args.database_url}")
    print(f"Programs: {programs_count}")
    print(f"Targets: {targets_count}")
    print(f"Hypotheses: {hypotheses_count}")
    print(f"Approvals: {approvals_count}")
    print(f"Executions: {executions_count}")
    print(f"Findings: {findings_count}")
    print(f"Audit events: {audit_count}")
    print("Suggested walkthrough: dashboard -> approvals -> executions -> findings -> audit")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
