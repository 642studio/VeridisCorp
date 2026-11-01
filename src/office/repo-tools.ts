import { tool, type StructuredToolInterface } from '@langchain/core/tools';
import { execFile } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';
import { z } from 'zod';

// Lectura de repositorios git para los puestos de software (allowedTools "repo.read").
// Solo lectura y solo lo que el operador declara en VERIDIS_REPOS ("nombre=/ruta,otro=/ruta"):
// - git se ejecuta con execFile (sin shell) y argumentos validados; nunca escribe, nunca hace
//   fetch/checkout, y sin textconv/ext-diff para que ningún filtro configurado ejecute nada.
// - Solo se leen archivos que git versiona: un .env o una llave ignorados no existen para el agente.
// - La salida se recorta y se tapan cadenas con forma de credencial antes de llegar al modelo.

export type RepoMap = Map<string, string>;

export function parseRepos(raw: string | undefined): RepoMap {
  const repos: RepoMap = new Map();
  for (const entry of (raw ?? '').split(',').map((e) => e.trim()).filter(Boolean)) {
    const at = entry.indexOf('=');
    if (at <= 0) continue;
    const name = entry.slice(0, at).trim().toLowerCase();
    const path = entry.slice(at + 1).trim();
    if (/^[a-z0-9][a-z0-9._-]{0,40}$/.test(name) && isAbsolute(path)) repos.set(name, path);
  }
  return repos;
}

let repos: RepoMap = parseRepos(process.env.VERIDIS_REPOS);
// Lo fija cli.ts después de cargar el .env, y las pruebas con un repo temporal.
export function configureRepos(map: RepoMap): void { repos = map; }
export function configuredRepoNames(): string[] { return [...repos.keys()]; }

const MAX_OUTPUT = 12000;
const SECRET_PATTERNS: RegExp[] = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
  /\b(sk|pk|rk)-[A-Za-z0-9_-]{20,}\b/g,
  /\bgh[pousr]_[A-Za-z0-9]{30,}\b/g,
  /\bxox[abpr]-[A-Za-z0-9-]{20,}\b/g,
  /\bAKIA[0-9A-Z]{16}\b/g,
  /\bAIza[0-9A-Za-z_-]{30,}\b/g,
];
export function redactSecrets(text: string): string {
  return SECRET_PATTERNS.reduce((out, pattern) => out.replace(pattern, '[OCULTO]'), text)
    // Contraseña dentro de una URL de conexión (postgres://usuario:clave@host): se conserva el resto.
    .replace(/([a-z][a-z0-9+.-]*:\/\/[^:\s/@]+:)[^@\s]+@/gi, '$1[OCULTO]@');
}
function clip(text: string, max = MAX_OUTPUT): string {
  const safe = redactSecrets(text);
  return safe.length > max ? `${safe.slice(0, max)}\n… [recortado: ${safe.length - max} caracteres más]` : safe;
}

function repoRoot(name: string): string {
  const root = repos.get(name.trim().toLowerCase());
  if (!root) {
    const known = configuredRepoNames();
    throw new Error(known.length ? `Repositorio desconocido "${name}". Disponibles: ${known.join(', ')}` : 'No hay repositorios configurados (VERIDIS_REPOS)');
  }
  return root;
}

class GitError extends Error { constructor(message: string, readonly exitCode: number | null) { super(message); } }
function git(root: string, args: string[], timeoutMs = 15000): Promise<string> {
  return new Promise((resolvePromise, reject) => {
    execFile('git', ['-C', root, '--no-pager', '-c', 'core.quotepath=off', ...args], {
      timeout: timeoutMs, maxBuffer: 4 * 1024 * 1024,
      env: { PATH: process.env.PATH ?? '/usr/bin:/bin', HOME: process.env.HOME ?? '/tmp', GIT_TERMINAL_PROMPT: '0', GIT_OPTIONAL_LOCKS: '0', LANG: 'C.UTF-8' },
    }, (error, stdout, stderr) => {
      if (error) reject(new GitError((stderr || error.message).trim().slice(0, 500), typeof error.code === 'number' ? error.code : null));
      else resolvePromise(stdout);
    });
  });
}

