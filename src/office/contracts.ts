import { z } from 'zod';

export const Id = z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,119}$/);
const Text = z.string().trim().min(1).max(16000);
export const AgentOrganization = z.object({
  departmentId: Id,
  title: Text,
  level: z.enum(['executive', 'head', 'manager', 'specialist', 'reviewer']),
  reportsToId: Id.optional(),
}).strict();
export const AgentKnowledge = z.object({
  id: Id,
  title: Text,
  reference: Text,
  content: z.string().trim().min(1).max(32000),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
}).strict();
export const AgentDefinition = z.object({
  id: Id,
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  name: Text,
  instructions: Text.optional(),
  context: Text.optional(),
  knowledge: z.array(AgentKnowledge).max(10).optional(),
  capabilities: z.array(Id).min(1),
  // Catálogo declarativo. El ejecutor de herramientas deberá aplicar estos permisos.
  allowedTools: z.array(Id),
  organization: AgentOrganization.optional(),
}).strict();
export type AgentDefinition = z.infer<typeof AgentDefinition>;

export const Criterion = z.object({ id: Id, description: Text }).strict();
export const Evidence = z.object({
  id: Id,
  kind: z.enum(['source', 'artifact', 'observation']),
  reference: Text,
  summary: Text,
}).strict();
export const Submission = z.object({
  summary: Text,
  evidence: z.array(Evidence).min(1).max(40),
}).strict();
export const Assessment = z.object({
  criterionId: Id,
  accepted: z.boolean(),
  evidenceIds: z.array(Id),
  explanation: Text,
}).strict();
export const TaskSpec = z.object({
  id: Id,
  title: Text,
  assignedAgentId: Id,
  capability: Id,
  dependsOn: z.array(Id).max(40),
  criteria: z.array(Criterion).min(1).max(20),
}).strict();
export const WorkTask = TaskSpec.extend({
  departmentId: Id.optional(),
  accountableAgentId: Id.optional(),
  status: z.enum(['pending', 'running', 'blocked', 'in_review', 'completed', 'failed']),
  revisions: z.number().int().nonnegative(),
  blocker: Text.optional(),
  submission: Submission.optional(),
  assessments: z.array(Assessment).optional(),
});
export const Actor = z.discriminatedUnion('role', [
  z.object({ role: z.literal('coordinator') }).strict(),
  z.object({ role: z.literal('agent'), agentId: Id }).strict(),
]);
export type Actor = z.infer<typeof Actor>;

export const CoordinatorCommand = z.discriminatedUnion('type', [
  z.object({ type: z.literal('add_task'), task: TaskSpec }).strict(),
  z.object({
    type: z.literal('resolve_block'), taskId: Id,
    dependsOn: z.array(Id).max(40), resolution: Text,
  }).strict(),
  z.object({ type: z.literal('close_order'), assessments: z.array(Assessment).min(1) }).strict(),
  z.object({ type: z.literal('pause_order'), reason: Text }).strict(),
]);
export const OfficeCommand = z.discriminatedUnion('type', [
  ...CoordinatorCommand.options,
  z.object({ type: z.literal('start_task'), taskId: Id }).strict(),
  z.object({
    type: z.literal('request_support'), taskId: Id,
    capability: Id, question: Text,
  }).strict(),
  z.object({ type: z.literal('submit_result'), taskId: Id, submission: Submission }).strict(),
  z.object({ type: z.literal('review_task'), taskId: Id, assessments: z.array(Assessment).min(1) }).strict(),
]);
export type OfficeCommand = z.infer<typeof OfficeCommand>;
export const OfficeEvent = z.object({
  sequence: z.number().int().positive(),
  actor: Actor,
  command: OfficeCommand,
});

export const WorkOrder = z.object({
  schemaVersion: z.literal(1),
  id: Id,
  workspaceId: Id,
  objective: Text,
  criteria: z.array(Criterion).min(1),
  status: z.enum(['active', 'paused', 'completed']),
  limits: z.object({
    maxTasks: z.number().int().positive().max(100),
    maxSteps: z.number().int().positive().max(10000),
    maxRevisionsPerTask: z.number().int().nonnegative().max(20),
  }).strict(),
  revision: z.number().int().nonnegative(),
  tasks: z.array(WorkTask),
  events: z.array(OfficeEvent),
  assessments: z.array(Assessment).optional(),
  pauseReason: Text.optional(),
}).strict();
export type WorkOrder = z.infer<typeof WorkOrder>;
export type WorkTask = z.infer<typeof WorkTask>;
export type Assessment = z.infer<typeof Assessment>;

export const NewOrder = WorkOrder.pick({
  id: true, workspaceId: true, objective: true, criteria: true, limits: true,
});

export function createOrder(input: z.input<typeof NewOrder>): WorkOrder {
  const initial = NewOrder.parse(input);
  unique(initial.criteria.map((c) => c.id), 'Criterios duplicados');
  return { ...initial, schemaVersion: 1, status: 'active', revision: 0, tasks: [], events: [] };
}

export function unique(ids: string[], message: string): void {
  if (new Set(ids).size !== ids.length) throw new Error(message);
}
