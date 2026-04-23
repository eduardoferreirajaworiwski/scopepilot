export type ApprovalStatus = "pending" | "approved" | "rejected" | "expired";
export type ExecutionStatus = "queued" | "blocked" | "running" | "completed";
export type FindingStatus = "new" | "reported" | "closed";
export type HypothesisStatus = "draft" | "pending_approval" | "approved" | "rejected" | "executed";
export type RequiredApprovalLevel = "analyst" | "security_lead";

export type ProgramPolicyLimits = {
  max_requests_per_minute: number;
  manual_approval_request_rate: number;
  max_targets_per_execution: number;
  manual_approval_techniques: string[];
};

export type ProgramScopePolicy = {
  allowed_domains: string[];
  denied_domains: string[];
  forbidden_techniques: string[];
  limits?: ProgramPolicyLimits;
  notes?: string | null;
};

export type ProgramRead = {
  id: number;
  name: string;
  description: string;
  owner: string;
  scope_policy: ProgramScopePolicy;
  created_at: string;
};

export type TargetRead = {
  id: number;
  program_id: number;
  identifier: string;
  target_type: string;
  created_by: string;
  in_scope: boolean;
  scope_reason: string;
  created_at: string;
};

export type ReconRecordRead = {
  id: number;
  target_id: number;
  analyst: string;
  summary: string;
  observations: unknown[];
  created_at: string;
};

export type HypothesisRead = {
  id: number;
  hypothesis_id: number;
  program_id: number;
  target_id: number;
  recon_record_id: number | null;
  title: string;
  description: string;
  rationale: string;
  confidence: number;
  suggested_next_step: string;
  required_approval_level: RequiredApprovalLevel;
  severity: string;
  created_by: string;
  status: HypothesisStatus;
  created_at: string;
  updated_at: string;
};

export type ApprovalRead = {
  id: number;
  hypothesis_id: number;
  requested_by: string;
  request_rationale: string;
  approver: string | null;
  approver_role: RequiredApprovalLevel | null;
  status: ApprovalStatus;
  decision_reason: string | null;
  created_at: string;
  expires_at: string | null;
  decided_at: string | null;
};

export type ExecutionRead = {
  id: number;
  hypothesis_id: number;
  requested_by: string;
  approved_by: string | null;
  status: ExecutionStatus;
  action_plan: string;
  output_summary: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
};

export type EvidenceRead = {
  id: number;
  program_id: number;
  target_id: number;
  hypothesis_id: number;
  execution_id: number;
  finding_id: number | null;
  evidence_type: string;
  content: string;
  content_format: string;
  content_sha256: string;
  artifact_uri: string | null;
  created_at: string;
};

export type FindingRead = {
  id: number;
  program_id: number;
  target_id: number;
  hypothesis_id: number;
  execution_id: number;
  title: string;
  description: string;
  severity: string;
  status: FindingStatus;
  created_at: string;
};

export type DecisionLogRead = {
  id: number;
  event_type: string;
  entity_type: string;
  entity_id: number | null;
  actor: string;
  decision: string;
  reason: string;
  metadata_json: Record<string, unknown>;
  created_at: string;
};

export type FlowSnapshotRead = {
  id: number;
  program_id: number;
  target_id: number | null;
  hypothesis_id: number | null;
  approval_id: number | null;
  execution_id: number | null;
  finding_id: number | null;
  stage: string;
  snapshot_type: string;
  actor: string | null;
  payload_json: Record<string, unknown>;
  created_at: string;
};

export type ReportDraftRead = {
  id: number;
  program_id: number;
  target_id: number;
  hypothesis_id: number;
  execution_id: number;
  finding_id: number;
  title: string;
  narrative: string;
  generated_by: string;
  status: string;
  created_at: string;
  updated_at: string;
};

export type EvidenceStoreQueryResult = {
  program_id: number | null;
  target_id: number | null;
  finding_id: number | null;
  snapshots: FlowSnapshotRead[];
  evidence: EvidenceRead[];
  findings: FindingRead[];
  report_drafts: ReportDraftRead[];
};

export type QueueSnapshot = {
  queued_execution_ids: number[];
};

export type HealthResponse = {
  status: string;
};

export type ProgramCreateInput = {
  name: string;
  description: string;
  owner: string;
  scope_policy: ProgramScopePolicy;
};

export type TargetCreateInput = {
  program_id: number;
  identifier: string;
  target_type: string;
  created_by: string;
};

export type HypothesisCreateInput = {
  target_id: number;
  created_by: string;
  title?: string | null;
  description?: string | null;
  severity: string;
  recon_record_id?: number | null;
};

export type ApprovalRequestInput = {
  requested_by: string;
  rationale: string;
  expires_at?: string | null;
};

export type ApprovalDecisionInput = {
  approver: string;
  approver_role: RequiredApprovalLevel;
  rationale: string;
};

export class ApiClientError extends Error {
  status: number;
  detail: string;
  payload: unknown;
  url?: string;

  constructor(status: number, detail: string, payload: unknown, url?: string) {
    super(detail);
    this.name = "ApiClientError";
    this.status = status;
    this.detail = detail;
    this.payload = payload;
    this.url = url;
  }
}
