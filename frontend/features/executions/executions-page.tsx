"use client";

import Link from "next/link";
import { useState } from "react";

import { DefinitionList } from "@/components/shared/definition-list";
import { MetricCard } from "@/components/shared/metric-card";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/states";
import { WorkflowStageRail } from "@/components/shared/workflow-stage-rail";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { getApiErrorMessage } from "@/lib/api/client";
import {
  useAllTargetsQuery,
  useApprovalsQuery,
  useAuditTrailQuery,
  useCompleteExecutionMutation,
  useDispatchNextExecutionMutation,
  useExecutionsQuery,
  useFindingsQuery,
  useHypothesesQuery,
  useProgramsQuery,
  useQueueSnapshotQuery,
  useRequestExecutionMutation,
} from "@/lib/api/hooks";
import { formatDateTime, humanizeToken } from "@/lib/format";
import { findHypothesis, findProgram, findTarget, getLatestApprovalForHypothesis, getLatestExecutionForHypothesis } from "@/lib/selectors";
import type { ExecutionRead, FindingStatus, HypothesisRead, ProgramRead, TargetRead } from "@/lib/types/api";

function executionContext(
  execution: ExecutionRead,
  hypotheses: HypothesisRead[],
  programs: ProgramRead[],
  targets: TargetRead[],
) {
  const hypothesis = findHypothesis(hypotheses, execution.hypothesis_id);
  const program = hypothesis ? findProgram(programs, hypothesis.program_id) : null;
  const target = hypothesis ? findTarget(targets, hypothesis.target_id) : null;

  return {
    hypothesis,
    program,
    target,
  };
}

