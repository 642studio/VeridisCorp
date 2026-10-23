import { z } from 'zod';
import { Id } from '../office/contracts.js';
import { AccessScope, Principal, Resource, Timestamp, Operation } from './contracts.js';

const Text = z.string().trim().min(1).max(16000);
const Hash = z.string().regex(/^[a-f0-9]{64}$/);
const Version = z.number().int().positive();
export const EntityRef = z.object({
  type: z.enum(['company', 'division', 'client', 'brand', 'project', 'product', 'person', 'resource']), id: Id,
}).strict();
// Las entidades tienen identidad corporativa estable; las relaciones no duplican su historial.
export const EntityRelationship = z.object({
  schemaVersion: z.literal(1), id: Id, workspaceId: Id,
  from: EntityRef, to: EntityRef,
  relation: z.enum(['belongs_to', 'served_by', 'participates_in', 'subscribes_to', 'shares_resource']),
  status: z.enum(['active', 'revoked']), validFrom: Timestamp, expiresAt: Timestamp.nullable(),
}).strict().refine((v) => v.expiresAt === null || Date.parse(v.validFrom) < Date.parse(v.expiresAt), 'Vigencia inválida');

// La relación comercial es independiente del permiso para acceder a un recurso compartido.
export const ResourceAccessLink = z.object({
  id: Id, relationshipId: Id, contextScope: AccessScope, resource: Resource,
  operations: z.array(Operation).min(1), validFrom: Timestamp, expiresAt: Timestamp,
}).strict().refine((v) => v.contextScope.workspaceId === v.resource.scope.workspaceId, 'No se comparte entre workspaces')
  .refine((v) => Date.parse(v.validFrom) < Date.parse(v.expiresAt), 'Vigencia inválida');
export type ResourceAccessLink = z.infer<typeof ResourceAccessLink>;

const JsonSchema = z.object({
  type: z.literal('object'), properties: z.record(z.string(), z.json()),
  required: z.array(z.string()), additionalProperties: z.literal(false),
}).strict().refine((v) => new Set(v.required).size === v.required.length && v.required.every((key) => key in v.properties), 'Campos requeridos inválidos');
export const CapabilityDefinition = z.object({
  schemaVersion: z.literal(1), id: Id, version: Version, description: Text,
  inputSchema: JsonSchema, outputSchema: JsonSchema,
  prerequisites: z.array(Id), requiredTools: z.array(Id),
  risks: z.array(Text), successCriteria: z.array(Text).min(1),
  modalities: z.array(z.enum(['text', 'image', 'audio', 'video', 'structured'])).min(1),
}).strict();
export type CapabilityDefinition = z.infer<typeof CapabilityDefinition>;
export const CapabilityBinding = z.object({
  agentId: Id, capabilityId: Id, capabilityVersion: Version,
  specialization: z.enum(['general', 'specialist', 'expert']), enabled: z.boolean(),
}).strict();
export type CapabilityBinding = z.infer<typeof CapabilityBinding>;

export const BusinessEvent = z.object({
  schemaVersion: z.literal(1), id: Id, type: z.string().regex(/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/),
  scope: AccessScope, source: Principal, occurredAt: Timestamp, receivedAt: Timestamp,
  correlationId: Id, causationId: Id.nullable(), deduplicationKey: Id,
  subject: EntityRef, payload: z.record(z.string(), z.json()),
  trust: z.enum(['external_untrusted', 'internal_verified']),
}).strict();

export const CorporateDecision = z.object({
  schemaVersion: z.literal(1), id: Id, version: Version, scope: AccessScope,
  owner: Principal.refine((v) => v.kind === 'human', 'La decisión formal requiere un responsable humano'),
  rationale: Text, alternatives: z.array(Text), affectedEntities: z.array(EntityRef).min(1),
  decidedAt: Timestamp, effectiveFrom: Timestamp, expiresAt: Timestamp.nullable(),
  status: z.enum(['proposed', 'approved', 'rejected', 'superseded', 'revoked']),
  approvalId: Id.nullable(), supersedesDecisionId: Id.nullable(),
}).strict().refine((v) => !['approved', 'superseded'].includes(v.status) || v.approvalId !== null, 'Falta referencia de aprobación')
  .refine((v) => v.expiresAt === null || Date.parse(v.effectiveFrom) < Date.parse(v.expiresAt), 'Vigencia inválida');

export const ArtifactVersion = z.object({
  schemaVersion: z.literal(1), artifactId: Id, version: Version, scope: AccessScope,
  owner: Principal, kind: z.enum(['brief', 'proposal', 'contract', 'script', 'image', 'audio', 'video', 'report', 'deliverable']),
  status: z.enum(['draft', 'in_review', 'approved', 'delivered', 'superseded']),
  storageReference: Text, contentHash: Hash, mediaType: Text,
  createdAt: Timestamp, taskIds: z.array(Id).min(1), sourceVersionRefs: z.array(Id), approvalIds: z.array(Id),
}).strict().refine((v) => !['approved', 'delivered'].includes(v.status) || v.approvalIds.length > 0, 'Falta referencia de aprobación');

export const ExternalOperation = z.object({
  schemaVersion: z.literal(1), id: Id, runId: Id, actionId: Id, actionDigest: Hash, scope: AccessScope,
  idempotencyKey: Id, connectorId: Id, credentialBindingId: Id,
  status: z.enum(['prepared', 'dispatching', 'confirmed', 'outcome_unknown', 'failed', 'compensation_pending', 'compensated', 'manual_reconciliation']),
  externalReference: Text.nullable(),
  recovery: z.object({
    strategy: z.enum(['query_before_retry', 'provider_idempotency', 'manual']),
    compensation: z.enum(['none', 'supported', 'manual']), compensationOperationId: Id.nullable(),
  }).strict(),
  updatedAt: Timestamp,
}).strict();

export const BusinessOutcome = z.object({
  schemaVersion: z.literal(1), id: Id, runId: Id, workflowId: Id, scope: AccessScope,
  metric: z.enum(['time_saved', 'revenue', 'project_margin', 'on_time_delivery', 'rework', 'customer_satisfaction']),
  value: z.number().finite(), unit: Text, periodStart: Timestamp, periodEnd: Timestamp,
  baseline: z.number().finite().nullable(), method: Text, evidenceReferences: z.array(Text).min(1),
  attribution: z.enum(['observed', 'estimated', 'experiment']), recordedAt: Timestamp,
}).strict().refine((v) => Date.parse(v.periodStart) <= Date.parse(v.periodEnd), 'Periodo inválido');

// Solo referencias: la credencial nunca forma parte del contexto de agentes ni del checkpoint.
export const CredentialBinding = z.object({
  schemaVersion: z.literal(1), id: Id, workspaceId: Id, companyId: Id,
  connectorId: Id, servicePrincipal: Principal.refine((v) => v.kind === 'service', 'Se requiere identidad de servicio'),
  vaultReference: z.string().regex(/^vault:\/\/[^\s]+$/), providerAccountId: Id, allowedOperations: z.array(Operation).min(1),
  providerScopes: z.array(Text), status: z.enum(['active', 'revoked', 'rotation_required']),
  rotatedAt: Timestamp, expiresAt: Timestamp.nullable(),
}).strict();
