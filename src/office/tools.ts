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
