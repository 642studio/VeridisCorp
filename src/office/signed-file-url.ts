import { loadEncryptionKey, signFileAccess } from '../runtime/secrets.js';

// Enlace temporal (15 min) hacia GET /office/files/:id/signed (ruta pública sin Bearer, ver
// http.ts). Lo usan los servicios externos que necesitan bajar un archivo real de office_files
// (Meta, Postiz): su propio servidor hace el GET, así que la URL debe ser la pública del servidor
// (VERIDIS_PUBLIC_BASE_URL), nunca localhost. Postiz además bloquea IPs privadas al descargar.
export function buildSignedFileUrl(fileId: string, env: NodeJS.ProcessEnv = process.env): string {
  const base = env.VERIDIS_PUBLIC_BASE_URL?.trim();
  if (!base) throw new Error('Falta VERIDIS_PUBLIC_BASE_URL: hace falta la URL pública real del servidor para que el servicio externo pueda bajar el archivo');
  const key = loadEncryptionKey(env);
  const expiresAtMs = Date.now() + 15 * 60 * 1000;
  const signature = signFileAccess(fileId, expiresAtMs, key);
  return `${base.replace(/\/$/, '')}/office/files/${fileId}/signed?${new URLSearchParams({ exp: String(expiresAtMs), sig: signature }).toString()}`;
}