export function ExecutionsPage() {
  const programsQuery = useProgramsQuery();
  const targetsRegistry = useAllTargetsQuery(programsQuery.data ?? []);
  const hypothesesQuery = useHypothesesQuery();
  const approvalsQuery = useApprovalsQuery();
  const auditQuery = useAuditTrailQuery();
  const executionsQuery = useExecutionsQuery();
  const queueQuery = useQueueSnapshotQuery();
  const findingsQuery = useFindingsQuery();

  const [requestForm, setRequestForm] = useState({
    hypothesis_id: "",
    requested_by: "",
    action_plan: "",
    technique: "manual_verification",
    request_rate_per_minute: "1",
    target_count: "1",
    state_changing: false,
    requires_authentication: false,
  });
  const [dispatchOperator, setDispatchOperator] = useState("");
  const [completionForm, setCompletionForm] = useState({
    execution_id: "",
    actor: "",
    output_summary: "",
    evidence_type: "note",
    evidence_content: "",
    artifact_uri: "",
    finding_title: "",
    finding_description: "",
    finding_severity: "medium",
    finding_status: "new" as FindingStatus,
  });

  const requestExecutionMutation = useRequestExecutionMutation();
  const dispatchMutation = useDispatchNextExecutionMutation();
  const completeExecutionMutation = useCompleteExecutionMutation(Number(completionForm.execution_id));

  if (
    programsQuery.isPending ||
    targetsRegistry.isPending ||
    hypothesesQuery.isPending ||
    approvalsQuery.isPending ||
    auditQuery.isPending ||
    executionsQuery.isPending ||
    queueQuery.isPending ||
    findingsQuery.isPending
  ) {
    return (
      <LoadingState
        title="Loading execution controls"
        description="Resolving approved hypotheses, manual queue state, running executions, and findings."
      />
    );
  }

  const pageError =
    programsQuery.error ??
    targetsRegistry.error ??
    hypothesesQuery.error ??
    approvalsQuery.error ??
    auditQuery.error ??
    executionsQuery.error ??
    queueQuery.error ??
    findingsQuery.error;

  if (pageError) {
    return (
      <ErrorState
        title="Execution workspace could not be loaded"
        description={getApiErrorMessage(pageError)}
        onRetry={() => {
          void Promise.all([
            programsQuery.refetch(),
            targetsRegistry.refetch(),
            hypothesesQuery.refetch(),
            approvalsQuery.refetch(),
            auditQuery.refetch(),
            executionsQuery.refetch(),
            queueQuery.refetch(),
            findingsQuery.refetch(),
          ]);
        }}
      />
    );
  }

  const programs = programsQuery.data ?? [];
  const targets = targetsRegistry.data;
  const hypotheses = hypothesesQuery.data ?? [];
  const approvals = approvalsQuery.data ?? [];
  const auditTrail = auditQuery.data ?? [];
  const executions = executionsQuery.data ?? [];
  const findings = findingsQuery.data ?? [];
  const queuedExecutionIds = queueQuery.data?.queued_execution_ids ?? [];
  const queuedExecutions = executions.filter((execution) => execution.status === "queued");
  const runningExecutions = executions.filter((execution) => execution.status === "running");
  const completedExecutions = executions.filter((execution) => execution.status === "completed");
  const blockedExecutionRequests = auditTrail.filter(
    (event) => event.entity_type === "execution" && event.decision === "blocked",
  ).length;
  const approvedHypotheses = hypotheses.filter(
    (hypothesis) => getLatestApprovalForHypothesis(approvals, hypothesis.id)?.status === "approved",
  );
  const requestableHypotheses = approvedHypotheses.filter((hypothesis) => {
    const execution = getLatestExecutionForHypothesis(executions, hypothesis.id);
    return !execution || execution.status === "blocked";
  });
  const selectedCompletionExecution = runningExecutions.find(
    (execution) => execution.id === Number(completionForm.execution_id),
  );
  const findingOverrideStarted =
    completionForm.finding_title.trim().length > 0 || completionForm.finding_description.trim().length > 0;
  const findingOverrideReady =
    !findingOverrideStarted ||
    (completionForm.finding_title.trim().length >= 3 && completionForm.finding_description.trim().length >= 5);
  const requestReady =
    Number(requestForm.hypothesis_id) > 0 &&
    requestForm.requested_by.trim().length >= 2 &&
    requestForm.action_plan.trim().length >= 8;
  const completionReady =
    Number(completionForm.execution_id) > 0 &&
    completionForm.actor.trim().length >= 2 &&
    completionForm.output_summary.trim().length >= 5 &&
    completionForm.evidence_content.trim().length >= 2 &&
    findingOverrideReady;
  const workflowStages = [
    {
      label: "Hypothesis",
      href: "/hypotheses",
      count: String(hypotheses.length),
      status: hypotheses.length > 0 ? "info" : "draft",
      description: "The AI proposal remains the source object.",
    },
    {
      label: "Approval",
      href: "/approvals",
      count: String(approvedHypotheses.length),
      status: approvedHypotheses.length > 0 ? "approved" : "pending",
      description: "A valid human decision is required before request.",
    },
    {
      label: "Request",
      count: String(queuedExecutions.length),
      status: queuedExecutions.length > 0 ? "queued" : "draft",
      description: "Execution request only queues after backend gates pass.",
    },
    {
      label: "Dispatch",
      count: String(runningExecutions.length),
      status: runningExecutions.length > 0 ? "running" : "draft",
      description: "Manual queue dispatch moves work to running.",
    },
    {
      label: "Evidence",
      count: String(completedExecutions.length),
      status: completedExecutions.length > 0 ? "confirmed" : "draft",
      description: "Completion requires evidence before a finding exists.",
    },
    {
      label: "Finding",
      href: "/findings",
      count: String(findings.length),
      status: findings.length > 0 ? "reported" : "draft",
      description: "Findings stay downstream of evidence provenance.",
    },
    {
      label: "Audit",
      href: "/audit",
      count: String(executions.length + findings.length),
      status: executions.length > 0 ? "confirmed" : "draft",
      description: "Requests, blocks, dispatches, and findings are logged.",
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Execution control room"
        description="Execution is deliberately split into request, queue, manual dispatch, completion with evidence, and finding creation. The frontend never treats approval as automatic execution."
        action={
          <div className="flex flex-wrap gap-3">
            <Link href="/findings" className={buttonVariants({ variant: "outline" })}>
              Open findings
            </Link>
            <Link href="/audit" className={buttonVariants({ variant: "secondary" })}>
              Open audit trail
            </Link>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Queued"
          value={String(queuedExecutions.length)}
          description={`${queuedExecutionIds.length} ids are currently in the in-memory dispatch queue.`}
          tone={queuedExecutions.length > 0 ? "warning" : "neutral"}
        />
        <MetricCard
          label="Running"
          value={String(runningExecutions.length)}
          description="Running executions can be completed only by recording output and evidence."
          tone="info"
        />
        <MetricCard
          label="Completed"
          value={String(completedExecutions.length)}
          description="Completed executions are the only source for findings and report drafts."
          tone="success"
        />
        <MetricCard
          label="Blocked requests"
          value={String(blockedExecutionRequests)}
          description="Blocked execution attempts are counted from the audit trail because the backend fails closed before creating work."
          tone={blockedExecutionRequests > 0 ? "danger" : "neutral"}
        />
      </div>

      <WorkflowStageRail
        title="Execution is a gated state machine"
        description="This page makes the sensitive lane explicit: approved hypotheses can request execution, queued work must be dispatched manually, and completion requires evidence."
        stages={workflowStages}
      />

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardHeader>
            <p className="eyebrow">Request execution</p>
            <CardTitle>Queue an approved hypothesis</CardTitle>
            <CardDescription>
              The API revalidates target scope, forbidden techniques, approval freshness, approver role, and requester
              separation before an execution can enter the queue.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {requestableHypotheses.length === 0 ? (
              <EmptyState
                title="No approved hypotheses are ready for execution"
                description="Approve a hypothesis first, or review existing queued/running/completed executions before creating another request."
              />
            ) : (
              <form
                className="space-y-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  requestExecutionMutation.mutate(
                    {
                      hypothesis_id: Number(requestForm.hypothesis_id),
                      requested_by: requestForm.requested_by,
                      action_plan: requestForm.action_plan,
                      technique: requestForm.technique,
                      request_rate_per_minute: Number(requestForm.request_rate_per_minute),
                      target_count: Number(requestForm.target_count),
                      state_changing: requestForm.state_changing,
                      requires_authentication: requestForm.requires_authentication,
                    },
                    {
                      onSuccess: () => {
                        setRequestForm({
                          hypothesis_id: "",
                          requested_by: requestForm.requested_by,
                          action_plan: "",
                          technique: "manual_verification",
                          request_rate_per_minute: "1",
                          target_count: "1",
                          state_changing: false,
                          requires_authentication: false,
                        });
                      },
                    },
                  );
                }}
              >
                <div className="space-y-2">
                  <Label htmlFor="execution-hypothesis">Approved hypothesis</Label>
                  <NativeSelect
                    id="execution-hypothesis"
                    value={requestForm.hypothesis_id}
                    onChange={(event) => setRequestForm({ ...requestForm, hypothesis_id: event.target.value })}
                    required
                  >
                    <option value="">Select an approved hypothesis</option>
                    {requestableHypotheses.map((hypothesis) => {
                      const target = findTarget(targets, hypothesis.target_id);
                      const program = findProgram(programs, hypothesis.program_id);

                      return (
                        <option key={hypothesis.id} value={hypothesis.id}>
                          {program?.name ?? `Program ${hypothesis.program_id}`} ·{" "}
                          {target?.identifier ?? `Target ${hypothesis.target_id}`} · {hypothesis.title}
                        </option>
                      );
                    })}
                  </NativeSelect>
                </div>
                <div className="grid gap-4 md:grid-cols-[0.9fr_1.1fr]">
                  <div className="space-y-2">
                    <Label htmlFor="execution-requested-by">Requested by</Label>
                    <Input
                      id="execution-requested-by"
                      value={requestForm.requested_by}
                      onChange={(event) => setRequestForm({ ...requestForm, requested_by: event.target.value })}
                      placeholder="Operator"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="execution-technique">Technique</Label>
                    <NativeSelect
                      id="execution-technique"
                      value={requestForm.technique}
                      onChange={(event) => setRequestForm({ ...requestForm, technique: event.target.value })}
                    >
                      <option value="manual_verification">Manual verification</option>
                      <option value="passive_recheck">Passive recheck</option>
                      <option value="config_review">Configuration review</option>
                      <option value="rate_limited_probe">Rate-limited probe</option>
                    </NativeSelect>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="execution-action-plan">Action plan</Label>
                  <Textarea
                    id="execution-action-plan"
                    value={requestForm.action_plan}
                    onChange={(event) => setRequestForm({ ...requestForm, action_plan: event.target.value })}
                    placeholder="Bounded manual verification steps. Include what will be touched and what will not be touched."
                    required
                  />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="execution-rate">Requests per minute</Label>
                    <Input
                      id="execution-rate"
                      type="number"
                      min={1}
                      value={requestForm.request_rate_per_minute}
                      onChange={(event) =>
                        setRequestForm({ ...requestForm, request_rate_per_minute: event.target.value })
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="execution-target-count">Targets touched</Label>
                    <Input
                      id="execution-target-count"
                      type="number"
                      min={1}
                      value={requestForm.target_count}
                      onChange={(event) => setRequestForm({ ...requestForm, target_count: event.target.value })}
                      required
                    />
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="flex items-center gap-3 rounded-2xl border border-[var(--border-subtle)] bg-white/[0.035] px-4 py-3 text-sm font-medium normal-case tracking-normal text-[var(--foreground)]">
                    <input
                      type="checkbox"
                      checked={requestForm.state_changing}
                      onChange={(event) => setRequestForm({ ...requestForm, state_changing: event.target.checked })}
                    />
                    State-changing action
                  </label>
                  <label className="flex items-center gap-3 rounded-2xl border border-[var(--border-subtle)] bg-white/[0.035] px-4 py-3 text-sm font-medium normal-case tracking-normal text-[var(--foreground)]">
                    <input
                      type="checkbox"
                      checked={requestForm.requires_authentication}
                      onChange={(event) =>
                        setRequestForm({ ...requestForm, requires_authentication: event.target.checked })
                      }
                    />
                    Requires authentication
                  </label>
                </div>
                {requestExecutionMutation.error ? (
                  <p className="text-sm text-rose-200">{getApiErrorMessage(requestExecutionMutation.error)}</p>
                ) : null}
                {requestExecutionMutation.isSuccess ? (
                  <p className="text-sm text-emerald-200">
                    Execution request passed backend gates and entered the manual queue.
                  </p>
                ) : null}
                <Button type="submit" disabled={!requestReady || requestExecutionMutation.isPending}>
                  {requestExecutionMutation.isPending ? "Queueing..." : "Request execution"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <p className="eyebrow">Execution guardrails</p>
            <CardTitle>Why this does not feel autonomous</CardTitle>
            <CardDescription>
              Sensitive transitions are exposed as operator actions instead of hidden helper behavior.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DefinitionList
              items={[
                {
                  label: "Scope",
                  value: "Target is revalidated during execution request.",
                },
                {
                  label: "Approval",
                  value: "Latest human decision is checked again before queueing.",
                },
                {
                  label: "Dispatch",
                  value: "Queue movement requires explicit operator identity.",
                },
                {
                  label: "Completion",
                  value: "Running state and at least one evidence item are required.",
                },
              ]}
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.75fr_1.25fr]">
        <Card>
          <CardHeader>
            <p className="eyebrow">Manual dispatch</p>
            <CardTitle>Move the next queued execution to running</CardTitle>
            <CardDescription>
              This calls the queue endpoint. It does not choose targets or create evidence automatically.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                dispatchMutation.mutate(
                  { operator: dispatchOperator },
                  {
                    onSuccess: () => setDispatchOperator(""),
                  },
                );
              }}
            >
              <div className="flex flex-wrap gap-2">
                {queuedExecutionIds.length > 0 ? (
                  queuedExecutionIds.map((executionId) => (
                    <StatusBadge key={executionId} status="queued" label={`Execution ${executionId}`} />
                  ))
                ) : (
                  <StatusBadge status="draft" label="Queue empty" />
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="dispatch-operator">Dispatch operator</Label>
                <Input
                  id="dispatch-operator"
                  value={dispatchOperator}
                  onChange={(event) => setDispatchOperator(event.target.value)}
                  placeholder="Operator"
                  required
                />
              </div>
              {dispatchMutation.error ? (
                <p className="text-sm text-rose-200">{getApiErrorMessage(dispatchMutation.error)}</p>
              ) : null}
              {dispatchMutation.isSuccess ? <p className="text-sm text-emerald-200">Execution dispatched.</p> : null}
              <Button
                type="submit"
                disabled={queuedExecutionIds.length === 0 || dispatchOperator.trim().length < 2 || dispatchMutation.isPending}
              >
                {dispatchMutation.isPending ? "Dispatching..." : "Dispatch next"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <p className="eyebrow">Completion and evidence</p>
            <CardTitle>Close running execution with factual output</CardTitle>
            <CardDescription>
              Completion creates evidence and a downstream finding/report draft. The narrative remains separate from raw
              evidence in the evidence store.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {runningExecutions.length === 0 ? (
              <EmptyState
                title="No running executions"
                description="Dispatch a queued execution before recording output, evidence, and a finding."
              />
            ) : (
              <form
                className="space-y-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  completeExecutionMutation.mutate(
                    {
                      actor: completionForm.actor,
                      output_summary: completionForm.output_summary,
                      evidence: [
                        {
                          evidence_type: completionForm.evidence_type,
                          content: completionForm.evidence_content,
                          artifact_uri: completionForm.artifact_uri.trim() || null,
                        },
                      ],
                      finding: findingOverrideStarted
                        ? {
                            title: completionForm.finding_title,
                            description: completionForm.finding_description,
                            severity: completionForm.finding_severity,
                            status: completionForm.finding_status,
                          }
                        : null,
                    },
                    {
                      onSuccess: () => {
                        setCompletionForm({
                          execution_id: "",
                          actor: completionForm.actor,
                          output_summary: "",
                          evidence_type: "note",
                          evidence_content: "",
                          artifact_uri: "",
                          finding_title: "",
                          finding_description: "",
                          finding_severity: "medium",
                          finding_status: "new",
                        });
                      },
                    },
                  );
                }}
              >
                <div className="space-y-2">
                  <Label htmlFor="completion-execution">Running execution</Label>
                  <NativeSelect
                    id="completion-execution"
                    value={completionForm.execution_id}
                    onChange={(event) => setCompletionForm({ ...completionForm, execution_id: event.target.value })}
                    required
                  >
                    <option value="">Select a running execution</option>
                    {runningExecutions.map((execution) => {
                      const context = executionContext(execution, hypotheses, programs, targets);

                      return (
                        <option key={execution.id} value={execution.id}>
                          Execution {execution.id} · {context.hypothesis?.title ?? `Hypothesis ${execution.hypothesis_id}`}
                        </option>
                      );
                    })}
                  </NativeSelect>
                </div>
                {selectedCompletionExecution ? (
                  <div className="subpanel p-4 text-sm leading-6 text-[var(--muted-foreground)]">
                    {selectedCompletionExecution.action_plan}
                  </div>
                ) : null}
                <div className="grid gap-4 md:grid-cols-[0.8fr_1.2fr]">
                  <div className="space-y-2">
                    <Label htmlFor="completion-actor">Actor</Label>
                    <Input
                      id="completion-actor"
                      value={completionForm.actor}
                      onChange={(event) => setCompletionForm({ ...completionForm, actor: event.target.value })}
                      placeholder="Operator"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="evidence-type">Evidence type</Label>
                    <Input
                      id="evidence-type"
                      value={completionForm.evidence_type}
                      onChange={(event) => setCompletionForm({ ...completionForm, evidence_type: event.target.value })}
                      placeholder="note"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="output-summary">Output summary</Label>
                  <Textarea
                    id="output-summary"
                    value={completionForm.output_summary}
                    onChange={(event) => setCompletionForm({ ...completionForm, output_summary: event.target.value })}
                    placeholder="What was observed during the bounded manual execution."
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="evidence-content">Raw evidence content</Label>
                  <Textarea
                    id="evidence-content"
                    value={completionForm.evidence_content}
                    onChange={(event) => setCompletionForm({ ...completionForm, evidence_content: event.target.value })}
                    placeholder="Paste the factual evidence text. Avoid secrets and unnecessary sensitive payloads."
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="artifact-uri">Artifact URI</Label>
                  <Input
                    id="artifact-uri"
                    value={completionForm.artifact_uri}
                    onChange={(event) => setCompletionForm({ ...completionForm, artifact_uri: event.target.value })}
                    placeholder="Optional evidence artifact reference"
                  />
                </div>
                <div className="subpanel p-4">
                  <div className="text-sm font-semibold text-white">Optional finding override</div>
                  <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                    Leave blank to let the deterministic report/evidence agent derive a finding from the execution.
                  </p>
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="finding-title">Finding title</Label>
                      <Input
                        id="finding-title"
                        value={completionForm.finding_title}
                        onChange={(event) => setCompletionForm({ ...completionForm, finding_title: event.target.value })}
                        placeholder="Optional"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="finding-severity">Finding severity</Label>
                      <NativeSelect
                        id="finding-severity"
                        value={completionForm.finding_severity}
                        onChange={(event) =>
                          setCompletionForm({ ...completionForm, finding_severity: event.target.value })
                        }
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="critical">Critical</option>
                      </NativeSelect>
                    </div>
                  </div>
                  <div className="mt-4 space-y-2">
                    <Label htmlFor="finding-description">Finding description</Label>
                    <Textarea
                      id="finding-description"
                      value={completionForm.finding_description}
                      onChange={(event) =>
                        setCompletionForm({ ...completionForm, finding_description: event.target.value })
                      }
                      placeholder="Optional synthesized narrative. Keep evidence and inference distinct."
                    />
                  </div>
                </div>
                {!findingOverrideReady ? (
                  <p className="text-sm text-amber-100">
                    Finding override requires both a title and a description, or neither.
                  </p>
                ) : null}
                {completeExecutionMutation.error ? (
                  <p className="text-sm text-rose-200">{getApiErrorMessage(completeExecutionMutation.error)}</p>
                ) : null}
                {completeExecutionMutation.isSuccess ? (
                  <p className="text-sm text-emerald-200">Execution completed with evidence and finding provenance.</p>
                ) : null}
                <Button type="submit" disabled={!completionReady || completeExecutionMutation.isPending}>
                  {completeExecutionMutation.isPending ? "Completing..." : "Complete with evidence"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <p className="eyebrow">Execution registry</p>
          <CardTitle>Requests, queue state, and evidence path</CardTitle>
        </CardHeader>
        <CardContent>
          {executions.length === 0 ? (
            <EmptyState
              title="No executions requested yet"
              description="Once an approved hypothesis is queued, it will appear here with program, target, action plan, and state."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Execution</TableHead>
                  <TableHead>Context</TableHead>
                  <TableHead>Requester</TableHead>
                  <TableHead>Action plan</TableHead>
                  <TableHead>Output</TableHead>
                  <TableHead>Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {executions.map((execution) => {
                  const context = executionContext(execution, hypotheses, programs, targets);

                  return (
                    <TableRow key={execution.id}>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusBadge status={execution.status} />
                          <span className="text-xs text-[var(--muted-foreground)]">#{execution.id}</span>
                        </div>
                        <div className="mt-2 text-xs text-[var(--muted-foreground)]">
                          Approved by {execution.approved_by ?? "n/a"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-white">
                          {context.hypothesis?.title ?? `Hypothesis ${execution.hypothesis_id}`}
                        </div>
                        <div className="text-xs text-[var(--muted-foreground)]">
                          {context.program?.name ?? "Unknown program"} ·{" "}
                          {context.target?.identifier ?? "Unknown target"}
                        </div>
                      </TableCell>
                      <TableCell>{execution.requested_by}</TableCell>
                      <TableCell className="max-w-md text-[var(--muted-foreground)]">{execution.action_plan}</TableCell>
                      <TableCell className="max-w-md text-[var(--muted-foreground)]">
                        {execution.output_summary ?? "No output recorded yet"}
                      </TableCell>
                      <TableCell>
                        {formatDateTime(execution.completed_at ?? execution.started_at ?? execution.created_at)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <p className="eyebrow">Approved hypotheses</p>
          <CardTitle>Eligible source objects</CardTitle>
          <CardDescription>
            These hypotheses have an approved human decision. Existing execution state is still shown separately.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {approvedHypotheses.length === 0 ? (
            <EmptyState
              title="No approved hypotheses"
              description="Use the approval queue to record a human decision before attempting execution."
            />
          ) : (
            <div className="grid gap-3 xl:grid-cols-2">
              {approvedHypotheses.slice(0, 8).map((hypothesis) => {
                const target = findTarget(targets, hypothesis.target_id);
                const program = findProgram(programs, hypothesis.program_id);
                const approval = getLatestApprovalForHypothesis(approvals, hypothesis.id);
                const execution = getLatestExecutionForHypothesis(executions, hypothesis.id);

                return (
                  <div key={hypothesis.id} className="subpanel p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status="draft" label="AI Hypothesis" />
                      <StatusBadge status={approval?.status ?? "pending"} label="Human approved" />
                      {execution ? <StatusBadge status={execution.status} label={`Execution ${execution.status}`} /> : null}
                    </div>
                    <div className="mt-3 text-base font-medium text-white">{hypothesis.title}</div>
                    <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
                      {program?.name ?? `Program ${hypothesis.program_id}`} ·{" "}
                      {target?.identifier ?? `Target ${hypothesis.target_id}`} · {humanizeToken(hypothesis.severity)}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
