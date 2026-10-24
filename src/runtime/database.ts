import { createHash, randomBytes } from 'node:crypto';
import { Pool, type PoolClient } from 'pg';
import { AccessScope, PermissionGrant, Principal, type Operation } from '../governance/contracts.js';

export const scopeKey = (s: AccessScope) => JSON.stringify([s.workspaceId, s.companyId, s.divisionId, s.clientId, s.projectId]);
export const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex');
export const schema = `
CREATE SCHEMA IF NOT EXISTS veridis_runtime_v1;
CREATE TABLE IF NOT EXISTS veridis_runtime_v1.sessions (
 token_hash text PRIMARY KEY, principal jsonb NOT NULL, scope jsonb NOT NULL,
 expires_at timestamptz NOT NULL, revoked boolean NOT NULL DEFAULT false
);
CREATE TABLE IF NOT EXISTS veridis_runtime_v1.grants (
 id text PRIMARY KEY, scope_key text NOT NULL, data jsonb NOT NULL
);
CREATE INDEX IF NOT EXISTS runtime_grants_scope ON veridis_runtime_v1.grants(scope_key);
CREATE TABLE IF NOT EXISTS veridis_runtime_v1.runs (
 id uuid PRIMARY KEY, scope_key text NOT NULL, data jsonb NOT NULL
);
CREATE INDEX IF NOT EXISTS runtime_runs_scope ON veridis_runtime_v1.runs(scope_key);
-- Columnas derivadas para listar sin escanear el jsonb; data sigue siendo la fuente de verdad.
-- created_at se guarda como el texto ISO-8601 (siempre UTC, ancho fijo): ordena igual que una fecha
-- sin necesitar ::timestamptz, cuyo cast depende de la zona de sesión y no es válido en una columna generada.
ALTER TABLE veridis_runtime_v1.runs ADD COLUMN IF NOT EXISTS status text GENERATED ALWAYS AS (data->>'status') STORED;
ALTER TABLE veridis_runtime_v1.runs ADD COLUMN IF NOT EXISTS created_at text GENERATED ALWAYS AS (data->>'createdAt') STORED;
CREATE INDEX IF NOT EXISTS runtime_runs_scope_status ON veridis_runtime_v1.runs(scope_key, status);
CREATE INDEX IF NOT EXISTS runtime_runs_scope_created ON veridis_runtime_v1.runs(scope_key, created_at DESC, id DESC);
CREATE TABLE IF NOT EXISTS veridis_runtime_v1.tasks (
 run_id uuid NOT NULL REFERENCES veridis_runtime_v1.runs(id), id text NOT NULL, data jsonb NOT NULL,
 PRIMARY KEY(run_id,id)
);
CREATE TABLE IF NOT EXISTS veridis_runtime_v1.artifacts (
 run_id uuid NOT NULL REFERENCES veridis_runtime_v1.runs(id), version integer NOT NULL CHECK(version > 0),
 content text NOT NULL, content_hash text NOT NULL, data jsonb NOT NULL, PRIMARY KEY(run_id,version)
);
CREATE TABLE IF NOT EXISTS veridis_runtime_v1.approvals (
 run_id uuid NOT NULL REFERENCES veridis_runtime_v1.runs(id), version integer NOT NULL,
 data jsonb NOT NULL, PRIMARY KEY(run_id,version),
 FOREIGN KEY(run_id,version) REFERENCES veridis_runtime_v1.artifacts(run_id,version)
);
CREATE TABLE IF NOT EXISTS veridis_runtime_v1.attempts (
 id uuid PRIMARY KEY, run_id uuid NOT NULL REFERENCES veridis_runtime_v1.runs(id),
 kind text NOT NULL CHECK(kind IN ('model','tool')), data jsonb NOT NULL
);
CREATE INDEX IF NOT EXISTS runtime_attempts_run ON veridis_runtime_v1.attempts(run_id);
CREATE TABLE IF NOT EXISTS veridis_runtime_v1.operations (
 run_id uuid NOT NULL REFERENCES veridis_runtime_v1.runs(id), version integer NOT NULL,
 idempotency_key text NOT NULL UNIQUE, data jsonb NOT NULL, PRIMARY KEY(run_id,version)
);
CREATE TABLE IF NOT EXISTS veridis_runtime_v1.audit (
 sequence bigserial PRIMARY KEY, run_id uuid, scope_key text NOT NULL,
 occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(), data jsonb NOT NULL
);
CREATE INDEX IF NOT EXISTS runtime_audit_run ON veridis_runtime_v1.audit(run_id, sequence);
-- Solo índice para listar: el estado real del expediente de office/ vive en el checkpoint de
-- LangGraph (tablas propias de PostgresSaver), no aquí. status/updated_at son una copia de
-- lectura rápida que esta capa actualiza después de cada invocación real del grafo.
CREATE TABLE IF NOT EXISTS veridis_runtime_v1.office_orders (
 id uuid PRIMARY KEY, scope_key text NOT NULL, thread_id text NOT NULL UNIQUE,
 objective text NOT NULL, status text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(), updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS runtime_office_orders_scope ON veridis_runtime_v1.office_orders(scope_key, created_at DESC);
-- Marca qué expedientes nació de un disparo automático, no de un humano. Sin referencia a
-- scheduled_tasks(id): esta columna solo sirve para mostrar/filtrar, igual que el resto de
-- punteros entre tablas de este archivo (runs/tasks es la excepción, no la regla).
ALTER TABLE veridis_runtime_v1.office_orders ADD COLUMN IF NOT EXISTS created_by_schedule_id uuid NULL;
-- scope completo (no solo scope_key): a diferencia de office_orders, el scheduler necesita
-- reconstruir el AccessScope real para poder disparar sin que haya una sesión humana detrás
-- (mismo patrón que veridis_runtime_v1.sessions).
CREATE TABLE IF NOT EXISTS veridis_runtime_v1.scheduled_tasks (
 id uuid PRIMARY KEY, scope_key text NOT NULL, scope jsonb NOT NULL,
 name text NOT NULL, objective_template text NOT NULL,
 cron_expression text NOT NULL, timezone text NOT NULL,
 enabled boolean NOT NULL DEFAULT true,
 current_order_id uuid NULL, consecutive_failures integer NOT NULL DEFAULT 0,
 last_run_at timestamptz NULL, last_fired_order_id uuid NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(), updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS runtime_scheduled_tasks_scope ON veridis_runtime_v1.scheduled_tasks(scope_key, created_at DESC);
CREATE INDEX IF NOT EXISTS runtime_scheduled_tasks_enabled ON veridis_runtime_v1.scheduled_tasks(enabled) WHERE enabled;
-- Archivos reales que produce una tarea de office/ (hoy solo pdf.generate). Los bytes viven en
-- Postgres (bytea), igual que artifacts.content hoy vive como texto — una sola fuente de verdad,
-- sin directorio aparte que aprovisionar ni respaldar. input_hash hace la herramienta idempotente
-- por (order_id, input): review() puede volver a pedir el mismo render sin duplicar el archivo.
CREATE TABLE IF NOT EXISTS veridis_runtime_v1.office_files (
 id uuid PRIMARY KEY, order_id uuid NOT NULL REFERENCES veridis_runtime_v1.office_orders(id),
 filename text NOT NULL, content_type text NOT NULL, content bytea NOT NULL,
 input_hash text NOT NULL, size_bytes integer NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS runtime_office_files_order ON veridis_runtime_v1.office_files(order_id);
CREATE UNIQUE INDEX IF NOT EXISTS runtime_office_files_dedupe ON veridis_runtime_v1.office_files(order_id, input_hash);
-- Primera credencial reversible del proyecto (ver src/runtime/secrets.ts): el refresh token de
-- OAuth se cifra en la aplicación (AES-256-GCM) antes de guardarse aquí, nunca en claro. Una
-- sola cuenta dedicada por ahora; account_email es la clave primaria para que una reautorización
-- reemplace en vez de duplicar.
CREATE TABLE IF NOT EXISTS veridis_runtime_v1.gmail_accounts (
 account_email text PRIMARY KEY, refresh_token_encrypted bytea NOT NULL, scope text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(), updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
`;
export async function migrate(pool: Pool) {
 await transaction(pool, async (tx) => {
  await tx.query("SELECT pg_advisory_xact_lock(hashtextextended('veridis.runtime.v1.migration',0))");
  await tx.query(schema);
 });
}
export async function transaction<T>(pool: Pool, work: (tx: PoolClient) => Promise<T>): Promise<T> {
 const tx = await pool.connect();
 try {
  await tx.query('BEGIN');
  await tx.query("SET LOCAL statement_timeout = '10s'");
  await tx.query("SET LOCAL lock_timeout = '5s'");
  const result = await work(tx); await tx.query('COMMIT'); return result;
 } catch (error) { await tx.query('ROLLBACK'); throw error; }
 finally { tx.release(); }
}

