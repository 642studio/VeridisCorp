import { createHash } from 'node:crypto';
import { ActionRequest, ApprovalRecord, type ExecutionContext, type PermissionGrant, type Principal } from './contracts.js';
import { authorize, samePrincipal, sameScope, trustedTime } from './authorization.js';

function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value !== null && typeof value === 'object') {
    return '{' + Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
      .map(([key, val]) => JSON.stringify(key) + ':' + canonical(val)).join(',') + '}';
  }
  return JSON.stringify(value);
}
export function actionDigest(input: ActionRequest): string {
  return createHash('sha256').update(canonical(ActionRequest.parse(input))).digest('hex');
}
function currentAction(input: ActionRequest, now: Date): ActionRequest {
  const action = ActionRequest.parse(input);
  if (trustedTime(now) >= Date.parse(action.expiresAt)) throw new Error('Acción vencida');
  return action;
}
function boundApproval(input: ApprovalRecord, action: ActionRequest, now: Date): ApprovalRecord {
  const record = ApprovalRecord.parse(input);
  const time = trustedTime(now);
  if (record.actionId !== action.id || record.actionDigest !== actionDigest(action) || !sameScope(record.scope, action.resource.scope)) {
    throw new Error('La aprobación no corresponde a esta acción y versión');
  }
  if (time < Date.parse(record.createdAt) || time >= Date.parse(record.expiresAt)) throw new Error('Aprobación fuera de vigencia');
  return record;
}
export function requestApproval(input: {
  id: string; action: ActionRequest; approver: Principal; expiresAt: string;
}, now: Date): ApprovalRecord {
  const action = currentAction(input.action, now);
  if (Date.parse(input.expiresAt) > Date.parse(action.expiresAt)) throw new Error('La aprobación no puede exceder la vigencia de la acción');
  return ApprovalRecord.parse({ schemaVersion: 1, id: input.id, actionId: action.id, actionDigest: actionDigest(action),
    scope: action.resource.scope, approver: input.approver, status: 'pending', createdAt: now.toISOString(), expiresAt: input.expiresAt });
}
export function decideApproval(
  recordInput: ApprovalRecord, actionInput: ActionRequest, context: ExecutionContext,
  decision: 'approved' | 'rejected' | 'revoked', reason: string, grants: PermissionGrant[], now: Date,
): ApprovalRecord {
  const action = currentAction(actionInput, now);
  const record = boundApproval(recordInput, action, now);
  if (context.principal.kind !== 'human' || !samePrincipal(context.principal, record.approver)) throw new Error('Solo el aprobador humano designado puede decidir');
  if (!['approved', 'rejected', 'revoked'].includes(decision)) throw new Error('Decisión inválida');
  if (decision === 'revoked' ? record.status !== 'approved' : record.status !== 'pending') throw new Error('Transición de aprobación inválida');
  const authorization = authorize(context, 'approval.decide', action.resource, grants, now);
  if (!authorization.allowed) throw new Error(authorization.reason);
  // Aprobar exige también autoridad sobre el tipo de acción concreta.
  const authority = authorize(context, action.operation, action.resource, grants, now);
  if (!authority.allowed) throw new Error(authority.reason);
  return ApprovalRecord.parse({ ...record, status: decision, decidedAt: now.toISOString(), reason });
}

// Política conservadora del servicio: un agente no puede rebajar la sensibilidad de su solicitud.
const withoutHumanApproval = new Set(['data.read', 'draft.create', 'task.assign']);
export function authorizeAction(
  context: ExecutionContext, actionInput: ActionRequest, grants: PermissionGrant[],
  approvalInput: ApprovalRecord | undefined, now: Date,
): { allowed: boolean; reason: string; grantIds: string[]; approvalId?: string } {
  const action = currentAction(actionInput, now);
  if (!samePrincipal(context.principal, action.requestedBy)) return { allowed: false, reason: 'Identidad de ejecución distinta del solicitante', grantIds: [] };
  const permission = authorize(context, action.operation, action.resource, grants, now);
  if (!permission.allowed || withoutHumanApproval.has(action.operation)) return permission;
  if (!approvalInput) return { allowed: false, reason: 'Se requiere aprobación humana', grantIds: [] };
  const approval = boundApproval(approvalInput, action, now);
  if (approval.status !== 'approved' || Date.parse(approval.decidedAt!) > trustedTime(now)) return { allowed: false, reason: 'La acción no tiene aprobación vigente', grantIds: [] };
  // Revalidar la autoridad humana permite que una revocación de permisos surta efecto antes de ejecutar.
  const approverContext = { ...context, principal: approval.approver };
  const canApprove = authorize(approverContext, 'approval.decide', action.resource, grants, now);
  const canAct = authorize(approverContext, action.operation, action.resource, grants, now);
  if (!canApprove.allowed || !canAct.allowed) return { allowed: false, reason: 'El aprobador perdió su autorización', grantIds: [] };
  return { ...permission, grantIds: [...new Set([...permission.grantIds, ...canApprove.grantIds, ...canAct.grantIds])], approvalId: approval.id };
}
