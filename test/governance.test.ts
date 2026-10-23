import { test } from 'node:test';
import assert from 'node:assert/strict';
import { authorize, authorizeDelegation } from '../src/governance/authorization.js';
import { actionDigest, authorizeAction, decideApproval, requestApproval } from '../src/governance/approvals.js';
import { transitionHumanTask } from '../src/governance/human-tasks.js';
import { AccessScope, ActionRequest, HumanTask, UsageRecord, type ExecutionContext, type PermissionGrant, type Principal, type Operation } from '../src/governance/contracts.js';
import { ArtifactVersion, BusinessEvent, CorporateDecision, CredentialBinding, type CapabilityDefinition, type ResourceAccessLink } from '../src/governance/enterprise-contracts.js';
import { CapabilityCatalog } from '../src/governance/capabilities.js';
import { officeRegistry } from '../src/office/registry.js';

const now = new Date('2026-10-23T12:00:00Z');
const validFrom = '2026-10-23T11:00:00Z';
const expiresAt = '2026-10-23T13:00:00Z';
const scope = { workspaceId: '642', companyId: 'studio', divisionId: 'creative', clientId: 'client-a', projectId: 'project-a' };
const agent: Principal = { kind: 'agent', id: 'pm' };
const human: Principal = { kind: 'human', id: 'adrian' };
const context = (principal = agent): ExecutionContext => ({ schemaVersion: 1, runId: 'run-1', correlationId: 'cor-1', principal, scope });
const resource = { type: 'artifact', id: 'piece', scope };
function grant(principal = agent, operations: Operation[] = ['content.publish']): PermissionGrant {
  return { id: 'g-' + principal.kind, principal, scope, operations, resourceType: 'artifact', resourceIds: ['piece'], validFrom, expiresAt };
}
function action(): ActionRequest {
  return { schemaVersion: 1, id: 'publish-1', version: 1, requestedBy: agent, operation: 'content.publish', resource,
    input: { text: 'Propuesta', artifactVersion: 1, contentHash: 'a'.repeat(64) }, idempotencyKey: 'publish-piece-v1', expiresAt };
}
const approverGrant = () => grant(human, ['approval.decide', 'content.publish']);
function approved() {
  const request = requestApproval({ id: 'approval-1', action: action(), approver: human, expiresAt }, now);
  return decideApproval(request, action(), context(human), 'approved', 'Versión revisada', [approverGrant()], now);
}

test('autoriza por identidad, recurso, vigencia y alcance exacto; un null no es comodín', () => {
  assert(authorize(context(), 'content.publish', resource, [grant()], now).allowed);
  assert(!authorize(context(human), 'content.publish', resource, [grant()], now).allowed);
  assert(!authorize(context(), 'data.read', resource, [grant()], now).allowed);
  assert(!authorize(context(), 'content.publish', { ...resource, id: 'other' }, [grant()], now).allowed);
  assert(!authorize(context(), 'content.publish', resource, [grant()], new Date(expiresAt)).allowed);
  for (const field of ['workspaceId', 'companyId', 'divisionId', 'clientId', 'projectId'] as const) {
    assert(!authorize(context(), 'content.publish', { ...resource, scope: { ...scope, [field]: 'other' } }, [grant()], now).allowed);
  }
  assert(!authorize({ ...context(), scope: { ...scope, clientId: null } }, 'content.publish', resource, [grant()], now).allowed);
  assert(!AccessScope.safeParse({ workspaceId: '642', companyId: 'studio' }).success);
});

test('el PM puede encargar a otra área únicamente con permiso y capacidad real', () => {
  const request = { context: context(), assigneeAgentId: 'content', capability: 'content.draft' };
  const assignment = { ...grant(), resourceType: 'agent', resourceIds: ['content'], operations: ['task.assign' as const] };
  assert(!authorizeDelegation(request, [], (id) => officeRegistry.get(id), now).allowed);
  assert(authorizeDelegation(request, [assignment], (id) => officeRegistry.get(id), now).allowed);
  assert(!authorizeDelegation({ ...request, capability: 'finance.budget' }, [assignment], (id) => officeRegistry.get(id), now).allowed);
  assert(!officeRegistry.organization!.canDelegate('pm', 'content'));
});

