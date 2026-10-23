import { z } from 'zod';
import { Actor, OfficeCommand, WorkOrder, unique, type Assessment, type WorkTask } from './contracts.js';
import { AgentRegistry } from './registry.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function validateAssessments(
  criteria: { id: string }[], assessments: Assessment[], evidenceIds: string[],
): boolean {
  unique(assessments.map((a) => a.criterionId), 'Evaluaciones duplicadas');
  assert(assessments.length === criteria.length, 'Hay que evaluar todos los criterios');
  for (const assessment of assessments) {
    assert(criteria.some((c) => c.id === assessment.criterionId), 'Criterio desconocido');
    assert(assessment.evidenceIds.every((id) => evidenceIds.includes(id)), 'Evidencia desconocida');
    assert(!assessment.accepted || assessment.evidenceIds.length > 0, 'Aceptar requiere evidencia');
  }
  return assessments.every((a) => a.accepted);
}

function validateDependencies(tasks: WorkTask[]): void {
  const visiting = new Set<string>();
  const visited = new Set<string>();
  function visit(id: string) {
    assert(!visiting.has(id), 'Dependencias circulares');
    if (visited.has(id)) return;
    const task = tasks.find((t) => t.id === id);
    assert(task, 'Dependencia inexistente: ' + id);
    visiting.add(id);
    for (const dep of task.dependsOn) visit(dep);
    visiting.delete(id);
    visited.add(id);
  }
  tasks.forEach((t) => visit(t.id));
}

// Función pura: no llama modelos, herramientas ni bases. El transporte debe
// obtener Actor de la identidad autenticada, nunca del mensaje de un LLM.
export function applyCommand(
  current: WorkOrder, actorInput: Actor, commandInput: z.input<typeof OfficeCommand>,
  registry: AgentRegistry,
): WorkOrder {
  const order = WorkOrder.parse(current);
  const actor = Actor.parse(actorInput);
  const command = OfficeCommand.parse(commandInput);
  assert(order.status === 'active', 'El expediente no está activo');
  if (actor.role === 'agent') registry.get(actor.agentId);
  assert(command.type === 'pause_order' || order.revision < order.limits.maxSteps, 'Límite de pasos alcanzado');
  const coordinator = () => assert(actor.role === 'coordinator', 'Solo el coordinador puede gestionar el plan');
  const taskById = (id: string) => {
    const task = order.tasks.find((t) => t.id === id);
    assert(task, 'Tarea inexistente');
    return task;
  };
  const owner = (task: WorkTask) => {
    assert(actor.role === 'agent' && actor.agentId === task.assignedAgentId, 'Solo el agente asignado puede ejecutar esta tarea');
  };

  switch (command.type) {
    case 'add_task': {
      if (actor.role !== 'coordinator' && !registry.organization?.canDelegate(actor.agentId, command.task.assignedAgentId)) {
        throw new Error('Solo el coordinador o un responsable autorizado puede asignar esta tarea');
      }
      assert(order.tasks.length < order.limits.maxTasks, 'Límite de tareas alcanzado');
      assert(!order.tasks.some((t) => t.id === command.task.id), 'Tarea duplicada');
      registry.requireCapability(command.task.assignedAgentId, command.task.capability);
      unique(command.task.criteria.map((c) => c.id), 'Criterios duplicados');
      unique(command.task.dependsOn, 'Dependencias duplicadas');
      const organization = registry.get(command.task.assignedAgentId).organization;
      order.tasks.push({ ...command.task, status: 'pending', revisions: 0,
        ...(organization ? { departmentId: organization.departmentId,
          accountableAgentId: organization.reportsToId || registry.organization?.executive().id } : {}),
      });
      validateDependencies(order.tasks);
      break;
    }
    case 'start_task': {
      const task = taskById(command.taskId);
      owner(task);
      registry.requireCapability(task.assignedAgentId, task.capability);
      assert(task.status === 'pending', 'La tarea no está pendiente');
      // Nombrar la tarea y su estado concreto ayuda al coordinador (humano o modelo) a corregirse:
      // "Dependencias pendientes" a secas no distingue "falta revisarla" de "aún no se asignó".
      const blocking = task.dependsOn.map((id) => taskById(id)).find((d) => d.status !== 'completed');
      assert(!blocking, `Dependencias pendientes: ${blocking?.id} está en estado '${blocking?.status}'; revísala o complétala antes de despachar esta`);
      task.status = 'running';
      break;
    }
    case 'request_support': {
      const task = taskById(command.taskId);
      owner(task);
      assert(task.status === 'running', 'La tarea no está en ejecución');
      task.status = 'blocked';
      task.blocker = command.question;
      // El pedido queda en el evento. No asigna tareas ni concede herramientas.
      break;
    }
    case 'resolve_block': {
      coordinator();
      const task = taskById(command.taskId);
      assert(task.status === 'blocked', 'La tarea no está bloqueada');
      unique(command.dependsOn, 'Dependencias duplicadas');
      // Las dependencias anteriores se conservan para no eludir trabajo pendiente.
      task.dependsOn = [...new Set([...task.dependsOn, ...command.dependsOn])];
      validateDependencies(order.tasks);
      task.status = 'pending';
      delete task.blocker;
      break;
    }
    case 'submit_result': {
      const task = taskById(command.taskId);
      owner(task);
      assert(task.status === 'running', 'La tarea no está en ejecución');
      unique(command.submission.evidence.map((e) => e.id), 'Evidencias duplicadas');
      const otherIds = order.tasks.filter((t) => t.id !== task.id)
        .flatMap((t) => t.submission?.evidence.map((e) => e.id) || []);
      assert(command.submission.evidence.every((e) => !otherIds.includes(e.id)), 'Evidencia ya registrada en otra tarea');
      task.submission = command.submission;
      task.status = 'in_review';
      delete task.assessments;
      break;
    }
    case 'review_task': {
      const task = taskById(command.taskId);
      assert(actor.role === 'agent', 'La revisión requiere un especialista');
      registry.requireCapability(actor.agentId, 'work.review');
      assert(actor.agentId !== task.assignedAgentId, 'El autor no puede aprobar su propio resultado');
      if (registry.organization && !registry.organization.canReview(actor.agentId, task.assignedAgentId)) {
        throw new Error('El revisor no pertenece al área de la tarea ni a Calidad');
      }
      assert(task.status === 'in_review' && task.submission, 'No hay resultado para revisar');
      const accepted = validateAssessments(task.criteria, command.assessments, task.submission.evidence.map((e) => e.id));
      task.assessments = command.assessments;
      if (accepted) task.status = 'completed';
      else if (task.revisions >= order.limits.maxRevisionsPerTask) task.status = 'failed';
      else {
        task.revisions += 1;
        task.status = 'pending';
      }
      break;
    }
    case 'close_order': {
      coordinator();
      assert(order.tasks.length > 0 && order.tasks.every((t) => t.status === 'completed'), 'Quedan tareas sin completar');
      assert(validateAssessments(order.criteria, command.assessments,
        order.tasks.flatMap((t) => t.submission?.evidence.map((e) => e.id) || [])), 'El objetivo aún no cumple todos los criterios');
      order.assessments = command.assessments;
      order.status = 'completed';
      break;
    }
    case 'pause_order':
      coordinator();
      order.status = 'paused';
      order.pauseReason = command.reason;
      break;
  }
  order.revision += 1;
  // La hora real es la única lectura no determinista de esta función, a propósito: es solo para
  // mostrarla en la UI, no para ninguna decisión del motor.
  order.events.push({ sequence: order.revision, actor, command, occurredAt: new Date().toISOString() });
  return order;
}
