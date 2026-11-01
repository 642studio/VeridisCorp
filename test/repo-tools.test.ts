import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, execSync } from 'node:child_process';
import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  configureRepos, parseRepos, redactSecrets, describeRepos,
  gitLogTool, gitShowTool, gitDiffTool, gitStatusTool, repoGrepTool, repoReadTool, repoListTool,
} from '../src/office/repo-tools.js';
import { toolsFor, runSandboxed } from '../src/office/tools.js';

// Repo git real y temporal: dos commits, un .env ignorado con un secreto, una llave falsa
// versionada (para comprobar que se tapa) y un symlink versionado que apunta fuera del repo.
let root = '';
let outside = '';
const fakeKey = 'sk-' + 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4';
before(() => {
  root = mkdtempSync(join(tmpdir(), 'veridis-repo-'));
  outside = mkdtempSync(join(tmpdir(), 'veridis-outside-'));
  writeFileSync(join(outside, 'secreto.txt'), 'NO DEBE LEERSE');
  const run = (...args: string[]) => execFileSync('git', ['-C', root, ...args], { stdio: 'pipe' });
  run('init', '-q', '-b', 'main');
  run('config', 'user.email', 'test@example.com'); run('config', 'user.name', 'Prueba');
  writeFileSync(join(root, '.gitignore'), '.env\n');
  writeFileSync(join(root, '.env'), 'OPENAI_API_KEY=ignorado-por-git\n');
  writeFileSync(join(root, 'app.ts'), 'export const suma = (a: number, b: number) => a + b;\n');
  run('add', '.'); run('commit', '-q', '-m', 'Primer commit: suma');
  writeFileSync(join(root, 'app.ts'), 'export const suma = (a: number, b: number) => a + b;\nexport const resta = (a: number, b: number) => a - b;\n');
  writeFileSync(join(root, 'config.ts'), `export const key = '${fakeKey}';\nexport const db = 'postgres://app:clave-secreta@db:5432/x';\n`);
  symlinkSync(join(outside, 'secreto.txt'), join(root, 'enlace.txt'));
  run('add', '.'); run('commit', '-q', '-m', 'Agregar resta y configuración');
  writeFileSync(join(root, 'app.ts'), 'export const suma = (a: number, b: number) => a + b; // sin commitear\n');
  configureRepos(parseRepos(`prueba=${root}`));
});
after(() => {
  configureRepos(new Map());
  rmSync(root, { recursive: true, force: true }); rmSync(outside, { recursive: true, force: true });
});

const call = (t: { invoke: (input: never) => Promise<unknown> }, input: Record<string, unknown>) => t.invoke(input as never) as Promise<string>;

test('parseRepos solo acepta nombre=/ruta/absoluta con nombres simples', () => {
  const repos = parseRepos('ok=/srv/repo, Mayus=/tmp/x ,sin-ruta,rel=repo/rel,=/x,mal nombre=/y');
  assert.deepEqual([...repos], [['ok', '/srv/repo'], ['mayus', '/tmp/x']]);
});

test('ningún esquema de herramienta lleva lookarounds: DeepSeek rechaza la llamada entera si los trae', async () => {
  const { toJsonSchema } = await import('@langchain/core/utils/json_schema');
  const all = ['web.search', 'calculator', 'cve.lookup', 'code.sandbox', 'clickup.read', 'memory.write', 'memory.query', 'pdf.generate',
    'email.draft', 'email.read', 'drive.upload', 'calendar.create_event', 'sheets.create', 'meet.create_space', 'slides.create', 'repo.read'];
  assert.equal(toolsFor(all).length, 22);
  for (const t of toolsFor(all)) {
    // Correo y fecha sí llevan pattern (de Zod) y DeepSeek los acepta; lo que rechaza son lookarounds.
    const patterns = JSON.stringify(toJsonSchema(t.schema as never)).match(/"pattern":"(?:[^"\\]|\\.)*"/g) ?? [];
    assert(!patterns.some((p) => /\(\?<?[=!]/.test(p)), `${t.name} manda un lookaround al proveedor: ${patterns.join(' ')}`);
  }
});

test('repo.read abre las siete herramientas de solo lectura', () => {
  assert.deepEqual(toolsFor(['repo.read']).map((t) => t.name),
    ['git_log', 'git_show', 'git_diff', 'git_status', 'repo_search', 'repo_read_file', 'repo_list_files']);
});

