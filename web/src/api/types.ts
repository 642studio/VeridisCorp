// Tipos que reflejan el contrato real de src/runtime/contracts.ts y service.ts.
// No se comparte el módulo con el backend (runtimes distintos); si el contrato
// cambia ahí, hay que actualizar esto a mano.

import type { Scene } from '../ascii/scene';

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
  // Solo en la lista (GET /organization): títulos de sus documentos de knowledge.
  knowledgeTitles?: string[];
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

// Campo editable desde AgentDetailPanel (POST /agents/{id}/text, src/runtime/service.ts:
// updateAgentText). "instructions" es el system prompt (instructions.md), "context" el
// contexto confirmado del puesto (context.md) — knowledge/ sigue sin edición desde aquí.
export type AgentTextField = 'instructions' | 'context';

// Tipos que reflejan src/office/contracts.ts y runtime/office-runtime.ts.

export type OfficeOrderStatus = 'active' | 'paused' | 'completed';
export type OfficeTaskStatus = 'pending' | 'running' | 'blocked' | 'in_review' | 'completed' | 'failed' | 'cancelled';

export interface OfficeOrderSummary {
  id: string;
  objective: string;
  status: OfficeOrderStatus;
  created_at: string;
  updated_at: string;
}

export interface OfficeOrdersListResponse {
  orders: OfficeOrderSummary[];
}

export interface OfficeCriterion {
  id: string;
  description: string;
}

export interface OfficeEvidence {
  id: string;
  kind: 'source' | 'artifact' | 'observation';
  reference: string;
  summary: string;
}

export interface OfficeAssessment {
  criterionId: string;
  accepted: boolean;
  evidenceIds: string[];
  explanation: string;
}

export interface OfficeTask {
  id: string;
  title: string;
  assignedAgentId: string;
  capability: string;
  dependsOn: string[];
  criteria: OfficeCriterion[];
  departmentId?: string;
  accountableAgentId?: string;
  status: OfficeTaskStatus;
  revisions: number;
  blocker?: string;
  submission?: { summary: string; evidence: OfficeEvidence[] };
  assessments?: OfficeAssessment[];
}

export type OfficeActor = { role: 'coordinator' } | { role: 'agent'; agentId: string };

export interface OfficeEventRow {
  sequence: number;
  actor: OfficeActor;
  command: { type: string } & Record<string, unknown>;
  occurredAt?: string;
}

export interface OfficeWorkOrder {
  id: string;
  workspaceId: string;
  objective: string;
  criteria: OfficeCriterion[];
  status: OfficeOrderStatus;
  limits: { maxTasks: number; maxSteps: number; maxRevisionsPerTask: number; maxCostMicros?: number | null };
  revision: number;
  tasks: OfficeTask[];
  events: OfficeEventRow[];
  assessments?: OfficeAssessment[];
  pauseReason?: string;
}

export interface OfficeModelCall {
  stage: string;
  agentId: string;
  capability: string;
  profileId: string;
  provider: string;
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
  costMicros: number | null;
  costStatus: 'estimated' | 'unknown';
}

export interface OfficeWorkflowLimits {
  maxTurns: number;
  maxRejectedDecisions: number;
  maxQuestions: number;
}

export interface OfficeExchange {
  question: string;
  answer: string;
}

// Refleja BudgetStatus de src/office/budget.ts tal como lo arma office-runtime.ts (shape()).
export interface OfficeBudget {
  maxCostMicros: number | null;
  spentMicros: number;
  unpricedCalls: number;
  projectedNextMicros: number | null;
  level: 'none' | 'ok' | 'warning' | 'critical' | 'exceeded';
}

export interface OfficeOrderDetail {
  id: string;
  order: OfficeWorkOrder;
  turns: number;
  rejectedDecisions: number;
  lastError: string | null;
  modelCalls: OfficeModelCall[];
  exchanges: OfficeExchange[];
  interrupted: boolean;
  pendingQuestion: string | null;
  limits: OfficeWorkflowLimits;
  budget: OfficeBudget;
}

// Tipos que reflejan src/runtime/office-runtime.ts (shapeSchedule) y src/runtime/scheduler.ts.

export interface OfficeSchedule {
  id: string;
  name: string;
  objective: string;
  cronExpression: string;
  timezone: string;
  enabled: boolean;
  running: boolean;
  consecutiveFailures: number;
  lastRunAt: string | null;
  lastFiredOrderId: string | null;
  createdAt: string;
  updatedAt: string;
  nextRunAt: string | null;
}

export interface OfficeSchedulesListResponse {
  schedules: OfficeSchedule[];
}

export type FireScheduleResult = 'fired' | 'skipped-overlap' | 'skipped-rate-limit' | 'skipped-disabled' | 'failed';

export interface FireScheduleResponse extends OfficeSchedule {
  result: FireScheduleResult;
}

// Tipos que reflejan src/governance/contracts.ts (CorporateMemoryRecord) tal como los devuelve
// src/runtime/office-runtime.ts (listMemory/validateMemory) — sin transformación, el mismo objeto
// validado por zod que se guarda en memory_records.data.

export type MemoryEntityType = 'company' | 'division' | 'client' | 'brand' | 'project' | 'contract' | 'person' | 'product' | 'decision' | 'integration' | 'process';
export type MemoryStatus = 'proposed' | 'validated' | 'superseded' | 'quarantined';
export type MemoryTrust = 'external_untrusted' | 'internal_unverified' | 'verified';

export interface MemoryProvenance {
  reference: string;
  observedAt: string;
}

