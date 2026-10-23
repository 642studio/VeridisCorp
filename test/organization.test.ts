import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MemorySaver } from '@langchain/langgraph';
import { AgentRegistry, officeRegistry } from '../src/office/registry.js';
import { createOrder } from '../src/office/contracts.js';
import { applyCommand } from '../src/office/engine.js';
import { createOfficeWorkflow } from '../src/office/workflow.js';
import { createCompanyDemoIntelligence, createCompanyDemoOrder } from '../src/office/company-demo.js';
import { DepartmentReply, type DepartmentContext, type CoordinatorContext, type SpecialistContext, type OfficeIntelligence } from '../src/office/runtime-contracts.js';
import { createOfficeIntelligence } from '../src/office/intelligence.js';
import { ModelRouter } from '../src/office/models.js';
import type { StructuredRequest } from '../src/office/model-providers.js';

const cfg = (id: string) => ({ configurable: { thread_id: id }, recursionLimit: 500 });

test('el organigrama conecta departamentos y subdepartamentos con 56 perfiles con el CEO', () => {
  const directory = officeRegistry.organization!;
  assert.equal(directory.executive().id, 'ceo');
  assert.equal(directory.snapshot().departments.length, 13);
  assert.equal(officeRegistry.list().length, 56);
  assert.equal(directory.team('ceo').length, 55);
  assert.deepEqual(directory.team('cm').map((a) => a.id).sort(), ['content', 'social-analyst']);
  assert(directory.canDelegate('cto', 'network'));
  assert(!directory.canDelegate('cto', 'finance-budget'));
  assert(!directory.canDelegate('content', 'social-analyst'));
});

test('rechaza departamentos desconocidos, superiores ausentes y ciclos de reporte', () => {
  const definition = officeRegistry.organization!.snapshot();
  const agents = officeRegistry.list();
  assert.throws(() => new AgentRegistry(agents.map((a) => a.id === 'network'
    ? { ...a, organization: { ...a.organization!, departmentId: 'unknown' } } : a), definition), /Departamento inexistente/);
  assert.throws(() => new AgentRegistry(agents.map((a) => a.id === 'network'
    ? { ...a, organization: { ...a.organization!, reportsToId: 'unknown' } } : a), definition), /no registrado/);
  assert.throws(() => new AgentRegistry(agents.map((a) => a.id === 'software-lead'
    ? { ...a, organization: { ...a.organization!, reportsToId: 'development' } }
    : a.id === 'development' ? { ...a, organization: { ...a.organization!, level: 'manager' } } : a), definition), /Ciclo/);
});

test('un responsable asigna a su equipo y el sistema deriva departamento y responsabilidad', () => {
  const order = createOrder({
    id: 'company', workspaceId: '642-studio', objective: 'Propuesta de costos',
    criteria: [{ id: 'goal', description: 'Propuesta' }], limits: { maxTasks: 10, maxSteps: 50, maxRevisionsPerTask: 1 },
  });
  const command = { type: 'add_task' as const, task: {
    id: 'budget', title: 'Propuesta', assignedAgentId: 'finance-budget', capability: 'finance.budget', dependsOn: [],
    criteria: [{ id: 'proposal', description: 'Propuesta revisada' }],
  } };
  assert.throws(() => applyCommand(order, { role: 'agent', agentId: 'cto' }, command, officeRegistry), /responsable autorizado/);
  const assigned = applyCommand(order, { role: 'agent', agentId: 'cfo' }, command, officeRegistry);
  assert.equal(assigned.tasks[0]!.departmentId, 'finance');
  assert.equal(assigned.tasks[0]!.accountableAgentId, 'cfo');
  assert.equal(order.tasks.length, 0);
});

test('un trabajo cruza CTO, CFO y PM con revisión de cada área', async () => {
  const graph = createOfficeWorkflow(createCompanyDemoIntelligence(), officeRegistry, new MemorySaver());
  const result = await graph.invoke({ order: createCompanyDemoOrder() }, cfg('company-delegation'));
  assert.equal(result.order.status, 'completed');
  assert.deepEqual(result.order.tasks.map((t) => t.departmentId), ['software', 'finance', 'projects']);
  assert.deepEqual(result.order.tasks[2]!.dependsOn, ['technical-plan', 'cost-plan']);
  assert.match(result.order.tasks[2]!.submission!.summary, /Presupuestos/);
  const authors = result.order.events.filter((e) => e.command.type === 'add_task').map((e) => e.actor);
  assert.deepEqual(authors, ['cto', 'cfo', 'pm'].map((agentId) => ({ role: 'agent', agentId })));
});

test('un plan de departamento inválido se rechaza entero sin registrar tareas parciales', async () => {
  const base = createCompanyDemoIntelligence();
  const intelligence: OfficeIntelligence = {
    ...base,
    async delegate(context) {
      const plan = DepartmentReply.parse(await base.delegate!(context));
      return { tasks: [...plan.tasks, { ...plan.tasks[0]!, id: 'outside-team', assignedAgentId: 'finance-budget', capability: 'finance.budget' }] };
    },
  };
  const graph = createOfficeWorkflow(intelligence, officeRegistry, new MemorySaver(), { maxRejectedDecisions: 1 });
  const result = await graph.invoke({ order: createCompanyDemoOrder() }, cfg('company-atomic'));
  assert.equal(result.order.status, 'paused');
  assert.equal(result.order.tasks.length, 0);
  assert.equal(result.order.events.length, 1);
  assert.match(result.lastError!, /responsable autorizado/);
});

