import { createOrder } from './contracts.js';
import type { OfficeIntelligence, CoordinatorContext } from './runtime-contracts.js';

export function createDemoOrder() {
  return createOrder({
    id: 'DEMO-WORKFLOW-001', workspaceId: '642-studio',
    objective: '[SIMULACIÓN] Informe de infraestructura con apoyo de investigación.',
    criteria: [{ id: 'report', description: 'Informe simulado revisado con alcance declarado.' }],
    limits: { maxTasks: 10, maxSteps: 50, maxRevisionsPerTask: 2 },
  });
}

// Decide a partir del expediente; no usa un cursor externo ni una lista de comandos.
export function createDemoOfficeIntelligence(options: { askFirst?: boolean } = {}): OfficeIntelligence {
  const decide = (context: CoordinatorContext) => {
    const tasks = context.order.tasks;
    if (options.askFirst && context.exchanges.length === 0) {
      return { type: 'ask_user', question: '¿Qué nombre debe llevar este informe de simulación?' };
    }
    if (!tasks.length) return { type: 'command', command: { type: 'add_task', task: {
      id: 'audit', title: 'Preparar un informe simulado', assignedAgentId: 'network', capability: 'network.audit', dependsOn: [],
      criteria: [{ id: 'scope', description: 'Declarar alcance y limitaciones de la simulación.' }],
    } } };
    const blocked = tasks.find((t) => t.status === 'blocked');
    if (blocked && !tasks.some((t) => t.id === 'research')) return { type: 'command', command: { type: 'add_task', task: {
      id: 'research', title: 'Aportar contexto simulado', assignedAgentId: 'research', capability: 'news.research', dependsOn: [],
      criteria: [{ id: 'sources', description: 'Identificar el contexto como ficticio.' }],
    } } };
    if (blocked) return { type: 'command', command: {
      type: 'resolve_block', taskId: blocked.id, dependsOn: ['research'], resolution: 'Esperar investigación revisada.',
    } };
    const review = tasks.find((t) => t.status === 'in_review');
    if (review) return { type: 'review', taskId: review.id, reviewerId: 'review' };
    const ready = tasks.find((t) => t.status === 'pending' && t.dependsOn.every((id) => tasks.find((d) => d.id === id)?.status === 'completed'));
    if (ready) return { type: 'dispatch', taskId: ready.id };
    if (tasks.every((t) => t.status === 'completed')) return { type: 'command', command: {
      type: 'close_order', assessments: [{ criterionId: 'report', accepted: true,
        evidenceIds: tasks.flatMap((t) => t.submission!.evidence.map((e) => e.id)), explanation: 'Entregables ficticios revisados.' }],
    } };
    return { type: 'command', command: { type: 'pause_order', reason: 'La simulación necesita intervención.' } };
  };
  return {
    async coordinate(context) { return decide(context); },
    async execute({ task, dependencies, exchanges }) {
      if (task.id === 'audit' && !dependencies.length) {
        return { type: 'support', capability: 'news.research', question: 'Necesito contexto simulado de investigación.' };
      }
      return { type: 'result', submission: {
        summary: `[SIMULACIÓN SIN IA] ${task.id}; corrección ${task.revisions}; apoyo recibido: ${dependencies.map((d) => d.submission!.summary).join(' ')}; información humana: ${exchanges.map((e) => e.answer).join(' ')}`,
        evidence: [{ id: `${task.id}-v${task.revisions}`, kind: 'artifact',
          reference: `demo://${task.id}/v${task.revisions}`, summary: 'Evidencia ficticia, sin consultas ni auditorías reales.' }],
      } };
    },
    async review({ task }) {
      const accepted = task.id !== 'audit' || task.revisions > 0;
      return { assessments: task.criteria.map((criterion) => ({
        criterionId: criterion.id, accepted,
        evidenceIds: task.submission!.evidence.map((e) => e.id),
        explanation: accepted ? 'Entrega simulada aceptada.' : 'Primera entrega: solicita corrección del alcance.',
      })) };
    },
  };
}
