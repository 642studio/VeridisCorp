import { tool, type StructuredToolInterface } from '@langchain/core/tools';
import type { Pool } from 'pg';
import { z } from 'zod';
import { clip } from './repo-tools.js';

// Lectura del CRM de 642CORE (allowedTools "core.read"): clientes, contactos, marcas de
// lealtad, paquetes y estado VMI. Hoy vive en Supabase (nube); en el futuro puede ser el
// Postgres local de la oficina — a los agentes no les cambia nada, solo CORE_DATABASE_URL.
// - Solo lectura: ningún tool de este archivo ejecuta INSERT/UPDATE/DELETE.
// - Tablas y columnas fijas en el código, nunca una lista que llegue del modelo: aunque el
//   rol de Postgres (CORE_DATABASE_URL) ya debería estar limitado a estas tablas (ver
//   docs/sql/core_readonly_role.sql), esta es una segunda barrera si ese rol se amplía por error.
// - SQL parametrizado ($1, $2…) siempre; el modelo nunca entrega una cadena SQL.
// - Salida acotada en filas (máx. 50) y recortada con el mismo clip() que repo.read.

let pool: Pool | null = null;
// Lo fija runtime/cli.ts tras cargar el .env. Sin CORE_DATABASE_URL, cada tool falla en su
// primera llamada real — igual que clickup.read sin CLICKUP_API_KEY — nunca tumba execute().
export function configureCoreDb(client: Pool | null): void { pool = client; }

function db(): Pool {
  if (!pool) throw new Error('CRM no configurado (falta CORE_DATABASE_URL)');
  return pool;
}

// Escritura del CRM (allowedTools "core.write"): conexión separada, con su propio rol de
// Postgres (core_write, docs/sql/core_write_role.sql) que solo tiene INSERT en tres tablas
// aditivas — nunca UPDATE/DELETE, nunca sobre clients/client_packages/client_brands. Por eso
// vive en un Pool distinto al de lectura: si algún día se revoca o rota, no afecta a core.read.
let writePool: Pool | null = null;
export function configureCoreWriteDb(client: Pool | null): void { writePool = client; }

function writeDb(): Pool {
  if (!writePool) throw new Error('Escritura del CRM no configurada (falta CORE_WRITE_DATABASE_URL)');
  return writePool;
}

async function resolveClientId(client: string): Promise<{ id: string; legal_name: string } | null> {
  const { rows } = await db().query(
    `select id, legal_name from public.clients where id::text = $1 or slug = $1 limit 1`,
    [client.trim()],
  );
  return rows[0] ?? null;
}

const MAX_ROWS = 50;
const Limit = z.number().int().min(1).max(MAX_ROWS).default(15);
const SearchText = z.string().trim().min(2).max(100);

export const crmListClientsTool = tool(
  async ({ search, limit }) => {
    const needle = search?.trim() || null;
    const { rows } = await db().query(
      `select id, slug, legal_name, display_name, status, owner_name, owner_email, created_at
       from public.clients
       where $1::text is null
          or legal_name ilike '%' || $1 || '%'
          or display_name ilike '%' || $1 || '%'
          or slug ilike '%' || $1 || '%'
       order by legal_name
       limit $2`,
      [needle, limit],
    );
    return clip(rows.length ? JSON.stringify(rows) : 'Sin clientes que coincidan.');
  },
  {
    name: 'crm_list_clients',
    description: 'Lista clientes reales del CRM (642CORE), opcionalmente filtrados por texto en nombre o slug. Solo lectura.',
    schema: z.object({ search: z.string().trim().max(100).optional(), limit: Limit }),
  },
);

