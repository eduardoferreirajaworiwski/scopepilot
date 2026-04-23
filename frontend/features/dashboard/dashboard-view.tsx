"use client";

import Link from "next/link";

import { DemoWalkthroughPanel } from "@/components/shared/demo-walkthrough-panel";
import { MetricCard } from "@/components/shared/metric-card";
import { PageHeader } from "@/components/shared/page-header";
import { ProvenancePanel } from "@/components/shared/provenance-panel";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/states";
import { WorkflowStageRail } from "@/components/shared/workflow-stage-rail";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime, formatRelativeCount } from "@/lib/format";
import { getApiErrorMessage } from "@/lib/api/client";
import {
  useApprovalsQuery,
  useAuditTrailQuery,
  useAllTargetsQuery,
  useExecutionsQuery,
  useFindingsQuery,
  useHypothesesQuery,
  useProgramsQuery,
  useQueueSnapshotQuery,
} from "@/lib/api/hooks";
import { cn } from "@/lib/utils";

export function DashboardView() {
  const programsQuery = useProgramsQuery();
  const targetsRegistry = useAllTargetsQuery(programsQuery.data ?? []);
  const hypothesesQuery = useHypothesesQuery();
  const approvalsQuery = useApprovalsQuery();
  const executionsQuery = useExecutionsQuery();
  const findingsQuery = useFindingsQuery();
  const auditQuery = useAuditTrailQuery();
  const queueQuery = useQueueSnapshotQuery();

  const criticalQuery = [
    programsQuery,
    hypothesesQuery,
    approvalsQuery,
    executionsQuery,
    findingsQuery,
    auditQuery,
    queueQuery,
    targetsRegistry,
  ].find((query) => query.isError);

  if (
    programsQuery.isPending ||
    targetsRegistry.isPending ||
    hypothesesQuery.isPending ||
    approvalsQuery.isPending ||
    executionsQuery.isPending ||
    findingsQuery.isPending ||
    auditQuery.isPending ||
    queueQuery.isPending
  ) {
    return (
      <LoadingState
        title="Loading operator dashboard"
        description="Fetching live program, approval, execution, and audit data."
      />
    );
  }

  if (criticalQuery?.error) {
    return (
      <ErrorState
        title="Dashboard data could not be loaded"
        description={getApiErrorMessage(criticalQuery.error)}
        onRetry={() => {
          void Promise.all([
            programsQuery.refetch(),
            targetsRegistry.refetch(),
            hypothesesQuery.refetch(),
            approvalsQuery.refetch(),
            executionsQuery.refetch(),
            findingsQuery.refetch(),
            auditQuery.refetch(),
            queueQuery.refetch(),
          ]);
        }}
      />
    );
  }

  const programs = programsQuery.data ?? [];
  const targets = targetsRegistry.data;
  const hypotheses = hypothesesQuery.data ?? [];
  const approvals = approvalsQuery.data ?? [];
  const executions = executionsQuery.data ?? [];
  const findings = findingsQuery.data ?? [];
  const auditTrail = auditQuery.data ?? [];
  const pendingApprovals = approvals.filter((approval) => approval.status === "pending");
  const approvedApprovals = approvals.filter((approval) => approval.status === "approved").length;
  const inScopeTargets = targets.filter((target) => target.in_scope).length;
  const runningExecutions = executions.filter((execution) => execution.status === "running").length;
  const completedExecutions = executions.filter((execution) => execution.status === "completed").length;
  const queuedExecutionIds = queueQuery.data?.queued_execution_ids ?? [];
  const workflowStages = [
    {
      label: "Program",
      href: "/programs",
      count: String(programs.length),
      status: programs.length > 0 ? "approved" : "draft",
      description: "Authorized scope policy is the first security boundary.",
    },
    {
      label: "Target",
      href: "/programs",
      count: `${inScopeTargets}/${targets.length}`,
      status: inScopeTargets > 0 ? "confirmed" : "draft",
      description: "Targets must pass Scope Guard before hypotheses.",
    },
    {
      label: "Hypothesis",
      href: "/hypotheses",
      count: String(hypotheses.length),
      status: hypotheses.length > 0 ? "info" : "draft",
      description: "AI proposals remain reviewable inference, not execution.",
    },
    {
      label: "Approval",
      href: "/approvals",
      count: `${pendingApprovals.length}/${approvedApprovals}`,
      status: pendingApprovals.length > 0 ? "pending" : approvedApprovals > 0 ? "approved" : "draft",
      description: "Human decisions are durable gates.",
    },
    {
      label: "Execution",
      href: "/executions",
      count: String(executions.length),
      status: runningExecutions > 0 ? "running" : queuedExecutionIds.length > 0 ? "queued" : "draft",
      description: "Requests, queue, dispatch, and completion stay separate.",
    },
    {
      label: "Evidence",
      href: "/findings",
      count: String(completedExecutions),
      status: completedExecutions > 0 ? "confirmed" : "draft",
      description: "Completed executions are the only evidence source.",
    },
    {
      label: "Finding",
      href: "/findings",
      count: String(findings.length),
      status: findings.length > 0 ? "reported" : "draft",
      description: "Findings are downstream of evidence provenance.",
    },
  ];
  const readinessChecks = [
    {
      label: "Program scope registered",
      ready: programs.some((program) => program.scope_policy.allowed_domains.length > 0),
    },
    {
      label: "At least one in-scope target",
      ready: inScopeTargets > 0,
    },
    {
      label: "AI hypothesis exists",
      ready: hypotheses.length > 0,
    },
    {
      label: "Human approval path visible",
      ready: approvals.length > 0,
    },
    {
      label: "Execution/evidence path visible",
      ready: executions.length > 0 || findings.length > 0,
    },
  ];
  const readyCount = readinessChecks.filter((check) => check.ready).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Human-in-the-loop security operations"
        description="ScopePilot surfaces AI hypotheses, human approvals, executions, evidence, and findings as separate operational states so the operator can review the path, not only the output."
        action={
          <div className="flex flex-wrap gap-3">
            <Link href="/programs" className={buttonVariants({ variant: "outline" })}>
              Review programs
            </Link>
            <Link href="/executions" className={buttonVariants({ variant: "secondary" })}>
              Open execution room
            </Link>
          </div>
        }
      />

      <DemoWalkthroughPanel />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Authorized programs"
          value={String(programs.length)}
          description="Programs with explicit scope policy currently registered in the backend."
          tone="accent"
        />
        <MetricCard
          label="AI hypotheses"
          value={String(hypotheses.length)}
          description={`${formatRelativeCount(
            hypotheses.filter((item) => item.status === "draft").length,
            "draft",
          )} still require operator movement.`}
          tone="info"
        />
        <MetricCard
          label="Pending approvals"
          value={String(pendingApprovals.length)}
          description="Human approval remains the gate for sensitive execution paths."
          tone={pendingApprovals.length > 0 ? "warning" : "success"}
        />
        <MetricCard
          label="Evidence-backed findings"
          value={String(findings.length)}
          description={`${completedExecutions} completed executions currently feed the reporting layer.`}
          tone="success"
        />
      </div>

      <WorkflowStageRail stages={workflowStages} />

      <ProvenancePanel />

      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader>
            <p className="eyebrow">Operating lanes</p>
            <CardTitle>What needs attention now</CardTitle>
            <CardDescription>
              These lanes keep the AI proposal queue, human decision queue, and execution state visible at the same time.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 lg:grid-cols-3">
            <div className="subpanel-strong p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-white">Approval queue</p>
                <StatusBadge status={pendingApprovals.length > 0 ? "pending" : "approved"} />
              </div>
              <p className="mt-3 text-3xl font-semibold text-white">{pendingApprovals.length}</p>
              <p className="mt-2 text-sm text-[var(--muted-foreground)]">
                Pending decisions by human reviewers before any execution can move forward.
              </p>
              <Link href="/approvals" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "mt-4")}>
                Open approval queue
              </Link>
            </div>
            <div className="subpanel p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-white">Execution queue</p>
                <StatusBadge status={queuedExecutionIds.length > 0 ? "executed" : "draft"} label="Visible" />
              </div>
              <p className="mt-3 text-3xl font-semibold text-white">{queuedExecutionIds.length}</p>
              <p className="mt-2 text-sm text-[var(--muted-foreground)]">
                Queued executions remain separate from approved hypotheses and from completed evidence records.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {queuedExecutionIds.length > 0 ? (
                  queuedExecutionIds.slice(0, 4).map((executionId) => (
                    <StatusBadge key={executionId} status="queued" label={`Execution ${executionId}`} />
                  ))
                ) : (
                  <StatusBadge status="draft" label="Queue empty" />
                )}
              </div>
            </div>
            <div className="subpanel p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-white">Execution activity</p>
                <StatusBadge status={runningExecutions > 0 ? "running" : "approved"} />
              </div>
              <p className="mt-3 text-3xl font-semibold text-white">{completedExecutions}</p>
              <p className="mt-2 text-sm text-[var(--muted-foreground)]">
                Completed executions are the only path that can produce raw evidence and downstream findings.
              </p>
              <div className="mt-4 text-xs uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
                {runningExecutions} running right now
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <p className="eyebrow">Demo readiness</p>
            <CardTitle>{readyCount}/5 control surfaces populated</CardTitle>
            <CardDescription>
              A credible demo should show scope, target validation, AI hypothesis, human decision, and execution evidence.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {readinessChecks.map((check) => (
              <div key={check.label} className="flex items-center justify-between gap-3 rounded-2xl bg-white/[0.035] px-4 py-3">
                <span className="text-sm text-[var(--foreground)]">{check.label}</span>
                <StatusBadge status={check.ready ? "confirmed" : "pending"} label={check.ready ? "Ready" : "Missing"} />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <p className="eyebrow">Recent hypotheses</p>
            <CardTitle>AI-generated proposals entering the workflow</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {hypotheses.length === 0 ? (
                <EmptyState
                  title="No hypotheses yet"
                  description="Create an in-scope target and register the first AI-assisted hypothesis to make the review lane visible."
                />
              ) : null}
              {hypotheses.slice(0, 4).map((hypothesis) => {
                const approval = approvals.find((item) => item.hypothesis_id === hypothesis.id);
                const execution = executions.find((item) => item.hypothesis_id === hypothesis.id);

                return (
                  <div key={hypothesis.id} className="subpanel p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status="draft" label="AI Hypothesis" />
                      <StatusBadge status={hypothesis.status} />
                      {approval ? <StatusBadge status={approval.status} label={`Approval ${approval.status}`} /> : null}
                      {execution ? (
                        <StatusBadge status={execution.status} label={`Execution ${execution.status}`} />
                      ) : null}
                    </div>
                    <div className="mt-3 text-base font-medium text-white">{hypothesis.title}</div>
                    <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">{hypothesis.description}</p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <p className="eyebrow">Recent findings</p>
            <CardTitle>Evidence-backed outcomes entering reporting</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {findings.slice(0, 4).map((finding) => (
              <div key={finding.id} className="subpanel p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status="confirmed" />
                  <StatusBadge status={finding.status} />
                </div>
                <div className="mt-3 text-base font-medium text-white">{finding.title}</div>
                <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">{finding.description}</p>
              </div>
            ))}
            {findings.length === 0 ? (
              <CardDescription>No findings yet. Completed executions with evidence will appear here.</CardDescription>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <p className="eyebrow">Audit trail</p>
          <CardTitle>Recent durable decisions</CardTitle>
        </CardHeader>
        <CardContent>
          {auditTrail.length === 0 ? (
            <EmptyState
              title="No audit records yet"
              description="Program creation, scope validation, approvals, execution gates, and finding creation will populate this trail."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Event</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Decision</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Timestamp</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {auditTrail.slice(0, 6).map((event) => (
                  <TableRow key={event.id}>
                    <TableCell>
                      <div className="font-medium text-white">{event.event_type}</div>
                      <div className="text-xs text-[var(--muted-foreground)]">
                        {event.entity_type} #{event.entity_id ?? "n/a"}
                      </div>
                    </TableCell>
                    <TableCell>{event.actor}</TableCell>
                    <TableCell>
                      <StatusBadge status={event.decision} />
                    </TableCell>
                    <TableCell className="max-w-md text-[var(--muted-foreground)]">{event.reason}</TableCell>
                    <TableCell className="text-[var(--muted-foreground)]">{formatDateTime(event.created_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <div className="mt-4">
            <Link href="/audit" className={buttonVariants({ variant: "ghost", size: "sm" })}>
              Open full audit trail
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
