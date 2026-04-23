"use client";

import { useQueries, useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import type { ProgramRead } from "@/lib/types/api";

export function useHealthQuery() {
  return useQuery({
    queryKey: queryKeys.health,
    queryFn: api.health,
  });
}

export function useProgramsQuery() {
  return useQuery({
    queryKey: queryKeys.programs,
    queryFn: api.listPrograms,
  });
}

export function useProgramTargetsQuery(programId: number) {
  return useQuery({
    queryKey: queryKeys.programTargets(programId),
    queryFn: () => api.listProgramTargets(programId),
    enabled: Number.isFinite(programId),
  });
}

export function useAllTargetsQuery(programs: ProgramRead[]) {
  const queries = useQueries({
    queries: programs.map((program) => ({
      queryKey: queryKeys.programTargets(program.id),
      queryFn: () => api.listProgramTargets(program.id),
      enabled: programs.length > 0,
    })),
  });

  return {
    data: queries.flatMap((query) => query.data ?? []),
    isPending: queries.some((query) => query.isPending),
    isError: queries.some((query) => query.isError),
    error: queries.find((query) => query.error)?.error ?? null,
  };
}

export function useHypothesesQuery() {
  return useQuery({
    queryKey: queryKeys.hypotheses,
    queryFn: api.listHypotheses,
  });
}

export function useApprovalsQuery() {
  return useQuery({
    queryKey: queryKeys.approvals,
    queryFn: api.listApprovals,
  });
}

export function usePendingApprovalsQuery() {
  return useQuery({
    queryKey: queryKeys.pendingApprovals,
    queryFn: api.listPendingApprovals,
  });
}

export function useExecutionsQuery() {
  return useQuery({
    queryKey: queryKeys.executions,
    queryFn: api.listExecutions,
  });
}

export function useQueueSnapshotQuery() {
  return useQuery({
    queryKey: queryKeys.queue,
    queryFn: api.queueSnapshot,
  });
}

export function useFindingsQuery() {
  return useQuery({
    queryKey: queryKeys.findings,
    queryFn: api.listFindings,
  });
}

export function useProgramEvidenceStoreQuery(programId: number) {
  return useQuery({
    queryKey: queryKeys.programEvidence(programId),
    queryFn: () => api.getProgramEvidenceStore(programId),
    enabled: Number.isFinite(programId),
  });
}

export function useFindingEvidenceStoreQuery(findingId: number | null) {
  return useQuery({
    queryKey: queryKeys.findingEvidence(findingId ?? 0),
    queryFn: () => api.getFindingEvidenceStore(findingId ?? 0),
    enabled: typeof findingId === "number",
  });
}

export function useAuditTrailQuery() {
  return useQuery({
    queryKey: queryKeys.audit,
    queryFn: api.listAuditTrail,
  });
}

