import { tool, type StructuredToolInterface } from '@langchain/core/tools';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { clip } from './repo-tools.js';
import { db, writeDb, resolveClientId, isCoreDbConfigured, isCoreWriteDbConfigured } from './core-tools.js';

// Lectura/escritura de tareas de 642CORE (allowedTools "tasks.read"/"tasks.write"): reemplazo
// nativo de ClickUp (public.tasks/task_assignees/task_templates/task_activity). Usa los mismos
// dos pools que core.read/core.write (core-tools.ts) — misma conexión, solo más GRANTs (ver
// docs/sql/core_grants_tasks_finance.sql), nunca credenciales nuevas.
// - tasks.write solo INSERTA (crear una tarea, asignarla a alguien); nunca cambia estado, nunca
//   reasigna quitando a otros, nunca borra. Eso lo sigue haciendo el equipo en 642CORE.
// - Insertar en tasks/task_assignees dispara los triggers reales de 642CORE que registran el
//   historial en task_activity (quedan con autor "Automatización"). Esos triggers son "security
//   invoker": corren con los permisos de quien hizo el INSERT (core_write), no con los del dueño
//   de la función — por eso el rol de escritura también necesita SELECT en profiles, INSERT en
//   task_activity y EXECUTE en record_task_activity(), no solo INSERT en tasks (ver el SQL).
// - Sin RETURNING, mismo motivo que en core-tools.ts: core_write no tiene SELECT en
//   tasks/task_assignees, y RETURNING lo exigiría. El id se genera aquí.

const MAX_ROWS = 50;
const Limit = z.number().int().min(1).max(MAX_ROWS).default(15);
const TaskStatus = z.enum(['pending', 'in_progress', 'review', 'approved', 'done', 'blocked']);
const TaskPriority = z.enum(['urgent', 'high', 'normal', 'low']);

async function resolveUserId(person: string): Promise<{ id: string; full_name: string | null; email: string | null } | null> {
  const needle = person.trim();
  const { rows } = await db().query(
    `select id, full_name, email from public.profiles
     where id::text = $1 or email ilike $1 or full_name ilike '%' || $1 || '%'
     order by (email ilike $1) desc
     limit 1`,
    [needle],
  );
  return rows[0] ?? null;
}

export const tasksListTool = tool(
  async ({ client, status, limit }) => {
    const found = await resolveClientId(client);
    if (!found) return `No existe ningún cliente con id/slug "${client}".`;
    const { rows } = await db().query(
      `select id, name, status, priority, start_date, due_date, parent_id
       from public.tasks
       where client_id = $1 and ($2::text is null or status = $2)
       order by due_date nulls last, created_at
       limit $3`,
      [found.id, status ?? null, limit],
    );
    return clip(rows.length
      ? JSON.stringify({ cliente: found.legal_name, tareas: rows })
      : `Sin tareas para "${found.legal_name}".`);
  },
  {
    name: 'tasks_list',
    description: 'Lista tareas reales de un cliente en 642CORE (reemplazo nativo de ClickUp), opcionalmente filtradas por estado. Solo lectura.',
    schema: z.object({
      client: z.string().trim().min(1).max(80).describe('id (uuid) o slug del cliente'),
      status: TaskStatus.optional(),
      limit: Limit,
    }),
  },
);

export const tasksGetTool = tool(
  async ({ task_id }) => {
    const { rows: tasks } = await db().query(
      `select t.id, t.name, t.description, t.status, t.priority, t.start_date, t.due_date,
              t.parent_id, c.legal_name as cliente
       from public.tasks t join public.clients c on c.id = t.client_id
       where t.id = $1 limit 1`,
      [task_id],
    );
    if (!tasks.length) return `No existe ninguna tarea con id "${task_id}".`;
    const [assignees, activity] = await Promise.all([
      db().query(
        `select p.full_name, p.email from public.task_assignees ta
         join public.profiles p on p.id = ta.user_id
         where ta.task_id = $1`,
        [task_id],
      ),
      db().query(
        `select kind, author_name, body, created_at from public.task_activity
         where task_id = $1 order by id desc limit 10`,
        [task_id],
      ),
    ]);
    return clip(JSON.stringify({ tarea: tasks[0], asignados: assignees.rows, actividad_reciente: activity.rows }));
  },
  {
    name: 'tasks_get',
    description: 'Detalle de una tarea de 642CORE por id: datos, a quién está asignada y su actividad reciente (comentarios y cambios). Solo lectura.',
    schema: z.object({ task_id: z.string().trim().uuid() }),
  },
);

export const CORE_TASK_READ_TOOLS: StructuredToolInterface[] = [tasksListTool, tasksGetTool];

