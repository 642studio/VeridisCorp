// Prueba en vivo (IA real, sin PostgreSQL ni servidor HTTP) de que el escenario
// company-demo de office/ hace participar a varios agentes reales, no solo al coordinador.
// No usa test/*.test.ts porque consume saldo real de proveedores; nunca corre en npm test.
import 'dotenv/config';
import { MemorySaver } from '@langchain/langgraph';
import { createOfficeWorkflow } from '../src/office/workflow.js';
import { createOfficeIntelligence } from '../src/office/intelligence.js';
import { officeRegistry } from '../src/office/registry.js';
import { createCompanyDemoOrder } from '../src/office/company-demo.js';

async function main() {
 const maxTurns = Number(process.env.VERIDIS_OFFICE_SMOKE_MAX_TURNS ?? 20);
 const threadId = 'live-office-smoke-' + Date.now();
 const config = { configurable: { thread_id: threadId }, recursionLimit: 150 };
 const graph = createOfficeWorkflow(createOfficeIntelligence({ registry: officeRegistry }), officeRegistry, new MemorySaver(), {
  maxTurns, maxRejectedDecisions: 4, maxQuestions: 1,
 });
 const stream = await graph.stream({ order: createCompanyDemoOrder() }, { ...config, streamMode: 'updates' });
 for await (const update of stream) {
  for (const [node, patch] of Object.entries(update as Record<string, unknown>)) {
   const p = patch as { decision?: unknown; lastError?: string | null; route?: string; rejectedDecisions?: number; turns?: number };
   console.error(`[${node}] route=${p.route ?? '-'} turns=${p.turns ?? '-'} rejected=${p.rejectedDecisions ?? '-'} lastError=${p.lastError ? JSON.stringify(p.lastError).slice(0, 300) : '-'}`);
   if (p.decision) console.error('  decision=' + JSON.stringify(p.decision).slice(0, 500));
  }
 }
 // El stream ya ejecutó todo el grafo hasta el final o la pausa; getState solo lee ese resultado,
 // nunca vuelve a invocar al modelo.
 const snapshot = await graph.getState(config);
 const result = snapshot.values;
 const distinctAgents = [...new Set(result.modelCalls.map((c: { agentId: string }) => c.agentId))].sort();

 console.log(JSON.stringify({
  mode: 'live-office-smoke',
  orderStatus: result.order.status,
  pauseReason: result.order.pauseReason ?? null,
  turnsUsed: result.turns,
  rejectedDecisions: result.rejectedDecisions,
  interrupted: snapshot.next.length > 0,
  tasks: result.order.tasks.map((t: { id: string; assignedAgentId: string; status: string; departmentId?: string }) =>
   ({ id: t.id, assignedAgentId: t.assignedAgentId, departmentId: t.departmentId, status: t.status })),
  modelCallsCount: result.modelCalls.length,
  distinctAgentsInvolved: distinctAgents,
  events: result.order.events.length,
 }, null, 2));

 if (snapshot.next.length > 0) {
  console.error('El expediente quedó interrumpido esperando una respuesta humana (ask_user); no es un fallo, pero no terminó solo.');
 } else if (distinctAgents.length < 4) {
  console.error(`Solo participaron ${distinctAgents.length} agentes distintos con llamadas reales; se esperaban al menos 4 (CEO + 3 responsables o especialistas).`);
  process.exitCode = 1;
 }
}
main().catch((error) => {
 console.error(error instanceof Error ? error.stack ?? error.message : error);
 process.exitCode = 1;
});
