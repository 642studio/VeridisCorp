import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createServer } from 'node:net';
const binaries = process.env.VERIDIS_POSTGRES_BIN ?? '/opt/homebrew/opt/postgresql@16/bin';
const root = mkdtempSync(join(tmpdir(), 'veridis-postgres-'));
const server = createServer();
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;
await new Promise((resolve) => server.close(resolve));
const run = (name, args) => {
 const result = spawnSync(join(binaries, name), args, { encoding: 'utf8' });
 if (result.status !== 0) throw new Error(result.stderr || result.error?.message || name + ' falló');
};
let started = false;
try {
 run('initdb', ['-D', join(root, 'data'), '-A', 'trust', '--no-locale', '-E', 'UTF8']);
 run('pg_ctl', ['-D', join(root, 'data'), '-l', join(root, 'postgres.log'), '-o', `-h 127.0.0.1 -p ${port} -k ${root}`, '-w', 'start']);
 started = true;
 const connection = `postgresql://${encodeURIComponent(process.env.USER ?? '')}@127.0.0.1:${port}/postgres`;
 const result = spawnSync(process.execPath, ['--import', 'tsx', '--test', 'test/*.test.ts'], {
  stdio: 'inherit', env: { ...process.env, VERIDIS_TEST_DATABASE_URL: connection },
 });
 process.exitCode = result.status ?? 1;
} finally {
 if (started) run('pg_ctl', ['-D', join(root, 'data'), '-m', 'immediate', '-w', 'stop']);
 rmSync(root, { recursive: true, force: true });
}
