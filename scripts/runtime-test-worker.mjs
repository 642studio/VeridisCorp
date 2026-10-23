// Proveedor determinista exclusivo de las pruebas de integración. Nunca se usa en runtime:serve.
import { Pool } from 'pg';
import { ContentRuntime } from '../src/runtime/service.ts';
import { createRuntimeServer } from '../src/runtime/http.ts';
import { httpDeliveryConnector } from '../src/runtime/providers.ts';
const pool = new Pool({ connectionString: process.env.VERIDIS_TEST_DATABASE_URL, max: 10 });
const gateway = {
 identify: () => ({ provider: 'test', model: 'deterministic' }),
 invoke: async (stage) => ({ output: stage === 'generate' ? { text: 'Entregable de integración' } : { accepted: true, explanation: 'Cumple el brief de prueba' }, inputTokens: 10, outputTokens: 5 }),
};
const runtime = new ContentRuntime(pool, gateway, httpDeliveryConnector(process.env.VERIDIS_TEST_DELIVERY_URL), { callTimeoutMs: 1000 });
const server = createRuntimeServer(runtime);
server.listen(0, '127.0.0.1', () => process.send({ port: server.address().port }));
