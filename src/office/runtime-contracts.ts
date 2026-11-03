import { z } from 'zod';
import { Assessment, Id, CoordinatorCommand, Submission, TaskSpec, type WorkOrder, type WorkTask, type AgentDefinition } from './contracts.js';
import type { ModelRequest, ModelRouter, ModelSelection, ModelUsage } from './models.js';
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
// Lo que el archivista destila de un expediente cerrado (ver OfficeRuntime.distill): pocas memorias,
// cortas y autocontenidas — vacío es la respuesta correcta cuando nada vale la pena recordar.
export const ArchivistReply = z.object({
  memories: z.array(z.object({
    kind: z.enum(['decision', 'fact', 'preference', 'question']),
    entityType: z.enum(['company', 'division', 'client', 'brand', 'project', 'contract', 'person', 'product', 'decision', 'integration', 'process']),
    // Tolerante a propósito (el runtime lo normaliza a slug): una mayúscula o un espacio no debe
    // tirar a la basura todas las memorias de la respuesta.
    entityId: z.string().trim().min(1).max(120),
    content: z.string().trim().min(1).max(600),
    contradicts: z.string().trim().max(120).nullable().optional(),
  }).strict()).max(5),
}).strict();
export type ArchivistReply = z.infer<typeof ArchivistReply>;
// Importar un documento que pegó un humano: a diferencia del archivista (lo poco que vale la pena de
// un expediente), aquí casi todo es conocimiento a conservar — hasta 12 memorias por sección.
export const IngestReply = z.object({ memories: ArchivistReply.shape.memories.element.array().max(12) }).strict();
// Respuesta rápida del chat (OfficeRuntime.ask): una sola llamada con la memoria ya consultada. "order"
// significa que lo pedido es trabajo para la oficina; entonces "objective" es el encargo ya redactado.
export const AssistantReply = z.object({
  mode: z.enum(['answer', 'order']),
  answer: z.string().trim().min(1).max(8000),
  objective: z.string().trim().max(4000).nullable(),
  memoryIds: z.array(z.string().trim().min(1).max(120)).max(12),
}).strict();
export type AssistantReply = z.infer<typeof AssistantReply>;
export type AssistantContext = {
  question: string;
  history: { question: string; answer: string }[];
  memories: { id: string; entityType: string; entityId: string; kind: string; content: string; confirmed: boolean }[];
  // Estado en vivo de las conexiones MCP según el motor (no la memoria): la fuente para "qué hay hoy".
  connections?: { name: string; status: string; confirmedByHuman: boolean; purpose: string; usableTools: string[]; offTools: string[] }[];
};
export type IngestContext = {
  title: string;
  section: string;
  text: string;
  existing: ArchivistContext['existing'];
};
export type ArchivistContext = {
  objective: string;
  deliverables: { task: string; agentId: string; summary: string }[];
  existing: { id: string; entityType: string; entityId: string; content: string; confirmed: boolean }[];
};
export type HumanExchange = { question: string; answer: string };
export type CoordinatorContext = {
  order: Omit<WorkOrder, 'events'>;
  recentEvents: WorkOrder['events'];
  agents: AgentDefinition[];
  exchanges: HumanExchange[];
  lastError: string | null;
  coordinator?: AgentDefinition;
  organization?: OrganizationDefinition;
  // Calculados por el motor (workflow.ts), no por el modelo: listos para dispatch ahora mismo, y
  // cuáles siguen bloqueados y por qué dependencia exacta — evita que el coordinador tenga que
  // cruzar dependsOn contra el status de cada tarea a mano bajo presión.
  readyTaskIds: string[];
  blockedTasks: { id: string; waitingOn: { id: string; status: string }[] }[];
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
  // Motivo del rechazo del intento anterior sobre ESTA misma tarea (p. ej. citó un id de evidencia
  // que no existe), si lo hubo — mismo propósito que lastError ya tiene en CoordinatorContext: que
  // el propio modelo se corrija en el siguiente turno en vez de repetir ciegamente el mismo error
  // hasta agotar maxRejectedDecisions. null en el primer intento.
  lastError: string | null;
  // Id del expediente (= office_orders.id en runtime/), no el AccessScope completo: lo único que
  // una herramienta con efecto persistente (pdf.generate) necesita para vincular lo que produce
  // a un expediente real — la verificación de scope sigue viviendo solo en runtime/office-runtime.ts.
  orderId: string;
};

// Las respuestas no incluyen Actor. La identidad la establece el runtime.
// onUsage: callback opcional que recibe el conteo real de tokens de ESTA llamada, si el
// proveedor lo reportó. No es un valor de retorno aparte a propósito: una sola instancia de
// OfficeIntelligence se reusa entre expedientes concurrentes (ver office-runtime.ts), así que
// guardar "el último usage" en un campo del closure mezclaría el consumo de llamadas de
// expedientes distintos corriendo a la vez. El callback captura por cierre en cada llamada de
// workflow.ts, sin estado compartido entre invocaciones.
export interface OfficeIntelligence {
  readonly modelPolicyFingerprint?: string;
  selectModel?(request: ModelRequest): ModelSelection;
  // OfficeRuntime.updateAgentModelProfile() la llama tras validar y escribir una política nueva en
  // disco, para que esta misma instancia (reusada entre expedientes, ver nota de onUsage debajo)
  // la use desde la siguiente llamada sin reiniciar el proceso.
  reloadModelRouter?(router: ModelRouter): void;
  coordinate(context: CoordinatorContext, onUsage?: (usage: ModelUsage) => void): Promise<unknown>;
  execute(context: SpecialistContext, onUsage?: (usage: ModelUsage) => void): Promise<unknown>;
  review(context: SpecialistContext, onUsage?: (usage: ModelUsage) => void): Promise<unknown>;
  delegate?(context: DepartmentContext, onUsage?: (usage: ModelUsage) => void): Promise<unknown>;
  // Archivista: fuera del workflow, después de que un expediente cerró (OfficeRuntime).
  distill?(context: ArchivistContext, onUsage?: (usage: ModelUsage) => void): Promise<unknown>;
  // Importación de documentos a memoria (OfficeRuntime.ingestMemorySection).
  ingest?(context: IngestContext, onUsage?: (usage: ModelUsage) => void): Promise<unknown>;
  // Respuesta rápida del chat, fuera del workflow (OfficeRuntime.ask).
  ask?(context: AssistantContext, onUsage?: (usage: ModelUsage) => void): Promise<unknown>;
}
