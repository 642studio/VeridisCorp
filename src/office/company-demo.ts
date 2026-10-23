import { createOrder } from './contracts.js';
import type { OfficeIntelligence } from './runtime-contracts.js';

export function createCompanyDemoOrder() {
  return createOrder({
    id: 'DEMO-COMPANY-001', workspaceId: '642-studio',
    objective: '[SIMULACIÓN] Preparar un plan técnico, de costos y de entrega para una herramienta interna.',
    criteria: [{ id: 'launch-plan', description: 'Plan conjunto revisado que incorpora las tres áreas.' }],
    limits: { maxTasks: 10, maxSteps: 80, maxRevisionsPerTask: 2 },
  });
}

export function createCompanyDemoIntelligence(): OfficeIntelligence {
  return {
    async coordinate({ order, organization }) {
      if (!order.tasks.some((t) => t.id === 'technical-plan')) return {
        type: 'delegate', managerId: 'cto', request: 'Propón el diseño técnico simulado.', dependsOn: [],
      };
      if (!order.tasks.some((t) => t.id === 'cost-plan')) return {
        type: 'delegate', managerId: 'cfo', request: 'Propón una estructura de costos ficticia, sin cifras reales.', dependsOn: ['technical-plan'],
      };
      if (!order.tasks.some((t) => t.id === 'delivery-plan')) return {
        type: 'delegate', managerId: 'pm', request: 'Integra un plan de entrega con los insumos anteriores.', dependsOn: ['technical-plan', 'cost-plan'],
      };
      const review = order.tasks.find((t) => t.status === 'in_review');
      if (review) return { type: 'review', taskId: review.id,
        reviewerId: organization!.departments.find((d) => d.id === review.departmentId)!.reviewerAgentId };
      const ready = order.tasks.find((t) => t.status === 'pending' && t.dependsOn.every((id) => order.tasks.find((d) => d.id === id)?.status === 'completed'));
      if (ready) return { type: 'dispatch', taskId: ready.id };
      if (order.tasks.every((t) => t.status === 'completed')) return { type: 'command', command: {
        type: 'close_order', assessments: [{ criterionId: 'launch-plan', accepted: true,
          evidenceIds: order.tasks.flatMap((t) => t.submission!.evidence.map((e) => e.id)), explanation: 'Tres entregables ficticios revisados.' }],
      } };
      return { type: 'command', command: { type: 'pause_order', reason: 'La simulación requiere intervención.' } };
    },
    async delegate({ manager, dependencies }) {
      const definitions: Record<string, { id: string; agent: string; capability: string }> = {
        cto: { id: 'technical-plan', agent: 'development', capability: 'software.design' },
        cfo: { id: 'cost-plan', agent: 'finance-budget', capability: 'finance.budget' },
        pm: { id: 'delivery-plan', agent: 'project-planner', capability: 'projects.integrate' },
      };
      const target = definitions[manager.id];
      if (!target) throw new Error('Responsable no incluido en esta simulación');
      return { tasks: [{
        id: target.id, title: `[SIMULACIÓN] ${target.id}`, assignedAgentId: target.agent,
        capability: target.capability, dependsOn: dependencies.map((d) => d.id),
        criteria: [{ id: 'proposal', description: 'Propuesta ficticia con insumos y limitaciones declarados.' }],
      }] };
    },
    async execute({ task, agent, dependencies }) {
      return { type: 'result', submission: {
        summary: `[SIMULACIÓN] ${agent.organization!.title}: ${task.title}. Insumos: ${dependencies.map((d) => d.submission!.summary).join(' ')}. No se ejecutaron acciones externas.`,
        evidence: [{ id: `evidence-${task.id}`, kind: 'artifact', reference: `demo://company/${task.id}`, summary: 'Artefacto ficticio para probar colaboración entre departamentos.' }],
      } };
    },
    async review({ task }) {
      return { assessments: task.criteria.map((criterion) => ({
        criterionId: criterion.id, accepted: true, evidenceIds: task.submission!.evidence.map((e) => e.id),
        explanation: 'Entrega ficticia revisada para esta simulación.',
      })) };
    },
  };
}
