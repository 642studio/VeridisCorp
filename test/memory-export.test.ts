import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  renderMemoryMarkdown, exportRecordToVault, memoryFilePath, vaultPathFromEnv,
} from '../src/runtime/memory-export.js';
import type { CorporateMemoryRecord } from '../src/governance/contracts.js';

const scope = { workspaceId: 'veridiscorp', companyId: '642-studio', divisionId: 'general', clientId: null, projectId: null };
const record: CorporateMemoryRecord = {
  schemaVersion: 1, id: 'mem-1', scope, entityType: 'project', entityId: 'veridiscorp-postgres', version: 2,
  content: 'El servidor PostgreSQL central corre en el equipo Linux de oficina (192.168.1.97).',
  status: 'validated',
  provenance: [{ reference: 'sesion://2026-10-24-memoria-corporativa', observedAt: '2026-10-24T09:53:56.817Z' }],
  updatedAt: '2026-10-24T09:56:13.000Z', validUntil: null, trust: 'internal_unverified',
};

test('renderMemoryMarkdown sigue el formato de la instrucción de memorias de CODE (AGENTS.md)', () => {
  const markdown = renderMemoryMarkdown(record);
  assert.match(markdown, /^# Memoria: veridiscorp-postgres \(project\)/);
  assert.match(markdown, /## Contenido/);
  assert.match(markdown, /El servidor PostgreSQL central corre/);
  assert.match(markdown, /## Procedencia/);
  assert.match(markdown, /- sesion:\/\/2026-10-24-memoria-corporativa \(2026-10-24\)/);
  assert.match(markdown, /\[\[memoria_corporativa\]\] \[\[project\]\]/);
  assert.match(markdown, /#veridis #memoria #project/);
  assert.match(markdown, /\n2026-10-24\n?$/);
});

test('renderMemoryMarkdown incluye el motivo de cuarentena solo cuando existe', () => {
  assert.doesNotMatch(renderMemoryMarkdown(record), /Motivo de cuarentena/);
  const quarantined: CorporateMemoryRecord = { ...record, status: 'quarantined', quarantineReason: 'Contradicha por la memoria validada mem-2.' };
  assert.match(renderMemoryMarkdown(quarantined), /- Motivo de cuarentena: Contradicha por la memoria validada mem-2\./);
});

test('exportRecordToVault escribe el archivo real en <vault>/<entityType>/<entityId>.md, creando carpetas', () => {
  const vault = mkdtempSync(join(tmpdir(), 'veridis-vault-'));
  try {
    const filePath = exportRecordToVault(vault, record);
    assert.equal(filePath, memoryFilePath(vault, record));
    assert.equal(filePath, join(vault, 'project', 'veridiscorp-postgres.md'));
    assert.equal(readFileSync(filePath, 'utf8'), renderMemoryMarkdown(record));
  } finally { rmSync(vault, { recursive: true, force: true }); }
});

test('exportRecordToVault sobreescribe en vez de acumular versiones viejas', () => {
  const vault = mkdtempSync(join(tmpdir(), 'veridis-vault-'));
  try {
    exportRecordToVault(vault, record);
    const updated: CorporateMemoryRecord = { ...record, version: 3, content: 'Contenido actualizado.' };
    const filePath = exportRecordToVault(vault, updated);
    const written = readFileSync(filePath, 'utf8');
    assert.match(written, /Contenido actualizado\./);
    assert.doesNotMatch(written, /El servidor PostgreSQL central corre/);
  } finally { rmSync(vault, { recursive: true, force: true }); }
});

test('vaultPathFromEnv exige una ruta no vacía, y null si no se configuró', () => {
  assert.equal(vaultPathFromEnv({}), null);
  assert.equal(vaultPathFromEnv({ VERIDIS_MEMORY_VAULT_PATH: '   ' }), null);
  assert.equal(vaultPathFromEnv({ VERIDIS_MEMORY_VAULT_PATH: '/tmp/vault' }), '/tmp/vault');
});
