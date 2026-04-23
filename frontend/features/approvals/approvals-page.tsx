"use client";

import { useState } from "react";

import { DefinitionList } from "@/components/shared/definition-list";
import { MetricCard } from "@/components/shared/metric-card";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { getApiErrorMessage } from "@/lib/api/client";
import {
  useAllTargetsQuery,
  useApproveApprovalMutation,
  useApprovalsQuery,
  useExecutionsQuery,
  useHypothesesQuery,
  usePendingApprovalsQuery,
  useProgramsQuery,
  useQueueSnapshotQuery,
  useRejectApprovalMutation,
} from "@/lib/api/hooks";
import { formatDateTime, formatRelativeCount, humanizeToken } from "@/lib/format";
import { findHypothesis, findProgram, findTarget, getLatestExecutionForHypothesis } from "@/lib/selectors";
import type { ApprovalRead } from "@/lib/types/api";

function DecisionForm({
  approval,
  onDecisionRecorded,
}: {
  approval: ApprovalRead;
  onDecisionRecorded: (decision: "approved" | "rejected", approvalId: number) => void;
}) {
  const [formState, setFormState] = useState({
    approver: "",
    approver_role: "analyst" as "analyst" | "security_lead",
    rationale: "",
  });
  const [lastDecision, setLastDecision] = useState<"approved" | "rejected" | null>(null);

  const approveMutation = useApproveApprovalMutation(approval.id);
  const rejectMutation = useRejectApprovalMutation(approval.id);
  const isMutating = approveMutation.isPending || rejectMutation.isPending;
  const isDecisionReady = formState.approver.trim().length > 0 && formState.rationale.trim().length > 0;

  const resetAfterDecision = (decision: "approved" | "rejected") => {
    setLastDecision(decision);
    onDecisionRecorded(decision, approval.id);
    setFormState({
      approver: "",
      approver_role: "analyst",
      rationale: "",
    });
  };

  return (
    <div className="decision-panel mt-4 p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-[var(--foreground-strong)]">Record human decision</div>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            Approval and rejection both require reviewer identity and rationale.
          </p>
        </div>
        <StatusBadge status="pending" label="Decision gate" />
      </div>
      <div className="grid gap-4 md:grid-cols-[0.8fr_0.8fr_1.2fr]">
        <div className="space-y-2">
          <Label htmlFor={`approver-${approval.id}`}>Approver</Label>
          <Input
            id={`approver-${approval.id}`}
            value={formState.approver}
            onChange={(event) => setFormState({ ...formState, approver: event.target.value })}
            placeholder="Security reviewer"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`approver-role-${approval.id}`}>Role</Label>
          <NativeSelect
            id={`approver-role-${approval.id}`}
            value={formState.approver_role}
            onChange={(event) =>
              setFormState({
                ...formState,
                approver_role: event.target.value as "analyst" | "security_lead",
              })
            }
          >
            <option value="analyst">Analyst</option>
            <option value="security_lead">Security Lead</option>
          </NativeSelect>
        </div>
        <div className="space-y-2">
          <Label htmlFor={`decision-reason-${approval.id}`}>Decision rationale</Label>
          <Textarea
            id={`decision-reason-${approval.id}`}
            value={formState.rationale}
            onChange={(event) => setFormState({ ...formState, rationale: event.target.value })}
            className="min-h-24"
            placeholder="Explain why this request is approved or rejected"
          />
        </div>
      </div>
      {approveMutation.error || rejectMutation.error ? (
        <p className="mt-3 text-sm text-rose-200">
          {getApiErrorMessage(approveMutation.error ?? rejectMutation.error)}
        </p>
      ) : null}
      {lastDecision ? (
        <p className="mt-3 text-sm text-emerald-200">
          Human decision recorded as {lastDecision}. Approval, hypothesis, audit, and evidence-store caches are refreshing.
        </p>
      ) : null}
      {!isDecisionReady ? (
        <p className="mt-3 text-sm text-[var(--muted-foreground)]">
          Reviewer identity and rationale are required before a decision can be submitted.
        </p>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-3">
        <Button
          size="sm"
          disabled={!isDecisionReady || isMutating}
          onClick={() => {
            approveMutation.mutate(formState, {
              onSuccess: () => resetAfterDecision("approved"),
            });
          }}
        >
          {approveMutation.isPending ? "Approving..." : "Approve"}
        </Button>
        <Button
          size="sm"
          variant="danger"
          disabled={!isDecisionReady || isMutating}
          onClick={() => {
            rejectMutation.mutate(formState, {
              onSuccess: () => resetAfterDecision("rejected"),
            });
          }}
        >
          {rejectMutation.isPending ? "Rejecting..." : "Reject"}
        </Button>
      </div>
    </div>
  );
}

export function ApprovalsPage() {
  const programsQuery = useProgramsQuery();
  const targetsRegistry = useAllTargetsQuery(programsQuery.data ?? []);
  const hypothesesQuery = useHypothesesQuery();
  const approvalsQuery = useApprovalsQuery();
  const pendingApprovalsQuery = usePendingApprovalsQuery();
  const executionsQuery = useExecutionsQuery();
  const queueQuery = useQueueSnapshotQuery();
  const [decisionFeedback, setDecisionFeedback] = useState<string | null>(null);

  if (
    programsQuery.isPending ||
    hypothesesQuery.isPending ||
    approvalsQuery.isPending ||
    pendingApprovalsQuery.isPending ||
    executionsQuery.isPending ||
    targetsRegistry.isPending ||
    queueQuery.isPending
  ) {
    return (
      <LoadingState
        title="Loading approval queue"
        description="Resolving pending human decisions and their related hypothesis context."
      />
    );
  }

  if (
    programsQuery.error ||
    hypothesesQuery.error ||
    approvalsQuery.error ||
    pendingApprovalsQuery.error ||
    executionsQuery.error ||
    targetsRegistry.error ||
    queueQuery.error
  ) {
    return (
      <ErrorState
        title="Approval queue could not be loaded"
        description={getApiErrorMessage(
          programsQuery.error ??
            hypothesesQuery.error ??
            approvalsQuery.error ??
            pendingApprovalsQuery.error ??
            executionsQuery.error ??
            targetsRegistry.error ??
            queueQuery.error,
        )}
        onRetry={() => {
          void Promise.all([
            programsQuery.refetch(),
            hypothesesQuery.refetch(),
            approvalsQuery.refetch(),
            pendingApprovalsQuery.refetch(),
            executionsQuery.refetch(),
            targetsRegistry.refetch(),
            queueQuery.refetch(),
          ]);
        }}
      />
    );
  }

  const programs = programsQuery.data ?? [];
  const targets = targetsRegistry.data;
  const hypotheses = hypothesesQuery.data ?? [];
  const pendingApprovals = pendingApprovalsQuery.data ?? [];
  const approvals = approvalsQuery.data ?? [];
  const executions = executionsQuery.data ?? [];
  const queuedExecutionIds = queueQuery.data?.queued_execution_ids ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Approval queue"
        description="This page is intentionally human-centered. It shows what the AI proposed, who requested review, what role is needed, and what decision the human reviewer made."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Pending approvals"
          value={String(pendingApprovals.length)}
          description="Requests currently blocked until a human decision is recorded."
          tone={pendingApprovals.length > 0 ? "warning" : "success"}
        />
        <MetricCard
          label="Approved decisions"
          value={String(approvals.filter((approval) => approval.status === "approved").length)}
          description="Human approvals already issued in the current dataset."
          tone="success"
        />
        <MetricCard
          label="Queued executions"
          value={String(queuedExecutionIds.length)}
          description="Executions are still visible separately from the approval state."
          tone="info"
        />
        <MetricCard
          label="Running executions"
          value={String(executions.filter((execution) => execution.status === "running").length)}
          description="Manual dispatch is required before execution moves into running state."
          tone="accent"
        />
      </div>

      {pendingApprovals.length === 0 ? (
        <EmptyState
          title="No pending approvals"
          description="When new approval requests are created from hypotheses, they will appear here with full AI and target context."
        />
      ) : null}

      {decisionFeedback ? (
        <Card className="border-emerald-400/35 bg-emerald-400/[0.06]">
          <CardContent className="pt-6 text-sm leading-6 text-emerald-100">{decisionFeedback}</CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4">
        {pendingApprovals.map((approval) => {
          const hypothesis = findHypothesis(hypotheses, approval.hypothesis_id);
          if (!hypothesis) {
            return null;
          }

          const program = findProgram(programs, hypothesis.program_id);
          const target = findTarget(targets, hypothesis.target_id);
          const execution = getLatestExecutionForHypothesis(executions, hypothesis.id);

          return (
            <Card key={approval.id}>
              <CardHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status="pending" label="Human decision required" />
                  <StatusBadge status="draft" label="AI Hypothesis" />
                  <StatusBadge status={hypothesis.status} />
                  <StatusBadge
                    status="warning"
                    label={`Required role: ${humanizeToken(hypothesis.required_approval_level)}`}
                  />
                  {execution ? <StatusBadge status={execution.status} label={`Execution ${execution.status}`} /> : null}
                </div>
                <CardTitle>{hypothesis.title}</CardTitle>
                <CardDescription>
                  {program?.name ?? `Program ${hypothesis.program_id}`} ·{" "}
                  {target?.identifier ?? `Target ${hypothesis.target_id}`}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
                  <div className="subpanel p-4">
                    <div className="text-xs uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
                      AI hypothesis / inference
                    </div>
                    <p className="mt-2 text-sm leading-7 text-white">{hypothesis.description}</p>
                  </div>
                  <div className="subpanel p-4">
                    <div className="text-xs uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
                      Approval request
                    </div>
                    <p className="mt-2 text-sm leading-7 text-[var(--muted-foreground)]">{approval.request_rationale}</p>
                    <div className="mt-3 text-xs uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
                      Requested by {approval.requested_by}
                    </div>
                  </div>
                </div>
                <DecisionForm
                  approval={approval}
                  onDecisionRecorded={(decision, approvalId) => {
                    setDecisionFeedback(
                      `Approval #${approvalId} recorded as ${decision}. The approval queue, hypothesis state, audit trail, and evidence-store snapshots are refreshing from the API.`,
                    );
                  }}
                />
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
        <Card>
          <CardHeader>
            <p className="eyebrow">Decision summary</p>
            <CardTitle>Human approval posture</CardTitle>
          </CardHeader>
          <CardContent>
            <DefinitionList
              items={[
                {
                  label: "Approved",
                  value: formatRelativeCount(
                    approvals.filter((approval) => approval.status === "approved").length,
                    "decision",
                  ),
                },
                {
                  label: "Rejected",
                  value: formatRelativeCount(
                    approvals.filter((approval) => approval.status === "rejected").length,
                    "decision",
                  ),
                },
                {
                  label: "Expired",
                  value: formatRelativeCount(
                    approvals.filter((approval) => approval.status === "expired").length,
                    "decision",
                  ),
                },
                {
                  label: "Queue ids",
                  value: queuedExecutionIds.join(", ") || "No queued executions",
                },
              ]}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <p className="eyebrow">Recent approval history</p>
            <CardTitle>Latest decisions</CardTitle>
          </CardHeader>
          <CardContent>
            {approvals.length === 0 ? (
              <EmptyState
                title="No approval records yet"
                description="Approval requests and human decisions will appear here once hypotheses are submitted for review."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Decision</TableHead>
                    <TableHead>Approver</TableHead>
                    <TableHead>Requested by</TableHead>
                    <TableHead>Decided</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {approvals.slice(0, 8).map((approval) => (
                    <TableRow key={approval.id}>
                      <TableCell>
                        <StatusBadge status={approval.status} />
                      </TableCell>
                      <TableCell>{approval.approver ?? "pending"}</TableCell>
                      <TableCell>{approval.requested_by}</TableCell>
                      <TableCell>{formatDateTime(approval.decided_at ?? approval.created_at)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