test('compartir un recurso requiere relación activa, vínculo explícito y permiso del actor', () => {
  const shared = { ...resource, scope: { ...scope, divisionId: 'media' } };
  const link: ResourceAccessLink = { id: 'link', relationshipId: 'relation', contextScope: scope, resource: shared,
    operations: ['data.read'], validFrom, expiresAt };
  const relationship = { schemaVersion: 1, id: 'relation', workspaceId: '642',
    from: { type: 'client', id: 'client-a' }, to: { type: 'division', id: 'media' },
    relation: 'served_by', status: 'active', validFrom, expiresAt: null };
  const permission = { ...grant(agent, ['data.read']), scope: shared.scope };
  assert(!authorize(context(), 'data.read', shared, [permission], now).allowed);
  assert(!authorize(context(), 'data.read', shared, [permission], now, [link]).allowed);
  assert(!authorize(context(), 'data.read', shared, [], now, [link], [relationship]).allowed);
  assert(authorize(context(), 'data.read', shared, [permission], now, [link], [relationship]).allowed);
  assert(!authorize(context(), 'data.read', shared, [permission], now, [link], [{ ...relationship, status: 'revoked' }]).allowed);
});

test('la publicación requiere permiso del ejecutor y aprobación humana vigente', () => {
  assert(!authorizeAction(context(), action(), [grant()], undefined, now).allowed);
  assert(authorizeAction(context(), action(), [grant(), approverGrant()], approved(), now).allowed);
  assert(!authorizeAction(context(), action(), [approverGrant()], approved(), now).allowed);
  assert(!authorizeAction(context(), action(), [grant()], approved(), now).allowed);
  assert(!authorizeAction(context(human), action(), [grant(), approverGrant()], approved(), now).allowed);
});

test('los borradores necesitan permisos aunque no exijan aprobación humana', () => {
  const draft = { ...action(), operation: 'draft.create' as const };
  assert(!authorizeAction(context(), draft, [], undefined, now).allowed);
  assert(authorizeAction(context(), draft, [grant(agent, ['draft.create'])], undefined, now).allowed);
});

test('cambiar contenido, destino, versión o idempotencia invalida solo la acción modificada', () => {
  const approval = approved();
  const grants = [grant(), approverGrant()];
  for (const changed of [
    { ...action(), input: { text: 'Cambio solicitado' } },
    { ...action(), version: 2 }, { ...action(), idempotencyKey: 'other' },
    { ...action(), resource: { ...resource, id: 'other' } },
  ]) {
    assert.notEqual(actionDigest(changed), actionDigest(action()));
    // Un destino sin permiso puede rechazarse antes de inspeccionar la aprobación.
    if (changed.resource.id === 'piece') assert.throws(() => authorizeAction(context(), changed, grants, approval, now), /no corresponde/);
    else assert(!authorizeAction(context(), changed, grants, approval, now).allowed);
  }
  assert(authorizeAction(context(), action(), grants, approval, now).allowed);
  assert.equal(actionDigest({ ...action(), input: { contentHash: 'a'.repeat(64), artifactVersion: 1, text: 'Propuesta' } }), actionDigest(action()));
});

test('solo el aprobador humano con permisos puede decidir y revocar', () => {
  const request = requestApproval({ id: 'approval-1', action: action(), approver: human, expiresAt }, now);
  assert.throws(() => decideApproval(request, action(), context(), 'approved', 'No', [grant()], now), /humano/);
  assert.throws(() => decideApproval(request, action(), context(human), 'approved', 'Sí', [], now), /permiso/);
  const revoked = decideApproval(approved(), action(), context(human), 'revoked', 'Requisitos modificados', [approverGrant()], now);
  assert(!authorizeAction(context(), action(), [grant(), approverGrant()], revoked, now).allowed);
  assert.throws(() => decideApproval(revoked, action(), context(human), 'approved', 'Reusar', [approverGrant()], now), /Transición/);
  assert.throws(() => authorizeAction(context(), action(), [grant(), approverGrant()], approved(), new Date(expiresAt)), /vencida/);
});

