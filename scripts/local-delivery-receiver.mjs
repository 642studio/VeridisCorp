// Receptor HTTP local de prueba para VERIDIS_DELIVERY_URL (ver docs/runtime-pilot.md).
// Implementa el contrato documentado: PUT/GET /deliveries/{key}. Guarda en memoria,
// no en disco; reiniciar este proceso pierde lo entregado. Solo para desarrollo local,
// nunca como receptor real de producción.
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';

const port = Number(process.env.PORT ?? 4000);
const deliveries = new Map();

const server = createServer(async (req, res) => {
  const key = decodeURIComponent((req.url ?? '').replace(/^\/deliveries\//, '').split('?')[0]);
  if (!key || !(req.url ?? '').startsWith('/deliveries/')) {
    res.writeHead(404); res.end();
    return;
  }
  if (req.method === 'PUT') {
    let body = '';
    for await (const chunk of req) body += chunk;
    const { text, contentHash } = JSON.parse(body);
    const actualHash = createHash('sha256').update(text).digest('hex');
    if (actualHash !== contentHash) {
      res.writeHead(400, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'contentHash no coincide con el texto recibido' }));
      return;
    }
    const reference = 'local-delivery://' + key;
    deliveries.set(key, { reference, contentHash });
    console.log(`[receptor local] entregado ${key} (${text.length} caracteres)`);
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ reference, contentHash }));
    return;
  }
  if (req.method === 'GET') {
    const stored = deliveries.get(key);
    if (!stored) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify(stored));
    return;
  }
  res.writeHead(405); res.end();
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Receptor local de entregas escuchando en http://127.0.0.1:${port}/`);
});
