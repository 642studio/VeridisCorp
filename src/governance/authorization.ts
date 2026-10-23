import { EntityRelationship, ResourceAccessLink } from './enterprise-contracts.js';
import {
  AccessScope, DelegationRequest, ExecutionContext, PermissionGrant, Resource,
  type Operation, type Principal,
} from './contracts.js';

type Authorization = { allowed: boolean; grantIds: string[]; reason: string };
export function samePrincipal(a: Principal, b: Principal): boolean { return a.kind === b.kind && a.id === b.id; }
export function sameScope(a: AccessScope, b: AccessScope): boolean {
  return a.workspaceId === b.workspaceId && a.companyId === b.companyId && a.divisionId === b.divisionId
    && a.clientId === b.clientId && a.projectId === b.projectId;
}
export function trustedTime(now: Date): number {
  if (!Number.isFinite(now.getTime())) throw new Error('Reloj inválido');
  return now.getTime();
}

// El transporte autenticado y el repositorio de permisos son las fuentes de contexto y grants.
// Ni estos valores ni el reloj deben proceder de una respuesta de modelo.
export function authorize(
  contextInput: ExecutionContext, operation: Operation, resourceInput: Resource,
  grantInputs: PermissionGrant[], now: Date, accessLinks: ResourceAccessLink[] = [], relationships: unknown[] = [],
): Authorization {
  const context = ExecutionContext.parse(contextInput);
  const resource = Resource.parse(resourceInput);
  const time = trustedTime(now);
  const denied = (reason: string): Authorization => ({ allowed: false, grantIds: [], reason });
  const activeRelationships = relationships.map((v) => EntityRelationship.parse(v)).filter((v) =>
    v.status === 'active' && v.workspaceId === context.scope.workspaceId && Date.parse(v.validFrom) <= time
    && (v.expiresAt === null || time < Date.parse(v.expiresAt)));
  const sharing = accessLinks.map((v) => ResourceAccessLink.parse(v)).some((link) =>
    activeRelationships.some((r) => r.id === link.relationshipId) && sameScope(link.contextScope, context.scope) && sameScope(link.resource.scope, resource.scope)
    && link.resource.id === resource.id && link.resource.type === resource.type && link.operations.includes(operation)
    && Date.parse(link.validFrom) <= time && time < Date.parse(link.expiresAt));
  if (!sameScope(context.scope, resource.scope) && !sharing) return denied('Recurso fuera del contexto autorizado');
  const grants = grantInputs.map((v) => PermissionGrant.parse(v)).filter((g) =>
    samePrincipal(g.principal, context.principal) && sameScope(g.scope, resource.scope)
    && g.operations.includes(operation) && g.resourceType === resource.type && g.resourceIds.includes(resource.id)
    && Date.parse(g.validFrom) <= time && time < Date.parse(g.expiresAt));
  if (!grants.length) return denied('No existe un permiso vigente para esta acción y recurso');
  return { allowed: true, grantIds: grants.map((g) => g.id), reason: 'Permiso explícito vigente' };
}

export function authorizeDelegation(
  input: DelegationRequest, grants: PermissionGrant[],
  getAgent: (id: string) => { capabilities: string[] }, now: Date,
): Authorization {
  const request = DelegationRequest.parse(input);
  const decision = authorize(request.context, 'task.assign', {
    type: 'agent', id: request.assigneeAgentId, scope: request.context.scope,
  }, grants, now);
  if (!decision.allowed) return decision;
  const agent = getAgent(request.assigneeAgentId);
  if (!agent.capabilities.includes(request.capability)) return { allowed: false, grantIds: [], reason: 'El agente carece de la capacidad requerida' };
  // Encargar una tarea no concede al ejecutor acceso a datos ni permisos para sus herramientas.
  return decision;
}
