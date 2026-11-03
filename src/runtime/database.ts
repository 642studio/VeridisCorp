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
-- Cuántas entradas de state.modelCalls (ver office/workflow.ts) ya se volcaron a usage_records.
-- Marcador idempotente, mismo patrón que memory_distilled_at: evita duplicar filas si advance()
-- se vuelve a invocar sin que el grafo haya avanzado.
ALTER TABLE veridis_runtime_v1.office_orders ADD COLUMN IF NOT EXISTS usage_synced_count integer NOT NULL DEFAULT 0;
-- El archivista destila memoria una sola vez por expediente cerrado: quien logra poner esta marca
-- (UPDATE ... WHERE memory_distilled_at IS NULL) es el único que destila, aunque avance dos veces.
ALTER TABLE veridis_runtime_v1.office_orders ADD COLUMN IF NOT EXISTS memory_distilled_at timestamptz NULL;
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
-- Ledger plano de cada llamada a modelo dentro de un expediente de oficina (ModelCallRecord,
-- office/models.ts), para el panel de consumo (office/usage.ts). Es la contraparte de
-- assistant_messages para el chat: aquí una fila por llamada real, no un snapshot acumulado — el
-- acumulado (state.modelCalls) sigue viviendo solo en el checkpoint de LangGraph. Sin columna de
-- moneda ni de costStatus: la moneda es la única que declara VERIDIS_PRICES_FILE en todo el
-- proceso (mismo criterio que assistant_messages), y costStatus se deriva de cost_micros IS NULL.
-- occurred_at es cuándo se sincronizó la fila (al terminar start()/advance()), no el instante
-- exacto de la llamada — ModelCallRecord no trae timestamp propio.
CREATE TABLE IF NOT EXISTS veridis_runtime_v1.usage_records (
 id bigserial PRIMARY KEY, scope_key text NOT NULL,
 order_id uuid NOT NULL REFERENCES veridis_runtime_v1.office_orders(id),
 agent_id text NOT NULL, profile_id text NOT NULL, provider text NOT NULL, model text NOT NULL,
 input_tokens integer NULL, output_tokens integer NULL, cost_micros bigint NULL,
 occurred_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS runtime_usage_records_scope ON veridis_runtime_v1.usage_records(scope_key, occurred_at DESC);
CREATE INDEX IF NOT EXISTS runtime_usage_records_order ON veridis_runtime_v1.usage_records(order_id);
-- Primera credencial reversible del proyecto (ver src/runtime/secrets.ts): el refresh token de
-- OAuth se cifra en la aplicación (AES-256-GCM) antes de guardarse aquí, nunca en claro. Una
-- sola cuenta dedicada por ahora; account_email es la clave primaria para que una reautorización
-- reemplace en vez de duplicar.
CREATE TABLE IF NOT EXISTS veridis_runtime_v1.gmail_accounts (
 account_email text PRIMARY KEY, refresh_token_encrypted bytea NOT NULL, scope text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(), updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
-- Memoria corporativa (CorporateMemoryRecord, src/governance/contracts.ts): una fila por versión de
-- lo que se sabe sobre una entidad. embedding guarda el vector de similitud semántica (ver
-- src/runtime/embeddings.ts); dimensión fija en 768 porque el perfil por defecto es Ollama local
-- nomic-embed-text — cambiar de proveedor de embeddings exige migrar esta columna y reembeber todo.
-- Sin índice ANN todavía (ivfflat/hnsw): al tamaño actual del corpus el escaneo secuencial alcanza;
-- se añade cuando el volumen lo justifique, no antes. Requiere la extensión pgvector instalada en
-- el servidor (brew install pgvector en Mac; paquete postgresql-16-pgvector del repo PGDG en Linux).
CREATE EXTENSION IF NOT EXISTS vector;
CREATE TABLE IF NOT EXISTS veridis_runtime_v1.memory_records (
 id uuid PRIMARY KEY, scope_key text NOT NULL, data jsonb NOT NULL,
 embedding vector(768) NULL, embedding_model text NULL, embedded_at timestamptz NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE veridis_runtime_v1.memory_records ADD COLUMN IF NOT EXISTS entity_type text GENERATED ALWAYS AS (data->>'entityType') STORED;
ALTER TABLE veridis_runtime_v1.memory_records ADD COLUMN IF NOT EXISTS entity_id text GENERATED ALWAYS AS (data->>'entityId') STORED;
ALTER TABLE veridis_runtime_v1.memory_records ADD COLUMN IF NOT EXISTS version integer GENERATED ALWAYS AS ((data->>'version')::integer) STORED;
ALTER TABLE veridis_runtime_v1.memory_records ADD COLUMN IF NOT EXISTS status text GENERATED ALWAYS AS (data->>'status') STORED;
-- Búsqueda léxica exacta (ids, códigos, nombres propios) como respaldo del vector: el coseno solo
-- captura similitud semántica y no es confiable para coincidencias exactas de un término raro.
ALTER TABLE veridis_runtime_v1.memory_records ADD COLUMN IF NOT EXISTS search tsvector GENERATED ALWAYS AS (to_tsvector('spanish', data->>'content')) STORED;
CREATE UNIQUE INDEX IF NOT EXISTS runtime_memory_entity_version ON veridis_runtime_v1.memory_records(scope_key, entity_type, entity_id, version);
CREATE INDEX IF NOT EXISTS runtime_memory_scope_status ON veridis_runtime_v1.memory_records(scope_key, status);
CREATE INDEX IF NOT EXISTS runtime_memory_search ON veridis_runtime_v1.memory_records USING GIN(search);
-- Cada vez que memory.query devuelve una memoria a un agente: alimenta el mapa (qué memorias "se
-- encienden" porque de verdad se usan) y su contador de uso. Solo id y hora, nunca la pregunta.
CREATE TABLE IF NOT EXISTS veridis_runtime_v1.memory_recalls (
 id bigserial PRIMARY KEY, memory_id uuid NOT NULL, scope_key text NOT NULL,
 recalled_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS runtime_memory_recalls_memory ON veridis_runtime_v1.memory_recalls(scope_key, memory_id);
-- Respuestas rápidas del chat (OfficeRuntime.ask): una fila por pregunta, agrupadas por thread_id.
-- mode='order' guarda el encargo que se pasó a la oficina; el expediente vive en office_orders.
-- memories es una copia de las memorias usadas tal como estaban al responder (pueden cambiar después).
CREATE TABLE IF NOT EXISTS veridis_runtime_v1.assistant_messages (
 id uuid PRIMARY KEY, thread_id uuid NOT NULL, scope_key text NOT NULL, principal jsonb NOT NULL,
 question text NOT NULL, answer text NOT NULL, mode text NOT NULL CHECK (mode IN ('answer','order')),
 objective text NULL, memories jsonb NOT NULL DEFAULT '[]', provider text NOT NULL, model text NOT NULL,
 input_tokens integer NULL, output_tokens integer NULL, cost_micros bigint NULL, latency_ms integer NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS runtime_assistant_messages_thread ON veridis_runtime_v1.assistant_messages(scope_key, thread_id, created_at);
-- Para el panel de consumo (office/usage.ts): identifica qué perfil de modelo (ModelRouter)
-- resolvió esta llamada, así se puede saber su plataforma/apiKeyEnv igual que para
-- usage_records. NULL en filas anteriores a esta columna; el agregador las trata como "sin
-- perfil conocido" en vez de tronar.
ALTER TABLE veridis_runtime_v1.assistant_messages ADD COLUMN IF NOT EXISTS profile_id text NULL;
-- Conexiones MCP (src/runtime/mcp-store.ts). tools guarda lo que el servidor declaró más la decisión
-- humana de cuáles están activas; credential_encrypted va cifrada como el refresh token de Google.
-- memory_id apunta a la memoria corporativa vigente que describe la conexión. Un nombre retirado
-- puede volver a usarse (índice único parcial).
CREATE TABLE IF NOT EXISTS veridis_runtime_v1.mcp_connections (
 id uuid PRIMARY KEY, scope_key text NOT NULL, name text NOT NULL, url text NULL,
 status text NOT NULL CHECK (status IN ('active','needs_auth','error','requested','removed')),
 trust text NOT NULL CHECK (trust IN ('confirmed','unconfirmed')),
 purpose text NOT NULL, added_by jsonb NOT NULL, origin_order_id uuid NULL,
 server jsonb NULL, tools jsonb NOT NULL DEFAULT '[]', credential_encrypted bytea NULL,
 memory_id uuid NULL, last_error text NULL, last_checked_at timestamptz NULL,
 call_count integer NOT NULL DEFAULT 0, last_used_at timestamptz NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(), updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE UNIQUE INDEX IF NOT EXISTS runtime_mcp_connections_name ON veridis_runtime_v1.mcp_connections(scope_key, name) WHERE status <> 'removed';
-- Login con authenticator app (TOTP, RFC 6238), alternativa a pegar el bearer token a mano.
-- scope/permissions son el perfil que loginWithTotp() le pasa a provisionSession() en cada
-- login exitoso (mismas formas que el config.json de runtime:provision); el secreto TOTP se
-- cifra igual que gmail_accounts.refresh_token_encrypted (ver src/runtime/secrets.ts).
-- last_time_step bloquea reusar un código ya validado (no solo dentro de su ventana de 30s);
-- NULL hasta el primer login (nunca se ha consumido ningún paso de tiempo todavía).
CREATE TABLE IF NOT EXISTS veridis_runtime_v1.totp_credentials (
 principal_id text PRIMARY KEY, principal jsonb NOT NULL, secret_encrypted bytea NOT NULL,
 scope jsonb NOT NULL, permissions jsonb NOT NULL, session_ttl_seconds integer NOT NULL DEFAULT 43200,
 last_time_step bigint NULL, failed_attempts integer NOT NULL DEFAULT 0, locked_until timestamptz NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(), updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
-- Preferencias de configuración por ámbito (panel CONFIGURACIONES), nunca credenciales: esas
-- siguen solo en variables de entorno del proceso (ver AGENTS.md). Hoy solo guarda la voz de
-- ElevenLabs elegida por defecto; value es jsonb para admitir otras claves futuras sin migración.
CREATE TABLE IF NOT EXISTS veridis_runtime_v1.settings (
 scope_key text NOT NULL, key text NOT NULL, value jsonb NOT NULL, updated_by jsonb NOT NULL,
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(scope_key, key)
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
