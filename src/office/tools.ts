import { tool, type StructuredToolInterface } from '@langchain/core/tools';
import { HumanMessage } from '@langchain/core/messages';
import { spawn } from 'node:child_process';
import { randomUUID, createHash } from 'node:crypto';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { z } from 'zod';
import type { Pool } from 'pg';
import type { OAuth2Client } from 'google-auth-library';
import { createProfileModel } from './model-providers.js';
import type { ResolvedProfile } from './models.js';
import type { AccessScope, CorporateMemoryRecord } from '../governance/contracts.js';
import type { MemoryQueryResult } from '../runtime/memory-store.js';
import { synthesizeElevenLabsForTool } from '../runtime/elevenlabs-proxy.js';
import { generateMusic } from '../runtime/sunoapi-proxy.js';
import { REPO_TOOLS } from './repo-tools.js';
import { CORE_TOOLS, CORE_WRITE_TOOLS } from './core-tools.js';
import { MCP_TOOLS } from './mcp-tools.js';

// Catálogo de herramientas reales que un agente puede usar durante execute(), siempre acotado
// por su allowedTools (agents/<id>/config.json). El id aquí es el mismo que allowedTools declara;
// el 'name' de la herramienta para function-calling es distinto porque OpenAI no admite puntos.
export type ToolResult = { title: string; url: string; snippet: string };

const WIKIPEDIA_ENDPOINT = 'https://es.wikipedia.org/w/api.php';

// Sin credenciales: cubre temas generales, conceptos y entidades conocidas con fuente real y
// citable. No cubre noticias en tiempo real ni la web completa; para eso haría falta una API de
// búsqueda de pago (Tavily, Brave, Serper) — mismo patrón, solo cambia esta función.
async function wikipediaSearch(query: string, limit = 5): Promise<ToolResult[]> {
  const params = new URLSearchParams({
    action: 'query', list: 'search', format: 'json', srlimit: String(limit), srsearch: query,
  });
  const response = await fetch(`${WIKIPEDIA_ENDPOINT}?${params.toString()}`, {
    signal: AbortSignal.timeout(10000),
    headers: { 'user-agent': 'VeridisCorp-office/1 (contacto: 642studio)' },
  });
  if (!response.ok) throw new Error(`Wikipedia respondió ${response.status}`);
  const data = await response.json() as { query?: { search?: { title: string; snippet: string }[] } };
  return (data.query?.search ?? []).map((hit) => ({
    title: hit.title,
    url: `https://es.wikipedia.org/wiki/${encodeURIComponent(hit.title.replace(/ /g, '_'))}`,
    snippet: hit.snippet.replace(/<[^>]+>/g, ''),
  }));
}

const BRAVE_SEARCH_ENDPOINT = 'https://api.search.brave.com/res/v1/web/search';

// Búsqueda real de pago (requiere BRAVE_API_KEY), índice propio de Brave: cubre toda la web,
// no solo Wikipedia. Se intenta antes que Wikipedia porque da mejor cobertura; si falla (sin
// credencial, cuota, red) el resto del flujo cae igual al respaldo gratuito.
export async function braveSearch(env: NodeJS.ProcessEnv, query: string, limit = 5): Promise<ToolResult[]> {
  const apiKey = env.BRAVE_API_KEY?.trim();
  if (!apiKey) throw new Error('Falta BRAVE_API_KEY');
  const params = new URLSearchParams({ q: query, count: String(limit) });
  const response = await fetch(`${BRAVE_SEARCH_ENDPOINT}?${params.toString()}`, {
    signal: AbortSignal.timeout(10000),
    headers: { accept: 'application/json', 'x-subscription-token': apiKey },
  });
  if (!response.ok) throw new Error(`Brave Search respondió ${response.status}`);
  const data = await response.json() as { web?: { results?: { title: string; url: string; description?: string }[] } };
  return (data.web?.results ?? []).map((hit) => ({
    title: hit.title, url: hit.url, snippet: (hit.description ?? '').replace(/<[^>]+>/g, ''),
  }));
}

const webSearchSchema = z.object({
  query: z.string().trim().min(1).max(300).describe('Términos de búsqueda, en español si aplica'),
});

export const webSearchTool = tool(
  async ({ query }: z.infer<typeof webSearchSchema>) => {
    const results = await wikipediaSearch(query);
    return results.length ? JSON.stringify(results) : 'Sin resultados reales para esa consulta.';
  },
  {
    name: 'web_search',
    description: 'Busca artículos reales en Wikipedia en español. Devuelve título, URL real y '
      + 'fragmento verbatim de cada resultado. No cubre noticias en tiempo real ni la web completa.',
    schema: webSearchSchema,
  },
);

// Evaluador aritmético seguro: nunca usa eval(). Solo dígitos, + - * / % ^ y paréntesis; cualquier
// otro carácter hace que falle el parseo. Precedencia estándar, ^ asociativo a la derecha.
export function evaluateExpression(expression: string): number {
  const tokens = expression.match(/\d+(?:\.\d+)?|[+\-*/%^()]/g) ?? [];
  if (tokens.join('') !== expression.replace(/\s+/g, '')) {
    throw new Error('La expresión contiene caracteres no permitidos');
  }
  let pos = 0;
  const peek = () => tokens[pos];
  const next = () => tokens[pos++];
  const parseAtom = (): number => {
    const token = next();
    if (token === undefined) throw new Error('Expresión incompleta');
    if (token === '(') {
      const value = parseExpr();
      if (next() !== ')') throw new Error('Falta un paréntesis de cierre');
      return value;
    }
    const value = Number(token);
    if (Number.isNaN(value)) throw new Error('Token numérico inválido: ' + token);
    return value;
  };
  const parsePower = (): number => {
    const base = parseAtom();
    if (peek() === '^') { next(); return Math.pow(base, parseUnary()); }
    return base;
  };
  const parseUnary = (): number => {
    if (peek() === '-') { next(); return -parsePower(); }
    if (peek() === '+') { next(); return parsePower(); }
    return parsePower();
  };
  const parseTerm = (): number => {
    let value = parseUnary();
    while (peek() === '*' || peek() === '/' || peek() === '%') {
      const op = next();
      const rhs = parseUnary();
      if (op === '*') value *= rhs;
      else if (op === '/') { if (rhs === 0) throw new Error('División por cero'); value /= rhs; }
      else { if (rhs === 0) throw new Error('Módulo por cero'); value %= rhs; }
    }
    return value;
  };
  function parseExpr(): number {
    let value = parseTerm();
    while (peek() === '+' || peek() === '-') {
      const op = next();
      value = op === '+' ? value + parseTerm() : value - parseTerm();
    }
    return value;
  }
  const result = parseExpr();
  if (pos !== tokens.length) throw new Error('Expresión mal formada');
  if (!Number.isFinite(result)) throw new Error('El resultado no es un número finito');
  return result;
}

const calculatorSchema = z.object({
  expression: z.string().trim().min(1).max(200).describe('Expresión aritmética, p. ej. "(1200 - 850) * 1.16"'),
});
export const calculatorTool = tool(
  ({ expression }: z.infer<typeof calculatorSchema>) => String(evaluateExpression(expression)),
  {
    name: 'calculator',
    description: 'Evalúa una expresión aritmética exacta (+ - * / % ^ paréntesis). Úsala para '
      + 'cualquier cálculo numérico en vez de estimarlo de memoria.',
    schema: calculatorSchema,
  },
);

const NVD_ENDPOINT = 'https://services.nvd.nist.gov/rest/json/cves/2.0';

// API oficial del NIST, sin credenciales (límite de tasa bajo sin API key, suficiente para uso
// ocasional). Devuelve vulnerabilidades reales con su id, severidad y descripción oficial.
async function cveSearch(query: string, limit = 5): Promise<{ id: string; severity: string | null; description: string; url: string }[]> {
  const isCveId = /^CVE-\d{4}-\d{4,}$/i.test(query.trim());
  const params = new URLSearchParams({ resultsPerPage: String(limit) });
  params.set(isCveId ? 'cveId' : 'keywordSearch', query.trim());
  const response = await fetch(`${NVD_ENDPOINT}?${params.toString()}`, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`NVD respondió ${response.status}`);
  const data = await response.json() as { vulnerabilities?: { cve: {
    id: string; descriptions?: { lang: string; value: string }[];
    metrics?: Record<string, { cvssData?: { baseSeverity?: string } }[]>;
  } }[] };
  return (data.vulnerabilities ?? []).map(({ cve }) => ({
    id: cve.id,
    severity: Object.values(cve.metrics ?? {}).flat()[0]?.cvssData?.baseSeverity ?? null,
    description: cve.descriptions?.find((d) => d.lang === 'en')?.value ?? '',
    url: `https://nvd.nist.gov/vuln/detail/${cve.id}`,
  }));
}