// Una referencia de git (hash, rama, HEAD~2, v1.0) — nunca algo que git pueda leer como opción — y
// una ruta relativa que no sale del repo. Se validan con refine (no con .regex): el patrón viaja en el
// JSON Schema de la herramienta y DeepSeek rechaza la llamada entera si trae lookaheads (visto en vivo).
const isRef = (value: string) => /^[A-Za-z0-9._/~^@{}-]+$/.test(value) && !value.startsWith('-');
const isRepoPath = (value: string) => !value.startsWith('-') && !value.startsWith('/') && !value.includes('\0')
  && !value.split('/').includes('..');
const Ref = z.string().trim().min(1).max(80).refine(isRef, 'Referencia de git inválida');
const RepoPath = z.string().trim().max(300).refine(isRepoPath, 'Ruta inválida');
const RepoName = z.string().trim().min(1).max(40).describe('Nombre del repositorio, tal como aparece en la lista de repositorios disponibles');

async function trackedFile(root: string, path: string): Promise<string> {
  const absolute = resolve(root, path);
  const real = realpathSync(absolute);
  const rootReal = realpathSync(root);
  const rel = relative(rootReal, real);
  if (rel.startsWith('..') || isAbsolute(rel)) throw new Error('La ruta sale del repositorio');
  // Solo archivos versionados: lo ignorado (.env, llaves, datos locales) no existe para el agente.
  await git(root, ['ls-files', '--error-unmatch', '--', rel]).catch(() => { throw new Error(`"${path}" no es un archivo versionado en git`); });
  return real;
}

export const gitLogTool = tool(
  async ({ repo, limit, path }) => {
    const root = repoRoot(repo);
    const out = await git(root, ['log', `-n${limit}`, '--date=iso-strict', '--no-color',
      '--pretty=format:%h | %ad | %an | %s', ...(path ? ['--', path] : [])]);
    return clip(out || 'Sin commits.');
  },
  {
    name: 'git_log',
    description: 'Lista los commits más recientes de un repositorio (hash corto, fecha, autor, mensaje). Opcionalmente filtrados por una ruta.',
    schema: z.object({ repo: RepoName, limit: z.number().int().min(1).max(30).default(10), path: RepoPath.optional() }),
  },
);

export const gitShowTool = tool(
  async ({ repo, ref, path }) => {
    const root = repoRoot(repo);
    const out = await git(root, ['show', '--no-color', '--no-textconv', '--no-ext-diff', '--format=fuller', '--stat', '--patch', ref, ...(path ? ['--', path] : [])]);
    return clip(out);
  },
  {
    name: 'git_show',
    description: 'Muestra un commit: autor, fecha, mensaje, archivos tocados (--stat) y el diff. Por defecto HEAD (el último commit). '
      + 'Un commit grande llega recortado: vuelve a llamarla con "path" para ver el diff completo de un archivo concreto.',
    schema: z.object({ repo: RepoName, ref: Ref.default('HEAD'), path: RepoPath.optional() }),
  },
);

export const gitDiffTool = tool(
  async ({ repo, from, to }) => {
    const root = repoRoot(repo);
    const range = from ? [to ? `${from}..${to}` : from] : [];
    const stat = await git(root, ['diff', '--no-color', '--no-textconv', '--no-ext-diff', '--stat', ...range]);
    const patch = await git(root, ['diff', '--no-color', '--no-textconv', '--no-ext-diff', ...range]);
    return clip(stat || patch ? `${stat}\n${patch}` : 'Sin diferencias.');
  },
  {
    name: 'git_diff',
    description: 'Diferencias de un repositorio. Sin "from": cambios sin commitear en archivos versionados. Con "from" (y opcional "to"): diferencias entre dos referencias.',
    schema: z.object({ repo: RepoName, from: Ref.optional(), to: Ref.optional() }),
  },
);

