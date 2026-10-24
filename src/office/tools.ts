import { tool, type StructuredToolInterface } from '@langchain/core/tools';
import { HumanMessage } from '@langchain/core/messages';
import { spawn } from 'node:child_process';
import { z } from 'zod';
import { createProfileModel } from './model-providers.js';
import type { ResolvedProfile } from './models.js';

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

const SANDBOX_IMAGES: Record<'javascript' | 'python', { image: string; command: string[] }> = {
  javascript: { image: 'node:22-slim', command: ['sh', '-c', 'cat > main.js && node --experimental-strip-types main.js'] },
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
  language: 'javascript' | 'python', code: string, timeoutMs = 60000,
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
  language: z.enum(['javascript', 'python']),
  code: z.string().trim().min(1).max(8000).describe('Código completo de un solo archivo, listo para ejecutar'),
});
export const codeSandboxTool = tool(
  async ({ language, code }: z.infer<typeof codeSandboxSchema>) => {
    const result = await runSandboxed(language, code);
    return JSON.stringify(result);
  },
  {
    name: 'run_code',
    description: 'Ejecuta un snippet de código (javascript o python) en un contenedor aislado, '
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

const OFFICE_TOOLS: Record<string, StructuredToolInterface> = {
  'web.search': webSearchTool,
  calculator: calculatorTool,
  'cve.lookup': cveLookupTool,
  'code.sandbox': codeSandboxTool,
  'clickup.read': clickupTool,
  'pdf.generate': pdfGenerateTool,
};

export function toolsFor(allowedTools: readonly string[]): StructuredToolInterface[] {
  return allowedTools
    .map((id) => OFFICE_TOOLS[id])
    .filter((found): found is StructuredToolInterface => Boolean(found));
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