function humanTask(): HumanTask {
  return { schemaVersion: 1, id: 'human-task', scope, title: 'Revisar diseño', coordinatorAgentId: 'pm',
    assigneeHumanId: 'employee-1', approverHumanId: 'adrian',
    criteria: [{ id: 'delivery', description: 'Archivo revisado' }], dependsOn: [], dueAt: expiresAt,
    timeZone: 'America/Hermosillo', status: 'proposed', revision: 0, evidence: [] };
}
function taskGrant(principal: Principal): PermissionGrant {
  return { ...grant(principal, ['task.assign', 'data.write']), resourceType: 'human-task', resourceIds: ['human-task'] };
}

test('el ciclo humano exige aceptación del empleado y cierre del responsable con evidencia', () => {
  const employee: Principal = { kind: 'human', id: 'employee-1' };
  const move = (task: HumanTask, principal: Principal, to: HumanTask['status'], extra = {}) => transitionHumanTask(task,
    context(principal), { to, expectedRevision: task.revision, ...extra }, [taskGrant(principal)], [], now);
  const proposed = humanTask();
  const pending = move(proposed, agent, 'awaiting_acceptance');
  assert.equal(proposed.status, 'proposed');
  assert.throws(() => move(pending, agent, 'accepted'), /persona asignada/);
  const running = move(move(pending, employee, 'accepted'), employee, 'in_progress');
  const awaiting = move(running, employee, 'awaiting_validation', { evidence: [{ id: 'file', kind: 'artifact', reference: 'artifact://piece/1', summary: 'Diseño' }] });
  assert.throws(() => move(awaiting, agent, 'completed'), /validación humana/);
  assert.throws(() => move(awaiting, human, 'completed'), /criterios/);
  const completed = move(awaiting, human, 'completed', { assessments: [{ criterionId: 'delivery', accepted: true, evidenceIds: ['file'], explanation: 'Revisado' }] });
  assert.equal(completed.status, 'completed');
  assert.equal(completed.validation!.validatedByHumanId, human.id);
  assert.throws(() => move(completed, human, 'cancelled'), /Transición/);
});

test('tareas humanas rechazan revisiones obsoletas, dependencias pendientes y zonas inválidas', () => {
  const task = { ...humanTask(), status: 'accepted' as const, dependsOn: ['other'] };
  const employee: Principal = { kind: 'human', id: 'employee-1' };
  assert.throws(() => transitionHumanTask(task, context(employee), { to: 'in_progress', expectedRevision: 1 }, [taskGrant(employee)], [], now), /revisión/);
  assert.throws(() => transitionHumanTask(task, context(employee), { to: 'in_progress', expectedRevision: 0 }, [taskGrant(employee)], [], now), /Dependencias/);
  assert(!HumanTask.safeParse({ ...task, timeZone: 'Invented/Zone' }).success);
});

test('un catálogo de capacidades admite distintos especialistas sin conceder permisos', () => {
  const capability: CapabilityDefinition = { schemaVersion: 1, id: 'generate_video_script', version: 1, description: 'Preparar guion',
    inputSchema: { type: 'object', properties: { brief: { type: 'string' } }, required: ['brief'], additionalProperties: false },
    outputSchema: { type: 'object', properties: { script: { type: 'string' } }, required: ['script'], additionalProperties: false },
    prerequisites: [], requiredTools: [], risks: ['Afirmaciones sin fuente'], successCriteria: ['Respeta el brief'], modalities: ['text'] };
  const binding = { agentId: 'content', capabilityId: capability.id, capabilityVersion: 1, specialization: 'general' as const, enabled: true };
  const catalog = new CapabilityCatalog([capability], [binding, { ...binding, agentId: 'creative-strategy', specialization: 'expert' }]);
  assert.equal(catalog.candidates(capability.id, 1).length, 2);
  const copy = catalog.get(capability.id, 1); copy.successCriteria.length = 0;
  assert.equal(catalog.get(capability.id, 1).successCriteria.length, 1);
  assert.throws(() => new CapabilityCatalog([], [binding]), /inexistente/);
});

