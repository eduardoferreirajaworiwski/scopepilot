"use client";

import { useMutation, useQueries, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import type { ProgramRead } from "@/lib/types/api";

function isValidId(value: number) {
  return Number.isInteger(value) && value > 0;
}

async function invalidateApprovalWorkflow(queryClient: QueryClient) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.approvals }),
    queryClient.invalidateQueries({ queryKey: queryKeys.pendingApprovals }),
    queryClient.invalidateQueries({ queryKey: queryKeys.hypotheses }),
    queryClient.invalidateQueries({ queryKey: queryKeys.audit }),
    queryClient.invalidateQueries({ queryKey: queryKeys.evidenceStore }),
  ]);
}

async function invalidateExecutionWorkflow(queryClient: QueryClient) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.executions }),
    queryClient.invalidateQueries({ queryKey: queryKeys.queue }),
    queryClient.invalidateQueries({ queryKey: queryKeys.hypotheses }),
    queryClient.invalidateQueries({ queryKey: queryKeys.findings }),
    queryClient.invalidateQueries({ queryKey: queryKeys.audit }),
    queryClient.invalidateQueries({ queryKey: queryKeys.evidenceStore }),
  ]);
}

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

export function useProgramQuery(programId: number) {
  return useQuery({
    queryKey: queryKeys.program(programId),
    queryFn: () => api.getProgram(programId),
    enabled: isValidId(programId),
  });
}

export function useProgramTargetsQuery(programId: number) {
  return useQuery({
    queryKey: queryKeys.programTargets(programId),
    queryFn: () => api.listProgramTargets(programId),
    enabled: isValidId(programId),
  });
}

export function useAllTargetsQuery(programs: ProgramRead[]) {
  const queries = useQueries({
    queries: programs.map((program) => ({
      queryKey: queryKeys.programTargets(program.id),
      queryFn: () => api.listProgramTargets(program.id),
      enabled: isValidId(program.id),
    })),
  });

  return {
    data: queries.flatMap((query) => query.data ?? []),
    isPending: queries.some((query) => query.isPending),
    isError: queries.some((query) => query.isError),
    error: queries.find((query) => query.error)?.error ?? null,
    refetch: () => Promise.all(queries.map((query) => query.refetch())),
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
    enabled: isValidId(programId),
  });
}

export function useFindingEvidenceStoreQuery(findingId: number | null) {
  return useQuery({
    queryKey: queryKeys.findingEvidence(findingId ?? 0),
    queryFn: () => api.getFindingEvidenceStore(findingId ?? 0),
    enabled: typeof findingId === "number" && isValidId(findingId),
  });
}

export function useAuditTrailQuery() {
  return useQuery({
    queryKey: queryKeys.audit,
    queryFn: api.listAuditTrail,
  });
}

export function useCreateProgramMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.createProgram,
    onSuccess: async (program) => {
      queryClient.setQueryData(queryKeys.program(program.id), program);

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.programs }),
        queryClient.invalidateQueries({ queryKey: queryKeys.audit }),
      ]);
    },
  });
}

export function useCreateTargetMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.createTarget,
    onSuccess: async (target) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.programTargets(target.program_id) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.program(target.program_id) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.audit }),
      ]);
    },
  });
}

export function useCreateHypothesisMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.createHypothesis,
    onSuccess: async (hypothesis) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.hypotheses }),
        queryClient.invalidateQueries({ queryKey: queryKeys.program(hypothesis.program_id) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.programEvidence(hypothesis.program_id) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.audit }),
      ]);
    },
  });
}

export function useRequestApprovalMutation(hypothesisId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: Parameters<typeof api.requestApproval>[1]) => api.requestApproval(hypothesisId, payload),
    onSuccess: async () => {
      await invalidateApprovalWorkflow(queryClient);
    },
  });
}

export function useApproveApprovalMutation(approvalId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: Parameters<typeof api.approveApproval>[1]) => api.approveApproval(approvalId, payload),
    onSuccess: async () => {
      await invalidateApprovalWorkflow(queryClient);
    },
  });
}

export function useRejectApprovalMutation(approvalId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: Parameters<typeof api.rejectApproval>[1]) => api.rejectApproval(approvalId, payload),
    onSuccess: async () => {
      await invalidateApprovalWorkflow(queryClient);
    },
  });
}

export function useRequestExecutionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.requestExecution,
    onSuccess: async () => {
      await invalidateExecutionWorkflow(queryClient);
    },
  });
}

export function useDispatchNextExecutionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.dispatchNextExecution,
    onSuccess: async () => {
      await invalidateExecutionWorkflow(queryClient);
    },
  });
}

export function useCompleteExecutionMutation(executionId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: Parameters<typeof api.completeExecution>[1]) =>
      api.completeExecution(executionId, payload),
    onSuccess: async () => {
      await invalidateExecutionWorkflow(queryClient);
    },
  });
}
