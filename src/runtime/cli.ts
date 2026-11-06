import 'dotenv/config';
import { readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';
import { z } from 'zod';
import { OAuth2Client } from 'google-auth-library';
import { migrate, provisionSession } from './database.js';
import { enrollTotp, printEnrollmentQr } from './totp.js';
import { encryptSecret, decryptSecret, loadEncryptionKey } from './secrets.js';
import { ContentRuntime } from './service.js';
import { OfficeRuntime } from './office-runtime.js';
import { Scheduler } from './scheduler.js';
import { createRuntimeServer } from './http.js';
import { httpDeliveryConnector, realModelGateway } from './providers.js';
import { Defaults } from './contracts.js';
import { createOfficeIntelligence } from '../office/intelligence.js';
import { configureGmail, configureMeta, configureMemory, configureMediaLibrary } from '../office/tools.js';
import { configureRepos, parseRepos } from '../office/repo-tools.js';
import { configureCoreDb, configureCoreWriteDb } from '../office/core-tools.js';
import { configureMcp } from '../office/mcp-tools.js';
import { McpStore } from './mcp-store.js';
import { officeRegistry } from '../office/registry.js';
import { AccessScope, Principal, Operation } from '../governance/contracts.js';
import { MemoryStore, companyMemoryScope } from './memory-store.js';
import { createEmbedder, embeddingProfileFromEnv } from './embeddings.js';
import { exportAllValidatedToVault, vaultPathFromEnv } from './memory-export.js';
import { startTelegramBridge, telegramConfigFromEnv, callTelegram, summarizeOrder, type TelegramConfig } from './telegram.js';
import type { FireNotification } from './scheduler.js';

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

// pages_show_list/pages_manage_metadata/pages_manage_posts: administrar texto/foto en la Página
// propia. pages_read_engagement: exigido por Meta junto a los anteriores. instagram_basic +
// instagram_content_publish: publicar en la cuenta de Instagram Business vinculada a esa Página.
// Sin publish_video ni nada de Reels/Threads todavía — ver docs/social-publishing-roadmap.md.
const META_SCOPES = [
 'pages_show_list', 'pages_manage_metadata', 'pages_manage_posts', 'pages_read_engagement',
 'instagram_basic', 'instagram_content_publish',
];
const META_GRAPH_VERSION = 'v26.0';

type MetaTokenResponse = { access_token: string; token_type?: string; expires_in?: number };
type MetaPagesResponse = { data: { id: string; name: string; access_token: string }[] };
type MetaPageFields = { id: string; instagram_business_account?: { id: string } };

// Flujo "app instalada" igual que gmailAuthorize: listener local temporal, nada de servidor
// público. A diferencia de Google, Meta no tiene refresh token — el token de Página que devuelve
// /me/accounts, derivado de un token de usuario ya intercambiado por uno de larga duración, no
// expira bajo condiciones normales (ver documentación de Meta citada en el roadmap); si algún día
// se invalida, se repite esta autorización a mano.
async function metaAuthorize(pool: Pool) {
 const appId = process.env.META_APP_ID;
 const appSecret = process.env.META_APP_SECRET;
 if (!appId || !appSecret) throw new Error('Faltan META_APP_ID o META_APP_SECRET');
 const key = loadEncryptionKey(process.env);
 const port = z.coerce.number().int().min(1024).max(65535).parse(process.env.VERIDIS_META_OAUTH_CALLBACK_PORT ?? '8732');
 const redirectUri = `http://localhost:${port}/oauth2callback`;
 const state = randomUUID();
 const authUrl = `https://www.facebook.com/${META_GRAPH_VERSION}/dialog/oauth?${new URLSearchParams({
  client_id: appId, redirect_uri: redirectUri, scope: META_SCOPES.join(','), response_type: 'code', state,
 }).toString()}`;
 process.stderr.write(`Abre esta URL en el navegador, con sesión iniciada como administrador de la Página:\n\n${authUrl}\n\nEsperando autorización en ${redirectUri} ...\n`);
 const code = await new Promise<string>((resolve, reject) => {
  const server = createServer((req, res) => {
   const url = new URL(req.url ?? '/', redirectUri);
   if (url.pathname !== '/oauth2callback') { res.writeHead(404); res.end(); return; }
   const returnedCode = url.searchParams.get('code');
   const authError = url.searchParams.get('error_description') ?? url.searchParams.get('error');
   res.setHeader('content-type', 'text/html; charset=utf-8');
   if (authError || !returnedCode || url.searchParams.get('state') !== state) {
    res.writeHead(400); res.end('<p>Autorización rechazada, incompleta o con estado inválido. Puedes cerrar esta pestaña.</p>');
    server.close(() => reject(new Error(authError ?? 'Sin código de autorización o estado inválido')));
    return;
   }
   res.writeHead(200); res.end('<p>Autorización recibida. Puedes cerrar esta pestaña.</p>');
   server.close(() => resolve(returnedCode));
  });
  server.listen(port, '127.0.0.1');
  server.once('error', reject);
 });
 const shortLived = await fetch(`https://graph.facebook.com/${META_GRAPH_VERSION}/oauth/access_token?${new URLSearchParams({
  client_id: appId, redirect_uri: redirectUri, client_secret: appSecret, code,
 }).toString()}`).then((r) => r.json() as Promise<MetaTokenResponse>);
 const longLived = await fetch(`https://graph.facebook.com/${META_GRAPH_VERSION}/oauth/access_token?${new URLSearchParams({
  grant_type: 'fb_exchange_token', client_id: appId, client_secret: appSecret, fb_exchange_token: shortLived.access_token,
 }).toString()}`).then((r) => r.json() as Promise<MetaTokenResponse>);
 if (!longLived.access_token) throw new Error('Meta no devolvió un token de usuario de larga duración');
 const pages = await fetch(`https://graph.facebook.com/${META_GRAPH_VERSION}/me/accounts?${new URLSearchParams({
  access_token: longLived.access_token,
 }).toString()}`).then((r) => r.json() as Promise<MetaPagesResponse>);
 if (!pages.data?.length) throw new Error('La cuenta autorizada no administra ninguna Página de Facebook');
 const preferredPageId = process.env.META_PAGE_ID;
 const page = preferredPageId ? pages.data.find((p) => p.id === preferredPageId) : pages.data[0];
 if (!page) throw new Error(`No se encontró la Página "${preferredPageId}" entre las administradas: ${pages.data.map((p) => `${p.name} (${p.id})`).join(', ')}`);
 if (!preferredPageId && pages.data.length > 1) {
  process.stderr.write(`Hay varias Páginas administradas; se usó la primera (${page.name}, ${page.id}). Para elegir otra, repite con META_PAGE_ID=<id> entre: ${pages.data.map((p) => `${p.name} (${p.id})`).join(', ')}\n`);
 }
 const pageFields = await fetch(`https://graph.facebook.com/${META_GRAPH_VERSION}/${page.id}?${new URLSearchParams({
  fields: 'instagram_business_account', access_token: page.access_token,
 }).toString()}`).then((r) => r.json() as Promise<MetaPageFields>);
 const encrypted = encryptSecret(page.access_token, key);
 await pool.query(
  `INSERT INTO veridis_runtime_v1.meta_accounts(page_id, page_access_token_encrypted, ig_user_id)
   VALUES($1,$2,$3)
   ON CONFLICT (page_id) DO UPDATE SET page_access_token_encrypted=$2, ig_user_id=$3, updated_at=clock_timestamp()`,
  [page.id, encrypted, pageFields.instagram_business_account?.id ?? null],
 );
 process.stderr.write(`Página "${page.name}" (${page.id}) autorizada y guardada`
  + (pageFields.instagram_business_account ? `, con Instagram Business vinculado (${pageFields.instagram_business_account.id}).\n` : ', sin cuenta de Instagram Business vinculada.\n'));
}

// Llamado desde serve(): sin fila autorizada todavía, las herramientas de Meta simplemente fallan
// como "no configurado" — nunca tumba el arranque del servidor, igual criterio que Gmail/ClickUp.
async function loadMetaClient(pool: Pool): Promise<void> {
 const row = await pool.query('SELECT page_id, page_access_token_encrypted, ig_user_id FROM veridis_runtime_v1.meta_accounts LIMIT 1').catch(() => null);
 if (!row?.rows[0]) return;
 const key = loadEncryptionKey(process.env);
 const pageAccessToken = decryptSecret(row.rows[0].page_access_token_encrypted as Buffer, key);
 configureMeta({ pageId: row.rows[0].page_id as string, pageAccessToken, igUserId: (row.rows[0].ig_user_id as string | null) ?? null });
}

// El puente de Telegram (telegram.ts) solo contesta mensajes entrantes; una rutina programada
// termina sin que nadie esté escribiéndole al bot. Reutiliza exactamente el mismo `callTelegram`
// y `summarizeOrder` que ya usa ese puente — nunca una segunda lógica de formateo — y avisa a
// todos los chats autorizados, no solo al que preguntó por última vez (ninguno pidió esta rutina).
function notifyTelegramOfFire(config: TelegramConfig): (n: FireNotification) => void {
 return (n) => {
  const text = n.detail ? summarizeOrder(n.detail) : '⚠️ La rutina programada falló antes de poder abrir expediente; revisa los logs.';
  const full = n.disabled ? `${text}\n\n🛑 Esta rutina se desactivó tras fallos consecutivos — hay que revisarla antes de reactivarla.` : text;
  for (const chatId of config.allowedChatIds) {
   callTelegram(config.botToken, 'sendMessage', { chat_id: chatId, text: full }, 15000)
    .catch((error) => process.stderr.write(`Telegram: fallo avisando el resultado de la rutina ${n.scheduleId}: ${error instanceof Error ? error.message : error}\n`));
  }
 };
}

async function main() {
 const [command, configFile, tokenFile] = process.argv.slice(2);
 if (!process.env.DATABASE_URL) throw new Error('Falta DATABASE_URL');
 const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 10, connectionTimeoutMillis: 5000 });
 if (command === 'serve') {
  // Biblioteca de medios (voice.generate/music.generate, src/office/tools.ts): sin ligarla a
  // VERIDIS_OFFICE_ENABLED como memoria/MCP — es solo caché de lectura/escritura, no abre ninguna
  // ruta de ejecución nueva, así que no hay motivo para condicionarla.
  configureMediaLibrary(pool);
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
  // Mismo criterio que Gmail/MCP: sin VERIDIS_TOKEN_ENCRYPTION_KEY el servidor igual arranca,
  // solo que /auth/login (login con authenticator app) responde 503 hasta que se configure.
  let encryptionKey: Buffer | null = null;
  try { encryptionKey = loadEncryptionKey(process.env); } catch { encryptionKey = null; }
  // office/ ejecuta de verdad solo si se habilita explícitamente: reabre una ruta que
  // office:run/resume/answer tenían suspendida, y una sola invocación puede disparar varias
  // llamadas reales (tope de turnos siempre; presupuesto en dinero por expediente solo con
  // VERIDIS_OFFICE_MAX_COST_MICROS, que además exige precios en VERIDIS_PRICES_FILE).
  let office: OfficeRuntime | undefined;
  // Declarado aquí (no dentro del bloque de abajo) para que el scheduler, más adelante, pueda
  // avisar por el mismo canal sin levantar un segundo puente ni duplicar config de Telegram.
  let telegramConfig: TelegramConfig | null = null;
  if (process.env.VERIDIS_OFFICE_ENABLED === 'true') {
   // Mismo criterio que Gmail: no bloquea el arranque si el proveedor de embeddings no responde;
   // memory_write/memory_query (herramientas) y /office/memory (endpoint humano) simplemente
   // fallarán en su primera llamada real.
   const embeddingProfile = embeddingProfileFromEnv();
   const memoryStore = new MemoryStore(pool, createEmbedder(embeddingProfile), embeddingProfile.model);
   // Conexiones MCP: sin VERIDIS_TOKEN_ENCRYPTION_KEY funcionan igual, solo no se pueden guardar credenciales.
   const mcpStore = new McpStore(pool, memoryStore, encryptionKey);
   office = new OfficeRuntime(pool, createOfficeIntelligence({ registry: officeRegistry, pool }), {
    maxTurns: z.coerce.number().int().positive().max(100).parse(process.env.VERIDIS_OFFICE_MAX_TURNS ?? '5'),
    maxRejectedDecisions: 3, maxQuestions: 2,
    maxCostMicros: process.env.VERIDIS_OFFICE_MAX_COST_MICROS
     ? z.coerce.number().int().positive().safe().parse(process.env.VERIDIS_OFFICE_MAX_COST_MICROS) : null,
   }, memoryStore, vaultPathFromEnv(), mcpStore);
   await office.setup({ migrate: process.env.VERIDIS_CHECKPOINT_SETUP_ON_START !== 'false' });
   const serviceScope = companyMemoryScope();
   configureMemory(memoryStore, serviceScope);
   configureMcp(mcpStore, serviceScope);
   // Repos git que los puestos de software pueden leer (solo lectura): VERIDIS_REPOS="nombre=/ruta,...".
   configureRepos(parseRepos(process.env.VERIDIS_REPOS));
   // CRM de 642CORE (solo lectura): sin CORE_DATABASE_URL, core.read falla en su primera llamada
   // real — mismo criterio que Gmail/MCP, nunca bloquea el arranque. El rol de la cadena de
   // conexión debe ser de solo lectura (ver docs/sql/core_readonly_role.sql), nunca el service role.
   // Sin statement_timeout: el pooler de Supabase (Supavisor) rechaza ese parámetro de arranque
   // ("unsupported startup parameter"); las consultas ya van acotadas con LIMIT en core-tools.ts.
   if (process.env.CORE_DATABASE_URL) {
    configureCoreDb(new Pool({
     connectionString: process.env.CORE_DATABASE_URL, max: 3, connectionTimeoutMillis: 5000,
    }));
   }
   // Escritura del CRM (core.write): conexión separada con su propio rol, solo INSERT en tres
   // tablas aditivas (ver docs/sql/core_write_role.sql). Sin CORE_WRITE_DATABASE_URL, core.write
   // falla en su primera llamada real — igual que el resto, nunca bloquea el arranque.
   if (process.env.CORE_WRITE_DATABASE_URL) {
    configureCoreWriteDb(new Pool({
     connectionString: process.env.CORE_WRITE_DATABASE_URL, max: 3, connectionTimeoutMillis: 5000,
    }));
   }
   telegramConfig = telegramConfigFromEnv(serviceScope);
   if (telegramConfig) startTelegramBridge(office, telegramConfig);
  }
  await loadGmailClient(pool);
  await loadMetaClient(pool);
  // Las tareas programadas disparan expedientes reales sin que nadie le dé clic a nada; solo
  // tiene sentido si office/ ya está habilitado, y sigue necesitando su propio interruptor
  // explícito (un operador puede querer office/ real sin disparos automáticos todavía).
  let scheduler: Scheduler | undefined;
  if (office && process.env.VERIDIS_SCHEDULER_ENABLED === 'true') {
   scheduler = new Scheduler(pool, office, {
    maxPerHour: z.coerce.number().int().positive().parse(process.env.VERIDIS_SCHEDULER_MAX_PER_HOUR ?? '10'),
    notify: telegramConfig ? notifyTelegramOfFire(telegramConfig) : undefined,
   });
   await scheduler.start();
  }
  const server = createRuntimeServer(runtime, office, scheduler, encryptionKey ?? undefined);
  server.listen(z.coerce.number().int().min(1024).max(65535).parse(process.env.PORT ?? 3000), '127.0.0.1', () => process.stderr.write('API gobernada escuchando en loopback.\n'));
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => server.close(() => { scheduler?.stop(); void pool.end(); }));
  return;
 }
 try {
  if (command === 'migrate') { await migrate(pool); await new PostgresSaver(pool).setup(); return; }
  if (command === 'gmail-authorize') { await gmailAuthorize(pool); return; }
  if (command === 'meta-authorize') { await metaAuthorize(pool); return; }
  if (command === 'export-memory') {
   const vaultPath = vaultPathFromEnv(process.env);
   if (!vaultPath) throw new Error('Falta VERIDIS_MEMORY_VAULT_PATH');
   const embeddingProfile = embeddingProfileFromEnv();
   const memoryStore = new MemoryStore(pool, createEmbedder(embeddingProfile), embeddingProfile.model);
   const written = await exportAllValidatedToVault(memoryStore, companyMemoryScope(), vaultPath);
   process.stderr.write(`Exportadas ${written.length} memorias validadas a ${vaultPath}\n`);
   return;
  }
  if (command === 'totp-enroll') {
   if (!configFile || !tokenFile) throw new Error('Uso: totp-enroll config.json archivo-de-respaldo.txt');
   const enrollConfig = z.object({ principal: Principal, scope: AccessScope,
    permissions: z.array(z.object({ principal: Principal, operations: z.array(Operation).min(1), resourceType: z.string(), resourceIds: z.array(z.string()).min(1) }).strict()),
    sessionTtlSeconds: z.number().int().positive().max(30 * 24 * 3600).optional(),
   }).strict().parse(JSON.parse(readFileSync(configFile, 'utf8')));
   const encryptionKeyForEnroll = loadEncryptionKey(process.env);
   // Crear primero el destino evita registrar el secreto si no puede guardarse el respaldo.
   writeFileSync(tokenFile, '', { mode: 0o600, flag: 'wx' });
   const { secret, otpauthUrl } = await enrollTotp(pool, encryptionKeyForEnroll, { ...enrollConfig, sessionTtlSeconds: enrollConfig.sessionTtlSeconds ?? 43200 });
   writeFileSync(tokenFile, `otpauthUrl=${otpauthUrl}\nsecret=${secret}\n`, { mode: 0o600 });
   process.stderr.write(`TOTP registrado para "${enrollConfig.principal.id}". Escanéalo con la app de autenticación:\n\n`);
   printEnrollmentQr(otpauthUrl);
   process.stderr.write(`\nSi no se puede escanear, el secreto manual es: ${secret}\nRespaldo guardado en el archivo privado indicado.\n`);
   return;
  }
  if (command !== 'provision' || !configFile || !tokenFile) throw new Error('Uso: migrate | serve | provision config.json archivo-de-token | totp-enroll config.json archivo-de-respaldo.txt | gmail-authorize | meta-authorize | export-memory');
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
// El mensaje genérico es a propósito (un error de pg o de un proveedor puede traer secretos). Solo
// se muestran los errores de configuración de modelos que arma src/office/models.ts y
// model-providers.ts: nombran la variable que falta, nunca su valor, y sin ellos no hay forma de
// saber por qué no arranca el servidor.
const SAFE_CONFIG_ERRORS = ['Falta el modelo del perfil', 'Falta la credencial', 'Perfil de modelo inexistente'];
main().catch((error: unknown) => {
 const message = error instanceof Error ? error.message : '';
 const safe = SAFE_CONFIG_ERRORS.some((prefix) => message.startsWith(prefix));
 process.stderr.write(safe ? `No se pudo iniciar: ${message}\n` : 'No se pudo iniciar la operación. Revisa configuración, permisos y conexión.\n');
 process.exitCode = 1;
});
