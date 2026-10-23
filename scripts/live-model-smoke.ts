import 'dotenv/config';
import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { z } from 'zod';
import { ContentRuntime } from '../src/runtime/service.js';
import { createRuntimeServer } from '../src/runtime/http.js';
import { realModelGateway } from '../src/runtime/providers.js';
import { migrate, provisionSession } from '../src/runtime/database.js';
import { Defaults } from '../src/runtime/contracts.js';

async function main() {
 // El wrapper crea y elimina un clúster temporal; nunca se usa DATABASE_URL para esta prueba.
 const connectionString = process.env.VERIDIS_TEST_DATABASE_URL;
 if (!connectionString) throw new Error('Falta base temporal de prueba');
 const pool = new Pool({ connectionString, max: 10, connectionTimeoutMillis: 5000 });
 const providerErrors: { stage: string; status: number | null }[] = [];
 const baseGateway = realModelGateway();
 const reservation = z.coerce.number().int().positive().max(1000000).parse(process.env.VERIDIS_MODEL_RESERVATION_MICROS);
 const runtime = new ContentRuntime(pool, {
  identify: (stage) => baseGateway.identify(stage),
  async invoke(stage, data, signal) {
   try { return await baseGateway.invoke(stage, data, signal); }
   catch (error) { providerErrors.push({ stage, status: typeof (error as { status?: unknown })?.status === 'number' ? (error as { status: number }).status : null }); throw error; }
  },
 }, { async send() { throw new Error('Entrega deshabilitada en prueba de modelos'); }, async lookup() { return null; } }, {
  budget: { ...Defaults, maxModelCalls: 2, maxToolCalls: 0, maxCostMicros: reservation * 2, maxDurationMs: 120000 }, modelReservationMicros: reservation,
 });
 const server = createRuntimeServer(runtime);
 try {
  await migrate(pool);
  const config = JSON.parse(readFileSync(new URL('../config/runtime-session.example.json', import.meta.url), 'utf8'));
  config.scope.workspaceId = 'smoke-' + randomUUID();
  config.expiresAt = new Date(Date.now() + 300000).toISOString();
  const token = await provisionSession(pool, config);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const call = async (path: string, payload?: unknown) => {
   const response = await fetch(url + path, { method: payload === undefined ? 'GET' : 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    ...(payload === undefined ? {} : { body: JSON.stringify(payload) }), signal: AbortSignal.timeout(100000) });
   return { status: response.status, data: await response.json() as any };
  };
  const created = await call('/runs', { brief: 'Escribe exactamente una frase en español, de 12 a 20 palabras, invitando a organizar mejor las tareas del equipo. Sin estadísticas ni afirmaciones comerciales.', approverHumanId: config.principal.id });
  if (created.status !== 200) throw new Error('No se pudo iniciar la prueba');
  const id = created.data.run.id;
  const advanced = await call(`/runs/${id}/advance`, {});
  const snapshot = await call(`/runs/${id}`);
  const run = snapshot.data.run;
  console.log(JSON.stringify({
   mode: 'live-models-governed', runId: id, requestStatus: advanced.status, status: run.status,
   modelCalls: run.modelCalls, toolCalls: run.toolCalls, artifactVersions: snapshot.data.artifacts.length,
   artifactText: snapshot.data.artifacts[0]?.content ?? null,
   review: run.review,
   attempts: snapshot.data.attempts.map((a: any) => ({ stage: a.stage, provider: a.provider, model: a.model, outcome: a.outcome,
    inputTokens: a.inputTokens, outputTokens: a.outputTokens, costStatus: a.costStatus })),
   providerErrors, publicationExecuted: false,
  }, null, 2));
  if (advanced.status !== 200 || run.status !== 'awaiting_approval') process.exitCode = 1;
 } finally {
  server.closeAllConnections();
  if (server.listening) await new Promise<void>((resolve) => server.close(() => resolve()));
  await pool.end();
 }
}
main().catch(() => { process.stderr.write('La prueba real no se completó. Revisa configuración o disponibilidad del proveedor.\n'); process.exitCode = 1; });
