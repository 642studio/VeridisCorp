import 'dotenv/config';
import { readFileSync, writeFileSync } from 'node:fs';
import { Pool } from 'pg';
import { z } from 'zod';
import { migrate, provisionSession } from './database.js';
import { ContentRuntime } from './service.js';
import { createRuntimeServer } from './http.js';
import { httpDeliveryConnector, realModelGateway } from './providers.js';
import { Defaults } from './contracts.js';
import { AccessScope, Principal, Operation } from '../governance/contracts.js';

async function main() {
 const [command, configFile, tokenFile] = process.argv.slice(2);
 if (!process.env.DATABASE_URL) throw new Error('Falta DATABASE_URL');
 const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 10, connectionTimeoutMillis: 5000 });
 if (command === 'serve') {
  if (!process.env.VERIDIS_DELIVERY_URL) throw new Error('Falta VERIDIS_DELIVERY_URL');
  // Reserva configurada por el operador para la tarifa y límites del modelo. No hay tarifa implícita verificada.
  const modelReservationMicros = z.coerce.number().int().positive().parse(process.env.VERIDIS_MODEL_RESERVATION_MICROS);
  // Los límites por defecto (Defaults) son conservadores a propósito; un operador puede ampliarlos
  // explícitamente por entorno (por ejemplo, para pruebas interactivas), nunca implícitamente.
  const budgetOverrides = {
   ...(process.env.VERIDIS_MAX_DURATION_MS ? { maxDurationMs: z.coerce.number().int().positive().parse(process.env.VERIDIS_MAX_DURATION_MS) } : {}),
   ...(process.env.VERIDIS_MAX_MODEL_CALLS ? { maxModelCalls: z.coerce.number().int().positive().parse(process.env.VERIDIS_MAX_MODEL_CALLS) } : {}),
   ...(process.env.VERIDIS_MAX_COST_MICROS ? { maxCostMicros: z.coerce.number().int().positive().parse(process.env.VERIDIS_MAX_COST_MICROS) } : {}),
   ...(process.env.VERIDIS_MAX_TOOL_CALLS ? { maxToolCalls: z.coerce.number().int().nonnegative().parse(process.env.VERIDIS_MAX_TOOL_CALLS) } : {}),
  };
  const runtime = new ContentRuntime(pool, realModelGateway(), httpDeliveryConnector(process.env.VERIDIS_DELIVERY_URL), {
   modelReservationMicros, ...(Object.keys(budgetOverrides).length ? { budget: { ...Defaults, ...budgetOverrides } } : {}),
  });
  const server = createRuntimeServer(runtime);
  server.listen(z.coerce.number().int().min(1024).max(65535).parse(process.env.PORT ?? 3000), '127.0.0.1', () => process.stderr.write('API gobernada escuchando en loopback.\n'));
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => server.close(() => { void pool.end(); }));
  return;
 }
 try {
  if (command === 'migrate') { await migrate(pool); return; }
  if (command !== 'provision' || !configFile || !tokenFile) throw new Error('Uso: migrate | serve | provision config.json archivo-de-token');
  const config = z.object({ principal: Principal, scope: AccessScope, expiresAt: z.iso.datetime({ offset: true }),
   permissions: z.array(z.object({ principal: Principal, operations: z.array(Operation).min(1), resourceType: z.string(), resourceIds: z.array(z.string()).min(1) }).strict()),
  }).strict().parse(JSON.parse(readFileSync(configFile, 'utf8')));
  // Crear primero el destino evita emitir una sesión si no puede guardarse su secreto.
  writeFileSync(tokenFile, '', { mode: 0o600, flag: 'wx' });
  const token = await provisionSession(pool, config);
  writeFileSync(tokenFile, token + '\n', { mode: 0o600 });
  process.stderr.write('Sesión creada; token guardado en el archivo privado indicado.\n');
 } finally { await pool.end(); }
}
main().catch(() => { process.stderr.write('No se pudo iniciar la operación. Revisa configuración, permisos y conexión.\n'); process.exitCode = 1; });