test('un especialista no puede convertirse en responsable mediante una decisión del CEO', async () => {
  let delegated = 0;
  const intelligence: OfficeIntelligence = {
    ...createCompanyDemoIntelligence(),
    async coordinate() { return { type: 'delegate', managerId: 'network', request: 'Plan', dependsOn: [] }; },
    async delegate() { delegated += 1; return { tasks: [] }; },
  };
  const graph = createOfficeWorkflow(intelligence, officeRegistry, new MemorySaver(), { maxRejectedDecisions: 1 });
  const result = await graph.invoke({ order: createCompanyDemoOrder() }, cfg('company-manager'));
  assert.equal(result.order.status, 'paused');
  assert.equal(delegated, 0);
});

test('una revisión de otra área se rechaza antes de enviarle el expediente al agente', async () => {
  const base = createCompanyDemoIntelligence();
  const reviews: string[] = [];
  const intelligence: OfficeIntelligence = {
    ...base,
    async coordinate(context) {
      const decision = await base.coordinate(context);
      if (context.order.tasks.some((t) => t.id === 'cost-plan' && t.status === 'in_review')) {
        return { type: 'review', taskId: 'cost-plan', reviewerId: 'software-qa' };
      }
      return decision;
    },
    async review(context) { reviews.push(context.task.id); return base.review(context); },
  };
  const graph = createOfficeWorkflow(intelligence, officeRegistry, new MemorySaver(), { maxRejectedDecisions: 1 });
  const result = await graph.invoke({ order: createCompanyDemoOrder() }, cfg('company-review-scope'));
  assert.equal(result.order.status, 'paused');
  assert(!reviews.includes('cost-plan'));
});

test('cada responsable de departamento usa su propia política de modelos para planificar', async () => {
  const demo = createCompanyDemoIntelligence();
  const calls: StructuredRequest[] = [];
  const router = new ModelRouter({ version: 1, defaultProfile: 'general', profiles: {
    general: { provider: 'openai', model: 'test-general', apiKeyEnv: 'TEST_KEY' },
    finance: { provider: 'anthropic', model: 'test-finance', apiKeyEnv: 'TEST_KEY' },
  }, agents: { cfo: { coordinate: 'finance' } } });
  const intelligence = createOfficeIntelligence({ router, invoker: async (request) => {
    calls.push(request);
    const context = JSON.parse(request.messages[1]!.content);
    switch (request.schemaName) {
      case 'office_decision': return { decision: await demo.coordinate(context as CoordinatorContext) };
      case 'office_department_plan': return demo.delegate!(context as DepartmentContext);
      case 'office_worker': return { reply: await demo.execute(context as SpecialistContext) };
      default: return demo.review(context as SpecialistContext);
    }
  } });
  const graph = createOfficeWorkflow(intelligence, officeRegistry, new MemorySaver());
  const result = await graph.invoke({ order: createCompanyDemoOrder() }, cfg('company-models'));
  assert.equal(result.order.status, 'completed');
  assert(calls.some((c) => c.selection.agentId === 'ceo' && c.selection.stage === 'coordinate'));
  assert(calls.some((c) => c.selection.agentId === 'cfo' && c.selection.model === 'test-finance'));
  assert(calls.some((c) => c.selection.agentId === 'cto' && c.selection.model === 'test-general'));
});


test('el CTO delega a subáreas sin abrir autoridad entre áreas hermanas', () => {
  const directory = officeRegistry.organization!;
  assert(directory.canDelegate('cto', 'security-audit'));
  assert(directory.canDelegate('ciso', 'security-appsec'));
  assert(directory.canDelegate('software-lead', 'backend'));
  assert(!directory.canDelegate('software-lead', 'security-audit'));
  assert(!directory.canDelegate('ciso', 'network'));
  assert(directory.canReview('security-review', 'security-audit'));
  assert(!directory.canReview('software-qa', 'security-audit'));
  assert.equal(officeRegistry.list().filter((a) => a.organization?.departmentId === 'cybersecurity' && a.organization.level === 'specialist').length, 4);
});

test('rechaza padres ausentes, ciclos departamentales y reportes entre áreas hermanas', () => {
  const definition = officeRegistry.organization!.snapshot();
  const agents = officeRegistry.list();
  const changed = (id: string, parentDepartmentId: string) => ({ ...definition,
    departments: definition.departments.map((d) => d.id === id ? { ...d, parentDepartmentId } : d),
  });
  assert.throws(() => new AgentRegistry(agents, changed('software', 'unknown')), /padre inexistente/);
  assert.throws(() => new AgentRegistry(agents, changed('technology', 'software')), /Ciclo de departamentos/);
  assert.throws(() => new AgentRegistry(agents.map((a) => a.id === 'security-audit'
    ? { ...a, organization: { ...a.organization!, reportsToId: 'software-lead' } } : a), definition), /jerarquía/);
  assert.throws(() => new AgentRegistry(agents.map((a) => a.id === 'ciso'
    ? { ...a, organization: { ...a.organization!, reportsToId: 'ceo' } } : a), definition), /subdepartamento/);
});

test('un encargo anidado conserva su departamento y responsable inmediato', () => {
  const order = createCompanyDemoOrder();
  const assigned = applyCommand(order, { role: 'agent', agentId: 'cto' }, { type: 'add_task', task: {
    id: 'security-plan', title: 'Revisión de aplicaciones', assignedAgentId: 'security-appsec', capability: 'security.appsec',
    dependsOn: [], criteria: [{ id: 'scope', description: 'Alcance documentado' }],
  } }, officeRegistry);
  assert.equal(assigned.tasks[0]!.departmentId, 'cybersecurity');
  assert.equal(assigned.tasks[0]!.accountableAgentId, 'ciso');
});
