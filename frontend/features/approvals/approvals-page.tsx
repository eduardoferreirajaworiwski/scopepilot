"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { DefinitionList } from "@/components/shared/definition-list";
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
import { api, getApiErrorMessage } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import {
  useAllTargetsQuery,
  useApprovalsQuery,
  useExecutionsQuery,
  useHypothesesQuery,
  usePendingApprovalsQuery,
  useProgramsQuery,
  useQueueSnapshotQuery,
} from "@/lib/api/hooks";
import { formatDateTime, formatRelativeCount, humanizeToken } from "@/lib/format";
import { findHypothesis, findProgram, findTarget, getLatestExecutionForHypothesis } from "@/lib/selectors";
import type { ApprovalRead } from "@/lib/types/api";

function DecisionForm({ approval }: { approval: ApprovalRead }) {
  const queryClient = useQueryClient();
  const [formState, setFormState] = useState({
    approver: "",
    approver_role: "analyst" as "analyst" | "security_lead",
    rationale: "",
  });

  const approveMutation = useMutation({
    mutationFn: () => api.approveApproval(approval.id, formState),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.approvals }),
        queryClient.invalidateQueries({ queryKey: queryKeys.pendingApprovals }),
        queryClient.invalidateQueries({ queryKey: queryKeys.hypotheses }),
        queryClient.invalidateQueries({ queryKey: queryKeys.audit }),
      ]);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: () => api.rejectApproval(approval.id, formState),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.approvals }),
        queryClient.invalidateQueries({ queryKey: queryKeys.pendingApprovals }),
        queryClient.invalidateQueries({ queryKey: queryKeys.hypotheses }),
        queryClient.invalidateQueries({ queryKey: queryKeys.audit }),
      ]);
    },
  });

  return (
    <div className="mt-4 rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
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
      <div className="mt-4 flex flex-wrap gap-3">
        <Button
          size="sm"
          disabled={approveMutation.isPending || rejectMutation.isPending}
          onClick={() => approveMutation.mutate()}
        >
          {approveMutation.isPending ? "Approving..." : "Approve"}
        </Button>
        <Button
          size="sm"
          variant="danger"
          disabled={approveMutation.isPending || rejectMutation.isPending}
          onClick={() => rejectMutation.mutate()}
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
        <Card>
          <CardHeader>
            <p className="eyebrow">Pending approvals</p>
            <CardTitle>{pendingApprovals.length}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-[var(--muted-foreground)]">
            Requests currently blocked until a human decision is recorded.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <p className="eyebrow">Approved decisions</p>
            <CardTitle>{approvals.filter((approval) => approval.status === "approved").length}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-[var(--muted-foreground)]">
            Human approvals already issued in the current dataset.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <p className="eyebrow">Queued executions</p>
            <CardTitle>{queuedExecutionIds.length}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-[var(--muted-foreground)]">
            Executions are still visible separately from the approval state.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <p className="eyebrow">Running executions</p>
            <CardTitle>{executions.filter((execution) => execution.status === "running").length}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-[var(--muted-foreground)]">
            Manual dispatch is required before execution moves into running state.
          </CardContent>
        </Card>
      </div>

      {pendingApprovals.length === 0 ? (
        <EmptyState
          title="No pending approvals"
          description="When new approval requests are created from hypotheses, they will appear here with full AI and target context."
        />
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
                  <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
                    <div className="text-xs uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
                      AI hypothesis / inference
                    </div>
                    <p className="mt-2 text-sm leading-7 text-white">{hypothesis.description}</p>
                  </div>
                  <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
                    <div className="text-xs uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
                      Approval request
                    </div>
                    <p className="mt-2 text-sm leading-7 text-[var(--muted-foreground)]">{approval.request_rationale}</p>
                    <div className="mt-3 text-xs uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
                      Requested by {approval.requested_by}
                    </div>
                  </div>
                </div>
                <DecisionForm approval={approval} />
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

