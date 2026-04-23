"use client";

import Link from "next/link";
import { useDeferredValue, useState } from "react";

import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/states";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { getApiErrorMessage } from "@/lib/api/client";
import {
  useAllTargetsQuery,
  useApprovalsQuery,
  useCreateHypothesisMutation,
  useExecutionsQuery,
  useHypothesesQuery,
  useProgramsQuery,
  useRequestApprovalMutation,
} from "@/lib/api/hooks";
import { formatConfidence, formatDateTime, humanizeToken } from "@/lib/format";
import { findProgram, findTarget, getLatestApprovalForHypothesis, getLatestExecutionForHypothesis } from "@/lib/selectors";
import type { ApprovalRead, HypothesisRead, ProgramRead, TargetRead } from "@/lib/types/api";

function ApprovalRequestPanel({ hypothesisId }: { hypothesisId: number }) {
  const [formState, setFormState] = useState({
    requested_by: "",
    rationale: "",
  });

  const mutation = useRequestApprovalMutation(hypothesisId);

  return (
    <form
      className="decision-panel mt-4 space-y-3 p-4"
      onSubmit={(event) => {
        event.preventDefault();
        mutation.mutate(formState, {
          onSuccess: () => setFormState({ requested_by: "", rationale: "" }),
        });
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-[var(--foreground-strong)]">Request human approval</div>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            Creates a review record without starting execution.
          </p>
        </div>
        <StatusBadge status="pending" label="Approval gate" />
      </div>
      <div className="grid gap-3 md:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-2">
          <Label htmlFor={`requested-by-${hypothesisId}`}>Requested by</Label>
          <Input
            id={`requested-by-${hypothesisId}`}
            value={formState.requested_by}
            onChange={(event) => setFormState({ ...formState, requested_by: event.target.value })}
            placeholder="Operator"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`approval-rationale-${hypothesisId}`}>Approval rationale</Label>
          <Input
            id={`approval-rationale-${hypothesisId}`}
            value={formState.rationale}
            onChange={(event) => setFormState({ ...formState, rationale: event.target.value })}
            placeholder="Why this hypothesis deserves human review"
            required
          />
        </div>
      </div>
      {mutation.error ? <p className="text-sm text-rose-200">{getApiErrorMessage(mutation.error)}</p> : null}
      {mutation.isSuccess ? <p className="text-sm text-emerald-200">Approval request created.</p> : null}
      <Button type="submit" size="sm" disabled={mutation.isPending}>
        {mutation.isPending ? "Requesting..." : "Request approval"}
      </Button>
    </form>
  );
}

function HypothesisCard({
  hypothesis,
  programs,
  targets,
  approvals,
  executions,
}: {
  hypothesis: HypothesisRead;
  programs: ProgramRead[];
  targets: TargetRead[];
  approvals: ApprovalRead[];
  executions: import("@/lib/types/api").ExecutionRead[];
}) {
  const program = findProgram(programs, hypothesis.program_id);
  const target = findTarget(targets, hypothesis.target_id);
  const approval = getLatestApprovalForHypothesis(approvals, hypothesis.id);
  const execution = getLatestExecutionForHypothesis(executions, hypothesis.id);
  const canRequestApproval = !approval || approval.status === "rejected" || approval.status === "expired";

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status="draft" label="AI Hypothesis" />
          <StatusBadge status={hypothesis.status} />
          <StatusBadge status="info" label={humanizeToken(hypothesis.severity)} />
          <StatusBadge status="warning" label={`Needs ${humanizeToken(hypothesis.required_approval_level)}`} />
          {approval ? <StatusBadge status={approval.status} label={`Approval ${approval.status}`} /> : null}
          {execution ? <StatusBadge status={execution.status} label={`Execution ${execution.status}`} /> : null}
        </div>
        <CardTitle>{hypothesis.title}</CardTitle>
        <CardDescription>
          {program?.name ?? `Program ${hypothesis.program_id}`} · {target?.identifier ?? `Target ${hypothesis.target_id}`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="subpanel p-4">
          <div className="text-xs uppercase tracking-[0.16em] text-[var(--muted-foreground)]">AI inference</div>
          <p className="mt-2 text-sm leading-7 text-[var(--foreground)]">{hypothesis.description}</p>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="subpanel p-4">
            <div className="text-xs uppercase tracking-[0.16em] text-[var(--muted-foreground)]">Confidence</div>
            <div className="mt-2 text-lg font-semibold text-white">{formatConfidence(hypothesis.confidence)}</div>
          </div>
          <div className="subpanel p-4">
            <div className="text-xs uppercase tracking-[0.16em] text-[var(--muted-foreground)]">Created</div>
            <div className="mt-2 text-sm font-medium text-white">{formatDateTime(hypothesis.created_at)}</div>
          </div>
          <div className="subpanel p-4">
            <div className="text-xs uppercase tracking-[0.16em] text-[var(--muted-foreground)]">Suggested next step</div>
            <div className="mt-2 text-sm font-medium text-white">{hypothesis.suggested_next_step}</div>
          </div>
        </div>
        {approval ? (
          <div className="subpanel p-4">
            <div className="text-xs uppercase tracking-[0.16em] text-[var(--muted-foreground)]">Human decision state</div>
            <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
              {approval.approver
                ? `${approval.approver} ${approval.status} this request.`
                : "Approval exists but has not been decided yet."}
            </p>
          </div>
        ) : null}
        {canRequestApproval ? <ApprovalRequestPanel hypothesisId={hypothesis.id} /> : null}
      </CardContent>
    </Card>
  );
}

export function HypothesesPage() {
  const programsQuery = useProgramsQuery();
  const targetsRegistry = useAllTargetsQuery(programsQuery.data ?? []);
  const hypothesesQuery = useHypothesesQuery();
  const approvalsQuery = useApprovalsQuery();
  const executionsQuery = useExecutionsQuery();

  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [formState, setFormState] = useState({
    target_id: "",
    created_by: "",
    title: "",
    description: "",
    severity: "medium",
  });

  const createHypothesisMutation = useCreateHypothesisMutation();

  if (
    programsQuery.isPending ||
    hypothesesQuery.isPending ||
    approvalsQuery.isPending ||
    executionsQuery.isPending ||
    targetsRegistry.isPending
  ) {
    return (
      <LoadingState
        title="Loading hypotheses queue"
        description="Fetching AI proposals, review state, and target registry."
      />
    );
  }

  if (
    programsQuery.error ||
    hypothesesQuery.error ||
    approvalsQuery.error ||
    executionsQuery.error ||
    targetsRegistry.error
  ) {
    return (
      <ErrorState
        title="Hypotheses could not be loaded"
        description={getApiErrorMessage(
          programsQuery.error ??
            hypothesesQuery.error ??
            approvalsQuery.error ??
            executionsQuery.error ??
            targetsRegistry.error,
        )}
        onRetry={() => {
          void Promise.all([
            programsQuery.refetch(),
            hypothesesQuery.refetch(),
            approvalsQuery.refetch(),
            executionsQuery.refetch(),
            targetsRegistry.refetch(),
          ]);
        }}
      />
    );
  }

  const programs = programsQuery.data ?? [];
  const targets = targetsRegistry.data;
  const inScopeTargets = targets.filter((target) => target.in_scope);
  const hypotheses = (hypothesesQuery.data ?? []).filter((hypothesis) => {
    const matchesStatus = statusFilter === "all" || hypothesis.status === statusFilter;
    const needle = deferredSearch.toLowerCase();
    const matchesSearch =
      needle.length === 0 ||
      hypothesis.title.toLowerCase().includes(needle) ||
      hypothesis.description.toLowerCase().includes(needle);

    return matchesStatus && matchesSearch;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Hypotheses queue"
        description="Every item on this page is explicitly marked as an AI-generated hypothesis. Human approval and executed state appear as separate badges, not as implicit progress."
        action={
          <Link href="/approvals" className={buttonVariants({ variant: "outline" })}>
            Open approval queue
          </Link>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <Card>
          <CardHeader>
            <p className="eyebrow">Create hypothesis</p>
            <CardTitle>Register a new AI-assisted proposal</CardTitle>
            <CardDescription>
              The backend still generates rationale and confidence. The frontend only orchestrates the request cleanly.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                createHypothesisMutation.mutate(
                  {
                    target_id: Number(formState.target_id),
                    created_by: formState.created_by,
                    title: formState.title || null,
                    description: formState.description || null,
                    severity: formState.severity,
                  },
                  {
                    onSuccess: () => {
                      setFormState({
                        target_id: "",
                        created_by: "",
                        title: "",
                        description: "",
                        severity: "medium",
                      });
                    },
                  },
                );
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="hypothesis-target">Target</Label>
                <NativeSelect
                  id="hypothesis-target"
                  value={formState.target_id}
                  onChange={(event) => setFormState({ ...formState, target_id: event.target.value })}
                  required
                >
                  <option value="">Select an in-scope target</option>
                  {inScopeTargets.map((target) => {
                    const program = findProgram(programs, target.program_id);
                    return (
                      <option key={target.id} value={target.id}>
                        {program?.name ?? `Program ${target.program_id}`} · {target.identifier}
                      </option>
                    );
                  })}
                </NativeSelect>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="hypothesis-created-by">Created by</Label>
                  <Input
                    id="hypothesis-created-by"
                    value={formState.created_by}
                    onChange={(event) => setFormState({ ...formState, created_by: event.target.value })}
                    placeholder="Operator"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="hypothesis-severity">Severity</Label>
                  <NativeSelect
                    id="hypothesis-severity"
                    value={formState.severity}
                    onChange={(event) => setFormState({ ...formState, severity: event.target.value })}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </NativeSelect>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="hypothesis-title">Title override</Label>
                <Input
                  id="hypothesis-title"
                  value={formState.title}
                  onChange={(event) => setFormState({ ...formState, title: event.target.value })}
                  placeholder="Optional human-provided title"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hypothesis-description">Description override</Label>
                <Textarea
                  id="hypothesis-description"
                  value={formState.description}
                  onChange={(event) => setFormState({ ...formState, description: event.target.value })}
                  placeholder="Optional operator framing before the backend enriches the hypothesis."
                />
              </div>
              {createHypothesisMutation.error ? (
                <p className="text-sm text-rose-200">{getApiErrorMessage(createHypothesisMutation.error)}</p>
              ) : null}
              {createHypothesisMutation.isSuccess ? (
                <p className="text-sm text-emerald-200">Hypothesis created and added to the queue.</p>
              ) : null}
              <Button type="submit" disabled={createHypothesisMutation.isPending || inScopeTargets.length === 0}>
                {createHypothesisMutation.isPending ? "Creating..." : "Create hypothesis"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <p className="eyebrow">Queue filters</p>
            <CardTitle>Focus the operator lane</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-[0.8fr_1.2fr]">
              <div className="space-y-2">
                <Label htmlFor="status-filter">Status</Label>
                <NativeSelect
                  id="status-filter"
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                >
                  <option value="all">All statuses</option>
                  <option value="draft">Draft</option>
                  <option value="pending_approval">Pending approval</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                  <option value="executed">Executed</option>
                </NativeSelect>
              </div>
              <div className="space-y-2">
                <Label htmlFor="search-filter">Search</Label>
                <Input
                  id="search-filter"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search title or rationale"
                />
              </div>
            </div>
            <div className="subpanel p-4 text-sm leading-6 text-[var(--muted-foreground)]">
              This queue is intentionally explicit: AI-generated content is labeled as hypothesis, approval remains a
              human decision, and execution is shown as a separate downstream state.
            </div>
          </CardContent>
        </Card>
      </div>

      {inScopeTargets.length === 0 ? (
        <EmptyState
          title="No in-scope targets available"
          description="Create targets in a program and let scope validation pass before registering hypotheses."
        />
      ) : null}

      {hypotheses.length === 0 ? (
        <EmptyState
          title="No hypotheses match the current filter"
          description="Adjust the filters or create a new hypothesis from an in-scope target."
        />
      ) : null}

      <div className="grid gap-4">
        {hypotheses.map((hypothesis) => (
          <HypothesisCard
            key={hypothesis.id}
            hypothesis={hypothesis}
            programs={programs}
            targets={targets}
            approvals={approvalsQuery.data ?? []}
            executions={executionsQuery.data ?? []}
          />
        ))}
      </div>
    </div>
  );
}
