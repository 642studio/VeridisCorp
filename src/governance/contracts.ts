import { z } from 'zod';
import { Assessment, Criterion, Evidence, Id } from '../office/contracts.js';

const Text = z.string().trim().min(1).max(16000);
export const Timestamp = z.iso.datetime({ offset: true });
export const Principal = z.object({ kind: z.enum(['human', 'agent', 'service']), id: Id }).strict();
export type Principal = z.infer<typeof Principal>;

// Un null identifica contexto corporativo o divisional, nunca «cualquier cliente».
export const AccessScope = z.object({
  workspaceId: Id, companyId: Id, divisionId: Id,
  clientId: Id.nullable(), projectId: Id.nullable(),
}).strict();
export type AccessScope = z.infer<typeof AccessScope>;
export const Resource = z.object({ type: Id, id: Id, scope: AccessScope }).strict();
export type Resource = z.infer<typeof Resource>;
export const Operation = z.enum([
  'data.read', 'draft.create', 'data.write', 'content.publish', 'external.communicate',
  'contract.commit', 'people.hire', 'finance.move', 'task.assign', 'approval.decide',
]);
export type Operation = z.infer<typeof Operation>;

export const PermissionGrant = z.object({
  id: Id, principal: Principal, scope: AccessScope, operations: z.array(Operation).min(1),
  resourceType: Id, resourceIds: z.array(Id).min(1),
  validFrom: Timestamp, expiresAt: Timestamp,
}).strict().refine((v) => Date.parse(v.validFrom) < Date.parse(v.expiresAt), 'Vigencia inválida');
export type PermissionGrant = z.infer<typeof PermissionGrant>;

export const ExecutionContext = z.object({
  schemaVersion: z.literal(1), runId: Id, principal: Principal, scope: AccessScope,
  correlationId: Id,
}).strict();
export type ExecutionContext = z.infer<typeof ExecutionContext>;

export const ActionRequest = z.object({
  schemaVersion: z.literal(1), id: Id, version: z.number().int().positive(),
  requestedBy: Principal, operation: Operation, resource: Resource,
  input: z.record(z.string(), z.json()), idempotencyKey: Id, expiresAt: Timestamp,
}).strict();
export type ActionRequest = z.infer<typeof ActionRequest>;
export const ApprovalRecord = z.object({
  schemaVersion: z.literal(1), id: Id, actionId: Id, actionDigest: z.string().regex(/^[a-f0-9]{64}$/),
  scope: AccessScope, approver: Principal.refine((v) => v.kind === 'human', 'El aprobador debe ser humano'),
  status: z.enum(['pending', 'approved', 'rejected', 'revoked']),
  createdAt: Timestamp, expiresAt: Timestamp, decidedAt: Timestamp.optional(), reason: Text.optional(),
}).strict().superRefine((v, ctx) => {
  if (Date.parse(v.createdAt) >= Date.parse(v.expiresAt)) ctx.addIssue({ code: 'custom', message: 'Vigencia inválida' });
  if ((v.status === 'pending') !== (v.decidedAt === undefined)) ctx.addIssue({ code: 'custom', message: 'Estado y decisión inconsistentes' });
  if (v.decidedAt && (Date.parse(v.decidedAt) < Date.parse(v.createdAt) || Date.parse(v.decidedAt) >= Date.parse(v.expiresAt))) {
    ctx.addIssue({ code: 'custom', message: 'Decisión fuera de vigencia' });
  }
});
export type ApprovalRecord = z.infer<typeof ApprovalRecord>;

export const DelegationRequest = z.object({
  context: ExecutionContext, assigneeAgentId: Id, capability: Id,
}).strict();
export type DelegationRequest = z.infer<typeof DelegationRequest>;

