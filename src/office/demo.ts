import { createOrder, type Actor, type OfficeCommand, type WorkOrder } from './contracts.js';
import { applyCommand } from './engine.js';
import { officeRegistry } from './registry.js';

export const coordinator: Actor = { role: 'coordinator' };
export const specialist = (agentId: string): Actor => ({ role: 'agent', agentId });

export function runOfficeDemo(): WorkOrder {
  let order = createOrder({
    id: 'DEMO-OFFICE-001', workspaceId: '642-studio',
    objective: '[SIMULACIÓN] Preparar un informe de infraestructura con apoyo de investigación.',
    criteria: [{ id: 'report', description: 'Informe revisado con alcance y evidencias.' }],
    limits: { maxTasks: 10, maxSteps: 50, maxRevisionsPerTask: 2 },
  });
  const send = (actor: Actor, command: OfficeCommand) => {
    order = applyCommand(order, actor, command, officeRegistry);
  };
  send(coordinator, { type: 'add_task', task: {
    id: 'audit', title: 'Preparar informe de infraestructura simulado',
    assignedAgentId: 'network', capability: 'network.audit', dependsOn: [],
    criteria: [{ id: 'scope', description: 'Declarar alcance y evidencia simulada.' }],
  } });
  send(specialist('network'), { type: 'start_task', taskId: 'audit' });
  send(specialist('network'), {
    type: 'request_support', taskId: 'audit', capability: 'news.research',
    question: 'Necesito referencias para contextualizar el informe simulado.',
  });
  send(coordinator, { type: 'add_task', task: {
    id: 'research', title: 'Preparar referencias simuladas',
    assignedAgentId: 'research', capability: 'news.research', dependsOn: [],
    criteria: [{ id: 'sources', description: 'Referencia identificada como simulada.' }],
  } });
  send(coordinator, {
    type: 'resolve_block', taskId: 'audit', dependsOn: ['research'],
    resolution: 'Esperar el resultado revisado de investigación antes de continuar.',
  });
  send(specialist('research'), { type: 'start_task', taskId: 'research' });
  send(specialist('research'), { type: 'submit_result', taskId: 'research', submission: {
    summary: 'Referencia de demostración; no se consultó internet.',
    evidence: [{ id: 'research-source', kind: 'source', reference: 'demo://research/reference', summary: 'Fuente ficticia para probar el intercambio.' }],
  } });
  send(specialist('review'), { type: 'review_task', taskId: 'research', assessments: [
    { criterionId: 'sources', accepted: true, evidenceIds: ['research-source'], explanation: 'Referencia correctamente marcada como simulada.' },
  ] });
  send(specialist('network'), { type: 'start_task', taskId: 'audit' });
  send(specialist('network'), { type: 'submit_result', taskId: 'audit', submission: {
    summary: 'Borrador simulado que todavía no declara su alcance.',
    evidence: [{ id: 'audit-draft', kind: 'artifact', reference: 'demo://audit/draft', summary: 'Borrador incompleto.' }],
  } });
  send(specialist('review'), { type: 'review_task', taskId: 'audit', assessments: [
    { criterionId: 'scope', accepted: false, evidenceIds: ['audit-draft'], explanation: 'Falta declarar alcance y explicar que no hubo auditoría real.' },
  ] });
  send(specialist('network'), { type: 'start_task', taskId: 'audit' });
  send(specialist('network'), { type: 'submit_result', taskId: 'audit', submission: {
    summary: 'Informe de simulación corregido: no se realizaron conexiones ni auditorías. Incorpora demo://research/reference.',
    evidence: [{ id: 'audit-final', kind: 'artifact', reference: 'demo://audit/final', summary: 'Artefacto ficticio con alcance declarado y referencia de investigación.' }],
  } });
  send(specialist('review'), { type: 'review_task', taskId: 'audit', assessments: [
    { criterionId: 'scope', accepted: true, evidenceIds: ['audit-final'], explanation: 'La simulación declara alcance y limitaciones.' },
  ] });
  send(coordinator, { type: 'close_order', assessments: [
    { criterionId: 'report', accepted: true, evidenceIds: ['audit-final', 'research-source'], explanation: 'Los dos entregables simulados pasaron revisión.' },
  ] });
  return order;
}