test('el costo desconocido permanece null incluso en intentos fallidos', () => {
  const usage = { schemaVersion: 1, id: 'usage', runId: 'run', taskId: 'task', attemptId: 'attempt', scope,
    agentId: 'content', departmentId: 'marketing', kind: 'model', provider: 'test', modelOrTool: 'model',
    startedAt: validFrom, finishedAt: expiresAt, outcome: 'failed', inputTokens: null, outputTokens: null,
    costMicros: null, currency: 'MXN', costStatus: 'unknown' };
  assert(UsageRecord.safeParse(usage).success);
  assert(!UsageRecord.safeParse({ ...usage, costMicros: 0 }).success);
  assert(!UsageRecord.safeParse({ ...usage, costStatus: 'actual' }).success);
});

test('los nuevos contratos exigen procedencia operativa y no aceptan secretos como campos extra', () => {
  const event = { schemaVersion: 1, id: 'event', type: 'client.feedback_received', scope, source: human,
    occurredAt: validFrom, receivedAt: now.toISOString(), correlationId: 'cor', causationId: null,
    deduplicationKey: 'feedback-1', subject: { type: 'client', id: 'client-a' }, payload: {}, trust: 'external_untrusted' };
  assert(BusinessEvent.safeParse(event).success);
  assert(!BusinessEvent.safeParse({ ...event, type: 'feedback' }).success);
  const artifact = { schemaVersion: 1, artifactId: 'piece', version: 1, scope, owner: agent, kind: 'image', status: 'approved',
    storageReference: 'artifact://piece/1', contentHash: 'a'.repeat(64), mediaType: 'image/png', createdAt: validFrom,
    taskIds: ['task'], sourceVersionRefs: [], approvalIds: [] };
  assert(!ArtifactVersion.safeParse(artifact).success);
  assert(ArtifactVersion.safeParse({ ...artifact, approvalIds: ['approval'] }).success);
  const decision = { schemaVersion: 1, id: 'decision', version: 1, scope, owner: human, rationale: 'Precio acordado',
    alternatives: [], affectedEntities: [{ type: 'product', id: 'crm' }], decidedAt: validFrom, effectiveFrom: validFrom,
    expiresAt: null, status: 'approved', approvalId: null, supersedesDecisionId: null };
  assert(!CorporateDecision.safeParse(decision).success);
  const binding = { schemaVersion: 1, id: 'credential', workspaceId: '642', companyId: 'studio', connectorId: 'provider',
    servicePrincipal: { kind: 'service', id: 'publisher' }, vaultReference: 'vault://publisher', providerAccountId: 'account',
    allowedOperations: ['content.publish'], providerScopes: ['publish'], status: 'active', rotatedAt: validFrom, expiresAt: null };
  assert(CredentialBinding.safeParse(binding).success);
  assert(!CredentialBinding.safeParse({ ...binding, apiKey: 'not-a-real-secret' }).success);
});

test('una interrupción tras el envío consulta o concilia antes de repetir', async () => {
  const { planExternalRecovery } = await import('../src/governance/recovery.js');
  const operation = { schemaVersion: 1 as const, id: 'op', runId: 'run', actionId: action().id, actionDigest: actionDigest(action()),
    scope, idempotencyKey: action().idempotencyKey, connectorId: 'task-manager', credentialBindingId: 'credential',
    status: 'outcome_unknown' as const, externalReference: null,
    recovery: { strategy: 'query_before_retry' as const, compensation: 'supported' as const, compensationOperationId: null }, updatedAt: now.toISOString() };
  assert.equal(planExternalRecovery(operation, { kind: 'not_checked' }).next, 'query_provider');
  assert.equal(planExternalRecovery(operation, { kind: 'unknown' }).next, 'manual_reconciliation');
  assert.deepEqual(planExternalRecovery(operation, { kind: 'confirmed', externalReference: 'task-42' }), { next: 'keep_confirmed', externalReference: 'task-42' });
  assert.equal(planExternalRecovery({ ...operation, recovery: { ...operation.recovery, strategy: 'provider_idempotency' } }, { kind: 'not_checked' }).next, 'retry_same_key');
});
