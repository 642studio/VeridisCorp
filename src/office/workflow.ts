import { Annotation, StateGraph, START, END, interrupt, type BaseCheckpointSaver } from '@langchain/langgraph';
import { OutputParserException } from '@langchain/core/output_parsers';
import { ZodError } from 'zod';
import { WorkOrder, type WorkTask } from './contracts.js';
import { applyCommand } from './engine.js';
import { AgentRegistry } from './registry.js';
import { agentSummary } from './agent-files.js';
import type { ModelSelection } from './models.js';
import {
  CoordinatorDecision, WorkerReply, ReviewReply, DepartmentReply, HumanAnswer,
  type HumanExchange, type OfficeIntelligence, type SpecialistContext,
} from './runtime-contracts.js';

export const OFFICE_WORKFLOW_VERSION = 'office.v1';
export const OfficeState = Annotation.Root({
  order: Annotation<WorkOrder>(),
  workflowVersion: Annotation<string>(),
  registrySnapshot: Annotation<string>(),
  decision: Annotation<unknown>(),
  route: Annotation<'coordinate' | 'execute' | 'review' | 'delegate' | 'human' | 'end'>(),
  turns: Annotation<number>({ reducer: (_a, b) => b, default: () => 0 }),
  rejectedDecisions: Annotation<number>({ reducer: (_a, b) => b, default: () => 0 }),
  lastError: Annotation<string | null>({ reducer: (_a, b) => b, default: () => null }),
  exchanges: Annotation<HumanExchange[]>({ reducer: (_a, b) => b, default: () => [] }),
  modelCalls: Annotation<ModelSelection[]>({ reducer: (_a, b) => b, default: () => [] }),
});

