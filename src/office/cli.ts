import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { Command, MemorySaver } from '@langchain/langgraph';
import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';
import { Pool } from 'pg';
import { createOrder } from './contracts.js';
import { officeRegistry } from './registry.js';
import { createOfficeWorkflow, OFFICE_WORKFLOW_VERSION } from './workflow.js';
import { createOfficeIntelligence } from './intelligence.js';
import { createDemoOfficeIntelligence, createDemoOrder } from './workflow-demo.js';
import { HumanAnswer } from './runtime-contracts.js';
import { loadModelRouter } from './models.js';
import { createCompanyDemoIntelligence, createCompanyDemoOrder } from './company-demo.js';
import { agentSummary } from './agent-files.js';

async function main() {
  const [command, argument, extra] = process.argv.slice(2);
  if (command === 'organization') {
    console.log(JSON.stringify({ organization: officeRegistry.organization!.snapshot(), agents: officeRegistry.list().map(agentSummary) }, null, 2));
    return;
  }
  if (command === 'company-demo') {
    const graph = createOfficeWorkflow(createCompanyDemoIntelligence(), officeRegistry, new MemorySaver());
    const result = await graph.invoke({ order: createCompanyDemoOrder() }, {
      configurable: { thread_id: 'company-demo' }, recursionLimit: 500,
    });
    console.log(JSON.stringify({ mode: 'simulation', ...result }, null, 2));
    return;
  }
  if (command === 'models') {
    console.log(JSON.stringify(loadModelRouter().snapshot(), null, 2));
    return;
  }
  if (command === 'demo') {
    const graph = createOfficeWorkflow(createDemoOfficeIntelligence(), officeRegistry, new MemorySaver());
    const result = await graph.invoke({ order: createDemoOrder() }, {
      configurable: { thread_id: 'office-demo' }, recursionLimit: 500,
    });
    console.log(JSON.stringify({ mode: 'simulation', ...result }, null, 2));
    return;
  }
  if (!['run', 'resume', 'answer', 'status'].includes(command || '')) {
    throw new Error('Uso: demo | run "solicitud" [UUID] | resume UUID | answer UUID "respuesta" | status UUID');
  }
  if (["run", "resume", "answer"].includes(command || '')) {
    throw new Error('Ruta anterior suspendida: usa la API gobernada de contenido. Las simulaciones y la consulta administrativa de checkpoints siguen disponibles.');
  }
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('Configura DATABASE_URL y ejecuta npm run db:setup.');
  const id = z.uuid().parse(command === 'run' ? extra || randomUUID() : argument);
  // Espacio propio: nunca reinterpretar los checkpoints del workflow secuencial.
  const threadId = `${OFFICE_WORKFLOW_VERSION}:${id}`;
  const pool = new Pool({ connectionString, max: 4, connectionTimeoutMillis: 10000 });
  try {
    const lock = await pool.connect();
    try {
      const acquired = await lock.query<{ locked: boolean }>(
        'SELECT pg_try_advisory_lock(hashtextextended($1, 0)) AS locked', [threadId],
      );
      if (!acquired.rows[0]?.locked) throw new Error('Este expediente ya está en ejecución.');
      const graph = createOfficeWorkflow(
        command === 'status' ? createDemoOfficeIntelligence() : createOfficeIntelligence(),
        officeRegistry, new PostgresSaver(pool),
      );
      const config = { configurable: { thread_id: threadId }, recursionLimit: 500 };
      const snapshot = await graph.getState(config);
      if (command === 'status') {
        console.log(JSON.stringify({ id, ...snapshot }, null, 2));
        return;
      }
      const exists = Boolean(snapshot.values.order);
      const waiting = snapshot.tasks.some((task) => task.interrupts?.length);
      if (command === 'run' && exists) throw new Error('El expediente ya existe. Usa resume, answer o un UUID nuevo.');
      if (command !== 'run' && (!exists || !snapshot.next.length)) throw new Error('No hay trabajo pendiente que continuar.');
      if (command === 'resume' && waiting) throw new Error('Falta responder la pregunta pendiente con office:answer.');
      if (command === 'answer' && !waiting) throw new Error('No hay una pregunta pendiente. Usa office:resume.');
      const input: Parameters<typeof graph.invoke>[0] = command === 'run'
        ? { order: createOrder({
          id, workspaceId: '642-studio', objective: z.string().trim().min(1).max(16000).parse(argument),
          criteria: [{ id: 'delivery', description: 'Entregable que responde al objetivo, con evidencias y limitaciones explícitas, revisado por un agente independiente.' }],
          limits: { maxTasks: 10, maxSteps: 100, maxRevisionsPerTask: 2 },
        }) }
        : command === 'answer' ? new Command({ resume: HumanAnswer.parse(extra) }) : null;
      console.error(JSON.stringify({ event: 'office_started', id, threadId }));
      console.log(JSON.stringify({ id, ...(await graph.invoke(input, config)) }, null, 2));
    } finally {
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
