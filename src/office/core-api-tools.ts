import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { clip } from './repo-tools.js';

const Id = z.string().trim().min(36).max(36).describe('UUID exacto obtenido al consultar Core');
const Version = z.string().trim().min(20).max(60).describe('updated_at exacto de la última consulta, sin modificar');
const Client = z.object({ clientId: Id });
const Edit = { clientId: Id, recordId: Id, expectedUpdatedAt: Version };

async function callCore(action: string, input: Record<string, unknown>, config: unknown): Promise<string> {
  const url = process.env.CORE_API_URL;
  const token = process.env.CORE_API_TOKEN;
  if (!url || !token) throw new Error('API de Core no configurada (CORE_API_URL/CORE_API_TOKEN)');
  const metadata = (config as { metadata?: Record<string, unknown> } | undefined)?.metadata;
  const agentId = metadata?.veridisAgentId;
  const orderId = metadata?.veridisOrderId;
  if (typeof agentId !== 'string' || typeof orderId !== 'string') throw new Error('Core exige agente y expediente identificados por el motor');
  const response = await fetch(new URL('/api/integrations/veridiscorp/actions', url), {
    method: 'POST', redirect: 'error', signal: AbortSignal.timeout(20000),
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ ...input, action, agentId, orderId }),
  });
  const result = await response.json() as { error?: string };
  if (!response.ok) throw new Error(`Core (${response.status}): ${result.error ?? 'operación rechazada'}`);
  return clip(JSON.stringify(result));
}

export const crmInspectWorkspaceTool = tool(
  async (input, config) => callCore('inspect_client', input, config),
  { name: 'crm_inspect_workspace', description: 'Consulta contactos, solicitudes e historial reciente de un cliente en Core. Devuelve IDs y updated_at para cambios posteriores. Solo lectura.', schema: Client },
);
export const crmUpdateContactTool = tool(
  async (input, config) => callCore('update_contact', input, config),
  { name: 'crm_update_contact', description: 'Corrige nombre, correo, teléfono, rol o notas de un contacto existente en Core. Exige consulta previa y updated_at vigente; registra agente y expediente. Nunca borra ni cambia de cliente.', schema: z.object({ ...Edit,
    changes: z.object({ name: z.string().trim().min(1).max(140).optional(), email: z.string().email().max(140).nullable().optional(),
      phone: z.string().trim().min(1).max(30).nullable().optional(), role: z.enum(['contacto', 'decisor', 'logistica', 'cta']).optional(),
      notes: z.string().trim().min(1).max(2000).nullable().optional() }).strict(),
  }).strict() },
);
export const crmUpdateRequestTool = tool(
  async (input, config) => callCore('update_request', input, config),
  { name: 'crm_update_request', description: 'Corrige título, descripción, prioridad o fecha de una solicitud de Core. Exige consulta previa y updated_at vigente. No cambia estado, asignados, pagos ni publica nada.', schema: z.object({ ...Edit,
    changes: z.object({ title: z.string().trim().min(1).max(140).optional(), description: z.string().trim().min(1).max(2000).nullable().optional(),
      priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(), due_date: z.string().max(10).nullable().optional() }).strict(),
  }).strict() },
);

export const CORE_API_READ_TOOLS = [crmInspectWorkspaceTool];
export const CORE_API_WRITE_TOOLS = [crmUpdateContactTool, crmUpdateRequestTool];

const TaskStatus = z.enum(['pending', 'in_progress', 'review', 'approved', 'done', 'blocked']);
const TaskPriority = z.enum(['urgent', 'high', 'normal', 'low']);
export const projectsListTasksTool = tool(
  async (input, config) => callCore('list_tasks', input, config),
  { name: 'projects_list_tasks', description: 'Lista una página de tareas del módulo interno de Core, con cliente, ID, estado y updated_at. Sin ClickUp. Usa nextAfterId como afterId para continuar; omitir clientId consulta la agencia.',
    schema: z.object({ clientId: Id.optional(), status: TaskStatus.optional(), limit: z.number().int().min(1).max(20).default(5), afterId: Id.optional() }).strict() },
);
export const projectsGetTaskTool = tool(
  async (input, config) => callCore('get_task', input, config),
  { name: 'projects_get_task', description: 'Consulta una tarea interna de Core por cliente e ID, con descripción, fechas, subtarea padre, responsables y versión. Solo lectura.', schema: z.object({ clientId: Id, taskId: Id }).strict() },
);
export const projectsCreateTaskTool = tool(
  async (input, config) => callCore('create_task', input, config),
  { name: 'projects_create_task', description: 'Crea una tarea o subtarea interna de Core en pending. Solo PM. operationKey es una clave estable y única dentro del expediente para esta creación; repetirla con el mismo contenido recupera la tarea sin duplicarla. Incluye motivo real del encargo.',
    schema: z.object({ clientId: Id, operationKey: z.string().trim().min(1).max(100), reason: z.string().trim().min(3).max(2000), task: z.object({
      name: z.string().trim().min(1).max(300), description: z.string().trim().max(4000).nullable().optional(), priority: TaskPriority.nullable().optional(),
      parent_id: Id.nullable().optional(), start_date: z.string().max(10).nullable().optional(), due_date: z.string().max(10).nullable().optional(),
    }).strict() }).strict() },
);
export const projectsUpdateTaskTool = tool(
  async (input, config) => callCore('update_task', input, config),
  { name: 'projects_update_task', description: 'Actualiza una tarea nativa de Core: nombre, descripción, estado, prioridad o fechas. Solo PM; exige consulta previa, expectedUpdatedAt exacto y motivo. Un 409 exige releer. No cambia responsables, padre o cliente ni elimina tareas; usa hechos comprobados para declarar avances.',
    schema: z.object({ clientId: Id, taskId: Id, expectedUpdatedAt: Version, reason: z.string().trim().min(3).max(2000), changes: z.object({
      name: z.string().trim().min(1).max(300).optional(), description: z.string().trim().max(4000).nullable().optional(), status: TaskStatus.optional(),
      priority: TaskPriority.nullable().optional(), start_date: z.string().max(10).nullable().optional(), due_date: z.string().max(10).nullable().optional(),
    }).strict() }).strict() },
);
export const PROJECT_READ_TOOLS = [projectsListTasksTool, projectsGetTaskTool];
export const PROJECT_WRITE_TOOLS = [projectsCreateTaskTool, projectsUpdateTaskTool];
