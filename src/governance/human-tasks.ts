import { Assessment, Evidence } from '../office/contracts.js';
import { HumanTask, type ExecutionContext, type PermissionGrant } from './contracts.js';
import { authorize, sameScope } from './authorization.js';

type HumanTaskChange = {
  to: HumanTask['status']; expectedRevision: number;
  evidence?: unknown[]; assessments?: unknown[];
};

// Las identidades, dependencias y revisiones se obtienen de repositorios autenticados.
export function transitionHumanTask(
  input: HumanTask, context: ExecutionContext, change: HumanTaskChange,
  grants: PermissionGrant[], completedDependencyIds: string[], now: Date,
): HumanTask {
  const task = HumanTask.parse(input);
  if (!sameScope(context.scope, task.scope)) throw new Error('Tarea fuera del contexto autorizado');
  if (task.revision !== change.expectedRevision) throw new Error('Conflicto de revisión');
  const edges: Record<HumanTask['status'], HumanTask['status'][]> = {
    proposed: ['awaiting_acceptance', 'cancelled'], awaiting_acceptance: ['accepted', 'cancelled'],
    accepted: ['in_progress', 'cancelled'], in_progress: ['blocked', 'awaiting_validation', 'cancelled'],
    blocked: ['in_progress', 'cancelled'], awaiting_validation: ['completed', 'in_progress', 'cancelled'],
    completed: [], cancelled: [],
  };
  if (!edges[task.status].includes(change.to)) throw new Error('Transición de tarea humana inválida');
  const actor = context.principal;
  const assignee = actor.kind === 'human' && actor.id === task.assigneeHumanId;
  const approver = actor.kind === 'human' && actor.id === task.approverHumanId;
  const coordinator = actor.kind === 'agent' && actor.id === task.coordinatorAgentId;
  if (change.to === 'accepted' && !assignee) throw new Error('Solo la persona asignada puede aceptar');
  if (['in_progress', 'blocked', 'awaiting_validation'].includes(change.to) && !assignee && !(approver && task.status === 'awaiting_validation')) {
    throw new Error('Solo la persona asignada puede informar ejecución');
  }
  if (change.to === 'awaiting_acceptance' && !coordinator && !approver) throw new Error('Coordinador no autorizado');
  if (change.to === 'completed' && !approver) throw new Error('El cierre requiere validación humana');
  if (change.to === 'cancelled' && !approver) throw new Error('La cancelación requiere al responsable humano');
  const permission = authorize(context, change.to === 'awaiting_acceptance' ? 'task.assign' : 'data.write', {
    type: 'human-task', id: task.id, scope: task.scope,
  }, grants, now);
  if (!permission.allowed) throw new Error(permission.reason);
  if (change.to === 'in_progress' && task.dependsOn.some((id) => !completedDependencyIds.includes(id))) throw new Error('Dependencias humanas pendientes');
  const evidence = change.evidence === undefined ? task.evidence : change.evidence.map((item) => Evidence.parse(item));
  let validation = task.validation;
  if (change.to === 'completed') {
    const assessments = (change.assessments ?? []).map((item) => Assessment.parse(item));
    if (assessments.length !== task.criteria.length || new Set(assessments.map((a) => a.criterionId)).size !== assessments.length
      || task.criteria.some((c) => !assessments.some((a) => a.criterionId === c.id && a.accepted && a.evidenceIds.length > 0))
      || assessments.some((a) => a.evidenceIds.some((id) => !evidence.some((e) => e.id === id)))) {
      throw new Error('El cierre requiere criterios aceptados con evidencia existente');
    }
    validation = { validatedByHumanId: actor.id, validatedAt: now.toISOString(), assessments };
  }
  return HumanTask.parse({ ...task, status: change.to, revision: task.revision + 1, evidence, validation });
}
