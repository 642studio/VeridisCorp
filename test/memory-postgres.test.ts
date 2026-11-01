import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Pool } from 'pg';
import { migrate } from '../src/runtime/database.js';
import { MemoryStore } from '../src/runtime/memory-store.js';
import { MEMORY_EMBEDDING_DIMENSIONS, type Embedder } from '../src/runtime/embeddings.js';
import type { AccessScope } from '../src/governance/contracts.js';

const connectionString = process.env.VERIDIS_TEST_DATABASE_URL;

// Embebedor determinista para no depender de Ollama en las pruebas: cada texto conocido se mapea
// a un vector unitario fijo; dos textos con el mismo vector son "idénticos" para el coseno, dos
// con vectores unitarios distintos son ortogonales (distancia 1).
function unitVector(index: number): number[] {
  const vector = new Array(MEMORY_EMBEDDING_DIMENSIONS).fill(0);
  vector[index] = 1;
  return vector;
}
function fakeEmbedder(byKeyword: [string, number[]][]): Embedder {
  return {
    dimensions: MEMORY_EMBEDDING_DIMENSIONS,
    async embed(text) {
      for (const [keyword, vector] of byKeyword) if (text.includes(keyword)) return vector;
      return new Array(MEMORY_EMBEDDING_DIMENSIONS).fill(0);
    },
  };
}

const scope: AccessScope = { workspaceId: 'ws-1', companyId: 'co-1', divisionId: 'div-1', clientId: null, projectId: null };
const provenance = [{ reference: 'test://memoria', observedAt: new Date().toISOString() }] as const;

test('memoria corporativa sobre PostgreSQL real: versiona por entidad y recupera por similitud', { skip: !connectionString, timeout: 30000 }, async (t) => {
  const pool = new Pool({ connectionString, max: 4 });
  await migrate(pool);
  const postgresVector = unitVector(0);
  const facturacionVector = unitVector(1);
  const embedder = fakeEmbedder([
    ['postgres', postgresVector],
    ['Facturación', facturacionVector],
  ]);
  const store = new MemoryStore(pool, embedder, 'fake-test-embedder');

  let postgresV1Id = '';
  await t.test('propone la primera versión de una entidad como versión 1, en estado proposed', async () => {
    const record = await store.propose(scope, {
      entityType: 'project', entityId: 'postgres-howto', content: 'Configuración de acceso remoto a postgres.',
      provenance: [...provenance], trust: 'internal_unverified',
    });
    assert.equal(record.version, 1);
    assert.equal(record.status, 'proposed');
    postgresV1Id = record.id;
  });

  await t.test('validar la deja vigente', async () => {
    const validated = await store.validate(scope, postgresV1Id);
    assert.equal(validated.status, 'validated');
  });

  await t.test('una entidad distinta también queda vigente, sin afectar a la primera', async () => {
    const record = await store.propose(scope, {
      entityType: 'project', entityId: 'facturacion-mensual', content: 'Facturación mensual revisada con el contador.',
      provenance: [...provenance], trust: 'verified',
    });
    await store.validate(scope, record.id);
  });

  await t.test('una nueva versión de la misma entidad sustituye a la vigente al validarse, no antes', async () => {
    const proposed = await store.propose(scope, {
      entityType: 'project', entityId: 'postgres-howto', content: 'Nota revisada sobre postgres, versión 2.',
      provenance: [...provenance], trust: 'internal_unverified',
    });
    assert.equal(proposed.version, 2);
    const beforeValidate = await pool.query(
      'SELECT status FROM veridis_runtime_v1.memory_records WHERE id = $1', [postgresV1Id]);
    assert.equal(beforeValidate.rows[0].status, 'validated');

    await store.validate(scope, proposed.id);

    const afterValidate = await pool.query(
      'SELECT status FROM veridis_runtime_v1.memory_records WHERE id = $1', [postgresV1Id]);
    assert.equal(afterValidate.rows[0].status, 'superseded');
  });

  await t.test('no deja validar dos veces la misma propuesta', async () => {
    await assert.rejects(() => store.validate(scope, postgresV1Id));
  });

  await t.test('la consulta trae primero la memoria vigente semánticamente más cercana', async () => {
    const results = await store.query(scope, 'postgres remoto, ¿cómo se configura?');
    assert.ok(results.length >= 2);
    assert.match(results[0]!.record.content, /postgres/);
    assert.equal(results[0]!.record.status, 'validated');
    assert.ok(results[0]!.distance < results[1]!.distance);
  });

  await pool.end();
});

