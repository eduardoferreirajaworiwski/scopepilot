"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, getApiErrorMessage } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import {
  useApprovalsQuery,
  useExecutionsQuery,
  useHypothesesQuery,
  useProgramEvidenceStoreQuery,
  useProgramsQuery,
  useProgramTargetsQuery,
} from "@/lib/api/hooks";
import { formatDateTime, formatRelativeCount } from "@/lib/format";
import { filterHypothesesByProgram, findProgram, getLatestApprovalForHypothesis, getLatestExecutionForHypothesis } from "@/lib/selectors";

export function ProgramDetailPage({ programId }: { programId: number }) {
  const queryClient = useQueryClient();
  const programsQuery = useProgramsQuery();
  const targetsQuery = useProgramTargetsQuery(programId);
  const hypothesesQuery = useHypothesesQuery();
  const approvalsQuery = useApprovalsQuery();
  const executionsQuery = useExecutionsQuery();
  const evidenceStoreQuery = useProgramEvidenceStoreQuery(programId);

  const [targetForm, setTargetForm] = useState({
    identifier: "",
    target_type: "",
    created_by: "",
  });

  const createTargetMutation = useMutation({
    mutationFn: api.createTarget,
    onSuccess: async () => {
      setTargetForm({
        identifier: "",
        target_type: "",
        created_by: "",
      });

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.programTargets(programId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.audit }),
      ]);
    },
  });

  if (
    programsQuery.isPending ||
    targetsQuery.isPending ||
    hypothesesQuery.isPending ||
    approvalsQuery.isPending ||
    executionsQuery.isPending ||
    evidenceStoreQuery.isPending
  ) {
    return (
      <LoadingState
        title="Loading program detail"
        description="Resolving scope inventory, workflow state, and evidence store for this program."
      />
    );
  }

  if (
    programsQuery.error ||
    targetsQuery.error ||
    hypothesesQuery.error ||
    approvalsQuery.error ||
    executionsQuery.error ||
    evidenceStoreQuery.error
  ) {
    return (
      <ErrorState
        title="Program detail could not be loaded"
        description={getApiErrorMessage(
          programsQuery.error ??
            targetsQuery.error ??
            hypothesesQuery.error ??
            approvalsQuery.error ??
            executionsQuery.error ??
            evidenceStoreQuery.error,
        )}
        onRetry={() => {
          void Promise.all([
            programsQuery.refetch(),
            targetsQuery.refetch(),
            hypothesesQuery.refetch(),
            approvalsQuery.refetch(),
            executionsQuery.refetch(),
            evidenceStoreQuery.refetch(),
          ]);
        }}
      />
    );
  }

  const program = findProgram(programsQuery.data ?? [], programId);
  if (!program) {
    return (
      <ErrorState
        title="Program not found"
        description="The requested program id does not exist in the current backend dataset."
      />
    );
  }

  const targets = targetsQuery.data ?? [];
  const hypotheses = filterHypothesesByProgram(hypothesesQuery.data ?? [], program.id);
  const approvals = approvalsQuery.data ?? [];
  const executions = executionsQuery.data ?? [];
  const evidenceStore = evidenceStoreQuery.data;

  return (
    <div className="space-y-6">
      <PageHeader
        title={program.name}
        description={program.description || "No program description available."}
        action={
          <Link href="/programs" className="text-sm text-[var(--muted-foreground)] transition-colors hover:text-white">
            Back to programs
          </Link>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[1fr_0.9fr]">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status="approved" label="Program boundary" />
              <StatusBadge
                status={program.scope_policy.allowed_domains.length > 0 ? "confirmed" : "draft"}
                label={
                  program.scope_policy.allowed_domains.length > 0 ? "Explicit domain scope" : "Needs allowlist detail"
                }
              />
            </div>
            <CardTitle>Scope policy</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <DefinitionList
              items={[
                { label: "Owner", value: program.owner },
                { label: "Created", value: formatDateTime(program.created_at) },
                {
                  label: "Allowed domains",
                  value: program.scope_policy.allowed_domains.join(", ") || "None defined",
                },
                {
                  label: "Denied domains",
                  value: program.scope_policy.denied_domains.join(", ") || "None defined",
                },
              ]}
            />
            <div className="subpanel p-4">
              <div className="text-sm font-medium text-white">Forbidden techniques</div>
              <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
                {program.scope_policy.forbidden_techniques.join(", ") || "No forbidden techniques declared yet."}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <p className="eyebrow">Target intake</p>
            <CardTitle>Add target to this program</CardTitle>
            <CardDescription>
              Scope validation still happens in the backend. The frontend only makes the result obvious to the operator.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                createTargetMutation.mutate({
                  program_id: program.id,
                  identifier: targetForm.identifier,
                  target_type: targetForm.target_type,
                  created_by: targetForm.created_by,
                });
              }}
            >
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="target-identifier">Identifier</Label>
                  <Input
                    id="target-identifier"
                    value={targetForm.identifier}
                    onChange={(event) => setTargetForm({ ...targetForm, identifier: event.target.value })}
                    placeholder="api.example.com"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="target-type">Target type</Label>
                  <Input
                    id="target-type"
                    value={targetForm.target_type}
                    onChange={(event) => setTargetForm({ ...targetForm, target_type: event.target.value })}
                    placeholder="web"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="target-created-by">Created by</Label>
                <Input
                  id="target-created-by"
                  value={targetForm.created_by}
                  onChange={(event) => setTargetForm({ ...targetForm, created_by: event.target.value })}
                  placeholder="Operator"
                  required
                />
              </div>
              {createTargetMutation.error ? (
                <p className="text-sm text-rose-200">{getApiErrorMessage(createTargetMutation.error)}</p>
              ) : null}
              {createTargetMutation.isSuccess ? (
                <p className="text-sm text-emerald-200">Target submitted for scope validation.</p>
              ) : null}
              <Button type="submit" disabled={createTargetMutation.isPending}>
                {createTargetMutation.isPending ? "Adding target..." : "Add target"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Targets"
          value={String(targets.length)}
          description={formatRelativeCount(targets.filter((target) => target.in_scope).length, "in-scope asset")}
          tone="accent"
        />
        <MetricCard
          label="Hypotheses"
          value={String(hypotheses.length)}
          description="AI proposals currently tied to this program."
          tone="info"
        />
        <MetricCard
          label="Evidence items"
          value={String(evidenceStore?.evidence.length ?? 0)}
          description="Raw evidence entries linked through execution provenance."
          tone="success"
        />
        <MetricCard
          label="Report drafts"
          value={String(evidenceStore?.report_drafts.length ?? 0)}
          description="Narrative outputs are tracked separately from raw evidence."
          tone="neutral"
        />
      </div>

      <Card>
        <CardHeader>
          <p className="eyebrow">Target inventory</p>
          <CardTitle>Program targets and scope result</CardTitle>
        </CardHeader>
        <CardContent>
          {targets.length === 0 ? (
            <EmptyState
              title="No targets registered"
              description="Add the first target to see scope validation and downstream workflow activity."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Target</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Scope</TableHead>
                  <TableHead>Created by</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {targets.map((target) => (
                  <TableRow key={target.id}>
                    <TableCell>
                      <div className="font-medium text-white">{target.identifier}</div>
                      <div className="text-xs text-[var(--muted-foreground)]">{target.scope_reason}</div>
                    </TableCell>
                    <TableCell>{target.target_type}</TableCell>
                    <TableCell>
                      <StatusBadge
                        status={target.in_scope ? "confirmed" : "rejected"}
                        label={target.in_scope ? "In scope" : "Out of scope"}
                      />
                    </TableCell>
                    <TableCell>{target.created_by}</TableCell>
                    <TableCell>{formatDateTime(target.created_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <p className="eyebrow">Hypotheses in this program</p>
            <CardTitle>AI proposals and downstream state</CardTitle>
          </CardHeader>
          <CardContent>
            {hypotheses.length === 0 ? (
              <EmptyState
                title="No hypotheses yet"
                description="Once hypotheses exist for targets in this program, approval and execution state will be summarized here."
              />
            ) : (
              <div className="space-y-3">
                {hypotheses.slice(0, 6).map((hypothesis) => {
                  const approval = getLatestApprovalForHypothesis(approvals, hypothesis.id);
                  const execution = getLatestExecutionForHypothesis(executions, hypothesis.id);

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
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <p className="eyebrow">Evidence store</p>
            <CardTitle>Program-level provenance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="subpanel p-4">
              <div className="text-sm font-medium text-white">Evidence vs inference</div>
              <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
                Evidence items are stored separately from report drafts, and decision snapshots remain visible in the
                same program context.
              </p>
            </div>
            <DefinitionList
              items={[
                {
                  label: "Snapshots",
                  value: formatRelativeCount(evidenceStore?.snapshots.length ?? 0, "snapshot"),
                },
                {
                  label: "Findings",
                  value: formatRelativeCount(evidenceStore?.findings.length ?? 0, "finding"),
                },
                {
                  label: "Evidence",
                  value: formatRelativeCount(evidenceStore?.evidence.length ?? 0, "record"),
                },
                {
                  label: "Drafts",
                  value: formatRelativeCount(evidenceStore?.report_drafts.length ?? 0, "draft"),
                },
              ]}
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <p className="eyebrow">Recent snapshots</p>
          <CardTitle>Evidence store timeline</CardTitle>
        </CardHeader>
        <CardContent>
          {(evidenceStore?.snapshots.length ?? 0) === 0 ? (
            <EmptyState
              title="No snapshots yet"
              description="Snapshots will appear once hypotheses, approvals, executions, or findings create provenance records."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Stage</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {evidenceStore?.snapshots.slice(0, 8).map((snapshot) => (
                  <TableRow key={snapshot.id}>
                    <TableCell>
                      <StatusBadge status={snapshot.stage} />
                    </TableCell>
                    <TableCell>{snapshot.snapshot_type}</TableCell>
                    <TableCell>{snapshot.actor ?? "system"}</TableCell>
                    <TableCell>{formatDateTime(snapshot.created_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
