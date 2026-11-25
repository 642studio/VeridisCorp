// Test de contrato VeridisCorp -> 642CORE (estatico, sin credenciales ni red).
// Verifica que todo lo que los agentes de Corp asumen de Core siga existiendo:
//  1. la ruta POST /api/integrations/veridiscorp/actions en Core
//  2. cada accion que Corp pide por API existe en Core (actions.ts + projects.ts)
//  3. cada tabla/columna que Corp lee o escribe por SQL directo existe en las
//     migraciones de Core (supabase/migrations)
// Uso: node scripts/contract-check-core.mjs [--core-root ../642-Core-main]
// Sale con codigo 1 si algo del contrato esta roto.
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const arg = process.argv.find((a) => a.startsWith('--core-root='));
const coreRoot = arg ? arg.slice('--core-root='.length) : join(root, '..', '642-Core-main');

let failures = 0;
let passes = 0;
function check(ok, label, detail = '') {
  if (ok) { passes++; console.log(`PASS  ${label}`); }
  else { failures++; console.log(`FAIL  ${label}${detail ? ` -- ${detail}` : ''}`); }
}
const read = (p) => readFileSync(p, 'utf8');

// --- 1. Ruta API en Core ---
check(
  existsSync(join(coreRoot, 'src/app/api/integrations/veridiscorp/actions/route.ts')),
  'Core expone POST /api/integrations/veridiscorp/actions',
);

// --- 2. Acciones API ---
const corpApi = read(join(root, 'src/office/core-api-tools.ts'));
const wantedActions = [...new Set([...corpApi.matchAll(/callCore\('([a-z_]+)'/g)].map((m) => m[1]))].sort();
const coreActionsSrc = read(join(coreRoot, 'src/lib/veridiscorp/actions.ts'))
  + read(join(coreRoot, 'src/lib/veridiscorp/projects.ts'));
const coreActions = [...new Set([...coreActionsSrc.matchAll(/z\.literal\("([a-z_]+)"\)/g)].map((m) => m[1]))].sort();
for (const a of wantedActions) check(coreActions.includes(a), `accion API '${a}' soportada por Core`, `Core soporta: ${coreActions.join(', ')}`);
for (const a of coreActions) if (!wantedActions.includes(a)) console.log(`INFO  accion Core sin uso en Corp: '${a}'`);

// --- 3. Tablas y columnas SQL directas ---
// Tablas que Corp toca por SQL: FROM / INSERT INTO / UPDATE public.X
const corpSql = read(join(root, 'src/office/core-tools.ts')) + read(join(root, 'src/office/finance-tools.ts'));
// Columnas que Corp selecciona por tabla (select <cols> from public.X)
const wantedCols = new Map(); // tabla -> Set(col)
for (const m of corpSql.matchAll(/select\s+([\s\S]{1,600}?)\s+from\s+public\.([a-z_]+)/gi)) {
  const table = m[2];
  // Parte la lista respetando parentesis (coalesce(sum(total), 0) tiene comas dentro),
  // quita prefijos de tabla (cc.name -> name) y extrae la columna dentro de
  // funciones (sum(total) -> total); ignora count(*) y literales.
  const items = [];
  let depth = 0, cur = '';
  for (const ch of m[1]) { if (ch === '(') depth++; if (ch === ')') depth--; if (ch === ',' && depth === 0) { items.push(cur); cur = ''; } else cur += ch; }
  items.push(cur);
  const cols = items.map((item) => {
    // Quita funciones y casts y quedate con el ultimo identificador:
    // coalesce(sum(total), 0)::numeric as total -> total; cc.name -> name.
    const cleaned = item.replace(/\s+as\s+\w+$/i, '').replace(/::[a-z_]+/gi, '')
      .replace(/\b(?:sum|count|coalesce|avg|min|max)\s*\(/gi, '').replace(/[()]/g, ' ');
    const words = cleaned.split(/[^a-z_]+/).filter((w) => w && !/^(and|or|not|null|true|false)$/.test(w));
    if (words.length) return words[words.length - 1];
    if (/\(/.test(item)) return '';
    return item.trim().replace(/\s+as\s+\w+$/i, '').split(/\s+/)[0].replace(/^\w+\./, '').replace(/[^a-z_]/g, '');
  }).filter(Boolean);
  if (!wantedCols.has(table)) wantedCols.set(table, new Set());
  for (const c of cols) wantedCols.get(table).add(c);
}
const wantedTables = new Set([
  ...corpSql.matchAll(/(?:from|insert into|update)\s+public\.([a-z_]+)/gi),
].map((m) => m[1]));
// Columnas que Core escribe por API (actions.ts: db.from("X").select("a,b"))
const coreApiSrc = read(join(coreRoot, 'src/lib/veridiscorp/actions.ts'));
for (const m of coreApiSrc.matchAll(/\.from\("([a-z_]+)"\)\.select\("([^"]+)"\)/g)) {
  if (!wantedCols.has(m[1])) wantedCols.set(m[1], new Set());
  for (const c of m[2].split(',')) wantedCols.get(m[1]).add(c.trim());
  wantedTables.add(m[1]);
}
// Esquema de Core segun migraciones: CREATE TABLE + ALTER TABLE ADD COLUMN
const migDir = join(coreRoot, 'supabase/migrations');
const schema = new Map(); // tabla -> Set(col)
for (const f of readdirSync(migDir).filter((x) => x.endsWith('.sql'))) {
  const sql = readFileSync(join(migDir, f), 'utf8');
  for (const m of sql.matchAll(/create table (?:if not exists )?public\.([a-z_]+)\s*\(([\s\S]*?)\n\);/gi)) {
    if (!schema.has(m[1])) schema.set(m[1], new Set());
    for (const line of m[2].split('\n')) {
      const col = line.trim().match(/^"?([a-z_][a-z0-9_]*)"?\s/);
      if (col && !/^(primary|foreign|unique|check|constraint)$/i.test(col[1])) schema.get(m[1]).add(col[1]);
    }
  }
  for (const m of sql.matchAll(/alter table (?:only )?public\.([a-z_]+)\s+add column (?:if not exists )?("?[a-z_][a-z0-9_]*"?)/gi)) {
    if (!schema.has(m[1])) schema.set(m[1], new Set());
    schema.get(m[1]).add(m[2].replace(/"/g, ''));
  }
}
for (const t of [...wantedTables].sort()) {
  check(schema.has(t), `tabla '${t}' existe en migraciones de Core`);
  if (!schema.has(t)) continue;
  // Una columna puede venir de un JOIN (p. ej. c.legal_name de clients en una
  // consulta sobre client_contacts): si existe en otra tabla del esquema, el
  // contrato no esta roto, solo es un join.
  const missing = [...(wantedCols.get(t) ?? [])].filter((c) => !schema.get(t).has(c));
  const trulyMissing = missing.filter((c) => ![...schema.values()].some((cols) => cols.has(c)));
  check(trulyMissing.length === 0, `columnas de '${t}' que usa Corp existen en Core`, trulyMissing.length ? `faltan: ${trulyMissing.join(', ')}` : '');
  if (missing.length && !trulyMissing.length) console.log(`INFO  columnas de '${t}' via JOIN: ${missing.join(', ')}`);
}

console.log(`\n${passes} pass, ${failures} fail -- ${failures ? 'CONTRATO ROTO' : 'contrato OK'}`);
process.exit(failures ? 1 : 0);