test('cuarentena de memoria corporativa sobre PostgreSQL real', { skip: !connectionString, timeout: 30000 }, async (t) => {
  const pool = new Pool({ connectionString, max: 4 });
  await migrate(pool);
  const embedder = fakeEmbedder([]);
  const store = new MemoryStore(pool, embedder, 'fake-test-embedder');

  await t.test('propose() rechaza un contradicts que no existe en este ámbito', async () => {
    await assert.rejects(() => store.propose(scope, {
      entityType: 'decision', entityId: 'decision-inexistente-contradicts', content: 'x',
      provenance: [...provenance], trust: 'internal_unverified', contradicts: 'id-que-no-existe',
    }));
  });

  let oldId = '';
  await t.test('validar una memoria con contradicts pone en cuarentena la memoria vigente referenciada', async () => {
    const old = await store.propose(scope, {
      entityType: 'decision', entityId: 'precio-plan-pro', content: 'El plan Pro cuesta $10/mes.',
      provenance: [...provenance], trust: 'internal_unverified',
    });
    oldId = old.id;
    await store.validate(scope, oldId);

    const correction = await store.propose(scope, {
      entityType: 'decision', entityId: 'precio-plan-pro-correccion', content: 'El plan Pro en realidad cuesta $12/mes desde el ajuste de octubre.',
      provenance: [...provenance], trust: 'verified', contradicts: oldId,
    });
    assert.equal(correction.contradicts, oldId);

    const beforeValidate = await pool.query('SELECT status FROM veridis_runtime_v1.memory_records WHERE id = $1', [oldId]);
    assert.equal(beforeValidate.rows[0].status, 'validated');

    const validatedCorrection = await store.validate(scope, correction.id);
    assert.equal(validatedCorrection.status, 'validated');

    const afterValidate = await pool.query<{ data: { status: string; quarantineReason: string | null } }>(
      'SELECT data FROM veridis_runtime_v1.memory_records WHERE id = $1', [oldId]);
    assert.equal(afterValidate.rows[0]!.data.status, 'quarantined');
    assert.match(afterValidate.rows[0]!.data.quarantineReason ?? '', new RegExp(correction.id));
  });

  await t.test('query() nunca devuelve una memoria en cuarentena', async () => {
    const results = await store.query(scope, 'plan Pro precio mensual');
    assert.ok(!results.some((r) => r.record.id === oldId));
  });

  await t.test('validar otra memoria con contradicts hacia algo que ya no está vigente no falla y no hace nada', async () => {
    const another = await store.propose(scope, {
      entityType: 'decision', entityId: 'otra-decision-contradicts-ya-en-cuarentena', content: 'y',
      provenance: [...provenance], trust: 'internal_unverified', contradicts: oldId,
    });
    const validated = await store.validate(scope, another.id);
    assert.equal(validated.status, 'validated');
    const stillQuarantined = await pool.query<{ data: { status: string } }>(
      'SELECT data FROM veridis_runtime_v1.memory_records WHERE id = $1', [oldId]);
    assert.equal(stillQuarantined.rows[0]!.data.status, 'quarantined');
  });

  let manualId = '';
  await t.test('quarantine() manual descarta tanto lo sin confirmar como lo ya confirmado', async () => {
    const unconfirmed = await store.propose(scope, {
      entityType: 'decision', entityId: 'cuarentena-sin-confirmar', content: 'z',
      provenance: [...provenance], trust: 'internal_unverified',
    });
    assert.equal((await store.quarantine(scope, unconfirmed.id, 'Pulgar abajo.')).status, 'quarantined');
    const proposed = await store.propose(scope, {
      entityType: 'decision', entityId: 'cuarentena-manual', content: 'z',
      provenance: [...provenance], trust: 'internal_unverified',
    });
    manualId = proposed.id;
    await store.validate(scope, manualId);
    const quarantined = await store.quarantine(scope, manualId, 'Dato obsoleto, confirmado por el cliente.');
    assert.equal(quarantined.status, 'quarantined');
    assert.equal(quarantined.quarantineReason, 'Dato obsoleto, confirmado por el cliente.');
  });

  await t.test('quarantine() no se puede aplicar dos veces', async () => {
    await assert.rejects(() => store.quarantine(scope, manualId, 'otra vez'));
  });

  await pool.end();
});

