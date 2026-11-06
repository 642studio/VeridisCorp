import { tool, type StructuredToolInterface } from '@langchain/core/tools';
import { z } from 'zod';
import { clip } from './repo-tools.js';
import { db, resolveClientId, isCoreDbConfigured } from './core-tools.js';

// Lectura de finanzas de 642CORE (allowedTools "finance.read"): solo las tablas operativas de
// contexto de un cliente (cuentas, facturas, transacciones) — a propósito NUNCA pólizas
// contables (finance_journal_entries/lines), ajustes fiscales (finance_fiscal_overrides),
// auditoría de transacciones (finance_transaction_audit_logs), importaciones bancarias crudas
// (finance_bank_statement_imports), activos fijos ni planeación (finance_plan_*): eso es
// contabilidad interna/auditoría, no "contexto" para trabajar con un cliente o sus tareas. Se
// agrega aparte, explícitamente, si algún día se necesita. Usa el mismo pool que core.read
// (core-tools.ts) — misma conexión, más GRANTs (ver docs/sql/core_grants_finance.sql).
// Solo lectura: ningún tool de este archivo ejecuta INSERT/UPDATE/DELETE.

const MAX_ROWS = 50;
const Limit = z.number().int().min(1).max(MAX_ROWS).default(15);
const InvoiceStatus = z.enum(['pending', 'paid', 'cancelled']);

export const financeGetClientSummaryTool = tool(
  async ({ client }) => {
    const found = await resolveClientId(client);
    if (!found) return `No existe ningún cliente con id/slug "${client}".`;
    const [accounts, invoices, transactions] = await Promise.all([
      db().query(
        `select name, type, balance, currency, status from public.finance_accounts
         where client_id = $1 and status = 'active' order by name limit $2`,
        [found.id, MAX_ROWS],
      ),
      db().query(
        `select status, count(*)::int as n, coalesce(sum(total), 0)::numeric as total
         from public.finance_invoices where client_id = $1 group by status`,
        [found.id],
      ),
      db().query(
        `select type, category, amount, currency, description, transaction_date
         from public.finance_transactions
         where client_id = $1 and deleted_at is null
         order by transaction_date desc limit 10`,
        [found.id],
      ),
    ]);
    return clip(JSON.stringify({
      cliente: found.legal_name,
      cuentas: accounts.rows,
      facturas_por_estado: invoices.rows,
      ultimas_transacciones: transactions.rows,
    }));
  },
  {
    name: 'finance_get_client_summary',
    description: 'Resumen financiero de un cliente de 642CORE para contexto: cuentas activas con su saldo, facturas agrupadas por estado (pending/paid/cancelled) y últimas transacciones. Solo lectura; no incluye pólizas contables, ajustes fiscales ni auditoría.',
    schema: z.object({ client: z.string().trim().min(1).max(80).describe('id (uuid) o slug del cliente') }),
  },
);

export const financeListInvoicesTool = tool(
  async ({ client, status, limit }) => {
    const found = await resolveClientId(client);
    if (!found) return `No existe ningún cliente con id/slug "${client}".`;
    const { rows } = await db().query(
      `select uuid_sat, direction, emitter, receiver, total, currency, status, invoice_date, paid_at
       from public.finance_invoices
       where client_id = $1 and ($2::text is null or status = $2)
       order by invoice_date desc
       limit $3`,
      [found.id, status ?? null, limit],
    );
    return clip(rows.length
      ? JSON.stringify({ cliente: found.legal_name, facturas: rows })
      : `Sin facturas para "${found.legal_name}".`);
  },
  {
    name: 'finance_list_invoices',
    description: 'Lista facturas (CFDI) de un cliente de 642CORE, opcionalmente filtradas por estado (pending, paid, cancelled). Solo lectura.',
    schema: z.object({
      client: z.string().trim().min(1).max(80).describe('id (uuid) o slug del cliente'),
      status: InvoiceStatus.optional(),
      limit: Limit,
    }),
  },
);

export const FINANCE_TOOLS: StructuredToolInterface[] = [financeGetClientSummaryTool, financeListInvoicesTool];

export async function describeFinance(): Promise<string | null> {
  if (!isCoreDbConfigured()) return null;
  try {
    const { rows } = await db().query(`select count(*)::int as n from public.finance_invoices where status = 'pending'`);
    return `Finanzas disponibles (642CORE, solo lectura, solo contexto): ${rows[0]?.n ?? 0} facturas pendientes en total. `
      + 'Usa finance_get_client_summary para el panorama de un cliente y finance_list_invoices para sus facturas.';
  } catch (error) {
    return `Finanzas configuradas pero no disponibles ahora (${error instanceof Error ? error.message.slice(0, 120) : 'error'}).`;
  }
}
