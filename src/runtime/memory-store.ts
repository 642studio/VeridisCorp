import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { toSql } from 'pgvector';
import { AccessScope, CorporateMemoryRecord } from '../governance/contracts.js';
import { scopeKey, transaction } from './database.js';
import type { Embedder } from './embeddings.js';

// Alcance fijo para toda la memoria corporativa (ver el comentario de configureMemory en
// src/office/tools.ts: ningún expediente de office/ tiene todavía su AccessScope propio cableado
// hasta la ejecución de herramientas — ni siquiera Gmail/Drive/Calendar lo tienen). No es "cualquier
// cliente": clientId/projectId quedan null a propósito, el mismo significado que ya usa el resto
// del proyecto para contexto corporativo o divisional.
export function companyMemoryScope(env: NodeJS.ProcessEnv = process.env): AccessScope {
  return AccessScope.parse({
    workspaceId: env.VERIDIS_MEMORY_WORKSPACE_ID?.trim() || 'veridiscorp',
    companyId: env.VERIDIS_MEMORY_COMPANY_ID?.trim() || '642-studio',
    divisionId: env.VERIDIS_MEMORY_DIVISION_ID?.trim() || 'general',
    clientId: null, projectId: null,
  });
}

export interface ProposeMemoryInput {
  entityType: CorporateMemoryRecord['entityType'];
  entityId: string;
  content: string;
  provenance: CorporateMemoryRecord['provenance'];
  trust: CorporateMemoryRecord['trust'];
  validUntil?: string | null;
  kind?: CorporateMemoryRecord['kind'];
  // Id de otra memoria (de este mismo ámbito) que esta refuta. Si esa memoria está sin confirmar,
  // pasa a cuarentena en el acto; si un humano ya la confirmó, solo cuando un humano confirme
  // también esta corrección (validate()) — nunca se descarta en automático algo confirmado.
  contradicts?: string | null;
}

export interface MemoryQueryResult {
  record: CorporateMemoryRecord;
  // Distancia coseno (0 = idéntico, 1 = sin relación, 2 = opuesto). No es una probabilidad.
  distance: number;
}

export interface MemoryGraphNode {
  record: CorporateMemoryRecord;
  recalls: number;
  lastRecalledAt: string | null;
}
export interface MemoryGraphLink {
  source: string;
  target: string;
  // Similitud coseno (1 - distancia) entre los embeddings, o 'contradicts' entre una corrección y
  // lo que refutó.
  similarity: number | null;
  kind: 'similar' | 'contradicts';
}

// Se enlazan dos memorias si su coseno supera el umbral, con un máximo de 4 enlaces salientes por
// memoria para que el mapa no se vuelva una maraña. 0.72, no el 0.6 del mapa de referencia del
// nicho: medido en vivo con nomic-embed-text (2026-10-31), textos en español SIN relación ya dan
// 0.62–0.70 y los relacionados 0.73–0.89. Recalibrar si cambia el modelo de embeddings.
export const LINK_THRESHOLD = 0.72;
const LINKS_PER_NODE = 4;
// Bono de orden para lo que un humano ya confirmó, frente a lo que todavía no — pequeño a propósito:
// la relevancia semántica sigue mandando.
const CONFIRMED_BONUS = 0.03;
// Similitud mínima para que una versión nueva de la misma entidad cuente como "el mismo tema,
// actualizado" y reemplace a la anterior sin confirmar. Por encima del umbral de enlace a propósito.
const SAME_TOPIC = 0.8;
// Rescate léxico de query() (calibrado en vivo con 527 memorias, 2026-11-03): una palabra es "rara" si
// aparece en a lo más el 5% de las memorias vigentes (mínimo 5); una coincidencia es "fuerte" con
// ts_rank_cd >= 0.5 (la especificación de un proceso dio 1.9; el ruido de palabras sueltas, 0.1–0.3).
const LEXICAL_RARE_FRACTION = 0.05;
const LEXICAL_MIN_DF = 5;
const LEXICAL_STRONG_RANK = 0.5;
const LEXICAL_SLOTS = 2;