const cveLookupSchema = z.object({
  query: z.string().trim().min(1).max(200).describe('Palabra clave (p. ej. "log4j") o un id exacto CVE-AAAA-NNNNN'),
});
export const cveLookupTool = tool(
  async ({ query }: z.infer<typeof cveLookupSchema>) => {
    const results = await cveSearch(query);
    return results.length ? JSON.stringify(results) : 'Sin vulnerabilidades reales encontradas para esa consulta.';
  },
  {
    name: 'cve_lookup',
    description: 'Busca vulnerabilidades reales en la base oficial del NIST (NVD) por palabra '
      + 'clave o id CVE exacto. Devuelve id, severidad oficial y descripción real.',
    schema: cveLookupSchema,
  },
);

export type SandboxLanguage = 'javascript' | 'typescript' | 'python';
// TypeScript va en main.ts: Node solo quita tipos en archivos .ts (en main.js un ": number" es error
// de sintaxis — así falló en vivo). transform-types cubre también enum y namespace.
const SANDBOX_IMAGES: Record<SandboxLanguage, { image: string; command: string[] }> = {
  javascript: { image: 'node:22-slim', command: ['sh', '-c', 'cat > main.js && node main.js'] },
  typescript: { image: 'node:22-slim', command: ['sh', '-c', 'cat > main.ts && node --no-warnings --experimental-transform-types main.ts'] },
  python: { image: 'python:3.12-slim', command: ['sh', '-c', 'cat > main.py && python3 main.py'] },
};

// Ejecuta código en un contenedor Docker efímero: sin red, sin credenciales del host, solo un
// tmpfs propio con límite de tamaño, tope de memoria/CPU y tiempo máximo. El código llega por
// stdin (nunca se monta el filesystem del host). Si Docker no está disponible o el contenedor
// no puede arrancar, se propaga el error — quien llama lo trata igual que cualquier herramienta
// sin configurar: "no se pudo verificar", nunca un fallo que tumbe execute().
// 60s por defecto: no porque el código deba tardar tanto, sino porque la primera ejecución en un
// host nuevo paga el costo único de bajar la imagen (probado en vivo: ~15s se quedó corto).
export function runSandboxed(
  language: SandboxLanguage, code: string, timeoutMs = 60000,
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  const { image, command } = SANDBOX_IMAGES[language];
  return new Promise((resolve, reject) => {
    const child = spawn('docker', [
      'run', '--rm', '-i', '--network', 'none', '--memory', '256m', '--cpus', '0.5',
      '--read-only', '--tmpfs', '/workspace:rw,size=16m', '--workdir', '/workspace',
      image, ...command,
    ], { timeout: timeoutMs, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = ''; let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', (exitCode, signal) => {
      if (signal) reject(new Error(`El contenedor se interrumpió (${signal}), probablemente por el límite de tiempo`));
      else resolve({ exitCode: exitCode ?? -1, stdout: stdout.slice(0, 8000), stderr: stderr.slice(0, 8000) });
    });
    child.stdin.end(code);
  });
}

const codeSandboxSchema = z.object({
  language: z.enum(['javascript', 'typescript', 'python']).describe('typescript si el código lleva tipos'),
  code: z.string().trim().min(1).max(8000).describe('Código completo de un solo archivo, listo para ejecutar'),
});
export const codeSandboxTool = tool(
  async ({ language, code }: z.infer<typeof codeSandboxSchema>) => {
    const result = await runSandboxed(language, code);
    return JSON.stringify(result);
  },
  {
    name: 'run_code',
    description: 'Ejecuta un snippet de código (javascript, typescript o python) en un contenedor aislado, '
      + 'sin red ni acceso al host, y devuelve exitCode, stdout y stderr reales. Úsala para '
      + 'verificar que el código propuesto realmente corre antes de entregarlo como resultado.',
    schema: codeSandboxSchema,
  },
);

// Imagen propia (docker/pdf-renderer/, construida localmente con `docker build`, no bajada de
// un registro de terceros): WeasyPrint sin motor JS, sobra para HTML+CSS estático. 8MB es muy
// generoso para un documento de negocio — tope duro contra un render fuera de control.
const PDF_RENDERER_IMAGE = 'veridis-pdf-renderer:latest';
const MAX_PDF_BYTES = 8 * 1024 * 1024;

// Variante binary-safe de runSandboxed: los bytes de un PDF no son texto, así que stdout se
// acumula como Buffer sin truncar (a diferencia del límite de 8000 caracteres de runSandboxed).
// stderr sí es texto corto: solo lleva {"pages": N} o un traceback si algo falla. Memoria más
// alta que el sandbox de código (512m vs 256m): Pango/cairo necesitan más margen para tipografía.
function runSandboxedBinary(
  image: string, stdin: string, timeoutMs = 30000, memory = '512m',
): Promise<{ exitCode: number; stdout: Buffer; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn('docker', [
      'run', '--rm', '-i', '--network', 'none', '--memory', memory, '--cpus', '1',
      '--read-only', '--tmpfs', '/workspace:rw,size=64m', '--workdir', '/workspace', image,
    ], { timeout: timeoutMs, stdio: ['pipe', 'pipe', 'pipe'] });
    const chunks: Buffer[] = []; let stderr = ''; let size = 0; let killedForSize = false;
    child.stdout.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_PDF_BYTES) { killedForSize = true; child.kill('SIGKILL'); return; }
      chunks.push(chunk);
    });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', (exitCode, signal) => {
      if (killedForSize) { reject(new Error('El documento generado excede el tamaño máximo permitido')); return; }
      if (signal) { reject(new Error(`El contenedor se interrumpió (${signal}), probablemente por el límite de tiempo`)); return; }
      resolve({ exitCode: exitCode ?? -1, stdout: Buffer.concat(chunks), stderr: stderr.slice(0, 4000) });
    });
    child.stdin.end(stdin);
  });
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function slugify(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 80) || 'documento';
}

const ACCENT_COLORS: Record<string, string> = {
  teal: '#0f766e', navy: '#1e3a5f', burgundy: '#7f1d3d', forest: '#14532d', slate: '#334155',
};

const PdfBlock = z.discriminatedUnion('type', [
  z.object({ type: z.literal('heading'), level: z.enum(['1', '2']), text: z.string().trim().min(1).max(200) }).strict(),
  z.object({ type: z.literal('paragraph'), text: z.string().trim().min(1).max(4000) }).strict(),
  z.object({ type: z.literal('bullet_list'), items: z.array(z.string().trim().min(1).max(500)).min(1).max(20) }).strict(),
  z.object({ type: z.literal('callout'), tone: z.enum(['info', 'success', 'warning']), text: z.string().trim().min(1).max(1000) }).strict(),
  z.object({ type: z.literal('table'), headers: z.array(z.string().max(100)).min(1).max(8), rows: z.array(z.array(z.string().max(200))).min(1).max(30) }).strict(),
  z.object({ type: z.literal('quote'), text: z.string().trim().min(1).max(1000), attribution: z.string().trim().max(200).optional() }).strict(),
  z.object({ type: z.literal('divider') }).strict(),
]);

// El modelo nunca escribe HTML/CSS: compone una secuencia de bloques tipados (qué usar, en qué
// orden, con qué énfasis) y el motor es dueño de toda la tipografía, el espaciado y el color.
// Esto da agencia real sobre el diseño del documento sin arriesgar consistencia visual ni abrir
// inyección — y 'accentColor' es una paleta curada, no un color libre.
const pdfGenerateSchema = z.object({
  title: z.string().trim().min(1).max(200),
  subtitle: z.string().trim().max(200).optional(),
  accentColor: z.enum(['teal', 'navy', 'burgundy', 'forest', 'slate']).default('navy'),
  blocks: z.array(PdfBlock).min(1).max(40),
  footerNote: z.string().trim().max(300).optional(),
}).strict();

