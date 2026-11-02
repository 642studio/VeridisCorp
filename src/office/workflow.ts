import { Annotation, StateGraph, START, END, interrupt, type BaseCheckpointSaver } from '@langchain/langgraph';
import { OutputParserException } from '@langchain/core/output_parsers';
import { ZodError } from 'zod';
import { WorkOrder, type WorkTask } from './contracts.js';
import { applyCommand } from './engine.js';
import { AgentRegistry } from './registry.js';
import { agentSummary } from './agent-files.js';
import type { ModelSelection, ModelCallRecord, ModelUsage } from './models.js';
import { loadPriceList, priceTokens, type PriceList } from './prices.js';
import { budgetBlockReason } from './budget.js';
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
  modelCalls: Annotation<ModelCallRecord[]>({ reducer: (_a, b) => b, default: () => [] }),
});

export function createOfficeWorkflow(
  intelligence: OfficeIntelligence, registry: AgentRegistry, checkpointer: BaseCheckpointSaver,
  options: { maxTurns?: number; maxRejectedDecisions?: number; maxQuestions?: number; priceList?: PriceList | null } = {},
) {
  const maxTurns = options.maxTurns ?? 100;
  const maxRejected = options.maxRejectedDecisions ?? 3;
  const maxQuestions = options.maxQuestions ?? 5;
  for (const limit of [maxTurns, maxRejected, maxQuestions]) {
    if (!Number.isInteger(limit) || limit < 1 || limit > 1000) throw new Error('Límite del workflow inválido');
  }
  // undefined (no se pasó la opción) carga VERIDIS_PRICES_FILE del entorno; null la desactiva a
  // propósito (p. ej. en pruebas que no quieren depender de process.env). costMicros es un cálculo
  // hecho una sola vez por llamada y queda fijo en el checkpoint — cambiar el archivo de precios
  // después no reescribe el costo de llamadas ya registradas, ver docs/competitive-strategy.md.
  const priceList = options.priceList !== undefined ? options.priceList : loadPriceList();
  const callRecord = (selection: ModelSelection, usage: ModelUsage | null): ModelCallRecord => {
    const price = priceTokens(priceList, selection.provider, selection.model, usage ?? { inputTokens: null, outputTokens: null });
    return { ...selection, inputTokens: usage?.inputTokens ?? null, outputTokens: usage?.outputTokens ?? null, costMicros: price.costMicros, costStatus: price.costStatus };
  };
  const fingerprint = JSON.stringify({ agents: registry.list(), maxTurns, maxRejected, maxQuestions,
    ...(registry.organization ? { organization: registry.organization.snapshot() } : {}),
    ...(intelligence.modelPolicyFingerprint ? { modelPolicy: intelligence.modelPolicyFingerprint } : {}),
  });
  const assertVersion = (state: typeof OfficeState.State) => {
    if (state.workflowVersion !== OFFICE_WORKFLOW_VERSION || state.registrySnapshot !== fingerprint) {
      throw new Error('La versión del workflow, registro o política de modelos cambió. Migra el checkpoint antes de continuar.');
    }
  };
  // Antes de cada llamada al modelo (coordinate/execute/review/delegate): null si puede seguir,
  // o el motivo para pausar el expediente. Sin maxCostMicros en el expediente, nunca bloquea.
  const budgetBlock = (state: typeof OfficeState.State, selection: ModelSelection | undefined) =>
    budgetBlockReason(state.modelCalls, state.order.limits.maxCostMicros, priceList, selection);
  const recordedCalls = (state: typeof OfficeState.State, selection: ModelSelection | undefined, usage: ModelUsage | null = null) =>
    selection ? [...state.modelCalls, callRecord(selection, usage)] : state.modelCalls;
  const pause = (order: WorkOrder, reason: string) => applyCommand(order, { role: 'coordinator' }, {
    type: 'pause_order', reason,
  }, registry);
  // Solo una respuesta del modelo con forma equivocada (no una excepción cualquiera) se trata
  // como decisión rechazada y se reintenta. Cualquier otra cosa (p. ej. que el proceso muera a
  // mitad de una llamada) debe seguir propagándose para que la recuperación por checkpoint actúe.
  const isMalformedModelOutput = (error: unknown) => error instanceof OutputParserException || error instanceof ZodError;
  // El modelo no respondió (tiempo agotado, red, proveedor saturado o caído): no es un error del motor
  // ni del especialista. Visto en vivo con un modelo local lento: el TimeoutError escapaba del nodo,
  // la petición respondía 409 genérico y la tarea quedaba 'running' para siempre. Se pausa con el
  // motivo, para reanudar cuando el modelo esté disponible o asignar otro perfil.
  const isModelUnavailable = (error: unknown) => error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError'
    || /timed? ?out|ECONNREFUSED|ECONNRESET|ETIMEDOUT|fetch failed|socket hang up|rate.?limit|overloaded|\b(429|50[0234])\b/i.test(error.message));
  const unavailableReason = (who: string, selection: ModelSelection | undefined, error: unknown) =>
    `El modelo ${selection ? `${selection.model} (perfil ${selection.profileId}) ` : ''}no respondió para ${who}: `
    + `${error instanceof Error ? error.message.slice(0, 200) : 'error desconocido'}. Reanuda cuando esté disponible o asigna otro perfil.`;
  // Un especialista (no el coordinador) puede fallar la forma por una respuesta suelta del
  // modelo; reintentar aquí mismo, dentro del nodo, resuelve la mayoría de esos casos sin gastar
  // un turno del coordinador en un problema que no es suyo. maxAttempts incluye el primer intento.
  // Un proveedor que devuelve una respuesta vacía o truncada (p. ej. un hueco momentáneo del
  // modelo remoto) se ve igual que una salida mal formada, pero una pausa de verdad mejora las
  // probabilidades de que el siguiente intento ya no la repita; un reintento inmediato no.
  const withRetries = async <T>(attempt: () => Promise<T>, maxAttempts: number): Promise<{ value: T; attempts: number }> => {
    for (let attempts = 1; ; attempts++) {
      try {
        return { value: await attempt(), attempts };
      } catch (error) {
        if (attempts >= maxAttempts || !isMalformedModelOutput(error)) throw error;
        await new Promise((resolve) => setTimeout(resolve, 500 * attempts));
      }
    }
  };
  // Un registro por intento real (no solo por el último): withRetries puede llamar al modelo
  // varias veces para la misma tarea, y cada intento consumió sus propios tokens aunque haya
  // fallado por forma inválida — usages.length es siempre igual al número real de intentos.
  const recordedCallsMany = (state: typeof OfficeState.State, selection: ModelSelection | undefined, usages: (ModelUsage | null)[]) =>
    selection ? [...state.modelCalls, ...usages.map((usage) => callRecord(selection, usage))] : state.modelCalls;
  // Calculado por el motor, no por el modelo: evita que el coordinador tenga que cruzar dependsOn
  // contra el status de cada tarea a mano bajo presión — causa real de "Dependencias pendientes"
  // repetido cuando el grafo de tareas crece (varias áreas en paralelo, tareas de apoyo anidadas).
  const taskReadiness = (tasks: WorkTask[]) => {
    const byId = new Map(tasks.map((t) => [t.id, t]));
    const pending = tasks.filter((t) => t.status === 'pending');
    const readyTaskIds = pending.filter((t) => t.dependsOn.every((id) => byId.get(id)?.status === 'completed')).map((t) => t.id);
    const blockedTasks = pending.filter((t) => !readyTaskIds.includes(t.id)).map((t) => ({
      id: t.id,
      waitingOn: t.dependsOn.map((id) => byId.get(id)).filter((d): d is WorkTask => !!d && d.status !== 'completed')
        .map((d) => ({ id: d.id, status: d.status })),
    }));
    return { readyTaskIds, blockedTasks };
  };
  const getTask = (state: typeof OfficeState.State, taskId: string) => {
    const task = state.order.tasks.find((t) => t.id === taskId);
    if (!task) throw new Error('Tarea inexistente');
    return task;
  };
  // No pasa por applyCommand a propósito: es una nota de bolsillo para el siguiente intento del
  // mismo especialista o revisor sobre esta tarea (ver SpecialistContext.lastError), no una
  // transición gobernada — no toca revision ni genera un evento.
  const withTaskError = (order: WorkOrder, taskId: string, lastError: string | undefined): WorkOrder => ({
    ...order, tasks: order.tasks.map((t) => (t.id === taskId ? { ...t, lastError } : t)),
  });
  const specialistContext = (state: typeof OfficeState.State, task: WorkTask, agentId: string): SpecialistContext => structuredClone({
    objective: state.order.objective, task, agent: registry.get(agentId),
    dependencies: state.order.tasks.filter((t) => task.dependsOn.includes(t.id)),
    exchanges: state.exchanges, orderId: state.order.id, lastError: task.lastError ?? null,
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
      const blocked = budgetBlock(state, selection);
      if (blocked) return { order: pause(state.order, blocked), route: 'end' as const };
      let usage: ModelUsage | null = null;
      try {
        const decision = await intelligence.coordinate(structuredClone({
          order, recentEvents: events.slice(-12), agents: registry.list().map(agentSummary),
          exchanges: state.exchanges, lastError: state.lastError, ...taskReadiness(order.tasks),
          ...(executive ? { coordinator: executive, organization: registry.organization!.snapshot() } : {}),
        }), (u) => { usage = u; });
        return { decision, turns: state.turns + 1, route: 'coordinate' as const, modelCalls: recordedCalls(state, selection, usage), lastError: null };
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
          return { order: pause(state.order, `Demasiadas decisiones rechazadas: ${lastError}`), rejectedDecisions, lastError, turns, route: 'end' as const, modelCalls: recordedCalls(state, selection, usage) };
        }
        return { rejectedDecisions, lastError, turns, route: 'coordinate' as const, modelCalls: recordedCalls(state, selection, usage) };
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
          return { order: pause(state.order, `Demasiadas decisiones rechazadas: ${lastError}`), rejectedDecisions, lastError, route: 'end' as const };
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
      // La tarea ya quedó 'running' (validate_decision aplicó start_task): mismo estado que dejan
      // las otras pausas de este nodo; el coordinador siguiente ve el expediente pausado y termina.
      const blocked = budgetBlock(state, selection);
      if (blocked) return { order: pause(state.order, blocked) };
      // Declarado fuera de withRetries para que sobreviva tanto al éxito como al agotar los
      // reintentos (el catch externo también necesita el consumo de los intentos fallidos).
      const usages: (ModelUsage | null)[] = [];
      try {
        const { value: reply } = await withRetries(async () =>
          WorkerReply.parse(await intelligence.execute(specialistContext(state, task, task.assignedAgentId), (u) => usages.push(u))), 3);
        const command = reply.type === 'result'
          ? { type: 'submit_result' as const, taskId: task.id, submission: reply.submission }
          : { type: 'request_support' as const, taskId: task.id, capability: reply.capability, question: reply.question };
        try {
          return { order: applyCommand(state.order, { role: 'agent', agentId: task.assignedAgentId }, command, registry), modelCalls: recordedCallsMany(state, selection, usages), lastError: null };
        } catch (error) {
          // La entrega tiene forma válida pero viola una regla del motor (p. ej. reutiliza un id de
          // evidencia de otra tarea): igual que una respuesta sin forma esperada, deja la tarea en
          // 'running' sin salida legal (dispatch exige 'pending'), así que se pausa aquí mismo en vez
          // de dejar que la excepción escape sin capturar — eso dejaba el expediente atascado: cada
          // reintento repetía el mismo choque contra la misma regla, sin pausar ni avanzar nunca.
          const rejectedDecisions = state.rejectedDecisions + 1;
          const lastError = error instanceof Error ? error.message : 'La entrega no cumple las reglas del motor';
          return {
            order: pause(state.order, `El especialista no completó la tarea "${task.id}" tras varios intentos: ${lastError}`),
            rejectedDecisions, lastError, modelCalls: recordedCallsMany(state, selection, usages),
          };
        }
      } catch (error) {
        // Una respuesta del especialista que no se pueda interpretar, aun tras reintentar, deja la
        // tarea en 'running' sin entrega: el coordinador no tiene ninguna decisión legal para
        // retomarla (dispatch exige 'pending'), así que devolverle el turno solo gastaría intentos
        // de rechazo en un callejón sin salida. Se pausa aquí mismo con un motivo específico.
        if (isModelUnavailable(error)) {
          const lastError = unavailableReason(`el especialista de "${task.id}"`, selection, error);
          return { order: pause(state.order, lastError), lastError, modelCalls: recordedCallsMany(state, selection, usages) };
        }
        if (!isMalformedModelOutput(error)) throw error;
        const rejectedDecisions = state.rejectedDecisions + 1;
        const lastError = error instanceof Error ? error.message : 'El especialista no devolvió una respuesta con la forma esperada';
        return {
          order: pause(state.order, `El especialista no completó la tarea "${task.id}" tras varios intentos: ${lastError}`),
          rejectedDecisions, lastError, modelCalls: recordedCallsMany(state, selection, usages),
        };
      }
    })
    .addNode('review', async (state) => {
      assertVersion(state);
      const decision = CoordinatorDecision.parse(state.decision);
      if (decision.type !== 'review') throw new Error('No hay revisión asignada');
      const task = getTask(state, decision.taskId);
      const selection = intelligence.selectModel?.({ stage: 'review', agentId: decision.reviewerId, capability: task.capability });
      const blocked = budgetBlock(state, selection);
      if (blocked) return { order: pause(state.order, blocked) };
      const usages: (ModelUsage | null)[] = [];
      try {
        const { value: reply } = await withRetries(async () =>
          ReviewReply.parse(await intelligence.review(specialistContext(state, task, decision.reviewerId), (u) => usages.push(u))), 3);
        try {
          const applied = applyCommand(state.order, { role: 'agent', agentId: decision.reviewerId }, {
            type: 'review_task', taskId: task.id, assessments: reply.assessments,
          }, registry);
          // Revisión aceptada con éxito: limpia la nota de intento anterior de esta tarea (si la
          // hubo), aplique al especialista o al revisor — ya no aplica.
          const order = withTaskError(applied, task.id, undefined);
          return { order, modelCalls: recordedCallsMany(state, selection, usages), lastError: null };
        } catch (error) {
          // applyCommand es puro y síncrono: cualquier error aquí es una evaluación con forma
          // válida pero que no cumple las reglas del motor (p. ej. cita una evidencia que no
          // existe en la entrega), nunca un fallo de infraestructura. Se trata igual que una
          // decisión rechazada, con el motivo, en vez de tumbar el nodo.
          const rejectedDecisions = state.rejectedDecisions + 1;
          const lastError = error instanceof Error ? error.message : 'La evaluación del revisor no cumple las reglas del motor';
          // Se guarda en la propia tarea (no solo en el lastError transitorio del grafo): entre
          // este rechazo y el siguiente intento de revisión siempre corre una vuelta de
          // 'coordinate' (addEdge('review','coordinate')), que limpia su propio lastError al tomar
          // una decisión válida — sin esto, el revisor vuelve a intentarlo sin saber qué citó mal.
          const order = rejectedDecisions >= maxRejected
            ? pause(state.order, `Demasiadas decisiones rechazadas: ${lastError}`)
            : withTaskError(state.order, task.id, lastError);
          return { order, rejectedDecisions, lastError, modelCalls: recordedCallsMany(state, selection, usages) };
        }
      } catch (error) {
        if (isModelUnavailable(error)) {
          const lastError = unavailableReason(`el revisor de "${task.id}"`, selection, error);
          return { order: pause(state.order, lastError), lastError, modelCalls: recordedCallsMany(state, selection, usages) };
        }
        if (!isMalformedModelOutput(error)) throw error;
        const rejectedDecisions = state.rejectedDecisions + 1;
        const lastError = error instanceof Error ? error.message : 'El revisor no devolvió una evaluación con la forma esperada';
        return { order: rejectedDecisions >= maxRejected ? pause(state.order, `Demasiadas decisiones rechazadas: ${lastError}`) : state.order,
          rejectedDecisions, lastError, modelCalls: recordedCallsMany(state, selection, usages) };
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
      const blocked = budgetBlock(state, selection);
      if (blocked) return { order: pause(state.order, blocked) };
      let usage: ModelUsage | null = null;
      try {
        const raw = await intelligence.delegate(structuredClone({
          objective: state.order.objective, request: decision.request,
          manager: registry.get(decision.managerId), team: team.map(agentSummary),
          existingTasks: state.order.tasks.filter((task) => ids.has(task.assignedAgentId)),
          dependencies: state.order.tasks.filter((task) => decision.dependsOn.includes(task.id)),
          exchanges: state.exchanges,
        }), (u) => { usage = u; });
        const reply = DepartmentReply.parse(raw);
        if (state.order.revision + reply.tasks.length > state.order.limits.maxSteps) {
          return { order: pause(state.order, 'Pasos insuficientes para registrar el plan del departamento'), modelCalls: recordedCalls(state, selection, usage) };
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
        return { order, lastError: null, modelCalls: recordedCalls(state, selection, usage) };
      } catch (error) {
        const rejectedDecisions = state.rejectedDecisions + 1;
        const lastError = error instanceof Error ? error.message : 'Plan de departamento inválido';
        return { order: rejectedDecisions >= maxRejected ? pause(state.order, `Demasiados planes o decisiones rechazados: ${lastError}`) : state.order,
          rejectedDecisions, lastError, modelCalls: recordedCalls(state, selection, usage) };
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
