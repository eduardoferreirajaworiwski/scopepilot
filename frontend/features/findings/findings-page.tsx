"use client";

import { useEffect, useState } from "react";

import { DefinitionList } from "@/components/shared/definition-list";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/states";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  useAllTargetsQuery,
  useFindingEvidenceStoreQuery,
  useFindingsQuery,
  useHypothesesQuery,
  useProgramsQuery,
} from "@/lib/api/hooks";
import { formatDateTime, humanizeToken } from "@/lib/format";
import { findHypothesis, findProgram, findTarget } from "@/lib/selectors";

export function FindingsPage() {
  const programsQuery = useProgramsQuery();
  const targetsRegistry = useAllTargetsQuery(programsQuery.data ?? []);
  const findingsQuery = useFindingsQuery();
  const hypothesesQuery = useHypothesesQuery();
  const [selectedFindingId, setSelectedFindingId] = useState<number | null>(null);

  useEffect(() => {
    if (!selectedFindingId && findingsQuery.data && findingsQuery.data.length > 0) {
      setSelectedFindingId(findingsQuery.data[0].id);
    }
  }, [selectedFindingId, findingsQuery.data]);

  const evidenceStoreQuery = useFindingEvidenceStoreQuery(selectedFindingId);

  if (programsQuery.isPending || findingsQuery.isPending || hypothesesQuery.isPending || targetsRegistry.isPending) {
    return (
      <LoadingState
        title="Loading findings and reports"
        description="Fetching findings plus raw evidence and report-draft provenance."
      />
    );
  }

  if (programsQuery.error || findingsQuery.error || hypothesesQuery.error || targetsRegistry.error) {
    return (
      <ErrorState
        title="Findings could not be loaded"
        description={
          (programsQuery.error ??
            findingsQuery.error ??
            hypothesesQuery.error ??
            targetsRegistry.error) instanceof Error
            ? (
                programsQuery.error ??
                findingsQuery.error ??
                hypothesesQuery.error ??
                targetsRegistry.error
              )?.message ?? "Unexpected failure."
            : "Unexpected failure."
        }
      />
    );
  }

  const programs = programsQuery.data ?? [];
  const targets = targetsRegistry.data;
  const findings = findingsQuery.data ?? [];
  const hypotheses = hypothesesQuery.data ?? [];
  const selectedFinding = findings.find((finding) => finding.id === selectedFindingId) ?? null;
  const selectedStore = evidenceStoreQuery.data;

  if (findings.length === 0) {
    return (
      <EmptyState
        title="No findings yet"
        description="Confirmed findings appear only after execution completes and evidence is registered."
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Findings and reports"
        description="This workspace keeps raw evidence, inferred narrative, and final finding state separated so the operator can inspect what is factual and what is synthesized."
      />

      <div className="grid gap-4 xl:grid-cols-[0.42fr_0.58fr]">
        <Card>
          <CardHeader>
            <p className="eyebrow">Finding registry</p>
            <CardTitle>Select a finding</CardTitle>
            <CardDescription>
              Choosing a finding loads its evidence store record, including raw evidence, snapshots, and report drafts.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {findings.map((finding) => {
              const active = finding.id === selectedFindingId;
              const program = findProgram(programs, finding.program_id);
              const target = findTarget(targets, finding.target_id);

              return (
                <button
                  key={finding.id}
                  type="button"
                  onClick={() => setSelectedFindingId(finding.id)}
                  className={`w-full rounded-[24px] border p-4 text-left transition-colors ${
                    active
                      ? "border-[var(--border-accent)] bg-[var(--surface-selected)]"
                      : "border-[var(--border-subtle)] bg-[var(--surface-inset)] hover:bg-[var(--surface-hover)]"
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status="confirmed" />
                    <StatusBadge status={finding.status} />
                  </div>
                  <div className="mt-3 text-base font-medium text-white">{finding.title}</div>
                  <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
                    {program?.name ?? `Program ${finding.program_id}`} · {target?.identifier ?? `Target ${finding.target_id}`}
                  </p>
                </button>
              );
            })}
          </CardContent>
        </Card>

        <div className="space-y-4">
          {!selectedFinding ? (
            <EmptyState
              title="Select a finding"
              description="Choose a finding from the list to inspect evidence, inference, and audit snapshots."
            />
          ) : (
            <>
              <Card>
                <CardHeader>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status="confirmed" label="Evidence-backed" />
                    <StatusBadge status={selectedFinding.status} />
                    <StatusBadge status="info" label={humanizeToken(selectedFinding.severity)} />
                  </div>
                  <CardTitle>{selectedFinding.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <DefinitionList
                    items={[
                      {
                        label: "Program",
                        value: findProgram(programs, selectedFinding.program_id)?.name ?? `Program ${selectedFinding.program_id}`,
                      },
                      {
                        label: "Target",
                        value:
                          findTarget(targets, selectedFinding.target_id)?.identifier ??
                          `Target ${selectedFinding.target_id}`,
                      },
                      {
                        label: "Hypothesis",
                        value:
                          findHypothesis(hypotheses, selectedFinding.hypothesis_id)?.title ??
                          `Hypothesis ${selectedFinding.hypothesis_id}`,
                      },
                      {
                        label: "Execution",
                        value: `Execution ${selectedFinding.execution_id}`,
                      },
                    ]}
                  />
                </CardContent>
              </Card>

              {evidenceStoreQuery.isPending ? (
                <LoadingState
                  title="Loading evidence store"
                  description="Fetching raw evidence and report-draft history for the selected finding."
                />
              ) : evidenceStoreQuery.error ? (
                <ErrorState
                  title="Evidence store could not be loaded"
                  description={
                    evidenceStoreQuery.error instanceof Error
                      ? evidenceStoreQuery.error.message
                      : "Unexpected evidence store failure."
                  }
                />
              ) : (
                <>
                  <div className="grid gap-4 xl:grid-cols-2">
                    <Card>
                      <CardHeader>
                        <p className="eyebrow">Raw evidence</p>
                        <CardTitle>Factual execution output</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {selectedStore?.evidence.length ? (
                          selectedStore.evidence.map((record) => (
                            <div key={record.id} className="subpanel p-4">
                              <div className="flex flex-wrap items-center gap-2">
                                <StatusBadge status="confirmed" label={record.evidence_type} />
                                <span className="text-xs uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
                                  {formatDateTime(record.created_at)}
                                </span>
                              </div>
                              <pre className="mt-3 whitespace-pre-wrap text-sm leading-6 text-white">
                                {record.content}
                              </pre>
                            </div>
                          ))
                        ) : (
                          <CardDescription>No raw evidence stored for this finding.</CardDescription>
                        )}
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <p className="eyebrow">Inference and reporting</p>
                        <CardTitle>Synthesized narrative</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="subpanel p-4">
                          <div className="text-xs uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
                            Finding description
                          </div>
                          <p className="mt-3 text-sm leading-7 text-white">{selectedFinding.description}</p>
                        </div>
                        {selectedStore?.report_drafts.length ? (
                          selectedStore.report_drafts.map((draft) => (
                            <div key={draft.id} className="subpanel p-4">
                              <div className="flex flex-wrap items-center gap-2">
                                <StatusBadge status={draft.status} />
                                <span className="text-sm font-medium text-white">{draft.title}</span>
                              </div>
                              <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[var(--muted-foreground)]">
                                {draft.narrative}
                              </p>
                            </div>
                          ))
                        ) : (
                          <CardDescription>No report drafts stored for this finding.</CardDescription>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  <Card>
                    <CardHeader>
                      <p className="eyebrow">Snapshots</p>
                      <CardTitle>Audit snapshots for this finding</CardTitle>
                    </CardHeader>
                    <CardContent>
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
                          {(selectedStore?.snapshots ?? []).map((snapshot) => (
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
                    </CardContent>
                  </Card>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
