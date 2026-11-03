import { Pool } from 'pg';
import { generateSecret, generateURI, verify } from 'otplib';
import qrcodeTerminal from 'qrcode-terminal';
import { AccessScope, Operation, Principal } from '../governance/contracts.js';
import { encryptSecret, decryptSecret } from './secrets.js';
import { provisionSession, transaction } from './database.js';
import { RuntimeError } from './contracts.js';

const ISSUER = 'VeridisCorp';
const PERIOD_SECONDS = 30;
const EPOCH_TOLERANCE_SECONDS = 30; // ±1 paso de 30s de margen por desfase de reloj
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_SECONDS = 300;

export type TotpPermission = { principal: Principal; operations: Operation[]; resourceType: string; resourceIds: string[] };
export type TotpProfile = { principal: Principal; scope: AccessScope; permissions: TotpPermission[]; sessionTtlSeconds: number };

// Enrolar (o re-enrolar, rotando el secreto) a una persona: genera el secreto TOTP y guarda el
// perfil (scope+permisos) que se le otorgará en cada login exitoso, sin volver a correr
// runtime:provision a mano cada vez.
export async function enrollTotp(pool: Pool, encryptionKey: Buffer, profile: TotpProfile): Promise<{ secret: string; otpauthUrl: string }> {
 if (profile.principal.kind !== 'human') throw new Error('TOTP solo aplica a sesiones humanas');
 const secret = generateSecret();
 const otpauthUrl = generateURI({ issuer: ISSUER, label: profile.principal.id, secret, period: PERIOD_SECONDS });
 const encrypted = encryptSecret(secret, encryptionKey);
 await pool.query(
  `INSERT INTO veridis_runtime_v1.totp_credentials(principal_id, principal, secret_encrypted, scope, permissions, session_ttl_seconds)
   VALUES ($1,$2,$3,$4,$5,$6)
   ON CONFLICT (principal_id) DO UPDATE SET principal=$2, secret_encrypted=$3, scope=$4, permissions=$5, session_ttl_seconds=$6,
    last_time_step=NULL, failed_attempts=0, locked_until=NULL, updated_at=clock_timestamp()`,
  [profile.principal.id, profile.principal, encrypted, profile.scope, JSON.stringify(profile.permissions), profile.sessionTtlSeconds],
 );
 return { secret, otpauthUrl };
}

export function printEnrollmentQr(otpauthUrl: string): void {
 qrcodeTerminal.generate(otpauthUrl, { small: true });
}

// Verifica el código de 6 dígitos y, si es válido, emite una sesión real (mismo mecanismo que
// runtime:provision) con el perfil guardado al enrolar. Bloquea reintentos tras varios fallos
// seguidos: el panel ya es público, y este endpoint no exige sesión previa.
export async function loginWithTotp(pool: Pool, encryptionKey: Buffer, principalId: string, code: string): Promise<string> {
 if (!/^[A-Za-z0-9_-]{1,100}$/.test(principalId) || !/^\d{6}$/.test(code)) throw new RuntimeError(401, 'Credenciales inválidas');
 const profile = await transaction(pool, async (tx) => {
  const rows = await tx.query(
   `SELECT principal, secret_encrypted, scope, permissions, session_ttl_seconds, last_time_step, failed_attempts, locked_until
    FROM veridis_runtime_v1.totp_credentials WHERE principal_id=$1 FOR UPDATE`, [principalId]);
  const row = rows.rows[0];
  if (!row) throw new RuntimeError(401, 'Credenciales inválidas');
  if (row.locked_until && new Date(row.locked_until).getTime() > Date.now()) throw new RuntimeError(423, 'Demasiados intentos; espera unos minutos');
  const secret = decryptSecret(row.secret_encrypted, encryptionKey);
  const result = await verify({
   secret, token: code, period: PERIOD_SECONDS, epochTolerance: EPOCH_TOLERANCE_SECONDS,
   ...(row.last_time_step !== null ? { afterTimeStep: Number(row.last_time_step) } : {}),
  });
  // La firma de verify() cubre TOTP y HOTP; solo el resultado válido de TOTP trae timeStep.
  if (!result.valid || !('timeStep' in result)) {
   const failedAttempts = Number(row.failed_attempts ?? 0) + 1;
   const lockedUntil = failedAttempts >= MAX_FAILED_ATTEMPTS ? new Date(Date.now() + LOCKOUT_SECONDS * 1000).toISOString() : null;
   await tx.query('UPDATE veridis_runtime_v1.totp_credentials SET failed_attempts=$2, locked_until=$3 WHERE principal_id=$1', [principalId, failedAttempts, lockedUntil]);
   throw new RuntimeError(401, 'Credenciales inválidas');
  }
  await tx.query('UPDATE veridis_runtime_v1.totp_credentials SET last_time_step=$2, failed_attempts=0, locked_until=NULL WHERE principal_id=$1', [principalId, result.timeStep]);
  return {
   principal: Principal.parse(row.principal), scope: AccessScope.parse(row.scope),
   permissions: row.permissions as TotpPermission[], sessionTtlSeconds: Number(row.session_ttl_seconds),
  };
 });
 const expiresAt = new Date(Date.now() + profile.sessionTtlSeconds * 1000).toISOString();
 return provisionSession(pool, { principal: profile.principal, scope: profile.scope, expiresAt, permissions: profile.permissions });
}
