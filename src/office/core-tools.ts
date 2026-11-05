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
