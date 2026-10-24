import { randomUUID } from 'node:crypto';
import { Cron } from 'croner';
import type { Pool } from 'pg';
import { AccessScope } from '../governance/contracts.js';
import type { OfficeRuntime } from './office-runtime.js';

export type FireResult = 'fired' | 'skipped-overlap' | 'skipped-rate-limit' | 'skipped-disabled' | 'failed';

const DEFAULT_MAX_PER_HOUR = 10;
const DEFAULT_FAILURE_THRESHOLD = 3;

// Dispara una tarea programada una sola vez. Todo el estado se lee de una sola fuente de
// verdad fresca (la fila que devuelve el UPDATE de reclamo), nunca de una copia guardada en
// memoria — así el conteo de fallos consecutivos y el candado de solapamiento siempre reflejan
// lo que de verdad hay en la base, sin importar cuántas veces se haya disparado antes.
export async function fireOnce(
 pool: Pool, office: OfficeRuntime, scheduleId: string,
 options: { maxPerHour?: number; failureThreshold?: number } = {},
): Promise<FireResult> {
 const orderId = randomUUID();
 // Reclamo atómico: esto es lo único que de verdad evita que dos disparos se encimen si el
 // anterior sigue en curso (una revisión previa por separado tendría una carrera real).
 const claim = await pool.query(
  `UPDATE veridis_runtime_v1.scheduled_tasks SET current_order_id=$2, updated_at=clock_timestamp()
   WHERE id=$1 AND current_order_id IS NULL AND enabled RETURNING *`,
  [scheduleId, orderId],
 );
 if (claim.rows.length === 0) return 'skipped-overlap';
 const row = claim.rows[0] as {
  scope: unknown; scope_key: string; objective_template: string; consecutive_failures: number;
 };

 const maxPerHour = options.maxPerHour ?? DEFAULT_MAX_PER_HOUR;
 const rate = await pool.query(
  `SELECT count(*)::int AS n FROM veridis_runtime_v1.office_orders
   WHERE scope_key=$1 AND created_by_schedule_id IS NOT NULL AND created_at > now() - interval '1 hour'`,
  [row.scope_key],
 );
 if ((rate.rows[0] as { n: number }).n >= maxPerHour) {
  // No cuenta como fallo: la tarea está sana, solo tocó esperar.
  await pool.query('UPDATE veridis_runtime_v1.scheduled_tasks SET current_order_id=NULL WHERE id=$1', [scheduleId]);
  return 'skipped-rate-limit';
 }

 const scope = AccessScope.parse(row.scope);
 let outcome: 'completed' | 'paused' | 'active' | 'error';
 try {
  const result = await office.startScheduled(scope, row.objective_template, scheduleId, orderId);
  const status = (result.order as { status: string }).status;
  outcome = status === 'completed' ? 'completed' : status === 'paused' ? 'paused' : 'active';
 } catch {
  outcome = 'error';
 }

 // Una pregunta pendiente sin resolver (sigue 'active' e interrumpido) no cuenta a favor ni en
 // contra: un humano puede resolverla después desde el chat o la vista técnica.
 const isFailure = outcome === 'paused' || outcome === 'error';
 const nextFailures = outcome === 'completed' ? 0 : isFailure ? row.consecutive_failures + 1 : row.consecutive_failures;
 const threshold = options.failureThreshold ?? DEFAULT_FAILURE_THRESHOLD;
 const disable = isFailure && nextFailures >= threshold;
 await pool.query(
  `UPDATE veridis_runtime_v1.scheduled_tasks
   SET current_order_id=NULL, last_run_at=clock_timestamp(), last_fired_order_id=$2,
       consecutive_failures=$3, enabled = enabled AND NOT $4
   WHERE id=$1`,
  [scheduleId, orderId, nextFailures, disable],
 );
 return outcome === 'error' ? 'failed' : disable ? 'skipped-disabled' : 'fired';
}

type SchedulableRow = { id: string; cron_expression: string; timezone: string };

// Dueño de los temporizadores en memoria (croner no persiste nada por sí mismo — el estado
// real vive siempre en scheduled_tasks). Un proceso reiniciado simplemente vuelve a cargar las
// filas activas al arrancar; un disparo que debía ocurrir mientras estuvo apagado no se
// recupera — es el comportamiento simple elegido a propósito, no un descuido.
export class Scheduler {
 private jobs = new Map<string, Cron>();
 constructor(
  private readonly pool: Pool, private readonly office: OfficeRuntime,
  private readonly options: { maxPerHour?: number; failureThreshold?: number } = {},
 ) {}

 async start() {
  const rows = await this.pool.query<SchedulableRow>(
   'SELECT id,cron_expression,timezone FROM veridis_runtime_v1.scheduled_tasks WHERE enabled',
  );
  for (const row of rows.rows) this.register(row);
 }

 register(row: SchedulableRow) {
  this.unregister(row.id);
  const job = new Cron(row.cron_expression, { timezone: row.timezone }, () => {
   void fireOnce(this.pool, this.office, row.id, this.options)
    .then((result) => { if (result !== 'fired') process.stderr.write(`Tarea programada ${row.id}: ${result}\n`); })
    .catch((error: unknown) => process.stderr.write(`Error disparando tarea programada ${row.id}: ${error instanceof Error ? error.message : String(error)}\n`));
  });
  this.jobs.set(row.id, job);
 }

 unregister(id: string) {
  this.jobs.get(id)?.stop();
  this.jobs.delete(id);
 }

 stop() {
  for (const job of this.jobs.values()) job.stop();
  this.jobs.clear();
 }
}