export async function describeTasks(): Promise<string | null> {
  if (!isCoreDbConfigured()) return null;
  try {
    const { rows } = await db().query(`select count(*)::int as n from public.tasks where status <> 'done'`);
    return `Tareas disponibles (642CORE, solo lectura): ${rows[0]?.n ?? 0} tareas abiertas. `
      + 'Usa tasks_list para ver las de un cliente y tasks_get para el detalle de una (asignados, actividad).';
  } catch (error) {
    return `Tareas configuradas pero no disponibles ahora (${error instanceof Error ? error.message.slice(0, 120) : 'error'}).`;
  }
}

// --- Escritura (tasks.write): solo INSERT en tasks/task_assignees, nunca UPDATE/DELETE. ---

export const tasksCreateTool = tool(
  async ({ client, name, description, priority, start_date, due_date, parent_task_id, assignee }) => {
    const found = await resolveClientId(client);
    if (!found) return `No existe ningún cliente con id/slug "${client}". No se creó nada.`;
    if (parent_task_id) {
      const { rows } = await db().query(`select 1 from public.tasks where id = $1 and client_id = $2`, [parent_task_id, found.id]);
      if (!rows.length) return `La tarea padre "${parent_task_id}" no existe o no es de "${found.legal_name}". No se creó nada.`;
    }
    const id = randomUUID();
    await writeDb().query(
      `insert into public.tasks(id, client_id, parent_id, name, description, priority, start_date, due_date)
       values ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [id, found.id, parent_task_id ?? null, name.trim(), description?.trim() || null, priority ?? null, start_date ?? null, due_date ?? null],
    );
    let asignadoA: string | null = null;
    if (assignee) {
      const person = await resolveUserId(assignee);
      if (person) {
        await writeDb().query(
          `insert into public.task_assignees(task_id, user_id) values ($1, $2) on conflict do nothing`,
          [id, person.id],
        );
        asignadoA = person.full_name ?? person.email ?? person.id;
      } else {
        asignadoA = `no encontrado: "${assignee}"`;
      }
    }
    return clip(JSON.stringify({
      creada: true, id, cliente: found.legal_name, status: 'pending', asignado_a: asignadoA, created_at: new Date().toISOString(),
    }));
  },
  {
    name: 'tasks_create',
    description: 'Crea una tarea nueva para un cliente en 642CORE (reemplazo nativo de ClickUp), opcionalmente como subtarea de otra (parent_task_id) y/o asignada de una vez a alguien del equipo por nombre o correo. Solo crea; queda en estado "pending".',
    schema: z.object({
      client: z.string().trim().min(1).max(80).describe('id (uuid) o slug del cliente'),
      name: z.string().trim().min(3).max(200),
      description: z.string().trim().max(2000).optional(),
      priority: TaskPriority.optional(),
      start_date: z.string().trim().max(10).optional().describe('fecha AAAA-MM-DD'),
      due_date: z.string().trim().max(10).optional().describe('fecha AAAA-MM-DD'),
      parent_task_id: z.string().trim().uuid().optional().describe('id de la tarea padre, si esta es una subtarea'),
      assignee: z.string().trim().max(140).optional().describe('nombre o correo de la persona a asignar'),
    }),
  },
);

export const tasksAssignUserTool = tool(
  async ({ task_id, assignee }) => {
    const { rows: tasks } = await db().query(
      `select t.id, c.legal_name from public.tasks t join public.clients c on c.id = t.client_id where t.id = $1`,
      [task_id],
    );
    if (!tasks.length) return `No existe ninguna tarea con id "${task_id}". No se asignó nada.`;
    const person = await resolveUserId(assignee);
    if (!person) return `No existe ninguna persona con nombre/correo "${assignee}". No se asignó nada.`;
    await writeDb().query(
      `insert into public.task_assignees(task_id, user_id) values ($1, $2) on conflict do nothing`,
      [task_id, person.id],
    );
    return clip(JSON.stringify({ asignado: true, tarea: task_id, cliente: tasks[0].legal_name, persona: person.full_name ?? person.email }));
  },
  {
    name: 'tasks_assign_user',
    description: 'Asigna una tarea existente de 642CORE a una persona del equipo, por nombre o correo. Solo agrega esa asignación; no quita a otros asignados ni cambia la tarea.',
    schema: z.object({
      task_id: z.string().trim().uuid(),
      assignee: z.string().trim().min(2).max(140).describe('nombre o correo de la persona'),
    }),
  },
);

export const CORE_TASK_WRITE_TOOLS: StructuredToolInterface[] = [tasksCreateTool, tasksAssignUserTool];

export async function describeTasksWrite(): Promise<string | null> {
  if (!isCoreWriteDbConfigured()) return null;
  return 'Escritura de tareas disponible (642CORE): tasks_create y tasks_assign_user. Las dos solo CREAN — '
    + 'una tarea nueva o una asignación nueva — nunca cambian estado, reasignan quitando a otros ni borran. '
    + 'Usa tasks_list/tasks_get primero para confirmar el cliente y, si aplica, la tarea correctos.';
}
