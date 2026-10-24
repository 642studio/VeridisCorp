import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

// Primer secreto del proyecto que hay que poder leer de vuelta, no solo comparar por hash
// (a diferencia de sessions.token_hash). Hoy solo lo usa gmail_accounts.refresh_token_encrypted.
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;

export function loadEncryptionKey(env: NodeJS.ProcessEnv): Buffer {
 const raw = env.VERIDIS_TOKEN_ENCRYPTION_KEY?.trim();
 if (!raw) throw new Error('Falta VERIDIS_TOKEN_ENCRYPTION_KEY');
 const key = Buffer.from(raw, 'base64');
 if (key.length !== KEY_LENGTH) throw new Error(`VERIDIS_TOKEN_ENCRYPTION_KEY debe decodificar a ${KEY_LENGTH} bytes en base64 (generar con: openssl rand -base64 32)`);
 return key;
}

// iv + authTag + texto cifrado, concatenados en un solo blob: una sola columna bytea alcanza,
// sin tener que guardar tres campos aparte para reconstruirlo.
export function encryptSecret(plaintext: string, key: Buffer): Buffer {
 const iv = randomBytes(IV_LENGTH);
 const cipher = createCipheriv(ALGORITHM, key, iv);
 const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
 return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]);
}

// GCM detecta por diseño una clave equivocada o un blob alterado: decipher.final() lanza en
// vez de devolver texto corrupto en silencio.
export function decryptSecret(blob: Buffer, key: Buffer): string {
 const iv = blob.subarray(0, IV_LENGTH);
 const authTag = blob.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
 const ciphertext = blob.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
 const decipher = createDecipheriv(ALGORITHM, key, iv);
 decipher.setAuthTag(authTag);
 return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}