test('memoria automática sobre PostgreSQL real: se usa sin confirmar y lo confirmado nunca cae solo', { skip: !connectionString, timeout: 30000 }, async (t) => {
  const pool = new Pool({ connectionString, max: 4 });
  await migrate(pool);
  const autoScope: AccessScope = { ...scope, divisionId: 'div-auto' };
  const store = new MemoryStore(pool, fakeEmbedder([['tarifa', unitVector(5)], ['horario', unitVector(6)]]), 'fake-test-embedder');
  const statusOf = async (id: string) => (await pool.query('SELECT status FROM veridis_runtime_v1.memory_records WHERE id = $1', [id])).rows[0].status as string;

  await t.test('lo propuesto ya lo encuentra query(), marcado sin confirmar, y su uso queda registrado', async () => {
    const record = await store.propose(autoScope, { entityType: 'company', entityId: 'tarifa', content: 'La tarifa base es 100.', kind: 'fact', provenance: [...provenance], trust: 'internal_unverified' });
    const found = await store.query(autoScope, 'tarifa');
    assert.equal(found[0]?.record.id, record.id);
    assert.equal(found[0]?.record.status, 'proposed');
    assert.equal(found[0]?.record.kind, 'fact');
    await store.query(autoScope, 'tarifa', { track: false });
    const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM veridis_runtime_v1.memory_recalls WHERE memory_id = $1', [record.id]);
    assert.equal(rows[0].n, 1);
  });

  await t.test('una versión nueva reemplaza a la anterior sin confirmar, pero no a una confirmada', async () => {
    const v1 = await store.propose(autoScope, { entityType: 'company', entityId: 'horario', content: 'El horario es de 9 a 6.', provenance: [...provenance], trust: 'internal_unverified' });
    const v2 = await store.propose(autoScope, { entityType: 'company', entityId: 'horario', content: 'El horario es de 9 a 7.', provenance: [...provenance], trust: 'internal_unverified' });
    assert.equal(await statusOf(v1.id), 'superseded');
    await store.validate(autoScope, v2.id);
    const v3 = await store.propose(autoScope, { entityType: 'company', entityId: 'horario', content: 'El horario es de 10 a 7.', provenance: [...provenance], trust: 'internal_unverified' });
    assert.equal(await statusOf(v2.id), 'validated');
    assert.equal(await statusOf(v3.id), 'proposed');
  });

  await t.test('contradicts tumba al instante lo sin confirmar, y lo confirmado solo al confirmar la corrección', async () => {
    const unconfirmed = await store.propose(autoScope, { entityType: 'project', entityId: 'a', content: 'tarifa A', provenance: [...provenance], trust: 'internal_unverified' });
    await store.propose(autoScope, { entityType: 'project', entityId: 'a-correccion', content: 'tarifa A corregida', provenance: [...provenance], trust: 'internal_unverified', contradicts: unconfirmed.id });
    assert.equal(await statusOf(unconfirmed.id), 'quarantined');

    const confirmed = await store.propose(autoScope, { entityType: 'project', entityId: 'b', content: 'tarifa B', provenance: [...provenance], trust: 'internal_unverified' });
    await store.validate(autoScope, confirmed.id);
    const correction = await store.propose(autoScope, { entityType: 'project', entityId: 'b-correccion', content: 'tarifa B corregida', provenance: [...provenance], trust: 'internal_unverified', contradicts: confirmed.id });
    assert.equal(await statusOf(confirmed.id), 'validated');
    await store.validate(autoScope, correction.id);
    assert.equal(await statusOf(confirmed.id), 'quarantined');
  });

  await t.test('graph() trae uso, enlaces por similitud sobre el umbral y la arista de cada contradicción', async () => {
    const { nodes, links } = await store.graph(autoScope);
    assert(nodes.every((n) => n.record.status !== 'superseded'));
    assert(nodes.some((n) => n.recalls >= 1 && n.lastRecalledAt));
    // Mismo vector unitario = similitud 1: las memorias de "tarifa" quedan enlazadas entre sí.
    assert(links.some((l) => l.kind === 'similar' && l.similarity! > 0.99));
    assert(links.some((l) => l.kind === 'contradicts'));
    // Nunca el mismo par dos veces.
    const pairs = links.filter((l) => l.kind === 'similar').map((l) => [l.source, l.target].sort().join('|'));
    assert.equal(new Set(pairs).size, pairs.length);
  });

  await pool.end();
});

test('una versión nueva con el mismo entityId pero de otro tema no borra a la anterior', { skip: !connectionString, timeout: 30000 }, async () => {
  const pool = new Pool({ connectionString, max: 4 });
  await migrate(pool);
  const topicScope: AccessScope = { ...scope, divisionId: 'div-topic' };
  const store = new MemoryStore(pool, fakeEmbedder([['servicios', unitVector(7)], ['WhatsApp', unitVector(8)]]), 'fake-test-embedder');
  const services = await store.propose(topicScope, { entityType: 'company', entityId: '642-studio', content: 'Ofrece servicios de software, n8n y video.', provenance: [...provenance], trust: 'internal_unverified' });
  const channel = await store.propose(topicScope, { entityType: 'company', entityId: '642-studio', content: 'Prefiere WhatsApp para urgencias.', provenance: [...provenance], trust: 'internal_unverified' });
  const { rows } = await pool.query('SELECT id, status FROM veridis_runtime_v1.memory_records WHERE id = ANY($1::uuid[])', [[services.id, channel.id]]);
  assert.deepEqual(rows.map((r) => r.status).sort(), ['proposed', 'proposed']);
  await pool.end();
});
