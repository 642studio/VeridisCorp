import 'dotenv/config';
import { readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { Pool } from 'pg';
import { z } from 'zod';
import { OAuth2Client } from 'google-auth-library';
import { migrate, provisionSession } from './database.js';
import { encryptSecret, decryptSecret, loadEncryptionKey } from './secrets.js';
import { ContentRuntime } from './service.js';
import { OfficeRuntime } from './office-runtime.js';
import { Scheduler } from './scheduler.js';
import { createRuntimeServer } from './http.js';
import { httpDeliveryConnector, realModelGateway } from './providers.js';
import { Defaults } from './contracts.js';
import { createOfficeIntelligence } from '../office/intelligence.js';
import { configureGmail } from '../office/tools.js';
import { officeRegistry } from '../office/registry.js';
import { AccessScope, Principal, Operation } from '../governance/contracts.js';

// Un solo cliente OAuth2, un solo listener de autorización, un solo refresh token guardado
// (gmail_accounts — el nombre quedó corto a propósito: ya hay una fila real autorizada y
// renombrar la tabla no aporta nada, solo arriesga esa fila). drive.file es per-archivo (solo
// lo que la propia app crea); spreadsheets/presentations no tienen ese equivalente acotado, dan
// acceso a todos los archivos de ese tipo en la cuenta — más amplios por cómo es la API, no por
// decisión nuestra.
const GOOGLE_SCOPES = [
 'https://www.googleapis.com/auth/gmail.compose', 'https://www.googleapis.com/auth/gmail.readonly',
 'https://www.googleapis.com/auth/drive.file', 'https://www.googleapis.com/auth/calendar.events',
 'https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/presentations',
 'https://www.googleapis.com/auth/meetings.space.created',
];

// Flujo "app instalada": nada de servidor público — un listener local y temporal captura la
// redirección de Google, solo mientras dura esta autorización de un solo uso (patrón nuevo en
// el proyecto: hoy el servidor real tiene un único .listen() en todo el repo, en serve()).
async function gmailAuthorize(pool: Pool) {
 const clientId = process.env.GMAIL_OAUTH_CLIENT_ID;
 const clientSecret = process.env.GMAIL_OAUTH_CLIENT_SECRET;
 if (!clientId || !clientSecret) throw new Error('Faltan GMAIL_OAUTH_CLIENT_ID o GMAIL_OAUTH_CLIENT_SECRET');
 const key = loadEncryptionKey(process.env);
 const port = z.coerce.number().int().min(1024).max(65535).parse(process.env.VERIDIS_OAUTH_CALLBACK_PORT ?? '8731');
 const redirectUri = `http://localhost:${port}/oauth2callback`;
 const client = new OAuth2Client({ clientId, clientSecret, redirectUri });
 const authUrl = client.generateAuthUrl({ access_type: 'offline', prompt: 'consent', scope: GOOGLE_SCOPES });
 process.stderr.write(`Abre esta URL en el navegador, con sesión iniciada en la cuenta dedicada:\n\n${authUrl}\n\nEsperando autorización en ${redirectUri} ...\n`);
 const code = await new Promise<string>((resolve, reject) => {
  const server = createServer((req, res) => {
   const url = new URL(req.url ?? '/', redirectUri);
   if (url.pathname !== '/oauth2callback') { res.writeHead(404); res.end(); return; }
   const code = url.searchParams.get('code');
   const authError = url.searchParams.get('error');
   res.setHeader('content-type', 'text/html; charset=utf-8');
   if (authError || !code) {
    res.writeHead(400); res.end('<p>Autorización rechazada o incompleta. Puedes cerrar esta pestaña.</p>');
    server.close(() => reject(new Error(authError ?? 'Sin código de autorización')));
    return;
   }
   res.writeHead(200); res.end('<p>Autorización recibida. Puedes cerrar esta pestaña.</p>');
   server.close(() => resolve(code));
  });
  server.listen(port, '127.0.0.1');
  server.once('error', reject);
 });
 const { tokens } = await client.getToken(code);
 if (!tokens.refresh_token) throw new Error('Google no devolvió un refresh token (vuelve a intentarlo; si ya habías autorizado esta app antes, revoca el acceso en https://myaccount.google.com/permissions y repite)');
 client.setCredentials(tokens);
 const profile = await client.request<{ emailAddress: string }>({ url: 'https://gmail.googleapis.com/gmail/v1/users/me/profile' });
 const accountEmail = profile.data.emailAddress;
 const encrypted = encryptSecret(tokens.refresh_token, key);
 await pool.query(
  `INSERT INTO veridis_runtime_v1.gmail_accounts(account_email, refresh_token_encrypted, scope)
   VALUES($1,$2,$3)
   ON CONFLICT (account_email) DO UPDATE SET refresh_token_encrypted=$2, scope=$3, updated_at=clock_timestamp()`,
  [accountEmail, encrypted, GOOGLE_SCOPES.join(' ')],
 );
 process.stderr.write(`Cuenta ${accountEmail} autorizada y guardada.\n`);
}

// Llamado desde serve(): si hay una cuenta ya autorizada, reconstruye el cliente OAuth2 (el
// propio google-auth-library refresca el access token solo, y vuelve a guardar el refresh
// token si Google emite uno nuevo durante la operación normal — raro, pero pasa). Sin cuenta
// autorizada todavía, las herramientas de Gmail simplemente fallan como "no configurado",
// igual que clickup.read sin credenciales — nunca tumba el arranque del servidor.
async function loadGmailClient(pool: Pool): Promise<void> {
 const clientId = process.env.GMAIL_OAUTH_CLIENT_ID;
 const clientSecret = process.env.GMAIL_OAUTH_CLIENT_SECRET;
 if (!clientId || !clientSecret) return;
 const row = await pool.query('SELECT account_email, refresh_token_encrypted FROM veridis_runtime_v1.gmail_accounts LIMIT 1');
 if (!row.rows[0]) return;
 const key = loadEncryptionKey(process.env);
 const refreshToken = decryptSecret(row.rows[0].refresh_token_encrypted as Buffer, key);
 const accountEmail = row.rows[0].account_email as string;
 const client = new OAuth2Client({ clientId, clientSecret });
 client.setCredentials({ refresh_token: refreshToken });
 client.on('tokens', (tokens) => {
  if (!tokens.refresh_token) return;
  void pool.query(
   'UPDATE veridis_runtime_v1.gmail_accounts SET refresh_token_encrypted=$2, updated_at=clock_timestamp() WHERE account_email=$1',
   [accountEmail, encryptSecret(tokens.refresh_token, key)],
  );
 });
 configureGmail(client);
}

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
  // office/ ejecuta de verdad solo si se habilita explícitamente: reabre una ruta que
  // office:run/resume/answer tenían suspendida, y una sola invocación puede disparar varias
  // llamadas reales (no tiene presupuesto en dólares propio, solo el tope de turnos).
  let office: OfficeRuntime | undefined;
  if (process.env.VERIDIS_OFFICE_ENABLED === 'true') {
   office = new OfficeRuntime(pool, createOfficeIntelligence({ registry: officeRegistry, pool }), {
    maxTurns: z.coerce.number().int().positive().max(100).parse(process.env.VERIDIS_OFFICE_MAX_TURNS ?? '5'),
    maxRejectedDecisions: 3, maxQuestions: 2,
   });
   await office.setup();
  }
  await loadGmailClient(pool);
  // Las tareas programadas disparan expedientes reales sin que nadie le dé clic a nada; solo
  // tiene sentido si office/ ya está habilitado, y sigue necesitando su propio interruptor
  // explícito (un operador puede querer office/ real sin disparos automáticos todavía).
  let scheduler: Scheduler | undefined;
  if (office && process.env.VERIDIS_SCHEDULER_ENABLED === 'true') {
   scheduler = new Scheduler(pool, office, {
    maxPerHour: z.coerce.number().int().positive().parse(process.env.VERIDIS_SCHEDULER_MAX_PER_HOUR ?? '10'),
   });
   await scheduler.start();
  }
  const server = createRuntimeServer(runtime, office, scheduler);
  server.listen(z.coerce.number().int().min(1024).max(65535).parse(process.env.PORT ?? 3000), '127.0.0.1', () => process.stderr.write('API gobernada escuchando en loopback.\n'));
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => server.close(() => { scheduler?.stop(); void pool.end(); }));
  return;
 }
 try {
  if (command === 'migrate') { await migrate(pool); return; }
  if (command === 'gmail-authorize') { await gmailAuthorize(pool); return; }
  if (command !== 'provision' || !configFile || !tokenFile) throw new Error('Uso: migrate | serve | provision config.json archivo-de-token | gmail-authorize');
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
