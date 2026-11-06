// Aprovisionamiento local explícito. No imprime claves ni usa la base de Core.
import { readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { parseEnv } from 'node:util';

const envPath = new URL('../.env', import.meta.url);
const previous = readFileSync(envPath, 'utf8');
const env = parseEnv(previous);
const db = new URL(env.DATABASE_URL);
if (!['localhost', '127.0.0.1'].includes(db.hostname) || db.pathname !== '/veridis_office' || db.username !== 'veridis_office') {
  throw new Error('Solo se admite la instalación local veridis_office con el rol dueño original');
}
const backup = new URL('../.env.bak.runtime-role-20261105', import.meta.url);
writeFileSync(backup, previous, { mode: 0o600, flag: 'wx' });
const password = randomBytes(32).toString('base64url');
const sql = readFileSync(new URL('../docs/sql/runtime_service_role.sql', import.meta.url), 'utf8')
  + `\nALTER ROLE veridis_runtime LOGIN PASSWORD '${password}';\n`;
// La contraseña viaja por stdin; nunca en argv ni en el journal del servicio.
execFileSync('sudo', ['-n', 'runuser', '-u', 'postgres', '--', 'psql', '-X', '-v', 'ON_ERROR_STOP=1', '-d', 'veridis_office'], {
  input: `BEGIN;\n${sql}\nCOMMIT;\n`, stdio: ['pipe', 'ignore', 'pipe'],
});
db.username = 'veridis_runtime'; db.password = password;
let next = previous.replace(/^DATABASE_URL=.*$/m, `DATABASE_URL=${db.href}`);
next += '\nVERIDIS_CHECKPOINT_SETUP_ON_START=false\n';
writeFileSync(envPath, next, { mode: 0o600 });
console.log('Rol de servicio local preparado; reiniciar solo después de verificar permisos. Respaldo privado disponible.');