export const HumanTask = z.object({
  schemaVersion: z.literal(1), id: Id, scope: AccessScope, title: Text,
  coordinatorAgentId: Id, assigneeHumanId: Id, approverHumanId: Id,
  criteria: z.array(Criterion).min(1), dependsOn: z.array(Id), dueAt: Timestamp,
  timeZone: z.string().refine((v) => { try { new Intl.DateTimeFormat('es', { timeZone: v }); return true; } catch { return false; } }, 'Zona horaria inválida'),
  status: z.enum(['proposed', 'awaiting_acceptance', 'accepted', 'in_progress', 'blocked', 'awaiting_validation', 'completed', 'cancelled']),
  revision: z.number().int().nonnegative(), evidence: z.array(Evidence),
  validation: z.object({ validatedByHumanId: Id, validatedAt: Timestamp, assessments: z.array(Assessment).min(1) }).strict().optional(),
}).strict().superRefine((v, ctx) => {
  if (new Set(v.criteria.map((c) => c.id)).size !== v.criteria.length || new Set(v.evidence.map((e) => e.id)).size !== v.evidence.length) {
    ctx.addIssue({ code: 'custom', message: 'Identificadores duplicados' });
  }
  if (v.dependsOn.includes(v.id) || new Set(v.dependsOn).size !== v.dependsOn.length) ctx.addIssue({ code: 'custom', message: 'Dependencias inválidas' });
  if (v.status === 'completed' && (v.evidence.length === 0 || !v.validation || v.validation.validatedByHumanId !== v.approverHumanId)) ctx.addIssue({ code: 'custom', message: 'El cierre humano requiere evidencia' });
  if (v.status === 'completed' && v.validation) {
    const assessments = v.validation.assessments;
    if (assessments.length !== v.criteria.length || new Set(assessments.map((a) => a.criterionId)).size !== assessments.length
      || v.criteria.some((c) => !assessments.some((a) => a.criterionId === c.id && a.accepted && a.evidenceIds.length > 0))
      || assessments.some((a) => a.evidenceIds.some((id) => !v.evidence.some((e) => e.id === id)))) {
      ctx.addIssue({ code: 'custom', message: 'Validación humana incompleta' });
    }
  }
});
export type HumanTask = z.infer<typeof HumanTask>;

export const CorporateMemoryRecord = z.object({
  schemaVersion: z.literal(1), id: Id, scope: AccessScope,
  entityType: z.enum(['company', 'division', 'client', 'brand', 'project', 'contract', 'person', 'product', 'decision']),
  entityId: Id, version: z.number().int().positive(), content: Text,
  status: z.enum(['proposed', 'validated', 'superseded']),
  provenance: z.array(z.object({ reference: Text, observedAt: Timestamp }).strict()).min(1),
  updatedAt: Timestamp, validUntil: Timestamp.nullable(),
  trust: z.enum(['external_untrusted', 'internal_unverified', 'verified']),
}).strict();
export type CorporateMemoryRecord = z.infer<typeof CorporateMemoryRecord>;

export const ExecutionBudget = z.object({
  currency: z.string().regex(/^[A-Z]{3}$/), maxCostMicros: z.number().int().nonnegative().safe(),
  maxDurationMs: z.number().int().positive().safe(), maxModelCalls: z.number().int().positive(),
  maxToolCalls: z.number().int().nonnegative(), maxDelegationDepth: z.number().int().nonnegative(),
}).strict();
export const UsageRecord = z.object({
  schemaVersion: z.literal(1), id: Id, runId: Id, taskId: Id, attemptId: Id,
  scope: AccessScope, agentId: Id, departmentId: Id,
  kind: z.enum(['model', 'tool']), provider: Id, modelOrTool: z.string().trim().min(1).max(240),
  startedAt: Timestamp, finishedAt: Timestamp, outcome: z.enum(['succeeded', 'failed', 'cancelled']),
  inputTokens: z.number().int().nonnegative().nullable(), outputTokens: z.number().int().nonnegative().nullable(),
  costMicros: z.number().int().nonnegative().safe().nullable(), currency: z.string().regex(/^[A-Z]{3}$/),
  costStatus: z.enum(['actual', 'estimated', 'unknown']),
}).strict().superRefine((v, ctx) => {
  if (Date.parse(v.finishedAt) < Date.parse(v.startedAt)) ctx.addIssue({ code: 'custom', message: 'Intervalo inválido' });
  if ((v.costStatus === 'unknown') !== (v.costMicros === null)) ctx.addIssue({ code: 'custom', message: 'Costo desconocido debe ser null' });
});
export const AuditRecord = z.object({
  schemaVersion: z.literal(1), id: Id, occurredAt: Timestamp,
  runId: Id, correlationId: Id, principal: Principal, resource: Resource,
  operation: Operation, outcome: z.enum(['allowed', 'denied', 'succeeded', 'failed']),
  grantIds: z.array(Id), approvalId: Id.nullable(), actionDigest: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
  inputReferences: z.array(Text), reason: Text,
}).strict();