export const crmGetClientTool = tool(
  async ({ client }) => {
    const needle = client.trim();
    const { rows: clients } = await db().query(
      `select id, slug, legal_name, display_name, status, owner_name, owner_email, created_at, updated_at
       from public.clients where id::text = $1 or slug = $1 limit 1`,
      [needle],
    );
    if (!clients.length) return `No existe ningún cliente con id/slug "${client}".`;
    const row = clients[0] as { id: string };
    const [contacts, brands, packages, vmi] = await Promise.all([
      db().query(
        `select name, email, phone, role, is_primary from public.client_contacts
         where client_id = $1 order by is_primary desc, name limit $2`,
        [row.id, MAX_ROWS],
      ),
      db().query(
        `select name, slug, mechanic, is_active from public.client_brands
         where client_id = $1 order by name limit $2`,
        [row.id, MAX_ROWS],
      ),
      db().query(
        `select status, quantity, price, start_date, end_date from public.client_packages
         where client_id = $1 order by start_date desc nulls last limit $2`,
        [row.id, MAX_ROWS],
      ),
      db().query(
        `select vmi_project_name, last_run_at, notes from public.client_vmi_states
         where client_id = $1 limit 1`,
        [row.id],
      ),
    ]);
    return clip(JSON.stringify({
      cliente: clients[0],
      contactos: contacts.rows,
      marcas_lealtad: brands.rows,
      paquetes: packages.rows,
      vmi: vmi.rows[0] ?? null,
    }));
  },
  {
    name: 'crm_get_client',
    description: 'Detalle de un cliente del CRM por id o slug: datos base, contactos, marcas de lealtad, paquetes activos y estado VMI. Solo lectura.',
    schema: z.object({ client: z.string().trim().min(1).max(80).describe('id (uuid) o slug del cliente') }),
  },
);

export const crmSearchContactsTool = tool(
  async ({ query, limit }) => {
    const { rows } = await db().query(
      `select cc.name, cc.email, cc.phone, cc.role, c.legal_name as cliente, c.slug as cliente_slug
       from public.client_contacts cc
       join public.clients c on c.id = cc.client_id
       where cc.name ilike '%' || $1 || '%'
          or cc.email ilike '%' || $1 || '%'
          or cc.phone ilike '%' || $1 || '%'
       order by cc.name
       limit $2`,
      [query, limit],
    );
    return clip(rows.length ? JSON.stringify(rows) : 'Sin contactos que coincidan.');
  },
  {
    name: 'crm_search_contacts',
    description: 'Busca contactos de clientes del CRM por nombre, correo o teléfono. Solo lectura; son datos de contacto reales, no los repitas fuera de la tarea que los pidió.',
    schema: z.object({ query: SearchText, limit: Limit }),
  },
);

export const CORE_TOOLS: StructuredToolInterface[] = [crmListClientsTool, crmGetClientTool, crmSearchContactsTool];

// --- Escritura (core.write): solo INSERT, nunca UPDATE/DELETE, nunca sobre clients mismo. ---

const ActivityCategory = z.enum(['nota', 'seguimiento', 'alerta', 'otro'])
  .describe('nota: observación general; seguimiento: algo que requiere acción futura; alerta: algo que el equipo debe saber pronto; otro: cualquier otro caso');

export const crmAddActivityNoteTool = tool(
  async ({ client, category, title, detail }) => {
    const found = await resolveClientId(client);
    if (!found) return `No existe ningún cliente con id/slug "${client}". No se guardó nada.`;
    const { rows } = await writeDb().query(
      `insert into public.client_activity_log(client_id, category, title, detail)
       values ($1, $2, $3, $4) returning id, created_at`,
      [found.id, category, title.trim(), detail?.trim() || null],
    );
    return clip(JSON.stringify({ guardado: true, id: rows[0].id, cliente: found.legal_name, created_at: rows[0].created_at }));
  },
  {
    name: 'crm_add_activity_note',
    description: 'Agrega una nota al historial de actividad de un cliente del CRM (solo crea, nunca edita ni borra notas existentes).',
    schema: z.object({
      client: z.string().trim().min(1).max(80).describe('id (uuid) o slug del cliente'),
      category: ActivityCategory,
      title: z.string().trim().min(3).max(140),
      detail: z.string().trim().max(2000).optional(),
    }),
  },
);

