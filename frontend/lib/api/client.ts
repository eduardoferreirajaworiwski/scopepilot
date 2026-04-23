import type {
  ApprovalDecisionInput,
  ApprovalRead,
  ApprovalRequestInput,
  DecisionLogRead,
  ExecutionCompleteInput,
  ExecutionCompleteResponse,
  EvidenceStoreQueryResult,
  ExecutionRequestInput,
  ExecutionRead,
  FindingRead,
  HealthResponse,
  HypothesisCreateInput,
  HypothesisRead,
  ProgramCreateInput,
  ProgramScopePolicy,
  ProgramRead,
  QueueDispatchInput,
  QueueSnapshot,
  TargetCreateInput,
  TargetRead,
} from "@/lib/types/api";
import { ApiClientError } from "@/lib/types/api";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_SCOPEPILOT_API_URL ?? "http://127.0.0.1:8000/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${API_BASE_URL}${path}`;
  let response: Response;

  try {
    response = await fetch(url, {
      ...init,
      headers: {
        Accept: "application/json",
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...(init?.headers ?? {}),
      },
    });
  } catch (error) {
    throw new ApiClientError(
      0,
      "Could not reach the ScopePilot API. Check that the FastAPI server is running and that NEXT_PUBLIC_SCOPEPILOT_API_URL points to the /api base path.",
      error,
      url,
    );
  }

  const text = await response.text();
  const payload = text ? safeParseJson(text) : null;

  if (!response.ok) {
    throw new ApiClientError(response.status, getErrorDetail(response.status, payload), payload, url);
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

function getErrorDetail(status: number, payload: unknown) {
  if (isRecord(payload) && "detail" in payload) {
    const detail = payload.detail;

    if (typeof detail === "string") {
      return detail;
    }

    if (Array.isArray(detail)) {
      return formatValidationErrors(detail);
    }

    if (isRecord(detail)) {
      return `The API rejected the request: ${JSON.stringify(detail)}`;
    }
  }

  if (status === 404) {
    return "The requested ScopePilot resource was not found.";
  }

  if (status === 409) {
    return "The request conflicts with the current workflow state. Refresh the page and review the latest decision state.";
  }

  if (status >= 500) {
    return "The ScopePilot API returned a server error. Retry after checking the backend logs.";
  }

  return `The ScopePilot API rejected the request with status ${status}.`;
}

function formatValidationErrors(detail: unknown[]) {
  const messages = detail
    .map((item) => {
      if (!isRecord(item)) {
        return null;
      }

      const location = Array.isArray(item.loc)
        ? item.loc.filter((part) => part !== "body").join(".")
        : "";
      const message = typeof item.msg === "string" ? item.msg : "Invalid value.";

      return location ? `${location}: ${message}` : message;
    })
    .filter(Boolean);

  if (messages.length === 0) {
    return "The API rejected the request because required data is missing or invalid.";
  }

  return `The API rejected the request because required data is missing or invalid. ${messages.join(" ")}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeStringList(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item) => String(item).trim()).filter(Boolean);
}

function normalizeNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function normalizeScopePolicy(value: unknown): ProgramScopePolicy {
  const policy = isRecord(value) ? value : {};
  const limits = isRecord(policy.limits) ? policy.limits : null;

  return {
    allowed_domains: normalizeStringList(policy.allowed_domains),
    denied_domains: normalizeStringList(policy.denied_domains),
    forbidden_techniques: normalizeStringList(policy.forbidden_techniques),
    limits: limits
      ? {
          max_requests_per_minute: normalizeNumber(limits.max_requests_per_minute, 30),
          manual_approval_request_rate: normalizeNumber(limits.manual_approval_request_rate, 10),
          max_targets_per_execution: normalizeNumber(limits.max_targets_per_execution, 1),
          manual_approval_techniques: normalizeStringList(limits.manual_approval_techniques),
        }
      : undefined,
    notes: typeof policy.notes === "string" ? policy.notes : null,
  };
}

function normalizeProgram(program: ProgramRead): ProgramRead {
  return {
    ...program,
    scope_policy: normalizeScopePolicy(program.scope_policy),
  };
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

function isValidId(value: number) {
  return Number.isInteger(value) && value > 0;
}

async function listPrograms() {
  const programs = await request<ProgramRead[]>("/programs");
  return programs.map(normalizeProgram);
}

async function getProgram(programId: number) {
  if (!isValidId(programId)) {
    throw new ApiClientError(400, "Program id is invalid. Use a positive numeric id.", { programId });
  }

  // Temporary adapter: the backend currently exposes GET /api/programs, but not GET /api/programs/{id}.
  const program = (await listPrograms()).find((item) => item.id === programId);

  if (!program) {
    throw new ApiClientError(
      404,
      "Program not found. The frontend resolved this detail view through GET /api/programs because GET /api/programs/{id} is not available yet.",
      { programId },
    );
  }

  return program;
}

export const api = {
  health: () => request<HealthResponse>("/health"),
  listPrograms,
  getProgram,
  createProgram: (payload: ProgramCreateInput) =>
    request<ProgramRead>("/programs", {
      method: "POST",
      body: JSON.stringify(payload),
    }).then(normalizeProgram),
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
  listExecutions: () => request<ExecutionRead[]>("/executions"),
  requestExecution: (payload: ExecutionRequestInput) =>
    request<ExecutionRead>("/executions", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  queueSnapshot: () => request<QueueSnapshot>("/executions/queue"),
  dispatchNextExecution: (payload: QueueDispatchInput) =>
    request<ExecutionRead>("/executions/queue/next", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  completeExecution: (executionId: number, payload: ExecutionCompleteInput) =>
    request<ExecutionCompleteResponse>(`/executions/${executionId}/complete`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  listFindings: () => request<FindingRead[]>("/findings"),
  getProgramEvidenceStore: (programId: number) =>
    request<EvidenceStoreQueryResult>(`/evidence-store/programs/${programId}`),
  getFindingEvidenceStore: (findingId: number) =>
    request<EvidenceStoreQueryResult>(`/evidence-store/findings/${findingId}`),
  listAuditTrail: () => request<DecisionLogRead[]>("/audit/decisions"),
};
