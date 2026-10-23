// Tipos que reflejan el contrato real de src/runtime/contracts.ts y service.ts.
// No se comparte el módulo con el backend (runtimes distintos); si el contrato
// cambia ahí, hay que actualizar esto a mano.

export type RunStatus =
  | 'queued' | 'generating' | 'awaiting_review' | 'reviewing' | 'awaiting_approval'
  | 'approved' | 'dispatching' | 'outcome_unknown' | 'completed' | 'failed';

export interface Budget {
  currency: string;
  maxCostMicros: number;
  maxDurationMs: number;
  maxModelCalls: number;
  maxToolCalls: number;
  maxDelegationDepth: number;
}

export interface Principal {
  kind: 'human' | 'agent' | 'service';
  id: string;
}

export interface RunSummary {
  id: string;
  status: RunStatus;
  brief: string;
  createdAt: string;
  deadline: string;
  version: number;
  reservedCostMicros: number;
  budget: Budget;
  modelCalls: number;
  toolCalls: number;
  approverHumanId: string;
  createdByHumanId: string;
  needsAttention: boolean;
}

export interface RunsListResponse {
  runs: RunSummary[];
  nextCursor: string | null;
}

export interface ActionRequest {
  id: string;
  version: number;
  requestedBy: Principal;
  operation: string;
  resource: { type: string; id: string };
  input: { artifactId?: string; artifactVersion?: number; contentHash?: string };
  idempotencyKey: string;
  expiresAt: string;
}

export interface Review {
  accepted: boolean;
  explanation: string;
}

export interface Run {
  id: string;
  createdByHumanId: string;
  approverHumanId: string;
  brief: string;
  status: RunStatus;
  version: number;
  createdAt: string;
  deadline: string;
  budget: Budget;
  reservedCostMicros: number;
  modelCalls: number;
  toolCalls: number;
  leaseUntil: string | null;
  activeAttemptId: string | null;
  action: ActionRequest | null;
  review: Review | null;
}

export type ArtifactStatus = 'in_review' | 'approved' | 'superseded' | 'delivered';

export interface ArtifactRow {
  version: number;
  content: string;
  content_hash: string;
  data: {
    owner: Principal;
    kind: string;
    status: ArtifactStatus;
    mediaType: string;
    createdAt: string;
  };
}

export type AttemptOutcome = 'pending' | 'succeeded' | 'failed' | 'discarded' | 'unknown';

export interface AttemptRow {
  agentId?: string;
  departmentId?: string;
  kind: 'model' | 'tool';
  stage?: string;
  provider?: string;
  startedAt: string;
  finishedAt?: string;
  outcome: AttemptOutcome;
  inputTokens: number | null;
  outputTokens: number | null;
  costMicros: number | null;
  costStatus: 'actual' | 'estimated' | 'unknown';
  reservationMicros: number;
  currency: string;
}

export interface AuditRow {
  sequence: number;
  occurred_at: string;
  data: { principal: Principal; event: string } & Record<string, unknown>;
}

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'revoked';

export interface ApprovalRow {
  version: number;
  data: {
    status: ApprovalStatus;
    reason?: string;
    decidedAt?: string;
    approver: Principal;
  };
}

export interface RunDetailResponse {
  run: Run;
  artifacts: ArtifactRow[];
  attempts: AttemptRow[];
  audit: AuditRow[];
  approvals: ApprovalRow[];
}

export type AgentLevel = 'executive' | 'head' | 'manager' | 'specialist' | 'reviewer';

export interface AgentSummary {
  id: string;
  version: string;
  name: string;
  capabilities: string[];
  allowedTools: string[];
  organization?: {
    departmentId: string;
    title: string;
    level: AgentLevel;
    reportsToId?: string;
  };
}

export interface Department {
  id: string;
  name: string;
  mission: string;
  headAgentId: string;
  reviewerAgentId: string;
  parentDepartmentId?: string;
}

export interface OrganizationDefinition {
  id: string;
  name: string;
  executiveAgentId: string;
  departments: Department[];
}

export interface OrganizationResponse {
  organization: OrganizationDefinition;
  agents: AgentSummary[];
}

export interface AgentKnowledge {
  id: string;
  title: string;
  reference: string;
  content: string;
  sha256: string;
}

export interface AgentDetail extends AgentSummary {
  instructions: string;
  context: string;
  knowledge: AgentKnowledge[];
}
