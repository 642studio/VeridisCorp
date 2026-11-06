import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { generate, verify } from 'otplib';
import { migrate } from '../src/runtime/database.js';
import { enrollTotp, loginWithTotp } from '../src/runtime/totp.js';

const connectionString = process.env.VERIDIS_TEST_DATABASE_URL;

test('TOTP conserva intentos fallidos, bloquea, permite recuperación y rechaza reutilización', { skip: !connectionString }, async () => {
  const pool = new Pool({ connectionString });
  const key = randomBytes(32);
  const id = randomUUID();
  const principal = { kind: 'human' as const, id };
  const scope = { workspaceId: id, companyId: '642', divisionId: 'studio', clientId: null, projectId: null };
  try {
    await migrate(pool);
    const { secret } = await enrollTotp(pool, key, {
      principal, scope, sessionTtlSeconds: 600,
      permissions: [{ principal, operations: ['data.read'], resourceType: 'workflow', resourceIds: ['office-pilot'] }],
    });
    let invalid = '000000';
    for (let n = 0; ; n++) {
      invalid = String(n).padStart(6, '0');
      if (!(await verify({ secret, token: invalid, period: 30, epochTolerance: 60 })).valid) break;
    }
    for (let n = 1; n <= 5; n++) {
      await assert.rejects(loginWithTotp(pool, key, id, invalid), /Credenciales inválidas/);
      const { rows } = await pool.query('SELECT failed_attempts, locked_until FROM veridis_runtime_v1.totp_credentials WHERE principal_id=$1', [id]);
      assert.equal(rows[0].failed_attempts, n);
      assert.equal(rows[0].locked_until !== null, n === 5);
    }
    await assert.rejects(loginWithTotp(pool, key, id, await generate({ secret })), /Demasiados intentos/);
    await pool.query("UPDATE veridis_runtime_v1.totp_credentials SET locked_until=now()-interval '1 second' WHERE principal_id=$1", [id]);
    const valid = await generate({ secret });
    const token = await loginWithTotp(pool, key, id, valid);
    assert.match(token, /^[A-Za-z0-9_-]{43}$/);
    const { rows } = await pool.query('SELECT failed_attempts, locked_until, last_time_step FROM veridis_runtime_v1.totp_credentials WHERE principal_id=$1', [id]);
    assert.equal(rows[0].failed_attempts, 0);
    assert.equal(rows[0].locked_until, null);
    assert.notEqual(rows[0].last_time_step, null);
    await assert.rejects(loginWithTotp(pool, key, id, valid), /Credenciales inválidas/);
  } finally {
    await pool.query('DELETE FROM veridis_runtime_v1.totp_credentials WHERE principal_id=$1', [id]);
    await pool.query("DELETE FROM veridis_runtime_v1.sessions WHERE principal->>'id'=$1", [id]);
    await pool.query("DELETE FROM veridis_runtime_v1.grants WHERE data->'principal'->>'id'=$1", [id]);
    await pool.end();
  }
});
