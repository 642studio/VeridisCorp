import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { MemorySaver } from '@langchain/langgraph';
import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';
import { Pool } from 'pg';
import { z } from 'zod';
import { createWorkflow } from './graph.js';
import { createIntelligence, demoIntelligence } from './intelligence.js';
import { runOfficeDemo } from './office/demo.js';

async function main() {
  const [command, argument, suppliedId] = process.argv.slice(2);
  if (command === 'office-demo') {
    console.log(JSON.stringify({ mode: 'simulation', order: runOfficeDemo() }, null, 2));
    return;
  }
  if (command === 'demo') {
    const graph = createWorkflow(demoIntelligence, new MemorySaver());
    const result = await graph.invoke({ request: argument || 'Planificar Veridis' }, {
      configurable: { thread_id: randomUUID() }, recursionLimit: 20,
    });
    console.log(JSON.stringify({ mode: 'demo', ...result }, null, 2));
    return;
  }
  if (!['run', 'resume', 'status', 'setup'].includes(command || '')) {
    throw new Error('Uso: demo [solicitud] | setup | run "solicitud" [UUID] | resume UUID | status UUID');
  }
  if (["run", "resume"].includes(command || '')) {
    throw new Error('Ruta anterior suspendida: usa la API gobernada de contenido. Las simulaciones y la consulta administrativa de checkpoints siguen disponibles.');
  }
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('Falta DATABASE_URL.');
  const pool = new Pool({ connectionString, max: 4, connectionTimeoutMillis: 10_000 });
  try {
    const saver = new PostgresSaver(pool);
    if (command === 'setup') {
      // Ejecutar migraciones como paso de despliegue, separado de cada trabajo.
      await saver.setup();
      console.log('Tablas de checkpoints preparadas.');
      return;
    }
    const threadId = z.uuid().parse(command === 'run' ? suppliedId || randomUUID() : argument);
    const lock = await pool.connect();
    try {
      // Evita dos escritores del mismo hilo incluso en procesos distintos.
      const acquired = await lock.query<{ locked: boolean }>(
        'SELECT pg_try_advisory_lock(hashtextextended($1, 0)) AS locked', [threadId],
      );
      if (!acquired.rows[0]?.locked) throw new Error('Este hilo ya está en ejecución.');
      // Inspeccionar estado no necesita credenciales del modelo.
      const graph = createWorkflow(command === 'status' ? demoIntelligence : createIntelligence(), saver);
      const config = { configurable: { thread_id: threadId }, recursionLimit: 20 };
      const snapshot = await graph.getState(config);
      if (command === 'status') {
        console.log(JSON.stringify({ threadId, ...snapshot }, null, 2));
        return;
      }
      if (command === 'run' && Object.keys(snapshot.values).length) {
        throw new Error('El hilo ya existe. Usa resume o inicia otro UUID.');
      }
      if (command === 'resume' && !snapshot.next.length) {
        throw new Error('No hay ejecución pendiente que reanudar.');
      }
      const input = command === 'run'
        ? { request: z.string().trim().min(1).max(16000).parse(argument) }
        : null;
      console.error(JSON.stringify({ event: 'run_started', threadId }));
      const result = await graph.invoke(input, config);
      console.log(JSON.stringify({ threadId, ...result }, null, 2));
    } finally {
      // Destruir esta conexión libera cualquier advisory lock, también tras error.
      lock.release(true);
    }
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Error inesperado');
  process.exitCode = 1;
});