// Capa de persistencia de CorporateMemoryRecord. Modelo automático (decisión 2026-10-31): lo que se
// propone queda vigente SIN CONFIRMAR y query() ya lo usa; un humano lo confirma (validate()) o lo
// descarta (quarantine()). Cada propuesta embebe su contenido al escribir (síncrono: a este volumen
// no justifica una cola/outbox).
export class MemoryStore {
  constructor(
    private readonly pool: Pool,
    private readonly embedder: Embedder,
    private readonly embeddingModel: string,
  ) {}

  async propose(scope: AccessScope, input: ProposeMemoryInput): Promise<CorporateMemoryRecord> {
    const vector = await this.embedder.embed(input.content);
    return transaction(this.pool, async (tx) => {
      const key = scopeKey(scope);
      // Postgres no permite FOR UPDATE junto con una función de agregación (MAX); se serializa la
      // asignación de versión por entidad con un lock de aviso en vez de bloquear filas.
      await tx.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [`memory:${key}:${input.entityType}:${input.entityId}`]);
      const { rows } = await tx.query<{ max: number | null }>(
        `SELECT MAX(version) AS max FROM veridis_runtime_v1.memory_records
         WHERE scope_key = $1 AND entity_type = $2 AND entity_id = $3`,
        [key, input.entityType, input.entityId],
      );
      let target: CorporateMemoryRecord | undefined;
      if (input.contradicts) {
        const found = await tx.query<{ data: CorporateMemoryRecord }>(
          'SELECT data FROM veridis_runtime_v1.memory_records WHERE id = $1 AND scope_key = $2 FOR UPDATE', [input.contradicts, key]);
        target = found.rows[0]?.data;
        if (!target) throw new Error('La memoria referenciada en contradicts no existe en este ámbito');
      }
      const now = new Date().toISOString();
      const record = CorporateMemoryRecord.parse({
        schemaVersion: 1, id: randomUUID(), scope, entityType: input.entityType, entityId: input.entityId,
        version: (rows[0]?.max ?? 0) + 1, content: input.content, status: 'proposed',
        provenance: input.provenance, updatedAt: now,
        validUntil: input.validUntil ?? null, trust: input.trust,
        ...(input.kind ? { kind: input.kind } : {}),
        contradicts: input.contradicts ?? null,
      });
      await tx.query(
        `INSERT INTO veridis_runtime_v1.memory_records(id, scope_key, data, embedding, embedding_model, embedded_at)
         VALUES ($1, $2, $3, $4, $5, clock_timestamp())`,
        [record.id, key, record, toSql(vector), this.embeddingModel],
      );
      // La versión nueva reemplaza a la anterior SIN CONFIRMAR de la misma entidad, pero solo si de
      // verdad trata del mismo tema (coseno >= SAME_TOPIC): visto en vivo, el archivista reusó
      // "642-studio" para dos conocimientos distintos y el segundo borró al primero. Si el tema es
      // otro, conviven. Una anterior confirmada por un humano sigue vigente hasta que un humano
      // confirme la nueva: lo confirmado no se reemplaza en automático.
      await tx.query(
        `UPDATE veridis_runtime_v1.memory_records
         SET data = jsonb_set(data, '{status}', '"superseded"') || jsonb_build_object('updatedAt', $1::text)
         WHERE scope_key = $2 AND entity_type = $3 AND entity_id = $4 AND id <> $5 AND status = 'proposed'
           AND embedding IS NOT NULL AND 1 - (embedding <=> $6) >= ${SAME_TOPIC}`,
        [now, key, input.entityType, input.entityId, record.id, toSql(vector)],
      );
      if (target?.status === 'proposed') {
        await this.quarantineInTx(tx, target, `Contradicha por ${record.entityType}/${record.entityId} v${record.version} (id ${record.id}).`);
      }
      return record;
    });
  }

  // Confirmación humana de una memoria sin confirmar.
  async validate(scope: AccessScope, id: string): Promise<CorporateMemoryRecord> {
    return transaction(this.pool, async (tx) => {
      const key = scopeKey(scope);
      const { rows } = await tx.query<{ data: CorporateMemoryRecord }>(
        `SELECT data FROM veridis_runtime_v1.memory_records WHERE id = $1 AND scope_key = $2 FOR UPDATE`,
        [id, key],
      );
      const existing = rows[0]?.data;
      if (!existing) throw new Error('Memoria no encontrada en este ámbito');
      if (existing.status !== 'proposed') throw new Error('Solo una memoria sin confirmar puede confirmarse');
      const validated = CorporateMemoryRecord.parse({ ...existing, status: 'validated', updatedAt: new Date().toISOString() });
      await tx.query('UPDATE veridis_runtime_v1.memory_records SET data = $1 WHERE id = $2', [validated, id]);
      await tx.query(
        `UPDATE veridis_runtime_v1.memory_records
         SET data = jsonb_set(data, '{status}', '"superseded"') || jsonb_build_object('updatedAt', $1::text)
         WHERE scope_key = $2 AND entity_type = $3 AND entity_id = $4 AND id <> $5 AND status = 'validated'`,
        [new Date().toISOString(), key, existing.entityType, existing.entityId, id],
      );
      // Lo que esta corrección refuta, si un humano lo había confirmado, solo cae ahora que un humano
      // confirma también la corrección (si estaba sin confirmar ya cayó al proponerse). Silencioso si
      // ya no aplica: confirmar ESTA memoria nunca debe fallar por el estado de otra.
      if (existing.contradicts) {
        const { rows: targetRows } = await tx.query<{ data: CorporateMemoryRecord }>(
          `SELECT data FROM veridis_runtime_v1.memory_records WHERE id = $1 AND scope_key = $2 AND status = 'validated' FOR UPDATE`,
          [existing.contradicts, key],
        );
        const target = targetRows[0]?.data;
        if (target) {
          await this.quarantineInTx(tx, target, `Contradicha por ${existing.entityType}/${existing.entityId} v${validated.version}, confirmada como corrección (id ${id}).`);
        }
      }
      return validated;
    });
  }

  // Descarte humano (pulgar abajo): de una memoria sin confirmar o de una ya confirmada que resultó
  // falsa. Se conserva, fuera de recall, para que nadie la vuelva a proponer igual.
  async quarantine(scope: AccessScope, id: string, reason: string): Promise<CorporateMemoryRecord> {
    return transaction(this.pool, async (tx) => {
      const key = scopeKey(scope);
      const { rows } = await tx.query<{ data: CorporateMemoryRecord }>(
        `SELECT data FROM veridis_runtime_v1.memory_records WHERE id = $1 AND scope_key = $2 FOR UPDATE`,
        [id, key],
      );
      const existing = rows[0]?.data;
      if (!existing) throw new Error('Memoria no encontrada en este ámbito');
      if (existing.status !== 'validated' && existing.status !== 'proposed') {
        throw new Error('Solo una memoria vigente (confirmada o sin confirmar) puede ponerse en cuarentena');
      }
      return this.quarantineInTx(tx, existing, reason);
    });
  }

  private async quarantineInTx(tx: PoolClient, record: CorporateMemoryRecord, reason: string): Promise<CorporateMemoryRecord> {
    const quarantined = CorporateMemoryRecord.parse({ ...record, status: 'quarantined', quarantineReason: reason, updatedAt: new Date().toISOString() });
    await tx.query('UPDATE veridis_runtime_v1.memory_records SET data = $1 WHERE id = $2', [quarantined, record.id]);
    return quarantined;
  }

  // Solo para memorias que escribe el propio motor a partir de lo que observó (el estado de una
  // conexión MCP): la versión nueva reemplaza a todas las anteriores de la misma entidad, aunque un
  // humano las hubiera confirmado, porque describen un estado que ya cambió — no un conocimiento que
  // alguien validó. Nunca se usa para lo que proponen agentes, el archivista o una importación.
  async supersedeOthers(scope: AccessScope, entityType: CorporateMemoryRecord['entityType'], entityId: string, keepId: string): Promise<number> {
    const result = await this.pool.query(
      `UPDATE veridis_runtime_v1.memory_records
       SET data = jsonb_set(data, '{status}', '"superseded"') || jsonb_build_object('updatedAt', $5::text)
       WHERE scope_key = $1 AND entity_type = $2 AND entity_id = $3 AND id <> $4 AND status IN ('proposed', 'validated')`,
      [scopeKey(scope), entityType, entityId, keepId, new Date().toISOString()]);
    return result.rowCount ?? 0;
  }

  async get(scope: AccessScope, id: string): Promise<CorporateMemoryRecord | null> {
    const { rows } = await this.pool.query<{ data: CorporateMemoryRecord }>(
      'SELECT data FROM veridis_runtime_v1.memory_records WHERE id = $1 AND scope_key = $2',
      [id, scopeKey(scope)],
    );
    return rows[0] ? CorporateMemoryRecord.parse(rows[0].data) : null;
  }

  async listByStatus(scope: AccessScope, status: CorporateMemoryRecord['status'], limit = 50): Promise<CorporateMemoryRecord[]> {
    const { rows } = await this.pool.query<{ data: CorporateMemoryRecord }>(
      `SELECT data FROM veridis_runtime_v1.memory_records WHERE scope_key = $1 AND status = $2 ORDER BY created_at DESC LIMIT $3`,
      [scopeKey(scope), status, limit],
    );
    return rows.map((row) => CorporateMemoryRecord.parse(row.data));
  }

  // Híbrida: cercanía semántica, menos un bono léxico (plainto_tsquery) para no perder ids/códigos
  // que el coseno puede pasar por alto (peso 0.15 sin calibrar con datos reales), menos un bono
  // pequeño a lo confirmado. Usa lo confirmado Y lo sin confirmar; cada resultado dice cuál es.
  // Registra el uso de lo que devuelve (memory_recalls) para el mapa de memoria.
  // track:false para consultas internas (el archivista buscando duplicados), que no son "uso".
  async query(scope: AccessScope, question: string, options: { limit?: number; track?: boolean } = {}): Promise<MemoryQueryResult[]> {
    const limit = options.limit ?? 8;
    const vector = await this.embedder.embed(question);
    const key = scopeKey(scope);
    const { rows: semantic } = await this.pool.query<{ id: string; data: CorporateMemoryRecord; distance: number }>(
      `SELECT id, data, embedding <=> $1 AS distance
       FROM veridis_runtime_v1.memory_records
       WHERE scope_key = $2 AND status IN ('proposed', 'validated') AND embedding IS NOT NULL
       ORDER BY (embedding <=> $1) - 0.15 * ts_rank(search, plainto_tsquery('spanish', $3))
         - CASE WHEN status = 'validated' THEN ${CONFIRMED_BONUS} ELSE 0 END ASC
       LIMIT $4`,
      [toSql(vector), key, question, limit],
    );
    // Rescate léxico: una memoria larga y específica (la especificación de un proceso) puede quedar
    // lejos por coseno de una pregunta corta, que se parece más a las decenas de memorias generales
    // de la empresa (visto en vivo: "¿cómo es el proceso de cotización?" la dejaba en el lugar 74 de
    // 527). Solo cuentan palabras de la pregunta que aparecen en pocas memorias (lo común, como "642" o
    // "studio", no distingue nada) y solo entra lo que coincide con fuerza; esas memorias van primero
    // y el resto conserva el orden semántico, así ninguna pregunta que ya funcionaba empeora.
    const { rows: lexical } = await this.pool.query<{ id: string; data: CorporateMemoryRecord; distance: number }>(
      `WITH active AS (
         SELECT id, data, embedding, search FROM veridis_runtime_v1.memory_records
         WHERE scope_key = $2 AND status IN ('proposed', 'validated') AND embedding IS NOT NULL),
       lexemes AS (SELECT DISTINCT lexeme FROM unnest(tsvector_to_array(to_tsvector('spanish', $3))) AS lexeme),
       rare AS (
         SELECT l.lexeme FROM lexemes l JOIN active a ON a.search @@ to_tsquery('simple', quote_literal(l.lexeme))
         GROUP BY l.lexeme HAVING count(*) <= GREATEST(${LEXICAL_MIN_DF}, (SELECT count(*) FROM active) * ${LEXICAL_RARE_FRACTION})),
       tq AS (SELECT to_tsquery('simple', string_agg(quote_literal(lexeme), ' | ')) AS q FROM rare HAVING count(*) > 0)
       SELECT a.id, a.data, a.embedding <=> $1 AS distance
       FROM active a, tq
       WHERE a.search @@ tq.q AND ts_rank_cd(a.search, tq.q) >= ${LEXICAL_STRONG_RANK}
       ORDER BY ts_rank_cd(a.search, tq.q) DESC
       LIMIT ${LEXICAL_SLOTS}`,
      [toSql(vector), key, question],
    );
    const seen = new Set<string>();
    const rows = [...lexical, ...semantic].filter((row) => !seen.has(row.id) && seen.add(row.id)).slice(0, limit);
    if (rows.length && options.track !== false) {
      await this.pool.query(
        'INSERT INTO veridis_runtime_v1.memory_recalls(memory_id, scope_key) SELECT unnest($1::uuid[]), $2',
        [rows.map((row) => row.id), key],
      );
    }
    return rows.map((row) => ({ record: CorporateMemoryRecord.parse(row.data), distance: row.distance }));
  }

  // Uso real decidido por quien consultó (el asistente rápido consulta con track:false y solo
  // cuenta las memorias que su respuesta de verdad usó).
  async recordRecalls(scope: AccessScope, memoryIds: string[]): Promise<void> {
    if (!memoryIds.length) return;
    await this.pool.query(
      'INSERT INTO veridis_runtime_v1.memory_recalls(memory_id, scope_key) SELECT unnest($1::uuid[]), $2',
      [memoryIds, scopeKey(scope)],
    );
  }

  // Todo lo necesario para dibujar el mapa de memoria de un ámbito: cada memoria (menos las
  // sustituidas, que ya no aportan), cuántas veces y cuándo se usó por última vez, y sus enlaces —
  // los N vecinos más parecidos por encima del umbral, más cada corrección con lo que refutó.
  async graph(scope: AccessScope, limit = 500): Promise<{ nodes: MemoryGraphNode[]; links: MemoryGraphLink[] }> {
    const key = scopeKey(scope);
    const { rows } = await this.pool.query<{ data: CorporateMemoryRecord; recalls: string; last_recalled_at: Date | null }>(
      `SELECT m.data, COUNT(r.id) AS recalls, MAX(r.recalled_at) AS last_recalled_at
       FROM veridis_runtime_v1.memory_records m
       LEFT JOIN veridis_runtime_v1.memory_recalls r ON r.memory_id = m.id AND r.scope_key = m.scope_key
       WHERE m.scope_key = $1 AND m.status <> 'superseded'
       GROUP BY m.id ORDER BY m.created_at DESC LIMIT $2`,
      [key, limit],
    );
    const nodes = rows.map((row) => ({
      record: CorporateMemoryRecord.parse(row.data),
      recalls: Number(row.recalls),
      lastRecalledAt: row.last_recalled_at ? row.last_recalled_at.toISOString() : null,
    }));
    const ids = nodes.map((n) => n.record.id);
    const { rows: pairs } = ids.length ? await this.pool.query<{ source: string; target: string; similarity: number }>(
      `SELECT a.id AS source, b.id AS target, 1 - (a.embedding <=> b.embedding) AS similarity
       FROM veridis_runtime_v1.memory_records a
       CROSS JOIN LATERAL (
         SELECT c.id, c.embedding FROM veridis_runtime_v1.memory_records c
         WHERE c.scope_key = a.scope_key AND c.id <> a.id AND c.embedding IS NOT NULL AND c.id = ANY($2::uuid[])
         ORDER BY a.embedding <=> c.embedding LIMIT ${LINKS_PER_NODE}
       ) b
       WHERE a.scope_key = $1 AND a.embedding IS NOT NULL AND a.id = ANY($2::uuid[])
         AND 1 - (a.embedding <=> b.embedding) >= ${LINK_THRESHOLD}`,
      [key, ids],
    ) : { rows: [] };
    // Un mismo par aparece desde ambos extremos: se conserva una sola vez.
    const seen = new Set<string>();
    const links: MemoryGraphLink[] = [];
    for (const pair of pairs) {
      const id = [pair.source, pair.target].sort().join('|');
      if (seen.has(id)) continue;
      seen.add(id);
      links.push({ source: pair.source, target: pair.target, similarity: Number(pair.similarity), kind: 'similar' });
    }
    const present = new Set(ids);
    for (const node of nodes) {
      const refuted = node.record.contradicts;
      if (refuted && present.has(refuted)) links.push({ source: node.record.id, target: refuted, similarity: null, kind: 'contradicts' });
    }
    return { nodes, links };
  }
}
