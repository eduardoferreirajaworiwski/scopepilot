import type {
  ApprovalDecisionInput,
  ApprovalRead,
  ApprovalRequestInput,
  DecisionLogRead,
  EvidenceStoreQueryResult,
  FindingRead,
  HealthResponse,
  HypothesisCreateInput,
  HypothesisRead,
  ProgramCreateInput,
  ProgramRead,
  QueueSnapshot,
  TargetCreateInput,
  TargetRead,
} from "@/lib/types/api";
import { ApiClientError } from "@/lib/types/api";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_SCOPEPILOT_API_URL ?? "http://127.0.0.1:8000/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  const text = await response.text();
  const payload = text ? safeParseJson(text) : null;

  if (!response.ok) {
    const detail =
      typeof payload === "object" && payload !== null && "detail" in payload
        ? String(payload.detail)
        : `Request failed with status ${response.status}.`;
    throw new ApiClientError(response.status, detail, payload);
  }

  return payload as T;
}

function safeParseJson(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

export function getApiErrorMessage(error: unknown) {
  if (error instanceof ApiClientError) {
    return error.detail;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Unexpected client error.";
}

export const api = {
  health: () => request<HealthResponse>("/health"),
  listPrograms: () => request<ProgramRead[]>("/programs"),
  createProgram: (payload: ProgramCreateInput) =>
    request<ProgramRead>("/programs", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  listProgramTargets: (programId: number) => request<TargetRead[]>(`/programs/${programId}/targets`),
  createTarget: (payload: TargetCreateInput) =>
    request<TargetRead>("/targets", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  listHypotheses: () => request<HypothesisRead[]>("/hypotheses"),
  createHypothesis: (payload: HypothesisCreateInput) =>
    request<HypothesisRead>("/hypotheses", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  requestApproval: (hypothesisId: number, payload: ApprovalRequestInput) =>
    request<ApprovalRead>(`/hypotheses/${hypothesisId}/approvals`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  listApprovals: () => request<ApprovalRead[]>("/approvals"),
  listPendingApprovals: () => request<ApprovalRead[]>("/approvals/pending"),
  approveApproval: (approvalId: number, payload: ApprovalDecisionInput) =>
    request<ApprovalRead>(`/approvals/${approvalId}/approve`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  rejectApproval: (approvalId: number, payload: ApprovalDecisionInput) =>
    request<ApprovalRead>(`/approvals/${approvalId}/reject`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  listExecutions: () => request<import("@/lib/types/api").ExecutionRead[]>("/executions"),
  queueSnapshot: () => request<QueueSnapshot>("/executions/queue"),
  listFindings: () => request<FindingRead[]>("/findings"),
  getProgramEvidenceStore: (programId: number) =>
    request<EvidenceStoreQueryResult>(`/evidence-store/programs/${programId}`),
  getFindingEvidenceStore: (findingId: number) =>
    request<EvidenceStoreQueryResult>(`/evidence-store/findings/${findingId}`),
  listAuditTrail: () => request<DecisionLogRead[]>("/audit/decisions"),
};