export const gitStatusTool = tool(
  async ({ repo }) => {
    const root = repoRoot(repo);
    return clip(await git(root, ['status', '--short', '--branch', '--untracked-files=no']));
  },
  {
    name: 'git_status',
    description: 'Rama actual, si va adelante/atrás del remoto y qué archivos versionados tienen cambios sin commitear.',
    schema: z.object({ repo: RepoName }),
  },
);

export const repoGrepTool = tool(
  async ({ repo, text, path }) => {
    const root = repoRoot(repo);
    // -F: texto literal (sin regex), solo archivos versionados, como mucho 5 coincidencias por archivo.
    const out = await git(root, ['grep', '-n', '-I', '-F', '--max-count=5', '-e', text, ...(path ? ['--', path] : [])])
      // git grep sale con 1 cuando no hay coincidencias: no es un error.
      .catch((error: unknown) => { if (error instanceof GitError && error.exitCode === 1) return ''; throw error; });
    return clip(out || 'Sin coincidencias.', 8000);
  },
  {
    name: 'repo_search',
    description: 'Busca un texto literal en los archivos versionados de un repositorio y devuelve archivo:línea:contenido.',
    schema: z.object({ repo: RepoName, text: z.string().min(2).max(200), path: RepoPath.optional() }),
  },
);

export const repoReadTool = tool(
  async ({ repo, path, startLine, endLine }) => {
    const root = repoRoot(repo);
    const file = await trackedFile(root, path);
    const lines = (await readFile(file, 'utf8')).split('\n');
    const from = Math.max(1, startLine ?? 1);
    const to = Math.min(lines.length, endLine ?? from + 299);
    const body = lines.slice(from - 1, to).map((line, i) => `${from + i}: ${line}`).join('\n');
    return clip(`${path} (líneas ${from}-${to} de ${lines.length})\n${body}`);
  },
  {
    name: 'repo_read_file',
    description: 'Lee un archivo versionado de un repositorio, con números de línea (hasta 300 líneas por llamada; usa startLine/endLine para otra parte).',
    schema: z.object({ repo: RepoName, path: RepoPath.min(1), startLine: z.number().int().min(1).optional(), endLine: z.number().int().min(1).optional() }),
  },
);

export const repoListTool = tool(
  async ({ repo, path }) => {
    const root = repoRoot(repo);
    const files = (await git(root, ['ls-files', ...(path ? ['--', path] : [])])).split('\n').filter(Boolean);
    const shown = files.slice(0, 300).join('\n');
    return clip(files.length > 300 ? `${shown}\n… y ${files.length - 300} archivos más (filtra con path)` : shown || 'Sin archivos.');
  },
  {
    name: 'repo_list_files',
    description: 'Lista los archivos versionados de un repositorio, opcionalmente dentro de una carpeta (path).',
    schema: z.object({ repo: RepoName, path: RepoPath.optional() }),
  },
);

export const REPO_TOOLS: StructuredToolInterface[] = [gitLogTool, gitShowTool, gitDiffTool, gitStatusTool, repoGrepTool, repoReadTool, repoListTool];

// Lo que el agente necesita saber antes de elegir: qué repos existen y en qué estado están.
export async function describeRepos(): Promise<string | null> {
  if (!repos.size) return null;
  const lines = await Promise.all([...repos].map(async ([name, root]) => {
    try {
      const branch = (await git(root, ['rev-parse', '--abbrev-ref', 'HEAD'])).trim();
      const last = (await git(root, ['log', '-1', '--date=iso-strict', '--pretty=format:%h %ad %s'])).trim();
      return `- ${name} (rama ${branch}; último commit: ${redactSecrets(last)})`;
    } catch (error) {
      return `- ${name} (no disponible: ${error instanceof Error ? error.message.slice(0, 120) : 'error'})`;
    }
  }));
  return `Repositorios git disponibles (solo lectura):\n${lines.join('\n')}`;
}
