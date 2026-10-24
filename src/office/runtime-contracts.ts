import { z } from 'zod';
import { Assessment, Id, CoordinatorCommand, Submission, TaskSpec, type WorkOrder, type WorkTask, type AgentDefinition } from './contracts.js';
import type { ModelRequest, ModelSelection } from './models.js';
import type { OrganizationDefinition } from './organization.js';
export const CoordinatorDecision = z.discriminatedUnion('type', [
  z.object({ type: z.literal('command'), command: CoordinatorCommand }).strict(),
  z.object({ type: z.literal('dispatch'), taskId: Id }).strict(),
  z.object({ type: z.literal('review'), taskId: Id, reviewerId: Id }).strict(),
  z.object({ type: z.literal('ask_user'), question: z.string().trim().min(1).max(4000) }).strict(),
  z.object({ type: z.literal('delegate'), managerId: Id, request: z.string().trim().min(1).max(4000), dependsOn: z.array(Id).max(40) }).strict(),
]);
export type CoordinatorDecision = z.infer<typeof CoordinatorDecision>;
export const WorkerReply = z.discriminatedUnion('type', [
  z.object({ type: z.literal('result'), submission: Submission }).strict(),
  z.object({ type: z.literal('support'), capability: Id, question: z.string().trim().min(1).max(4000) }).strict(),
]);
export const ReviewReply = z.object({ assessments: z.array(Assessment).min(1).max(20) }).strict();
export const DepartmentReply = z.object({ tasks: z.array(TaskSpec).min(1).max(6) }).strict();
export const HumanAnswer = z.string().trim().min(1).max(16000);
export type HumanExchange = { question: string; answer: string };
export type CoordinatorContext = {
  order: Omit<WorkOrder, 'events'>;
  recentEvents: WorkOrder['events'];
  agents: AgentDefinition[];
  exchanges: HumanExchange[];
  lastError: string | null;
  coordinator?: AgentDefinition;
  organization?: OrganizationDefinition;
};
export type DepartmentContext = {
  objective: string;
  request: string;
  manager: AgentDefinition;
  team: AgentDefinition[];
  existingTasks: WorkTask[];
  dependencies: WorkTask[];
  exchanges: HumanExchange[];
};
export type SpecialistContext = {
  objective: string;
  task: WorkTask;
  agent: AgentDefinition;
  dependencies: WorkTask[];
  exchanges: HumanExchange[];
  // Id del expediente (= office_orders.id en runtime/), no el AccessScope completo: lo único que
  // una herramienta con efecto persistente (pdf.generate) necesita para vincular lo que produce
  // a un expediente real — la verificación de scope sigue viviendo solo en runtime/office-runtime.ts.
  orderId: string;
};

// Las respuestas no incluyen Actor. La identidad la establece el runtime.
export interface OfficeIntelligence {
  readonly modelPolicyFingerprint?: string;
  selectModel?(request: ModelRequest): ModelSelection;
  coordinate(context: CoordinatorContext): Promise<unknown>;
  execute(context: SpecialistContext): Promise<unknown>;
  review(context: SpecialistContext): Promise<unknown>;
  delegate?(context: DepartmentContext): Promise<unknown>;
}
