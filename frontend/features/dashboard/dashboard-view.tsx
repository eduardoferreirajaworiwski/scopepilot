"use client";

import Link from "next/link";

import { DefinitionList } from "@/components/shared/definition-list";
import { MetricCard } from "@/components/shared/metric-card";
import { PageHeader } from "@/components/shared/page-header";
import { ProvenancePanel } from "@/components/shared/provenance-panel";
import { StatusBadge } from "@/components/shared/status-badge";
import { ErrorState, LoadingState } from "@/components/shared/states";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime, formatRelativeCount } from "@/lib/format";
import {
  useApprovalsQuery,
  useAuditTrailQuery,
  useExecutionsQuery,
  useFindingsQuery,
  useHypothesesQuery,
  useProgramsQuery,
  useQueueSnapshotQuery,
} from "@/lib/api/hooks";
import { cn } from "@/lib/utils";

export function DashboardView() {
  const programsQuery = useProgramsQuery();
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
  ].find((query) => query.isError);

  if (
    programsQuery.isPending ||
    hypothesesQuery.isPending ||
    approvalsQuery.isPending ||
    executionsQuery.isPending ||
    findingsQuery.isPending ||
    auditQuery.isPending
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
        description={criticalQuery.error instanceof Error ? criticalQuery.error.message : "Unexpected query failure."}
        onRetry={() => {
          void Promise.all([
            programsQuery.refetch(),
            hypothesesQuery.refetch(),
            approvalsQuery.refetch(),
            executionsQuery.refetch(),
            findingsQuery.refetch(),
            auditQuery.refetch(),
          ]);
        }}
      />
    );
  }

  const programs = programsQuery.data ?? [];
  const hypotheses = hypothesesQuery.data ?? [];
  const approvals = approvalsQuery.data ?? [];
  const executions = executionsQuery.data ?? [];
  const findings = findingsQuery.data ?? [];
  const auditTrail = auditQuery.data ?? [];
  const pendingApprovals = approvals.filter((approval) => approval.status === "pending");
  const runningExecutions = executions.filter((execution) => execution.status === "running").length;
  const completedExecutions = executions.filter((execution) => execution.status === "completed").length;
  const queuedExecutionIds = queueQuery.data?.queued_execution_ids ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Human-in-the-loop security operations"
        description="ScopePilot surfaces AI hypotheses, human approvals, executions, evidence, and findings as separate operational states so the operator can review the path, not only the output."
        action={
          <Link href="/programs" className={buttonVariants({ variant: "outline" })}>
            Review programs
          </Link>
        }
      />

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
            <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
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
            <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
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
            <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
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
            <p className="eyebrow">Operational facts</p>
            <CardTitle>Current dataset footprint</CardTitle>
          </CardHeader>
          <CardContent>
            <DefinitionList
              items={[
                {
                  label: "Programs",
                  value: formatRelativeCount(programs.length, "program"),
                },
                {
                  label: "Approvals",
                  value: formatRelativeCount(approvals.length, "decision"),
                },
                {
                  label: "Executions",
                  value: formatRelativeCount(executions.length, "execution"),
                },
                {
                  label: "Audit logs",
                  value: formatRelativeCount(auditTrail.length, "event"),
                },
              ]}
            />
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
              {hypotheses.slice(0, 4).map((hypothesis) => {
                const approval = approvals.find((item) => item.hypothesis_id === hypothesis.id);
                const execution = executions.find((item) => item.hypothesis_id === hypothesis.id);

                return (
                  <div key={hypothesis.id} className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
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
              <div key={finding.id} className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
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