const RequestType = z.enum(['diseno', 'adjuntar_foto', 'cambio', 'otro']);
const RequestPriority = z.enum(['low', 'normal', 'high']).default('normal');

export const crmCreateContentRequestTool = tool(
  async ({ client, type, title, description, priority }) => {
    const found = await resolveClientId(client);
    if (!found) return `No existe ningún cliente con id/slug "${client}". No se creó nada.`;
    const { rows } = await writeDb().query(
      `insert into public.content_requests(client_id, type, title, description, priority)
       values ($1, $2, $3, $4, $5) returning id, status, created_at`,
      [found.id, type, title.trim(), description?.trim() || null, priority],
    );
    return clip(JSON.stringify({
      creada: true, id: rows[0].id, cliente: found.legal_name, status: rows[0].status, created_at: rows[0].created_at,
    }));
  },
  {
    name: 'crm_create_content_request',
    description: 'Crea una solicitud de contenido para un cliente del CRM (queda en estado "pending" para que alguien del equipo la tome). Solo crea, nunca cambia el estado de una solicitud existente.',
    schema: z.object({
      client: z.string().trim().min(1).max(80).describe('id (uuid) o slug del cliente'),
      type: RequestType,
      title: z.string().trim().min(3).max(140),
      description: z.string().trim().max(2000).optional(),
      priority: RequestPriority,
    }),
  },
);

export const crmCreateContactTool = tool(
  async ({ client, name, email, phone, role }) => {
    const found = await resolveClientId(client);
    if (!found) return `No existe ningún cliente con id/slug "${client}". No se creó nada.`;
    const { rows } = await writeDb().query(
      `insert into public.client_contacts(client_id, name, email, phone, role)
       values ($1, $2, $3, $4, $5) returning id, created_at`,
      [found.id, name.trim(), email?.trim() || null, phone?.trim() || null, role?.trim() || 'contacto'],
    );
    return clip(JSON.stringify({ creado: true, id: rows[0].id, cliente: found.legal_name, created_at: rows[0].created_at }));
  },
  {
    name: 'crm_create_contact',
    description: 'Agrega un contacto nuevo a un cliente del CRM. Solo crea; no edita ni borra contactos existentes (para eso hace falta a alguien del equipo).',
    schema: z.object({
      client: z.string().trim().min(1).max(80).describe('id (uuid) o slug del cliente'),
      name: z.string().trim().min(2).max(140),
      email: z.string().trim().email().max(140).optional(),
      phone: z.string().trim().max(40).optional(),
      role: z.string().trim().max(60).optional().describe('rol del contacto, por ejemplo "gerente" o "dueño"'),
    }),
  },
);

export const CORE_WRITE_TOOLS: StructuredToolInterface[] = [crmAddActivityNoteTool, crmCreateContentRequestTool, crmCreateContactTool];

export async function describeCoreWrite(): Promise<string | null> {
  if (!writePool) return null;
  return 'Escritura del CRM disponible (642CORE): crm_add_activity_note, crm_create_content_request y '
    + 'crm_create_contact. Las tres solo CREAN — nunca editan ni borran nada existente. Usa crm_list_clients '
    + 'o crm_get_client primero para confirmar el cliente correcto antes de escribir.';
}

// Lo que el agente necesita saber antes de elegir: si el CRM está disponible y cuántos
// clientes reales tiene hoy, igual que describeRepos() hace con los repositorios.
export async function describeCore(): Promise<string | null> {
  if (!pool) return null;
  try {
    const { rows } = await pool.query('select count(*)::int as n from public.clients');
    return `CRM disponible (642CORE, solo lectura): ${rows[0]?.n ?? 0} clientes registrados. `
      + 'Usa crm_list_clients para buscar, crm_get_client para el detalle de uno y crm_search_contacts para ubicar a una persona.';
  } catch (error) {
    return `CRM configurado pero no disponible ahora (${error instanceof Error ? error.message.slice(0, 120) : 'error'}).`;
  }
}