export function createOfficeWorkflow(
  intelligence: OfficeIntelligence, registry: AgentRegistry, checkpointer: BaseCheckpointSaver,
  options: { maxTurns?: number; maxRejectedDecisions?: number; maxQuestions?: number } = {},
) {
  const maxTurns = options.maxTurns ?? 100;
  const maxRejected = options.maxRejectedDecisions ?? 3;
  const maxQuestions = options.maxQuestions ?? 5;
  for (const limit of [maxTurns, maxRejected, maxQuestions]) {
    if (!Number.isInteger(limit) || limit < 1 || limit > 1000) throw new Error('Límite del workflow inválido');
  }
  const fingerprint = JSON.stringify({ agents: registry.list(), maxTurns, maxRejected, maxQuestions,
    ...(registry.organization ? { organization: registry.organization.snapshot() } : {}),
    ...(intelligence.modelPolicyFingerprint ? { modelPolicy: intelligence.modelPolicyFingerprint } : {}),
  });
  const assertVersion = (state: typeof OfficeState.State) => {
    if (state.workflowVersion !== OFFICE_WORKFLOW_VERSION || state.registrySnapshot !== fingerprint) {
      throw new Error('La versión del workflow, registro o política de modelos cambió. Migra el checkpoint antes de continuar.');
    }
  };
  const recordedCalls = (state: typeof OfficeState.State, selection: ModelSelection | undefined) =>
    selection ? [...state.modelCalls, selection] : state.modelCalls;
  const pause = (order: WorkOrder, reason: string) => applyCommand(order, { role: 'coordinator' }, {
    type: 'pause_order', reason,
  }, registry);
  // Solo una respuesta del modelo con forma equivocada (no una excepción cualquiera) se trata
  // como decisión rechazada y se reintenta. Cualquier otra cosa (p. ej. que el proceso muera a
  // mitad de una llamada) debe seguir propagándose para que la recuperación por checkpoint actúe.
  const isMalformedModelOutput = (error: unknown) => error instanceof OutputParserException || error instanceof ZodError;
  // Un especialista (no el coordinador) puede fallar la forma por una respuesta suelta del
  // modelo; reintentar aquí mismo, dentro del nodo, resuelve la mayoría de esos casos sin gastar
  // un turno del coordinador en un problema que no es suyo. maxAttempts incluye el primer intento.
  const withRetries = async <T>(attempt: () => Promise<T>, maxAttempts: number): Promise<{ value: T; attempts: number }> => {
    for (let attempts = 1; ; attempts++) {
      try {
        return { value: await attempt(), attempts };
      } catch (error) {
        if (attempts >= maxAttempts || !isMalformedModelOutput(error)) throw error;
      }
    }
  };
  const recordedCallsTimes = (state: typeof OfficeState.State, selection: ModelSelection | undefined, times: number) =>
    selection ? [...state.modelCalls, ...Array.from({ length: times }, () => selection)] : state.modelCalls;
  const getTask = (state: typeof OfficeState.State, taskId: string) => {
    const task = state.order.tasks.find((t) => t.id === taskId);
    if (!task) throw new Error('Tarea inexistente');
    return task;
  };
  const specialistContext = (state: typeof OfficeState.State, task: WorkTask, agentId: string): SpecialistContext => structuredClone({
    objective: state.order.objective, task, agent: registry.get(agentId),
    dependencies: state.order.tasks.filter((t) => task.dependsOn.includes(t.id)),
    exchanges: state.exchanges,
  });

  return new StateGraph(OfficeState)
    .addNode('initialize', (state) => ({
      order: WorkOrder.parse(state.order), workflowVersion: OFFICE_WORKFLOW_VERSION,
      registrySnapshot: fingerprint,
    }))
    .addNode('coordinate', async (state) => {
      assertVersion(state);
      if (state.order.status !== 'active') return { route: 'end' as const };
      if (state.turns >= maxTurns || state.order.revision >= state.order.limits.maxSteps) {
        return { order: pause(state.order, 'Límite de coordinación alcanzado'), route: 'end' as const };
      }
      const { events, ...order } = state.order;
      const executive = registry.organization?.executive();
      const selection = intelligence.selectModel?.({ stage: 'coordinate', agentId: executive?.id || 'coordinator', capability: executive ? 'company.strategy' : 'office.coordinate' });
      try {
        const decision = await intelligence.coordinate(structuredClone({
          order, recentEvents: events.slice(-12), agents: registry.list().map(agentSummary),
          exchanges: state.exchanges, lastError: state.lastError,
          ...(executive ? { coordinator: executive, organization: registry.organization!.snapshot() } : {}),
        }));
        return { decision, turns: state.turns + 1, route: 'coordinate' as const, modelCalls: recordedCalls(state, selection), lastError: null };
      } catch (error) {
        // Una respuesta del modelo que ni siquiera tiene la forma esperada (no solo una regla de
        // negocio inválida) no debe tumbar la ejecución: se trata igual que una decisión rechazada,
        // con lastError para que el propio modelo se corrija en el siguiente turno. Cualquier otro
        // error (p. ej. el proceso muere a mitad de la llamada) sigue propagándose sin tocarlo.
        if (!isMalformedModelOutput(error)) throw error;
        const rejectedDecisions = state.rejectedDecisions + 1;
        const lastError = error instanceof Error ? error.message : 'El modelo no devolvió una decisión con la forma esperada';
        const turns = state.turns + 1;
        if (rejectedDecisions >= maxRejected || turns >= maxTurns) {
          return { order: pause(state.order, 'Demasiadas decisiones rechazadas'), rejectedDecisions, lastError, turns, route: 'end' as const, modelCalls: recordedCalls(state, selection) };
        }
        return { rejectedDecisions, lastError, turns, route: 'coordinate' as const, modelCalls: recordedCalls(state, selection) };
      }
    })
    .addNode('validate_decision', (state) => {
      assertVersion(state);
      try {
        const decision = CoordinatorDecision.parse(state.decision);
        switch (decision.type) {
          case 'command': {
            const order = applyCommand(state.order, { role: 'coordinator' }, decision.command, registry);
            return { order, route: order.status === 'active' ? 'coordinate' as const : 'end' as const, lastError: null };
          }
          case 'dispatch': {
            // Inicio y entrega consumen dos transiciones: no dejar una tarea
            // en ejecución cuando ya no alcanza el presupuesto para su resultado.
            if (state.order.revision + 2 > state.order.limits.maxSteps) {
              return { order: pause(state.order, 'Pasos insuficientes para iniciar otra tarea'), route: 'end' as const };
            }
            const task = getTask(state, decision.taskId);
            const order = applyCommand(state.order, { role: 'agent', agentId: task.assignedAgentId }, {
              type: 'start_task', taskId: task.id,
            }, registry);
            return { order, route: 'execute' as const, lastError: null };
          }
          case 'review': {
            const task = getTask(state, decision.taskId);
            registry.requireCapability(decision.reviewerId, 'work.review');
            if (task.status !== 'in_review' || decision.reviewerId === task.assignedAgentId) {
              throw new Error('La revisión requiere un resultado pendiente y un revisor independiente');
            }
            if (registry.organization && !registry.organization.canReview(decision.reviewerId, task.assignedAgentId)) {
              throw new Error('El revisor no pertenece al área de la tarea ni a Calidad');
            }
            return { route: 'review' as const, lastError: null };
          }
          case 'delegate': {
            if (!intelligence.delegate || !registry.organization?.isManager(decision.managerId)
              || !registry.organization.canDelegate(registry.organization.executive().id, decision.managerId)) {
              throw new Error('La delegación requiere un responsable subordinado y un adaptador de departamento');
            }
            registry.requireCapability(decision.managerId, 'department.plan');
            decision.dependsOn.forEach((id) => getTask(state, id));
            return { route: 'delegate' as const, lastError: null };
          }
          case 'ask_user':
            if (state.exchanges.length >= maxQuestions) throw new Error('Límite de preguntas alcanzado');
            return { route: 'human' as const, lastError: null };
        }
      } catch (error) {
        const rejectedDecisions = state.rejectedDecisions + 1;
        const lastError = error instanceof Error ? error.message : 'Decisión no válida';
        if (rejectedDecisions >= maxRejected) {
          return { order: pause(state.order, 'Demasiadas decisiones rechazadas'), rejectedDecisions, lastError, route: 'end' as const };
        }
        return { rejectedDecisions, lastError, route: 'coordinate' as const };
      }
    })
    .addNode('execute', async (state) => {
      assertVersion(state);
      const decision = CoordinatorDecision.parse(state.decision);
      if (decision.type !== 'dispatch') throw new Error('No hay asignación para ejecutar');
      const task = getTask(state, decision.taskId);
      const selection = intelligence.selectModel?.({ stage: 'execute', agentId: task.assignedAgentId, capability: task.capability });
      try {
        const { value: reply, attempts } = await withRetries(async () =>
          WorkerReply.parse(await intelligence.execute(specialistContext(state, task, task.assignedAgentId))), 2);
        const command = reply.type === 'result'
          ? { type: 'submit_result' as const, taskId: task.id, submission: reply.submission }
          : { type: 'request_support' as const, taskId: task.id, capability: reply.capability, question: reply.question };
        return { order: applyCommand(state.order, { role: 'agent', agentId: task.assignedAgentId }, command, registry), modelCalls: recordedCallsTimes(state, selection, attempts), lastError: null };
      } catch (error) {
        // Una respuesta del especialista que no se pueda interpretar, aun tras reintentar, deja la
        // tarea en 'running' sin entrega: el coordinador no tiene ninguna decisión legal para
        // retomarla (dispatch exige 'pending'), así que devolverle el turno solo gastaría intentos
        // de rechazo en un callejón sin salida. Se pausa aquí mismo con un motivo específico.
        if (!isMalformedModelOutput(error)) throw error;
        const rejectedDecisions = state.rejectedDecisions + 1;
        const lastError = error instanceof Error ? error.message : 'El especialista no devolvió una respuesta con la forma esperada';
        return {
          order: pause(state.order, `El especialista no completó la tarea "${task.id}" tras varios intentos: ${lastError}`),
          rejectedDecisions, lastError, modelCalls: recordedCallsTimes(state, selection, 2),
        };
      }
    })
    .addNode('review', async (state) => {
      assertVersion(state);
      const decision = CoordinatorDecision.parse(state.decision);
      if (decision.type !== 'review') throw new Error('No hay revisión asignada');
      const task = getTask(state, decision.taskId);
      const selection = intelligence.selectModel?.({ stage: 'review', agentId: decision.reviewerId, capability: task.capability });
      try {
        const { value: reply, attempts } = await withRetries(async () =>
          ReviewReply.parse(await intelligence.review(specialistContext(state, task, decision.reviewerId))), 2);
        return { order: applyCommand(state.order, { role: 'agent', agentId: decision.reviewerId }, {
          type: 'review_task', taskId: task.id, assessments: reply.assessments,
        }, registry), modelCalls: recordedCallsTimes(state, selection, attempts), lastError: null };
      } catch (error) {
        if (!isMalformedModelOutput(error)) throw error;
        const rejectedDecisions = state.rejectedDecisions + 1;
        const lastError = error instanceof Error ? error.message : 'El revisor no devolvió una evaluación con la forma esperada';
        return { order: rejectedDecisions >= maxRejected ? pause(state.order, 'Demasiadas decisiones rechazadas') : state.order,
          rejectedDecisions, lastError, modelCalls: recordedCallsTimes(state, selection, 2) };
      }
    })
    .addNode('human', (state) => {
      assertVersion(state);
      const decision = CoordinatorDecision.parse(state.decision);
      if (decision.type !== 'ask_user') throw new Error('No hay pregunta pendiente');
      // Sin efectos antes de interrupt: este nodo vuelve a empezar al reanudar.
      const answer = HumanAnswer.parse(interrupt({
        type: 'information_required', orderId: state.order.id, question: decision.question,
      }));
      return { exchanges: [...state.exchanges, { question: decision.question, answer }] };
    })
    .addNode('delegate', async (state) => {
      assertVersion(state);
      const decision = CoordinatorDecision.parse(state.decision);
      if (decision.type !== 'delegate' || !intelligence.delegate || !registry.organization) throw new Error('No hay delegación válida');
      const team = registry.organization.team(decision.managerId);
      const ids = new Set(team.map((member) => member.id));
      const selection = intelligence.selectModel?.({ stage: 'coordinate', agentId: decision.managerId, capability: 'department.plan' });
      try {
        const raw = await intelligence.delegate(structuredClone({
          objective: state.order.objective, request: decision.request,
          manager: registry.get(decision.managerId), team: team.map(agentSummary),
          existingTasks: state.order.tasks.filter((task) => ids.has(task.assignedAgentId)),
          dependencies: state.order.tasks.filter((task) => decision.dependsOn.includes(task.id)),
          exchanges: state.exchanges,
        }));
        const reply = DepartmentReply.parse(raw);
        if (state.order.revision + reply.tasks.length > state.order.limits.maxSteps) {
          return { order: pause(state.order, 'Pasos insuficientes para registrar el plan del departamento'), modelCalls: recordedCalls(state, selection) };
        }
        let order = state.order;
        const allowedDependencies = new Set([...decision.dependsOn,
          ...order.tasks.filter((task) => ids.has(task.assignedAgentId)).map((task) => task.id)]);
        // Se devuelve un único cambio de estado: un plan inválido no deja
        // tareas parcialmente registradas ni efectos externos.
        for (const task of reply.tasks) {
          if (!task.dependsOn.every((id) => allowedDependencies.has(id))) throw new Error('El plan usa dependencias no compartidas con el departamento');
          order = applyCommand(order, { role: 'agent', agentId: decision.managerId }, { type: 'add_task', task }, registry);
          allowedDependencies.add(task.id);
        }
        return { order, lastError: null, modelCalls: recordedCalls(state, selection) };
      } catch (error) {
        const rejectedDecisions = state.rejectedDecisions + 1;
        const lastError = error instanceof Error ? error.message : 'Plan de departamento inválido';
        return { order: rejectedDecisions >= maxRejected ? pause(state.order, 'Demasiados planes o decisiones rechazados') : state.order,
          rejectedDecisions, lastError, modelCalls: recordedCalls(state, selection) };
      }
    })
    .addEdge(START, 'initialize')
    .addEdge('initialize', 'coordinate')
    .addConditionalEdges('coordinate', (state) => state.route === 'end' ? END : 'validate_decision')
    .addConditionalEdges('validate_decision', (state) => state.route === 'end' ? END : state.route)
    .addEdge('execute', 'coordinate')
    .addEdge('review', 'coordinate')
    .addEdge('human', 'coordinate')
    .addEdge('delegate', 'coordinate')
    .compile({ checkpointer });
}