function renderBlock(block: z.infer<typeof PdfBlock>): string {
  switch (block.type) {
    case 'heading':
      return `<h${block.level}>${escapeHtml(block.text)}</h${block.level}>`;
    case 'paragraph':
      return `<p>${escapeHtml(block.text)}</p>`;
    case 'bullet_list':
      return `<ul>${block.items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
    case 'callout':
      return `<div class="callout callout--${block.tone}">${escapeHtml(block.text)}</div>`;
    case 'table':
      return `<table><thead><tr>${block.headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead>`
        + `<tbody>${block.rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
    case 'quote':
      return `<blockquote>${escapeHtml(block.text)}${block.attribution ? `<footer>— ${escapeHtml(block.attribution)}</footer>` : ''}</blockquote>`;
    case 'divider':
      return '<hr/>';
  }
}

// Plantilla profesional provisional: sin logo ni marca real todavía (no hay assets de 642
// Studio en este repo). Las variables de color (accent) son el único gancho de marca por ahora
// — sustituir por la identidad real de 642 Studio es trabajo pendiente, no de este alcance.
function buildDocumentHtml(input: z.infer<typeof pdfGenerateSchema>): string {
  const accent = ACCENT_COLORS[input.accentColor] ?? ACCENT_COLORS.navy;
  const body = input.blocks.map(renderBlock).join('\n');
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<style>
  @page { size: A4; margin: 28mm 22mm 24mm; @bottom-center { content: counter(page) " / " counter(pages); font-size: 9pt; color: #94a3b8; } }
  * { box-sizing: border-box; }
  body { font-family: 'DejaVu Sans', sans-serif; color: #1e293b; font-size: 11pt; line-height: 1.55; }
  .cover { border-bottom: 3pt solid ${accent}; padding-bottom: 10mm; margin-bottom: 12mm; }
  .cover h1 { font-size: 24pt; margin: 0 0 4mm; color: ${accent}; letter-spacing: -0.01em; }
  .cover .subtitle { font-size: 12pt; color: #64748b; margin: 0; }
  h1 { font-size: 16pt; color: ${accent}; margin: 10mm 0 4mm; }
  h2 { font-size: 13pt; color: #334155; margin: 8mm 0 3mm; }
  p { margin: 0 0 4mm; text-align: justify; }
  ul { margin: 0 0 4mm; padding-left: 6mm; }
  li { margin-bottom: 1.5mm; }
  hr { border: none; border-top: 0.5pt solid #cbd5e1; margin: 8mm 0; }
  blockquote { border-left: 2pt solid ${accent}; margin: 0 0 4mm; padding: 2mm 0 2mm 6mm; font-style: italic; color: #475569; }
  blockquote footer { font-style: normal; font-size: 9pt; color: #94a3b8; margin-top: 2mm; }
  table { width: 100%; border-collapse: collapse; margin: 0 0 4mm; font-size: 10pt; }
  th { text-align: left; background: ${accent}; color: #fff; padding: 2.5mm 3mm; font-weight: 600; }
  td { padding: 2.5mm 3mm; border-bottom: 0.5pt solid #e2e8f0; }
  tr:nth-child(even) td { background: #f8fafc; }
  .callout { border-radius: 2mm; padding: 4mm 5mm; margin: 0 0 4mm; font-size: 10.5pt; }
  .callout--info { background: #eff6ff; border-left: 2pt solid #3b82f6; color: #1e40af; }
  .callout--success { background: #f0fdf4; border-left: 2pt solid #22c55e; color: #166534; }
  .callout--warning { background: #fffbeb; border-left: 2pt solid #f59e0b; color: #92400e; }
  .footer-note { margin-top: 14mm; padding-top: 4mm; border-top: 0.5pt solid #e2e8f0; font-size: 8.5pt; color: #94a3b8; }
</style>
</head>
<body>
<div class="cover">
  <h1>${escapeHtml(input.title)}</h1>
  ${input.subtitle ? `<p class="subtitle">${escapeHtml(input.subtitle)}</p>` : ''}
</div>
${body}
${input.footerNote ? `<div class="footer-note">${escapeHtml(input.footerNote)}</div>` : ''}
</body>
</html>`;
}

// Devuelve metadata + los bytes en base64 (filename, contentType, pages, base64) — lo que ve el
// modelo normalmente NO es esto: gatherToolResults() en intelligence.ts intercepta esta
// herramienta en particular, persiste el archivo y le sustituye el resultado por metadata segura
// (fileId, filename, pages) antes de que llegue al contexto del modelo. Invocada aquí directo
// (pruebas, uso fuera de office/) sigue devolviendo el documento completo.
export const pdfGenerateTool = tool(
  async (input: z.infer<typeof pdfGenerateSchema>) => {
    const html = buildDocumentHtml(input);
    const { exitCode, stdout, stderr } = await runSandboxedBinary(PDF_RENDERER_IMAGE, html);
    if (exitCode !== 0) throw new Error(`No se pudo generar el PDF: ${stderr.slice(0, 500) || 'el renderizador terminó con error'}`);
    let pages = 0;
    try { pages = (JSON.parse(stderr.trim().split('\n')[0] ?? '{}') as { pages?: number }).pages ?? 0; }
    catch { /* stderr sin el conteo de páginas: no es crítico para el resultado */ }
    return JSON.stringify({
      filename: `${slugify(input.title)}.pdf`, contentType: 'application/pdf', pages,
      base64: stdout.toString('base64'),
    });
  },
  {
    name: 'generate_pdf',
    description: 'Genera un documento PDF real, con tipografía y maquetación profesionales, a partir '
      + 'de bloques estructurados (encabezados, párrafos, listas, tablas, citas, cajas destacadas) — '
      + 'nunca de HTML libre. Úsala cuando el entregable de la tarea sea un documento o reporte para '
      + 'compartir, no para texto que solo vive dentro de la conversación.',
    schema: pdfGenerateSchema,
  },
);

// Imagen propia (docker/video-renderer/, construida localmente con `docker build`, no bajada de
// un registro de terceros): Node 22 + FFmpeg + Chromium de Debian + la CLI de HyperFrames fijada
// a 0.9.9 (probada el 2026-11-04; ver agents/video-production/knowledge/). A diferencia de
// pdf.generate, aquí el modelo SÍ escribe HTML/CSS/JS libre (es el contrato de HyperFrames, no un
// descuido), así que el aislamiento es el de code.sandbox, no el de pdf.generate: sin red
// (--network none; el contenedor ya trae su propia copia de GSAP para que la composición no
// necesite el CDN), memoria y cpu acotadas, directorio del proyecto desechable por llamada. No usa
// --read-only: Chrome necesita escribir su propio perfil y caché de proceso.
const VIDEO_RENDERER_IMAGE = 'veridis-video-renderer:latest';
const MAX_VIDEO_FILES = 60;
const MAX_VIDEO_FILE_BYTES = 20 * 1024 * 1024;
const MAX_VIDEO_PROJECT_BYTES = 40 * 1024 * 1024;
// Un video de 22.5s tardó ~40s dentro del contenedor (GPU por software, más lento que fuera de
// Docker) en la prueba real — 5 minutos deja margen real sin dejar un tool-call colgado para
// siempre si algo se traba.
const VIDEO_RENDER_TIMEOUT_MS = 5 * 60 * 1000;

function runVideoRendererCli(
  projectDir: string, args: string[], timeoutMs: number,
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn('docker', [
      'run', '--rm', '--network', 'none', '--memory', '2g', '--cpus', '2', '--shm-size', '1g',
      '-v', `${projectDir}:/workspace`, '--workdir', '/workspace', VIDEO_RENDERER_IMAGE, ...args,
    ], { timeout: timeoutMs, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = ''; let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', (exitCode, signal) => {
      if (signal) reject(new Error(`El renderizador se interrumpió (${signal}), probablemente por el límite de tiempo`));
      // stdout es el JSON de `check` (puede superar fácilmente 20 KB en un video largo con muchos
      // hallazgos de craft) — truncarlo rompía JSON.parse y escondía el error real detrás del log
      // de progreso de stderr. stdout solo se acota como tope de DoS, muy por encima de un reporte
      // real; stderr sí se recorta corto porque solo es log de progreso, nunca datos a parsear.
      else resolve({ exitCode: exitCode ?? -1, stdout: stdout.slice(0, 2_000_000), stderr: stderr.slice(0, 4000) });
    });
  });
}

const videoFileSchema = z.object({
  path: z.string().trim().min(1).max(200)
    .regex(/^[A-Za-z0-9_][A-Za-z0-9_.-]*(\/[A-Za-z0-9_][A-Za-z0-9_.-]*)*$/, 'Ruta relativa inválida')
    .refine((p) => !p.includes('..'), 'La ruta no puede contener ..'),
  contentBase64: z.string().min(1).optional()
    .describe('Contenido del archivo en base64 (texto o binario: HTML, CSS, JS). Para un audio ya '
      + 'generado con generate_voice/generate_music usa "mediaRef", nunca pegues su base64 aquí.'),
  mediaRef: z.string().min(1).optional()
    .describe('El "mediaRef" exacto que devolvió generate_voice/generate_music para este audio — el '
      + 'motor resuelve el archivo real del lado del servidor, sin que su contenido pase por el modelo.'),
}).strict().refine((f) => Boolean(f.contentBase64) !== Boolean(f.mediaRef),
  'Cada archivo lleva exactamente uno de "contentBase64" o "mediaRef", nunca ambos ni ninguno');

const videoRenderSchema = z.object({
  files: z.array(videoFileSchema).min(1).max(MAX_VIDEO_FILES)
    .describe('Árbol completo del proyecto HyperFrames: index.html en la raíz, compositions/*.html, '
      + 'assets/* (incluida cualquier voz ya generada). No incluyas GSAP: el contenedor ya pone su '
      + 'propia copia en assets/vendor/gsap.min.js — referencia esa ruta local, nunca un CDN.'),
  quality: z.enum(['draft', 'delivery']).default('draft')
    .describe('draft mientras iteras, delivery para el entregable final'),
}).strict();

// mediaRef = "<kind>:<requestHash>", el mismo valor que devuelve generate_voice/generate_music
// (ver resolveOrGenerateMedia): el audio real nunca viaja por el contexto del modelo, se resuelve
// aquí contra la fila ya guardada en media_library por su hash exacto.
async function resolveMediaRefBytes(mediaRef: string): Promise<Buffer> {
  const sep = mediaRef.indexOf(':');
  const kind = sep === -1 ? '' : mediaRef.slice(0, sep);
  const requestHash = sep === -1 ? mediaRef : mediaRef.slice(sep + 1);
  if (!mediaLibraryPool) throw new Error('No hay biblioteca de medios configurada para resolver "mediaRef"');
  if ((kind !== 'voice' && kind !== 'music') || !requestHash) throw new Error(`"mediaRef" inválido: "${mediaRef}"`);
  const result = await mediaLibraryPool.query(
    'SELECT content FROM veridis_runtime_v1.media_library WHERE kind=$1 AND request_hash=$2',
    [kind, requestHash],
  );
  const row = result.rows[0] as { content: Buffer } | undefined;
  if (!row) throw new Error(`"mediaRef" "${mediaRef}" no corresponde a ningún audio generado — vuelve a llamar generate_voice/generate_music`);
  return row.content;
}

async function writeVideoProjectFiles(projectDir: string, files: z.infer<typeof videoFileSchema>[]): Promise<void> {
  if (!files.some((file) => file.path === 'index.html')) throw new Error('El proyecto necesita un index.html en la raíz');
  let totalBytes = 0;
  for (const file of files) {
    const buffer = file.mediaRef ? await resolveMediaRefBytes(file.mediaRef) : Buffer.from(file.contentBase64!, 'base64');
    if (buffer.length > MAX_VIDEO_FILE_BYTES) throw new Error(`"${file.path}" excede el tamaño máximo por archivo`);
    totalBytes += buffer.length;
    if (totalBytes > MAX_VIDEO_PROJECT_BYTES) throw new Error('El proyecto excede el tamaño máximo permitido');
    const resolved = path.resolve(projectDir, file.path);
    // Defensa adicional a la validación de zod de arriba: nunca escribir fuera del directorio efímero.
    if (!resolved.startsWith(projectDir + path.sep)) throw new Error(`Ruta fuera del proyecto: "${file.path}"`);
    await mkdir(path.dirname(resolved), { recursive: true });
    await writeFile(resolved, buffer);
  }
}

// Devuelve metadata + los bytes en base64, igual que pdf.generate — y, igual que pdf.generate,
// gatherToolResults() en intelligence.ts intercepta esta herramienta en particular para persistir
// el archivo real y sustituir el resultado por metadata segura antes de que llegue al modelo.
export const videoRenderTool = tool(
  async ({ files, quality }: z.infer<typeof videoRenderSchema>) => {
    const projectDir = await mkdtemp(path.join(tmpdir(), 'veridis-video-'));
    try {
      await writeVideoProjectFiles(projectDir, files);

      const check = await runVideoRendererCli(projectDir, ['check', '--json'], VIDEO_RENDER_TIMEOUT_MS);
      let checkReport: { ok?: boolean; layout?: { duration?: number } } = {};
      try { checkReport = JSON.parse(check.stdout) as typeof checkReport; } catch { /* sin JSON válido: se trata como falla abajo */ }
      if (check.exitCode !== 0 || checkReport.ok !== true) {
        const sections = ['lint', 'runtime', 'layout', 'contrast', 'craft', 'audio'] as const;
        const findings = sections.flatMap((key) => {
          const section = (checkReport as Record<string, unknown>)[key] as { errorCount?: number; findings?: { code: string; message: string }[] } | undefined;
          return section?.errorCount ? (section.findings ?? []).map((f) => `${key}: ${f.code} — ${f.message}`) : [];
        });
        throw new Error(`La composición no pasó la revisión (check). Corrige y vuelve a intentar:\n`
          + (findings.join('\n').slice(0, 1500) || check.stderr.slice(0, 1000) || 'check falló sin más detalle'));
      }

      const outputName = 'render.mp4';
      const render = await runVideoRendererCli(projectDir, ['render', '--quality', quality, '-o', outputName], VIDEO_RENDER_TIMEOUT_MS);
      if (render.exitCode !== 0) {
        throw new Error(`El render falló: ${render.stderr.slice(0, 1000) || render.stdout.slice(0, 1000) || 'sin más detalle'}`);
      }
      const videoBytes = await readFile(path.join(projectDir, outputName))
        .catch(() => { throw new Error('El render terminó pero no se encontró el archivo de salida'); });
      if (!videoBytes.length) throw new Error('El render produjo un archivo vacío');

      return JSON.stringify({
        filename: 'video.mp4', contentType: 'video/mp4',
        durationSeconds: checkReport.layout?.duration ?? null, quality,
        base64: videoBytes.toString('base64'),
      });
    } finally {
      await rm(projectDir, { recursive: true, force: true }).catch(() => {});
    }
  },
  {
    name: 'render_video',
    description: 'Renderiza un proyecto real de HyperFrames (HTML+CSS+GSAP siguiendo el contrato de '
      + 'agents/video-production/knowledge/) a un MP4 real, en un contenedor aislado y sin red. '
      + 'Corre `check` antes de renderizar y falla con el detalle exacto si no pasa (contraste, texto '
      + 'bajo el mínimo legible, reglas del contrato) — corrige la composición y vuelve a llamar. '
      + '"quality": "draft" mientras iteras, "delivery" solo para el entregable final. Para un audio ya '
      + 'generado con generate_voice/generate_music, usa "mediaRef" (no "contentBase64") en su archivo.',
    schema: videoRenderSchema,
  },
);

// Biblioteca de medios generados (veridis_runtime_v1.media_library, src/runtime/database.ts):
// antes de pedirle a un proveedor voz o música nueva, busca si ya se generó exactamente lo mismo
// (mismo texto/estilo/voz) para cualquier expediente, no solo el actual — a diferencia de
// office_files (pdf.generate, video.render), que de-duplica solo dentro de un mismo order_id. Sin
// pool configurado (configureMediaLibrary en src/runtime/cli.ts), sigue funcionando pero sin caché:
// cada llamada genera de nuevo, nunca falla por no tener dónde guardar.
let mediaLibraryPool: Pool | null = null;
export function configureMediaLibrary(pool: Pool | null): void {
  mediaLibraryPool = pool;
}

async function resolveOrGenerateMedia(
  kind: 'voice' | 'music', provider: string, requestParams: Record<string, unknown>,
  generate: () => Promise<{ contentType: string; body: Buffer }>,
): Promise<{ contentType: string; requestHash: string; cached: boolean }> {
  const requestHash = createHash('sha256').update(JSON.stringify({ kind, provider, ...requestParams })).digest('hex');
  if (mediaLibraryPool) {
    const existing = await mediaLibraryPool.query(
      'SELECT content_type FROM veridis_runtime_v1.media_library WHERE kind=$1 AND provider=$2 AND request_hash=$3',
      [kind, provider, requestHash],
    );
    const row = existing.rows[0] as { content_type: string } | undefined;
    if (row) {
      await mediaLibraryPool.query(
        'UPDATE veridis_runtime_v1.media_library SET last_used_at=clock_timestamp() WHERE kind=$1 AND provider=$2 AND request_hash=$3',
        [kind, provider, requestHash],
      );
      return { contentType: row.content_type, requestHash, cached: true };
    }
  }
  const generated = await generate();
  if (mediaLibraryPool) {
    // ON CONFLICT DO NOTHING: dos llamadas concurrentes con el mismo request_hash pueden perder la
    // carrera contra el índice único; la que pierde simplemente no vuelve a escribir, no falla.
    await mediaLibraryPool.query(
      `INSERT INTO veridis_runtime_v1.media_library(id, kind, provider, request_hash, request_params, content, content_type, size_bytes)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (kind, provider, request_hash) DO NOTHING`,
      [randomUUID(), kind, provider, requestHash, JSON.stringify(requestParams), generated.body, generated.contentType, generated.body.length],
    );
  } else {
    // Sin biblioteca configurada no hay dónde resolver "mediaRef" después — render_video fallaría
    // más tarde con un error confuso. Mejor fallar aquí mismo, apenas se genera, con la causa real.
    throw new Error('No hay biblioteca de medios configurada: no se puede generar voz/música sin ella');
  }
  return { contentType: generated.contentType, requestHash, cached: false };
}

const voiceGenerateSchema = z.object({
  text: z.string().trim().min(1).max(2000).describe('Texto exacto a convertir en voz'),
  voiceId: z.string().trim().max(64).optional().describe('voice_id de ElevenLabs; vacío usa la voz configurada por defecto'),
}).strict();

// A diferencia de pdf.generate/video.render, esto no persiste en office_files (no es un entregable
// final del expediente, es un insumo — el texto a convertir en voz lo decide video-production para
// luego incluirlo como assets/ al llamar video.render). Por eso no exige `persist`.
// El audio real NUNCA vuelve en la respuesta (ni como base64 ni de ninguna otra forma): ya vive en
// media_library por su "mediaRef". Pasar bytes de audio por el contexto del modelo fue justo el bug
// que reventaba el límite de tokens de los proveedores (1.3-1.8M tokens en un solo expediente de
// video) — generate_pdf/render_video ya evitaban esto porque gatherToolResults() los intercepta
// aparte; aquí es más simple: la herramienta misma nunca emite los bytes.
export const voiceGenerateTool = tool(
  async ({ text, voiceId }: z.infer<typeof voiceGenerateSchema>) => {
    const result = await resolveOrGenerateMedia('voice', 'elevenlabs', { text, voiceId: voiceId ?? null }, () => synthesizeElevenLabsForTool(process.env, text, voiceId ?? null));
    return JSON.stringify({ filename: 'voz.mp3', contentType: result.contentType, cached: result.cached, mediaRef: `voice:${result.requestHash}` });
  },
  {
    name: 'generate_voice',
    description: 'Convierte texto a voz real con el proxy de ElevenLabs ya conectado. Si ya se generó '
      + 'exactamente este texto antes (con la misma voz), reusa el audio de la biblioteca de medios sin '
      + 'volver a llamar al proveedor. Nunca devuelve el audio en sí (rompería el límite de contexto): '
      + 'devuelve "mediaRef" — pásalo tal cual, sin modificarlo, como "mediaRef" del archivo correspondiente '
      + 'al llamar render_video; el motor resuelve el audio real del lado del servidor.',
    schema: voiceGenerateSchema,
  },
);

const musicGenerateSchema = z.object({
  prompt: z.string().trim().min(1).max(3000).describe('Idea central de la pista, en inglés o español'),
  style: z.string().trim().min(1).max(1000).describe('Estilo/género/instrumentación, en inglés (indexado así por el proveedor)'),
  instrumental: z.boolean().default(true).describe('true: sin voces cantadas — lo normal para una cama de fondo que no debe competir con la narración'),
}).strict();

export const musicGenerateTool = tool(
  async ({ prompt, style, instrumental }: z.infer<typeof musicGenerateSchema>) => {
    const result = await resolveOrGenerateMedia('music', 'sunoapi', { prompt, style, instrumental }, () => generateMusic(process.env, { prompt, style, instrumental }));
    return JSON.stringify({ filename: 'musica.mp3', contentType: result.contentType, cached: result.cached, mediaRef: `music:${result.requestHash}` });
  },
  {
    name: 'generate_music',
    description: 'Genera una pista de música real con sunoapi.org (IA, no voz hablada — para eso usa '
      + 'generate_voice). Tarda de segundos a unos minutos (genera y espera, no requiere otra llamada). '
      + 'Si ya se generó una pista con el mismo prompt/estilo antes, reusa la de la biblioteca de medios '
      + 'sin gastar otra generación. Para una cama de fondo de video, instrumental=true casi siempre. '
      + 'Nunca devuelve la música en sí: devuelve "mediaRef" — pásalo tal cual como "mediaRef" del archivo '
      + 'correspondiente al llamar render_video.',
    schema: musicGenerateSchema,
  },
);

// Pendiente de probar en vivo: falta BRAVE... no, falta CLICKUP_API_KEY y CLICKUP_TEAM_ID (el id
// de espacio de trabajo, no el de una lista). Solo lectura: lista tareas reales del equipo y
// filtra por palabra clave en el cliente, sin crear, mover ni cerrar nada.
async function clickupSearch(query: string, limit = 5): Promise<{ id: string; name: string; status: string | null; url: string }[]> {
  const apiKey = process.env.CLICKUP_API_KEY?.trim();
  const teamId = process.env.CLICKUP_TEAM_ID?.trim();
  if (!apiKey || !teamId) throw new Error('Falta CLICKUP_API_KEY o CLICKUP_TEAM_ID');
  const response = await fetch(`https://api.clickup.com/api/v2/team/${encodeURIComponent(teamId)}/task?page=0`, {
    signal: AbortSignal.timeout(15000),
    headers: { Authorization: apiKey },
  });
  if (!response.ok) throw new Error(`ClickUp respondió ${response.status}`);
  const data = await response.json() as { tasks?: { id: string; name: string; status?: { status?: string }; url?: string; text_content?: string }[] };
  const needle = query.trim().toLowerCase();
  const tasks = (data.tasks ?? []).filter((task) => !needle
    || task.name.toLowerCase().includes(needle) || (task.text_content ?? '').toLowerCase().includes(needle));
  return tasks.slice(0, limit).map((task) => ({
    id: task.id, name: task.name, status: task.status?.status ?? null,
    url: task.url ?? `https://app.clickup.com/t/${task.id}`,
  }));
}

const clickupSchema = z.object({
  query: z.string().trim().max(200).default('').describe('Palabra clave para filtrar tareas, o vacío para listar las más recientes'),
});
export const clickupTool = tool(
  async ({ query }: z.infer<typeof clickupSchema>) => {
    const results = await clickupSearch(query);
    return results.length ? JSON.stringify(results) : 'Sin tareas reales encontradas para esa consulta.';
  },
  {
    name: 'clickup_search',
    description: 'Busca tareas reales en ClickUp (solo lectura) por palabra clave y devuelve id, '
      + 'nombre, estado y URL real. No crea, mueve ni cierra ninguna tarea.',
    schema: clickupSchema,
  },
);

// Memoria corporativa (CorporateMemoryRecord, src/governance/contracts.ts; implementación real en
// src/runtime/memory-store.ts). Mismo patrón de inyección que configureGmail: un único acceso
// compartido, fijado una vez al arrancar (src/runtime/cli.ts), nunca por llamada — igual que Gmail
// usa una sola cuenta para cualquier expediente sin importar su cliente, memory.write/memory.query
// no están aisladas todavía por el AccessScope propio del expediente (ese cableado no existe hoy
// en execute()/review()); son corporativas en el sentido más literal: un solo ámbito fijo para
// todo el despliegue (VERIDIS_MEMORY_WORKSPACE_ID/COMPANY_ID/DIVISION_ID en .env). Aislamiento real
// por cliente exigiría propagar el scope del expediente hasta aquí, que queda pendiente explícito.
export interface MemoryAccess {
  propose(scope: AccessScope, input: {
    entityType: CorporateMemoryRecord['entityType']; entityId: string; content: string;
    provenance: CorporateMemoryRecord['provenance']; trust: CorporateMemoryRecord['trust'];
    kind?: CorporateMemoryRecord['kind']; contradicts?: string | null;
  }): Promise<CorporateMemoryRecord>;
  query(scope: AccessScope, question: string, options?: { limit?: number; track?: boolean }): Promise<MemoryQueryResult[]>;
}
let memoryAccess: { access: MemoryAccess; scope: AccessScope } | null = null;
export function configureMemory(access: MemoryAccess | null, scope?: AccessScope): void {
  memoryAccess = access && scope ? { access, scope } : null;
}

// Lo usan memory_query y la consulta automática que el motor hace antes de cada tarea
// (gatherToolResults en intelligence.ts). null = sin memoria configurada o sin resultados.
export async function recallCorporateMemory(question: string, options: { limit: number; track?: boolean }): Promise<string | null> {
  if (!memoryAccess) return null;
  const results = await memoryAccess.access.query(memoryAccess.scope, question.slice(0, 2000), options);
  if (!results.length) return null;
  // id es el único dato que memory_write acepta en contradictsMemoryId: sin él, un agente no
  // tiene forma de señalar qué memoria refuta (entityId es un slug compartido entre versiones).
  return JSON.stringify(results.map((r) => ({
    id: r.record.id, entityType: r.record.entityType, entityId: r.record.entityId, content: r.record.content,
    confirmed: r.record.status === 'validated', kind: r.record.kind ?? 'fact',
    version: r.record.version, updatedAt: r.record.updatedAt, distance: r.distance,
  })));
}

const MEMORY_ENTITY_TYPES = ['company', 'division', 'client', 'brand', 'project', 'contract', 'person', 'product', 'decision', 'integration', 'process'] as const;
const memoryWriteSchema = z.object({
  entityType: z.enum(MEMORY_ENTITY_TYPES).describe('Qué tipo de entidad describe esta memoria'),
  entityId: z.string().trim().min(1).max(120).describe('Identificador corto y estable de ESTE conocimiento, con su tema (p. ej. "cliente-acme-tono-de-marca", no solo "cliente-acme"): '
    + 'repetir el entityId de otra memoria la reemplaza.'),
  content: z.string().trim().min(1).max(16000).describe('El conocimiento en sí, en prosa clara y autocontenida — nunca una referencia a "ver la tarea X"'),
  sourceReference: z.string().trim().min(1).max(2000).describe('De dónde sale este conocimiento (una tarea, una conversación, un documento concreto)'),
  kind: z.enum(['decision', 'fact', 'preference', 'question']).optional()
    .describe('Qué clase de conocimiento es: decision (algo que se decidió), fact (un dato), preference (cómo prefiere algo una persona o la empresa), question (algo abierto que falta resolver)'),
  contradictsMemoryId: z.string().trim().min(1).max(120).optional()
    .describe('El campo "id" exacto (no el entityId) de una memoria que devolvió memory_query y que esta refuta. '
      + 'Si esa memoria estaba sin confirmar, pasa a cuarentena en el acto; si un humano ya la había confirmado, solo cuando un humano confirme esta. Déjalo vacío si no refuta nada concreto.'),
});
export const memoryWriteTool = tool(
  async ({ entityType, entityId, content, sourceReference, kind, contradictsMemoryId }: z.infer<typeof memoryWriteSchema>) => {
    if (!memoryAccess) throw new Error('La memoria corporativa no está configurada en este servidor');
    const record = await memoryAccess.access.propose(memoryAccess.scope, {
      entityType, entityId, content,
      provenance: [{ reference: sourceReference, observedAt: new Date().toISOString() }],
      trust: 'internal_unverified',
      ...(kind ? { kind } : {}),
      contradicts: contradictsMemoryId ?? null,
    });
    return JSON.stringify({ id: record.id, entityType: record.entityType, entityId: record.entityId, version: record.version, status: record.status });
  },
  {
    name: 'memory_write',
    description: 'Guarda una memoria corporativa nueva (conocimiento sobre la empresa, un cliente, un proyecto, una decisión, etc.). '
      + 'Queda vigente SIN CONFIRMAR: memory_query ya la encuentra (marcada como tal) y un humano puede confirmarla o descartarla después. '
      + 'Reemplaza a la versión anterior sin confirmar de la misma entidad. No la uses para notas efímeras de una sola tarea. '
      + 'Si refuta una memoria existente, pasa su id en contradictsMemoryId.',
    schema: memoryWriteSchema,
  },
);

const memoryQuerySchema = z.object({
  question: z.string().trim().min(1).max(500).describe('La pregunta o tema a buscar en la memoria corporativa'),
  limit: z.number().int().min(1).max(20).default(5).describe('Máximo de resultados a devolver'),
});
export const memoryQueryTool = tool(
  async ({ question, limit }: z.infer<typeof memoryQuerySchema>) => {
    if (!memoryAccess) throw new Error('La memoria corporativa no está configurada en este servidor');
    return (await recallCorporateMemory(question, { limit })) ?? 'Sin memorias relevantes para esa consulta.';
  },
  {
    name: 'memory_query',
    description: 'Busca en la memoria corporativa (por significado, no solo palabras exactas) y devuelve el contenido real de las memorias más relevantes. '
      + 'Cada resultado dice si un humano ya lo confirmó ("confirmed": true) o sigue sin confirmar: trata lo no confirmado como información probable, no como hecho comprobado. '
      + 'Úsala antes de afirmar algo que dependa de conocimiento previo de la empresa, un cliente o una decisión, en vez de inventarlo o asumirlo. '
      + 'Cada resultado trae su "id": es el valor que va en contradictsMemoryId de memory_write si propones una corrección que la refuta.',
    schema: memoryQuerySchema,
  },
);

// Un solo cliente OAuth2 real de la cuenta de Google dedicada, para Gmail, Drive, Calendar,
// Sheets, Meet y Slides — inyectado una sola vez al arrancar desde runtime/cli.ts (lee y
// desencripta el refresh token guardado, ver runtime/secrets.ts). Sin cuenta autorizada todavía
// (npm run runtime:gmail-authorize), queda null y las herramientas fallan con un mensaje claro,
// igual que clickup.read sin CLICKUP_API_KEY — nunca tumban execute().
let googleClient: OAuth2Client | null = null;
export function configureGmail(client: OAuth2Client | null): void { googleClient = client; }

function requireGoogleClient(): OAuth2Client {
  if (!googleClient) throw new Error('La cuenta de Google no está configurada: falta autorizar (npm run runtime:gmail-authorize)');
  return googleClient;
}

function buildMimeMessage(to: string[], subject: string, body: string): string {
  const headers = [`To: ${to.join(', ')}`, `Subject: ${subject}`, 'Content-Type: text/plain; charset="UTF-8"', 'MIME-Version: 1.0'].join('\r\n');
  return `${headers}\r\n\r\n${body}`;
}
function toBase64Url(text: string): string {
  return Buffer.from(text, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Nunca llama users.messages.send: solo crea un borrador real (users.drafts.create). El
// envío lo decide un humano revisando la bandeja de Borradores de la cuenta — la aprobación
// que docs/assistant-v1-roadmap.md ya exigía para correo, sin inventar un mecanismo nuevo.
const gmailDraftSchema = z.object({
  to: z.array(z.email()).min(1).max(10),
  subject: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(8000),
}).strict();
export const gmailDraftTool = tool(
  async ({ to, subject, body }: z.infer<typeof gmailDraftSchema>) => {
    const client = requireGoogleClient();
    const raw = toBase64Url(buildMimeMessage(to, subject, body));
    const response = await client.request<{ id: string }>({
      url: 'https://gmail.googleapis.com/gmail/v1/users/me/drafts', method: 'POST',
      data: { message: { raw } },
    });
    return JSON.stringify({ draftId: response.data.id, webLink: 'https://mail.google.com/mail/u/0/#drafts' });
  },
  {
    name: 'draft_email',
    description: 'Crea un borrador real de correo en la cuenta de Gmail del sistema — nunca lo envía. '
      + 'Un humano lo revisa y lo envía manualmente desde la bandeja de Borradores. Úsala cuando el '
      + 'entregable sea comunicación real por correo hacia un destinatario.',
    schema: gmailDraftSchema,
  },
);

type GmailMessageList = { messages?: { id: string }[] };
type GmailMessage = { id: string; snippet?: string; payload?: { headers?: { name: string; value: string }[] } };
const gmailReadSchema = z.object({
  query: z.string().trim().max(200).default('').describe('Consulta de búsqueda de Gmail (p. ej. "from:cliente@dominio.com"), o vacío para los más recientes'),
  limit: z.number().int().min(1).max(10).default(5),
}).strict();
export const gmailReadTool = tool(
  async ({ query, limit }: z.infer<typeof gmailReadSchema>) => {
    const client = requireGoogleClient();
    const list = await client.request<GmailMessageList>({
      url: 'https://gmail.googleapis.com/gmail/v1/users/me/messages',
      params: { q: query || undefined, maxResults: limit },
    });
    const ids = list.data.messages ?? [];
    if (!ids.length) return 'Sin mensajes reales encontrados para esa consulta.';
    const messages = await Promise.all(ids.map((m) => client.request<GmailMessage>({
      url: `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}`,
      params: { format: 'metadata', metadataHeaders: ['Subject', 'From', 'Date'] },
    }).then((r) => r.data)));
    const results = messages.map((msg) => ({
      id: msg.id,
      subject: msg.payload?.headers?.find((h) => h.name === 'Subject')?.value ?? '(sin asunto)',
      from: msg.payload?.headers?.find((h) => h.name === 'From')?.value ?? '',
      date: msg.payload?.headers?.find((h) => h.name === 'Date')?.value ?? '',
      snippet: msg.snippet ?? '',
    }));
    return JSON.stringify(results);
  },
  {
    name: 'search_email',
    description: 'Busca mensajes reales (solo lectura) en la cuenta de Gmail del sistema, con la '
      + 'sintaxis de búsqueda de Gmail. Devuelve asunto, remitente, fecha y un extracto real. No '
      + 'modifica ni borra nada.',
    schema: gmailReadSchema,
  },
);

// Las cinco herramientas que siguen comparten cliente con Gmail (requireGoogleClient()), pero a
// diferencia de pdf.generate no guardan nada en nuestra Postgres: Drive, Calendar, Sheets, Meet
// y Slides son dueños del contenido real, y cada una devuelve su propio enlace real para citar
// como evidencia — mismo patrón que ya usa email.draft.

const DRIVE_BOUNDARY = 'veridiscorp_drive_upload_boundary';
function buildDriveMultipart(metadata: Record<string, unknown>, content: string, mimeType: string): string {
  return `--${DRIVE_BOUNDARY}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`
    + `--${DRIVE_BOUNDARY}\r\nContent-Type: ${mimeType}\r\n\r\n${content}\r\n--${DRIVE_BOUNDARY}--`;
}
const driveUploadSchema = z.object({
  title: z.string().trim().min(1).max(200),
  content: z.string().trim().min(1).max(200000),
  mimeType: z.enum(['text/plain', 'text/csv', 'text/markdown']).default('text/plain'),
}).strict();
export const driveUploadTool = tool(
  async ({ title, content, mimeType }: z.infer<typeof driveUploadSchema>) => {
    const client = requireGoogleClient();
    const response = await client.request<{ id: string; webViewLink?: string }>({
      url: 'https://www.googleapis.com/upload/drive/v3/files', method: 'POST',
      params: { uploadType: 'multipart', fields: 'id,webViewLink' },
      headers: { 'Content-Type': `multipart/related; boundary=${DRIVE_BOUNDARY}` },
      data: buildDriveMultipart({ name: title }, content, mimeType),
    });
    return JSON.stringify({ fileId: response.data.id, webViewLink: response.data.webViewLink });
  },
  {
    name: 'upload_drive_file',
    description: 'Sube un archivo de texto real a Drive, en la cuenta del sistema (drive.file: solo '
      + 've archivos que esta misma herramienta crea, nunca el resto del Drive). Devuelve un enlace '
      + 'real para compartir. Úsala para un entregable que deba vivir como archivo compartible.',
    schema: driveUploadSchema,
  },
);

type CalendarEventResponse = { id: string; htmlLink: string; hangoutLink?: string; conferenceData?: { entryPoints?: { entryPointType: string; uri: string }[] } };
const calendarEventSchema = z.object({
  summary: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional(),
  start: z.iso.datetime({ offset: true }),
  end: z.iso.datetime({ offset: true }),
  attendees: z.array(z.email()).max(20).optional(),
  withMeetLink: z.boolean().default(false),
}).strict();
// sendUpdates: 'all' — a diferencia de email.draft, un invitado real SÍ recibe la invitación de
// verdad en el momento de crear el evento, sin que un humano la revise antes. Decisión explícita
// del usuario, documentada en docs/assistant-v1-roadmap.md — más riesgo que correo, a propósito.
export const calendarCreateEventTool = tool(
  async ({ summary, description, start, end, attendees, withMeetLink }: z.infer<typeof calendarEventSchema>) => {
    const client = requireGoogleClient();
    const response = await client.request<CalendarEventResponse>({
      url: 'https://www.googleapis.com/calendar/v3/calendars/primary/events', method: 'POST',
      params: { sendUpdates: 'all', ...(withMeetLink ? { conferenceDataVersion: 1 } : {}) },
      data: {
        summary, ...(description ? { description } : {}),
        start: { dateTime: start }, end: { dateTime: end },
        ...(attendees?.length ? { attendees: attendees.map((email) => ({ email })) } : {}),
        ...(withMeetLink ? { conferenceData: { createRequest: { requestId: randomUUID() } } } : {}),
      },
    });
    const meetLink = response.data.hangoutLink ?? response.data.conferenceData?.entryPoints?.find((e) => e.entryPointType === 'video')?.uri;
    return JSON.stringify({ eventId: response.data.id, htmlLink: response.data.htmlLink, ...(meetLink ? { meetLink } : {}) });
  },
  {
    name: 'create_calendar_event',
    description: 'Crea un evento real en el Calendar de la cuenta del sistema. Si incluye "attendees", '
      + 'Google les manda la invitación real de inmediato — no es un borrador, no la revisa un humano '
      + 'antes. Usa "withMeetLink" para incluir un enlace real de videollamada en el propio evento.',
    schema: calendarEventSchema,
  },
);

type SheetsCreateResponse = { spreadsheetId: string; spreadsheetUrl: string };
const sheetsCreateSchema = z.object({
  title: z.string().trim().min(1).max(200),
  headers: z.array(z.string().max(100)).max(20).optional(),
  rows: z.array(z.array(z.string().max(300)).max(20)).max(500).optional(),
}).strict();
export const sheetsCreateTool = tool(
  async ({ title, headers, rows }: z.infer<typeof sheetsCreateSchema>) => {
    const client = requireGoogleClient();
    const created = await client.request<SheetsCreateResponse>({
      url: 'https://sheets.googleapis.com/v4/spreadsheets', method: 'POST',
      data: { properties: { title } },
    });
    const values = [...(headers ? [headers] : []), ...(rows ?? [])];
    if (values.length) {
      await client.request({
        url: `https://sheets.googleapis.com/v4/spreadsheets/${created.data.spreadsheetId}/values/A1:append`,
        method: 'POST', params: { valueInputOption: 'RAW' }, data: { values },
      });
    }
    return JSON.stringify({ spreadsheetId: created.data.spreadsheetId, spreadsheetUrl: created.data.spreadsheetUrl });
  },
  {
    name: 'create_spreadsheet',
    description: 'Crea una hoja de cálculo real en Google Sheets, con encabezados y filas opcionales, '
      + 'y devuelve su enlace real. Úsala cuando el entregable sean datos estructurados, no un documento.',
    schema: sheetsCreateSchema,
  },
);

type MeetSpaceResponse = { meetingUri: string; meetingCode: string };
export const meetCreateSpaceTool = tool(
  async () => {
    const client = requireGoogleClient();
    const response = await client.request<MeetSpaceResponse>({
      url: 'https://meet.googleapis.com/v2/spaces', method: 'POST', data: {},
    });
    return JSON.stringify({ meetingUri: response.data.meetingUri, meetingCode: response.data.meetingCode });
  },
  {
    name: 'create_meet_space',
    description: 'Crea una sala real de Google Meet, sin evento de calendario asociado, y devuelve el '
      + 'enlace real para unirse. Para programar una reunión con fecha y hora, usa create_calendar_event '
      + 'con withMeetLink en vez de esta.',
    schema: z.object({}).strict(),
  },
);

type SlidesCreateResponse = { presentationId: string; slides?: { objectId: string }[] };
const slideBlockSchema = z.object({
  heading: z.string().trim().min(1).max(200),
  bullets: z.array(z.string().trim().min(1).max(300)).min(1).max(8),
}).strict();
const slidesCreateSchema = z.object({
  title: z.string().trim().min(1).max(200),
  slides: z.array(slideBlockSchema).min(1).max(15),
}).strict();
// v1 solo compone encabezado + viñetas por diapositiva, con diseños predefinidos de Google
// (TITLE, TITLE_AND_BODY) — nada de imágenes, tablas ni dos columnas todavía, misma frontera que
// ya se puso en pdf.generate. La API de Slides es por objetos: cada diapositiva necesita sus
// propios ids de marcador de posición antes de poder insertarle texto, todo en un solo batchUpdate.
export const slidesCreateTool = tool(
  async ({ title, slides }: z.infer<typeof slidesCreateSchema>) => {
    const client = requireGoogleClient();
    const created = await client.request<SlidesCreateResponse>({
      url: 'https://slides.googleapis.com/v1/presentations', method: 'POST', data: { title },
    });
    const presentationId = created.data.presentationId;
    const requests: Record<string, unknown>[] = [];
    const defaultSlideId = created.data.slides?.[0]?.objectId;
    if (defaultSlideId) requests.push({ deleteObject: { objectId: defaultSlideId } });
    const coverTitleId = 'cover_title';
    requests.push({ createSlide: { objectId: 'cover', insertionIndex: 0, slideLayoutReference: { predefinedLayout: 'TITLE' },
      placeholderIdMappings: [{ layoutPlaceholder: { type: 'CENTERED_TITLE' }, objectId: coverTitleId }] } });
    requests.push({ insertText: { objectId: coverTitleId, insertionIndex: 0, text: title } });
    slides.forEach((slide, index) => {
      const slideId = `content_${index}`; const titleId = `${slideId}_title`; const bodyId = `${slideId}_body`;
      requests.push({ createSlide: { objectId: slideId, insertionIndex: index + 1, slideLayoutReference: { predefinedLayout: 'TITLE_AND_BODY' },
        placeholderIdMappings: [{ layoutPlaceholder: { type: 'TITLE' }, objectId: titleId }, { layoutPlaceholder: { type: 'BODY' }, objectId: bodyId }] } });
      requests.push({ insertText: { objectId: titleId, insertionIndex: 0, text: slide.heading } });
      requests.push({ insertText: { objectId: bodyId, insertionIndex: 0, text: slide.bullets.map((b) => `• ${b}`).join('\n') } });
    });
    await client.request({ url: `https://slides.googleapis.com/v1/presentations/${presentationId}:batchUpdate`, method: 'POST', data: { requests } });
    return JSON.stringify({ presentationId, url: `https://docs.google.com/presentation/d/${presentationId}/edit` });
  },
  {
    name: 'create_presentation',
    description: 'Crea una presentación real de Google Slides: una diapositiva de portada con el título '
      + 'y una diapositiva por cada bloque de encabezado + viñetas. Sin imágenes ni tablas todavía. '
      + 'Devuelve el enlace real de edición.',
    schema: slidesCreateSchema,
  },
);

// Meta (Facebook Pages + Instagram, ver docs/social-publishing-roadmap.md): cliente propio, sin
// reusar requireGoogleClient — es otro proveedor, otro token, otra forma de autenticar (Graph API
// acepta access_token por querystring/body, no un cliente OAuth2 con refresco automático como
// google-auth-library). configureMeta() lo inyecta una sola vez al arrancar el servidor
// (runtime/cli.ts, loadMetaClient()), igual patrón que configureGmail: sin cuenta autorizada
// todavía, las herramientas fallan como "no configurado", nunca tumban execute().
const GRAPH_API_VERSION = 'v26.0';
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

export type MetaAccount = { pageId: string; pageAccessToken: string; igUserId: string | null };
let metaAccount: MetaAccount | null = null;
export function configureMeta(account: MetaAccount | null): void { metaAccount = account; }

function requireMetaAccount(): MetaAccount {
  if (!metaAccount) throw new Error('La cuenta de Meta (Facebook/Instagram) no está configurada: falta autorizar (npm run runtime:meta-authorize)');
  return metaAccount;
}

type GraphErrorBody = { error?: { message: string; code?: number; error_subcode?: number } };

// Params siempre van en el cuerpo (POST) o la query (GET) de Graph API, nunca mezclados — así lo
// documentan los propios ejemplos curl de Meta. access_token entra como un parámetro más, nunca
// como header: Graph API no soporta "Authorization: Bearer" en todos sus endpoints por igual.
async function graphRequest<T>(method: 'GET' | 'POST', path: string, params: Record<string, string | undefined>): Promise<T> {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value !== undefined) query.set(key, value);
  const url = method === 'GET' ? `${GRAPH_API_BASE}/${path}?${query.toString()}` : `${GRAPH_API_BASE}/${path}`;
  const response = await fetch(url, {
    method, signal: AbortSignal.timeout(30000),
    ...(method === 'POST' ? { headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: query.toString() } : {}),
  });
  const data = await response.json() as T & GraphErrorBody;
  if (!response.ok || data.error) {
    throw new Error(data.error ? `Meta Graph API (${data.error.code ?? '?'}): ${data.error.message}` : `Meta Graph API respondió ${response.status}`);
  }
  return data;
}

const facebookPublishSchema = z.object({
  message: z.string().trim().max(5000).optional().describe('Texto de la publicación'),
  imageUrl: z.url().optional().describe('URL pública (ya alojada, JPEG/PNG) de una imagen; si se incluye, se publica como foto en vez de como texto'),
  link: z.url().optional().describe('Enlace a incluir en una publicación de texto; se ignora si hay imageUrl'),
}).strict().refine((data) => Boolean(data.message?.trim() || data.imageUrl), { message: 'Hace falta "message" o "imageUrl"' });

// Dos endpoints reales distintos de Graph API según haya imagen o no — a diferencia de Instagram,
// la Página de Facebook no exige el modelo de contenedor para texto/foto simple, solo para Reels
// (fuera de alcance de esta primera versión, igual límite que ya se puso en video.render/pdf.generate
// con imágenes y dos columnas: no se construye hasta tener un caso real que lo necesite).
export const facebookPublishTool = tool(
  async ({ message, imageUrl, link }: z.infer<typeof facebookPublishSchema>) => {
    const account = requireMetaAccount();
    if (imageUrl) {
      const photo = await graphRequest<{ id: string; post_id?: string }>('POST', `${account.pageId}/photos`, {
        url: imageUrl, access_token: account.pageAccessToken, ...(message ? { caption: message } : {}),
      });
      const postId = photo.post_id ?? photo.id;
      return JSON.stringify({ postId, permalink: `https://www.facebook.com/${postId}` });
    }
    const post = await graphRequest<{ id: string }>('POST', `${account.pageId}/feed`, {
      access_token: account.pageAccessToken, message: message ?? '', ...(link ? { link } : {}),
    });
    return JSON.stringify({ postId: post.id, permalink: `https://www.facebook.com/${post.id}` });
  },
  {
    name: 'publish_facebook_post',
    description: 'Publica de verdad en la Página de Facebook conectada: texto (con enlace opcional) o una '
      + 'foto única desde una URL pública ya alojada, con leyenda opcional. Sin video, Reels ni carrusel '
      + 'todavía — para eso hace falta pedirlo explícitamente. Devuelve el id real de la publicación y su enlace.',
    schema: facebookPublishSchema,
  },
);

const instagramPublishSchema = z.object({
  caption: z.string().trim().max(2200).optional().describe('Leyenda de la publicación (límite real de Instagram: 2200 caracteres)'),
  imageUrl: z.url().describe('URL pública (ya alojada, JPEG) de la imagen; Instagram la descarga desde ahí al publicar'),
}).strict();

// Instagram sí exige el modelo de contenedor siempre (crear -> esperar a que termine de procesar
// -> publicar), a diferencia de Facebook/feed. Sin esto, media_publish puede fallar o publicar
// algo a medio procesar — documentado así en el propio Content Publishing API de Meta.
async function pollInstagramContainer(containerId: string, accessToken: string): Promise<void> {
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    const status = await graphRequest<{ status_code?: string }>('GET', containerId, { fields: 'status_code', access_token: accessToken });
    if (status.status_code === 'FINISHED') return;
    if (status.status_code === 'ERROR' || status.status_code === 'EXPIRED') throw new Error(`Instagram no pudo procesar la imagen (status ${status.status_code})`);
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  throw new Error('Instagram no terminó de procesar la imagen a tiempo (más de 60s)');
}

export const instagramPublishTool = tool(
  async ({ caption, imageUrl }: z.infer<typeof instagramPublishSchema>) => {
    const account = requireMetaAccount();
    if (!account.igUserId) throw new Error('La Página de Facebook conectada no tiene una cuenta de Instagram Business vinculada');
    const container = await graphRequest<{ id: string }>('POST', `${account.igUserId}/media`, {
      access_token: account.pageAccessToken, image_url: imageUrl, ...(caption ? { caption } : {}),
    });
    await pollInstagramContainer(container.id, account.pageAccessToken);
    const published = await graphRequest<{ id: string }>('POST', `${account.igUserId}/media_publish`, {
      access_token: account.pageAccessToken, creation_id: container.id,
    });
    // El permalink es una llamada aparte y no siempre está disponible de inmediato; si falla, se
    // devuelve igual el id real de la publicación en vez de tumbar la herramienta por un detalle.
    const permalink = await graphRequest<{ permalink?: string }>('GET', published.id, { fields: 'permalink', access_token: account.pageAccessToken })
      .then((r) => r.permalink ?? null).catch(() => null);
    return JSON.stringify({ mediaId: published.id, permalink });
  },
  {
    name: 'publish_instagram_post',
    description: 'Publica de verdad una imagen en la cuenta de Instagram Business vinculada a la Página de '
      + 'Facebook conectada, desde una URL pública ya alojada (JPEG), con leyenda opcional. Crea el '
      + 'contenedor, espera a que Instagram termine de procesarlo y recién entonces publica — puede tardar '
      + 'unos segundos. Sin video, Reels, Stories ni carrusel todavía. Devuelve el id real de la publicación '
      + 'y su enlace cuando Instagram lo tenga disponible.',
    schema: instagramPublishSchema,
  },
);

// Un id de allowedTools puede abrir varias herramientas (repo.read = git log/show/diff/status, buscar, leer, listar).
const OFFICE_TOOLS: Record<string, StructuredToolInterface | StructuredToolInterface[]> = {
  'web.search': webSearchTool,
  calculator: calculatorTool,
  'cve.lookup': cveLookupTool,
  'code.sandbox': codeSandboxTool,
  'clickup.read': clickupTool,
  'memory.write': memoryWriteTool,
  'memory.query': memoryQueryTool,
  'pdf.generate': pdfGenerateTool,
  'video.render': videoRenderTool,
  'voice.generate': voiceGenerateTool,
  'music.generate': musicGenerateTool,
  'email.draft': gmailDraftTool,
  'email.read': gmailReadTool,
  'drive.upload': driveUploadTool,
  'calendar.create_event': calendarCreateEventTool,
  'sheets.create': sheetsCreateTool,
  'meet.create_space': meetCreateSpaceTool,
  'slides.create': slidesCreateTool,
  'social.publish_facebook': facebookPublishTool,
  'social.publish_instagram': instagramPublishTool,
  'repo.read': REPO_TOOLS,
  'core.read': CORE_TOOLS,
  'core.write': CORE_WRITE_TOOLS,
  ...MCP_TOOLS,
};

export function toolsFor(allowedTools: readonly string[]): StructuredToolInterface[] {
  return allowedTools.flatMap((id) => OFFICE_TOOLS[id] ?? []);
}

// Grounding real con la búsqueda nativa de Google (requiere el perfil 'search-google': Gemini +
// GEMINI_API_KEY). A diferencia de wikipediaSearch, aquí el propio modelo decide qué buscar y
// redacta la respuesta; nosotros solo extraemos sus fuentes reales (groundingChunks) para que
// execute() pueda exigir que las evidencias las citen literalmente.
type GroundingChunk = { web?: { uri?: string; title?: string } };
export async function groundedWebSearch(
  profile: ResolvedProfile, env: NodeJS.ProcessEnv, question: string,
): Promise<{ answer: string; sources: ToolResult[] }> {
  const model = createProfileModel(profile, env);
  const bound = model.bindTools?.([{ googleSearch: {} }] as never);
  if (!bound) throw new Error('El modelo configurado no admite la búsqueda nativa de Google');
  const response = await bound.invoke([new HumanMessage(question)], {
    signal: AbortSignal.timeout(profile.timeoutMs),
  });
  const metadata = response.response_metadata as { groundingMetadata?: { groundingChunks?: GroundingChunk[] } } | undefined;
  const sources = (metadata?.groundingMetadata?.groundingChunks ?? [])
    .map((chunk) => chunk.web)
    .filter((web): web is { uri: string; title?: string } => Boolean(web?.uri))
    .map((web) => ({ title: web.title || web.uri, url: web.uri, snippet: '' }));
  const content = response.content;
  const answer = typeof content === 'string' ? content
    : Array.isArray(content)
      ? content.map((part) => {
        const text = (part as { text?: unknown }).text;
        return typeof text === 'string' ? text : '';
      }).join('\n')
      : '';
  if (!answer.trim()) throw new Error('La búsqueda de Google no devolvió una respuesta con contenido');
  return { answer, sources };
}