test('git_log, git_show, git_diff y git_status leen el repo real', async () => {
  const log = await call(gitLogTool, { repo: 'prueba', limit: 5 });
  assert.match(log, /Agregar resta y configuración/);
  assert.match(log, /Primer commit: suma/);
  const show = await call(gitShowTool, { repo: 'prueba' });
  assert.match(show, /\+export const resta/);
  assert.match(show, /config\.ts/);
  const onlyApp = await call(gitShowTool, { repo: 'prueba', path: 'app.ts' });
  assert.match(onlyApp, /\+export const resta/);
  assert(!onlyApp.includes('postgres://'), 'con path solo debe venir el diff de ese archivo');
  const diff = await call(gitDiffTool, { repo: 'prueba' });
  assert.match(diff, /sin commitear/);
  const range = await call(gitDiffTool, { repo: 'prueba', from: 'HEAD~1', to: 'HEAD' });
  assert.match(range, /\+export const resta/);
  assert.match(await call(gitStatusTool, { repo: 'prueba' }), /## main[\s\S]*app\.ts/);
  assert.match((await describeRepos())!, /prueba \(rama main; último commit: [0-9a-f]+ .*Agregar resta/);
});

test('las credenciales que aparezcan en el código se tapan antes de llegar al modelo', async () => {
  const show = await call(gitShowTool, { repo: 'prueba', ref: 'HEAD' });
  assert(!show.includes(fakeKey), 'la llave llegó al modelo');
  assert(!show.includes('clave-secreta'), 'la contraseña de la URL llegó al modelo');
  assert.match(show, /postgres:\/\/app:\[OCULTO\]@db/);
  assert.equal(redactSecrets('-----BEGIN RSA PRIVATE KEY-----\nabc\n-----END RSA PRIVATE KEY-----'), '[OCULTO]');
});

test('repo_search busca texto literal en archivos versionados, y sin coincidencias no es un error', async () => {
  // Busca en la copia de trabajo (incluye cambios sin commitear).
  assert.match(await call(repoGrepTool, { repo: 'prueba', text: 'sin commitear' }), /app\.ts:1:/);
  assert.equal(await call(repoGrepTool, { repo: 'prueba', text: 'no-existe-en-ningun-lado' }), 'Sin coincidencias.');
  // El .env está ignorado: git grep no lo ve.
  assert.equal(await call(repoGrepTool, { repo: 'prueba', text: 'ignorado-por-git' }), 'Sin coincidencias.');
});

test('repo_read_file lee solo archivos versionados y nunca sale del repo', async () => {
  assert.match(await call(repoReadTool, { repo: 'prueba', path: 'app.ts' }), /^app\.ts \(líneas 1-2 de 2\)\n1: export const suma/);
  await assert.rejects(call(repoReadTool, { repo: 'prueba', path: '.env' }), /no es un archivo versionado/);
  await assert.rejects(call(repoReadTool, { repo: 'prueba', path: 'enlace.txt' }), /sale del repositorio/);
  await assert.rejects(call(repoReadTool, { repo: 'prueba', path: '../secreto.txt' }), /Ruta inválida|Received tool input did not match/);
  await assert.rejects(call(repoReadTool, { repo: 'prueba', path: '/etc/passwd' }), /Ruta inválida|Received tool input did not match/);
  assert.match(await call(repoListTool, { repo: 'prueba' }), /app\.ts/);
});

test('una referencia que git leería como opción se rechaza, y un repo desconocido dice cuáles hay', async () => {
  await assert.rejects(call(gitShowTool, { repo: 'prueba', ref: '--output=/tmp/x' }), /Referencia de git inválida|Received tool input did not match/);
  await assert.rejects(call(gitLogTool, { repo: 'otro', limit: 1 }), /Repositorio desconocido "otro"\. Disponibles: prueba/);
});

function dockerAvailable(): boolean {
  try { execSync('docker info', { stdio: 'ignore', timeout: 5000 }); return true; } catch { return false; }
}
test('code.sandbox corre TypeScript de verdad (antes iba a main.js y fallaba por sintaxis)', { skip: !dockerAvailable(), timeout: 90000 }, async () => {
  const result = await runSandboxed('typescript', 'enum E { A = 21 }\nconst doble = (x: number): number => x * 2;\nconsole.log(doble(E.A));');
  assert.equal(result.exitCode, 0, result.stderr);
  assert.equal(result.stdout.trim(), '42');
});
