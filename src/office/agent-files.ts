import { readFileSync, realpathSync, statSync } from 'node:fs';
import { resolve, relative, isAbsolute, sep, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { AgentDefinition, Id, unique } from './contracts.js';

export const AgentFileConfig = AgentDefinition.omit({ instructions: true, context: true, knowledge: true }).extend({
  knowledge: z.array(z.object({
    id: Id, title: z.string().trim().min(1).max(1000), path: z.string().trim().min(1).max(240),
  }).strict()).max(10).default([]),
}).strict();
const AgentIndex = z.object({ schemaVersion: z.literal(1), agentIds: z.array(Id).min(1).max(200) }).strict();
const textExtensions = new Set(['.md', '.txt', '.json']);

function inside(root: string, path: string): string {
  const actual = realpathSync(path);
  const part = relative(root, actual);
  if (!part || part === '..' || part.startsWith('..' + sep) || isAbsolute(part)) {
    throw new Error('El archivo debe permanecer dentro de su carpeta de agente');
  }
  return actual;
}

function readText(root: string, path: string, maxBytes: number): string {
  const actual = inside(root, path);
  const info = statSync(actual);
  if (!info.isFile() || info.size > maxBytes) throw new Error('Archivo no válido o demasiado grande: ' + relative(root, actual));
  const bytes = readFileSync(actual);
  if (bytes.length > maxBytes) throw new Error('Archivo demasiado grande');
  const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes).trim();
  if (!text) throw new Error('Archivo vacío: ' + relative(root, actual));
  return text;
}

export function loadAgentDirectory(directory: string): AgentDefinition {
  const root = realpathSync(directory);
  const config = AgentFileConfig.parse(JSON.parse(readText(root, resolve(root, 'config.json'), 16000)));
  unique(config.capabilities, 'Capacidades duplicadas');
  unique(config.allowedTools, 'Herramientas duplicadas');
  unique(config.knowledge.map((reference) => reference.id), 'Referencias duplicadas');
  const instructions = readText(root, resolve(root, 'instructions.md'), 16000);
  const context = readText(root, resolve(root, 'context.md'), 16000);
  const knowledgeRoot = inside(root, resolve(root, 'knowledge'));
  let knowledgeBytes = 0;
  const knowledge = config.knowledge.map(({ id, title, path }) => {
    if (isAbsolute(path) || !textExtensions.has(extname(path).toLowerCase())) throw new Error('Referencia de conocimiento no válida');
    const content = readText(knowledgeRoot, resolve(knowledgeRoot, path), 32000);
    knowledgeBytes += Buffer.byteLength(content, 'utf8');
    if (knowledgeBytes > 64000) throw new Error('El conocimiento del agente supera 64000 bytes');
    return { id, title, reference: `${config.id}/knowledge/${path}`, content,
      sha256: createHash('sha256').update(content).digest('hex') };
  });
  const { knowledge: _references, ...definition } = config;
  return AgentDefinition.parse({ ...definition, instructions, context, knowledge });
}

export function loadAgentCatalog(directory: string): AgentDefinition[] {
  const root = realpathSync(directory);
  const index = AgentIndex.parse(JSON.parse(readText(root, resolve(root, 'index.json'), 16000)));
  unique(index.agentIds, 'Agentes duplicados en el índice');
  return index.agentIds.map((id) => {
    const agentRoot = inside(root, resolve(root, id));
    const agent = loadAgentDirectory(agentRoot);
    if (agent.id !== id) throw new Error('El identificador del agente no coincide con su carpeta: ' + id);
    return agent;
  });
}

// Válido tanto desde src/office como desde dist/src/office; no depende del cwd.
export function projectAgentDirectory(): string {
  const moduleDirectory = fileURLToPath(new URL('.', import.meta.url));
  const sourceOrDistRoot = resolve(moduleDirectory, '../..');
  return resolve(sourceOrDistRoot, sourceOrDistRoot.endsWith(sep + 'dist') ? '../agents' : 'agents');
}

// El catálogo de otros puestos no necesita incluir sus instrucciones ni documentos.
export function agentSummary(agent: AgentDefinition): AgentDefinition {
  const { instructions: _instructions, context: _context, knowledge: _knowledge, ...summary } = agent;
  return structuredClone(summary);
}
