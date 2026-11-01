import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { AccessScope, CorporateMemoryRecord } from '../governance/contracts.js';
import type { MemoryStore } from './memory-store.js';

export function vaultPathFromEnv(env: NodeJS.ProcessEnv = process.env): string | null {
  const raw = env.VERIDIS_MEMORY_VAULT_PATH?.trim();
  return raw ? raw : null;
}

const TRUST_LABEL: Record<CorporateMemoryRecord['trust'], string> = {
  external_untrusted: 'externo sin verificar',
  internal_unverified: 'interno sin verificar',
  verified: 'verificado',
};

function isoDate(iso: string): string {
  return iso.slice(0, 10);
}

// Mismo formato que la "Instrucción permanente para generación de memorias Veridis .md" del
// proyecto CODE (AGENTS.md): título con #, subtítulos con ##, backlinks [[...]], tags al final,
// fecha en YYYY-MM-DD. El contenido es literal de CorporateMemoryRecord.content —ya validado por
// un humano—, nunca reescrito ni filtrado aquí.
export function renderMemoryMarkdown(record: CorporateMemoryRecord): string {
  const provenance = record.provenance.map((p) => `- ${p.reference} (${isoDate(p.observedAt)})`).join('\n');
  return `# Memoria: ${record.entityId} (${record.entityType})

## Contenido

${record.content}

## Procedencia

${provenance}

## Notas adicionales

- Confianza: ${TRUST_LABEL[record.trust]}
- Versión: ${record.version}
- Estado: ${record.status}
- Vigente hasta: ${record.validUntil ? isoDate(record.validUntil) : 'sin fecha de vencimiento'}${record.quarantineReason ? `
- Motivo de cuarentena: ${record.quarantineReason}` : ''}

[[memoria_corporativa]] [[${record.entityType}]]

#veridis #memoria #${record.entityType}
${isoDate(record.updatedAt)}
`;
}

function sanitizeSegment(value: string): string {
  return value.replace(/[/\\]/g, '-');
}

// Una carpeta por entityType, un archivo por entityId: siempre el mismo nombre para la misma
// entidad, así que validar una versión nueva sobreescribe el archivo en vez de acumular copias
// viejas — el vault siempre refleja la versión vigente, igual que memory_records en Postgres.
export function memoryFilePath(vaultPath: string, record: CorporateMemoryRecord): string {
  return join(vaultPath, sanitizeSegment(record.entityType), `${sanitizeSegment(record.entityId)}.md`);
}

// Escritura directa a disco: la única pieza de este proyecto que toca el sistema de archivos del
// operador fuera de Postgres, a propósito acotada a esta función. Postgres sigue siendo la única
// fuente de verdad — esto es un espejo de solo escritura para que Obsidian lo visualice; nada en
// VeridisCorp vuelve a leer estos archivos.
export function exportRecordToVault(vaultPath: string, record: CorporateMemoryRecord): string {
  const filePath = memoryFilePath(vaultPath, record);
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, renderMemoryMarkdown(record), 'utf8');
  return filePath;
}

export async function exportAllValidatedToVault(memory: MemoryStore, scope: AccessScope, vaultPath: string): Promise<string[]> {
  const records = await memory.listByStatus(scope, 'validated', 1000);
  return records.map((record) => exportRecordToVault(vaultPath, record));
}
