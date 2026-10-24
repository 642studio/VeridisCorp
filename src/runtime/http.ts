import { createServer, type IncomingMessage } from 'node:http';
import { ZodError } from 'zod';
import { ContentRuntime } from './service.js';
import type { OfficeRuntime } from './office-runtime.js';
import type { Scheduler } from './scheduler.js';
import { RuntimeError } from './contracts.js';

async function body(req: IncomingMessage): Promise<unknown> {
 if (!req.headers['content-type']?.startsWith('application/json')) throw new RuntimeError(415, 'Se requiere JSON');
 let size = 0; const chunks: Buffer[] = [];
 for await (const chunk of req) {
  size += chunk.length; if (size > 32768) throw new RuntimeError(413, 'Solicitud demasiado grande');
  chunks.push(chunk);
 }
 try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
 catch { throw new RuntimeError(400, 'JSON inválido'); }
}
// scheduler puede ser undefined (VERIDIS_SCHEDULER_ENABLED=false): las rutas de abajo siguen
// funcionando igual (crear/editar/borrar tareas programadas en la base), solo que ningún Cron
// real las dispara hasta que el proceso arranque con el flag activo.
export function createRuntimeServer(runtime: ContentRuntime, office?: OfficeRuntime, scheduler?: Scheduler) {
 const server = createServer(async (req, res) => {
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  try {
   const token = /^Bearer ([A-Za-z0-9_-]{43})$/.exec(req.headers.authorization ?? '')?.[1];
   if (!token) throw new RuntimeError(401, 'Se requiere sesión');
   const url = new URL(req.url ?? '/', 'http://localhost');
   const path = url.pathname;
   let result: unknown;
   if (req.method === 'POST' && path === '/runs') result = await runtime.start(token, await body(req));
   else if (req.method === 'GET' && path === '/runs') {
    const status = url.searchParams.get('status');
    const limit = url.searchParams.get('limit');
    const cursor = url.searchParams.get('cursor');
    result = await runtime.list(token, {
     ...(status ? { status: status.split(',').map((s) => s.trim()) } : {}),
     limit: limit === null ? 20 : Number(limit),
     ...(cursor ? { cursor } : {}),
    });
   } else if (req.method === 'GET' && path === '/organization') {
    result = await runtime.organization(token);
   } else if (req.method === 'GET' && /^\/agents\/[a-zA-Z0-9][a-zA-Z0-9._:-]{0,119}$/.test(path)) {
    result = await runtime.agent(token, path.slice('/agents/'.length));
   } else if (office && req.method === 'POST' && path === '/office/orders') {
    result = await office.start(token, await body(req));
   } else if (office && req.method === 'GET' && path === '/office/orders') {
    result = await office.list(token);
   } else if (office && /^\/office\/orders\/([0-9a-f-]{36})(?:\/(advance|answer))?$/.test(path)) {
    const officeMatch = /^\/office\/orders\/([0-9a-f-]{36})(?:\/(advance|answer))?$/.exec(path)!;
    const id = officeMatch[1]!; const action = officeMatch[2];
    if (req.method === 'GET' && !action) result = await office.get(token, id);
    else if (req.method === 'POST' && action === 'advance') result = await office.advance(token, id);
    else if (req.method === 'POST' && action === 'answer') result = await office.answer(token, id, await body(req));
    else throw new RuntimeError(405, 'Método no disponible');
   } else if (office && req.method === 'POST' && path === '/office/schedules') {
    result = await office.createSchedule(token, await body(req));
    scheduler?.register({ id: (result as { id: string }).id, cron_expression: (result as { cronExpression: string }).cronExpression, timezone: (result as { timezone: string }).timezone });
   } else if (office && req.method === 'GET' && path === '/office/schedules') {
    result = await office.listSchedules(token);
   } else if (office && /^\/office\/schedules\/([0-9a-f-]{36})(?:\/(update|delete|fire))?$/.test(path)) {
    const scheduleMatch = /^\/office\/schedules\/([0-9a-f-]{36})(?:\/(update|delete|fire))?$/.exec(path)!;
    const id = scheduleMatch[1]!; const action = scheduleMatch[2];
    if (req.method === 'GET' && !action) result = await office.getSchedule(token, id);
    else if (req.method === 'POST' && action === 'update') {
     result = await office.updateSchedule(token, id, await body(req));
     const r = result as { enabled: boolean; cronExpression: string; timezone: string };
     if (r.enabled) scheduler?.register({ id, cron_expression: r.cronExpression, timezone: r.timezone });
     else scheduler?.unregister(id);
    } else if (req.method === 'POST' && action === 'delete') {
     result = await office.deleteSchedule(token, id);
     scheduler?.unregister(id);
    } else if (req.method === 'POST' && action === 'fire') result = await office.fireSchedule(token, id);
    else throw new RuntimeError(405, 'Método no disponible');
   } else {
    const match = /^\/runs\/([0-9a-f-]{36})(?:\/(advance|revise|approve|execute|reconcile|regenerate))?$/.exec(path);
    if (!match) throw new RuntimeError(404, 'Ruta no disponible');
    const id = match[1]!; const action = match[2];
    if (req.method === 'GET' && !action) result = await runtime.get(token, id);
    else if (req.method === 'POST') {
     switch (action) {
      case 'advance': result = await runtime.advance(token, id); break;
      case 'revise': result = await runtime.revise(token, id, await body(req)); break;
      case 'approve': result = await runtime.approve(token, id, await body(req)); break;
      case 'execute': result = await runtime.execute(token, id); break;
      case 'reconcile': result = await runtime.reconcile(token, id); break;
      case 'regenerate': result = await runtime.regenerate(token, id); break;
      default: throw new RuntimeError(404, 'Ruta no disponible');
     }
    } else throw new RuntimeError(405, 'Método no disponible');
   }
   res.writeHead(200); res.end(JSON.stringify(result));
  } catch (error) {
   if (!(error instanceof RuntimeError) && !(error instanceof ZodError)) {
    process.stderr.write(`Error inesperado en ${req.method} ${req.url}: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`);
   }
   const token = /^Bearer ([A-Za-z0-9_-]{43})$/.exec(req.headers.authorization ?? '')?.[1];
   if (token) await runtime.recordRejected(token, error instanceof RuntimeError ? String(error.status) : error instanceof ZodError ? 'invalid_contract' : 'invalid_transition');
   res.writeHead(error instanceof RuntimeError ? error.status : error instanceof ZodError ? 400 : 409);
   res.end(JSON.stringify({ error: error instanceof RuntimeError ? error.message : error instanceof ZodError ? 'Solicitud o contrato inválido' : 'La operación no está permitida en su estado actual' }));
  }
 });
 server.requestTimeout = 65000; server.headersTimeout = 10000;
 return server;
}
