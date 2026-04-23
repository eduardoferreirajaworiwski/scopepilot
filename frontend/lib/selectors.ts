import type {
  ApprovalRead,
  ExecutionRead,
  HypothesisRead,
  ProgramRead,
  TargetRead,
} from "@/lib/types/api";

export function getLatestApprovalForHypothesis(approvals: ApprovalRead[], hypothesisId: number) {
  return approvals.find((approval) => approval.hypothesis_id === hypothesisId) ?? null;
}

export function getLatestExecutionForHypothesis(executions: ExecutionRead[], hypothesisId: number) {
  return executions.find((execution) => execution.hypothesis_id === hypothesisId) ?? null;
}

export function findProgram(programs: ProgramRead[], programId: number) {
  return programs.find((program) => program.id === programId) ?? null;
}

export function findTarget(targets: TargetRead[], targetId: number) {
  return targets.find((target) => target.id === targetId) ?? null;
}

export function findHypothesis(hypotheses: HypothesisRead[], hypothesisId: number) {
  return hypotheses.find((hypothesis) => hypothesis.id === hypothesisId) ?? null;
}

export function filterHypothesesByProgram(hypotheses: HypothesisRead[], programId: number) {
  return hypotheses.filter((hypothesis) => hypothesis.program_id === programId);
}

