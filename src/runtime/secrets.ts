import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

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

// Firma para enlaces temporales de office_files (video.render/pdf.generate) hacia un proveedor
// externo que no puede mandar un Bearer de sesión (Meta hace su propio fetch del video/imagen al
// publicar un Reel o un post de Instagram). Reusa la misma VERIDIS_TOKEN_ENCRYPTION_KEY que ya
// cifra gmail_accounts/meta_accounts — no es un secreto nuevo, solo otro uso del mismo. El propio
// servidor es el único que firma (al construir la URL en social.publish_facebook/instagram) y el
// único que verifica (la ruta pública en http.ts); nadie más puede producir una firma válida sin
// la clave, así que no hace falta una tabla de enlaces ni poder revocarlos uno por uno: expiran
// solos a los pocos minutos (ver buildSignedFileUrl en office/tools.ts).
export function signFileAccess(fileId: string, expiresAtMs: number, key: Buffer): string {
 return createHmac('sha256', key).update(`${fileId}:${expiresAtMs}`).digest('hex');
}

// Comparación a tiempo constante: una firma mal formada (longitud distinta) no es una firma
// inválida silenciosa, se trata igual que un intento real de adivinarla.
export function verifyFileAccessSignature(fileId: string, expiresAtMs: number, signature: string, key: Buffer): boolean {
 const expected = Buffer.from(signFileAccess(fileId, expiresAtMs, key), 'hex');
 let provided: Buffer;
 try { provided = Buffer.from(signature, 'hex'); } catch { return false; }
 return expected.length === provided.length && timingSafeEqual(expected, provided);
}