export interface CorporateMemoryRecord {
  schemaVersion: 1;
  id: string;
  entityType: MemoryEntityType;
  entityId: string;
  version: number;
  content: string;
  status: MemoryStatus;
  provenance: MemoryProvenance[];
  updatedAt: string;
  validUntil: string | null;
  trust: MemoryTrust;
  kind?: MemoryKind;
  contradicts?: string | null;
  quarantineReason?: string | null;
}

export type MemoryKind = 'decision' | 'fact' | 'preference' | 'question';

// Refleja MemoryStore.graph() (src/runtime/memory-store.ts) vía GET /office/memory/graph.
export interface MemoryGraphNode {
  record: CorporateMemoryRecord;
  recalls: number;
  lastRecalledAt: string | null;
}
export interface MemoryGraphLink {
  source: string;
  target: string;
  similarity: number | null;
  kind: 'similar' | 'contradicts';
}
export interface MemoryGraph {
  nodes: MemoryGraphNode[];
  links: MemoryGraphLink[];
}

export interface MemoryListResponse {
  records: CorporateMemoryRecord[];
}

// Respuesta rápida del chat (POST /office/assistant/ask): una llamada con memoria, sin expediente.
export interface AssistantMemory {
  id: string;
  entityType: string;
  entityId: string;
  kind: string;
  content: string;
  confirmed: boolean;
}
export interface AssistantMessage {
  id: string;
  threadId: string;
  question: string;
  answer: string;
  // 'order': lo pedido era trabajo; objective es el encargo redactado para la oficina.
  mode: 'answer' | 'order';
  objective: string | null;
  memories: AssistantMemory[];
  // Escena visual opcional para el avatar ASCII (ver web/src/ascii/scene.ts); casi siempre null.
  // No validado de nuevo aquí — se confía en Scene.safeParse en el punto donde se usa (useVoiceDock.ts).
  scene: Scene | null;
  inputTokens: number | null;
  outputTokens: number | null;
  costMicros: number | null;
  latencyMs: number;
  createdAt: string;
}
export interface AssistantThreadSummary {
  threadId: string;
  title: string;
  messages: number;
  // Solo traspasos a la oficina: la conversación real es el expediente, no hace falta listarla.
  onlyHandoffs: boolean;
  createdAt: string;
  updatedAt: string;
}

// Conexiones MCP (src/runtime/mcp-store.ts).
export type McpStatus = 'active' | 'needs_auth' | 'error' | 'requested' | 'removed';
export interface McpTool {
  name: string; title: string | null; description: string; inputSchema: Record<string, unknown>;
  access: 'read' | 'write' | 'unknown'; enabled: boolean; accessSetBy?: 'server' | 'human';
}
export interface McpConnection {
  id: string; name: string; url: string | null; displayUrl: string | null; status: McpStatus; trust: 'confirmed' | 'unconfirmed';
  purpose: string; addedBy: { kind: 'human' | 'agent' | 'service'; id: string }; originOrderId: string | null;
  server: { name: string | null; version: string | null; instructions: string | null; transport: string } | null;
  tools: McpTool[]; hasCredential: boolean; memoryId: string | null; lastError: string | null; lastCheckedAt: string | null;
  callCount: number; lastUsedAt: string | null; createdAt: string; updatedAt: string;
}
export interface McpCredentialInput { headerName?: string; value: string }

// Refleja src/office/usage.ts (summarizeUsage) tal como lo devuelve GET /office/usage
// (src/runtime/office-runtime.ts: usage()). key en cada desglose es el agentId, la plataforma
// (openai/deepseek/local/...), la variable de entorno de la credencial (apiKeyEnv) o el modelo,
// según el bloque — nunca el valor real de una credencial.
export interface UsageBreakdownEntry {
  key: string;
  costMicros: number;
  pricedCalls: number;
  unpricedCalls: number;
}
export interface UsageSummary {
  currency: string;
  totalCostMicros: number;
  pricedCalls: number;
  unpricedCalls: number;
  byAgent: UsageBreakdownEntry[];
  byPlatform: UsageBreakdownEntry[];
  byApiKeyEnv: UsageBreakdownEntry[];
  byModel: UsageBreakdownEntry[];
}

// Refleja GET /office/settings (src/runtime/office-runtime.ts: settings()). Nunca incluye el
// valor de una credencial — solo si la variable de entorno que necesita está definida.
export interface ProviderStatus {
  profileId: string;
  provider: string;
  model: string;
  apiKeyEnv: string;
  baseURL: string | null;
  configured: boolean;
}
export interface ElevenLabsSettings {
  configured: boolean;
  voiceId: string | null;
  modelId: string;
}
export interface IntegrationsStatus {
  telegram: boolean;
  gmail: boolean;
}
export interface SettingsSummary {
  providers: ProviderStatus[];
  elevenlabs: ElevenLabsSettings;
  integrations: IntegrationsStatus;
  totpEnrolled: boolean;
}

// Refleja GET /office/settings/models (src/runtime/office-runtime.ts: modelPolicy()). agents es
// tal como está en config/models.active.json (VERIDIS_MODELS_FILE): solo los overrides explícitos,
// nunca el valor resuelto — un agente sin entrada ahí hereda el perfil de su etapa o el default.
export type ModelStage = 'coordinate' | 'execute' | 'review';
export interface ModelPolicyResponse {
  editable: boolean;
  filePath: string | null;
  profiles: ProviderStatus[];
  stages: Record<ModelStage, string> | null;
  agents: Record<string, Partial<Record<ModelStage, string>>>;
  agentIds: string[];
}
export interface ElevenLabsVoice {
  voiceId: string;
  name: string;
  category: string | null;
  previewUrl: string | null;
}