// Uso administrativo local; nunca se expone por HTTP ni se invoca desde agentes.
export async function provisionSession(pool: Pool, input: {
 principal: Principal; scope: AccessScope; expiresAt: string;
 permissions: { principal: Principal; operations: Operation[]; resourceType: string; resourceIds: string[] }[];
}): Promise<string> {
 const principal = Principal.parse(input.principal); const scope = AccessScope.parse(input.scope);
 if (principal.kind !== 'human' || Date.parse(input.expiresAt) <= Date.now()) throw new Error('Sesión humana o vigencia inválida');
 const token = randomBytes(32).toString('base64url');
 await transaction(pool, async (tx) => {
  await tx.query('INSERT INTO veridis_runtime_v1.sessions(token_hash,principal,scope,expires_at) VALUES($1,$2,$3,$4)', [tokenHash(token), principal, scope, input.expiresAt]);
  for (const [index, permission] of input.permissions.entries()) {
   const grant = PermissionGrant.parse({ id: `${tokenHash(token).slice(0,16)}-${index}`, ...permission, scope,
    validFrom: new Date().toISOString(), expiresAt: input.expiresAt });
   await tx.query('INSERT INTO veridis_runtime_v1.grants(id,scope_key,data) VALUES($1,$2,$3)', [grant.id, scopeKey(scope), grant]);
  }
 });
 return token;
}
