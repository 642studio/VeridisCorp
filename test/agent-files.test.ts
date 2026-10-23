import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Command, MemorySaver } from '@langchain/langgraph';
import { loadAgentDirectory, loadAgentCatalog, projectAgentDirectory } from '../src/office/agent-files.js';
import { AgentRegistry, officeRegistry } from '../src/office/registry.js';
import { createOfficeWorkflow } from '../src/office/workflow.js';
import { createDemoOfficeIntelligence, createDemoOrder } from '../src/office/workflow-demo.js';
import { createCompanyDemoIntelligence, createCompanyDemoOrder } from '../src/office/company-demo.js';
import type { OfficeIntelligence } from '../src/office/runtime-contracts.js';

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'veridiscorp-agent-'));
  mkdirSync(join(root, 'knowledge'));
  const config = {
    id: 'example', name: 'Ejemplo', version: '1.0.0', capabilities: ['example.work'], allowedTools: [],
    knowledge: [] as { id: string; title: string; path: string }[],
  };
  const save = () => writeFileSync(join(root, 'config.json'), JSON.stringify(config));
  save();
  writeFileSync(join(root, 'instructions.md'), 'Reglas propias del puesto.');
  writeFileSync(join(root, 'context.md'), 'Contexto confirmado de prueba.');
  writeFileSync(join(root, 'knowledge', 'README.md'), 'Este texto no debe cargarse automáticamente.');
  return { root, config, save, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

test('los 56 perfiles se cargan desde sus carpetas con instrucciones y contexto', () => {
  const agents = loadAgentCatalog(projectAgentDirectory());
  assert.equal(agents.length, 56);
  assert(agents.every((agent) => agent.instructions && agent.context && ['2.1.0', '2.2.0'].includes(agent.version)));
  assert(agents.every((agent) => agent.knowledge?.length === 0));
});

test('solo incorpora documentos declarados y registra un hash de contenido', () => {
  const f = fixture();
  try {
    writeFileSync(join(f.root, 'knowledge', 'policy.md'), 'Referencia confirmada.');
    f.config.knowledge.push({ id: 'policy', title: 'Política', path: 'policy.md' });
    f.save();
    const first = loadAgentDirectory(f.root);
    assert.equal(first.context, 'Contexto confirmado de prueba.');
    assert.equal(first.knowledge!.length, 1);
    assert.equal(first.knowledge![0]!.content, 'Referencia confirmada.');
    assert.match(first.knowledge![0]!.sha256, /^[a-f0-9]{64}$/);
    writeFileSync(join(f.root, 'knowledge', 'policy.md'), 'Referencia actualizada.');
    assert.notEqual(loadAgentDirectory(f.root).knowledge![0]!.sha256, first.knowledge![0]!.sha256);
  } finally { f.cleanup(); }
});

test('rechaza referencias que escapan de knowledge, también mediante enlaces simbólicos', () => {
  const f = fixture();
  try {
    f.config.knowledge.push({ id: 'outside', title: 'Fuera', path: '../context.md' });
    f.save();
    assert.throws(() => loadAgentDirectory(f.root), /dentro/);
    symlinkSync(join(f.root, 'context.md'), join(f.root, 'knowledge', 'link.md'));
    f.config.knowledge[0]!.path = 'link.md';
    f.save();
    assert.throws(() => loadAgentDirectory(f.root), /dentro/);
  } finally { f.cleanup(); }
});

test('rechaza contenido vacío, archivos excesivos y configuración fuera del contrato', () => {
  const f = fixture();
  try {
    writeFileSync(join(f.root, 'instructions.md'), '   ');
    assert.throws(() => loadAgentDirectory(f.root), /vacío/);
    writeFileSync(join(f.root, 'instructions.md'), 'a'.repeat(16001));
    assert.throws(() => loadAgentDirectory(f.root), /demasiado grande/);
    writeFileSync(join(f.root, 'instructions.md'), 'Reglas');
    writeFileSync(join(f.root, 'config.json'), JSON.stringify({ ...f.config, instructions: 'No se permiten instrucciones duplicadas en JSON' }));
    assert.throws(() => loadAgentDirectory(f.root));
  } finally { f.cleanup(); }
});

test('el índice explícito rechaza IDs que no coinciden y no incorpora carpetas extra', () => {
  const f = fixture();
  try {
    mkdirSync(join(f.root, 'example'));
    for (const file of ['config.json', 'instructions.md', 'context.md']) {
      // Contenido pequeño y explícito para evitar copiar referencias ajenas.
      writeFileSync(join(f.root, 'example', file), file === 'config.json' ? JSON.stringify(f.config) : 'Texto');
    }
    mkdirSync(join(f.root, 'example', 'knowledge'));
    mkdirSync(join(f.root, 'not-indexed'));
    writeFileSync(join(f.root, 'index.json'), JSON.stringify({ schemaVersion: 1, agentIds: ['example'] }));
    assert.equal(loadAgentCatalog(f.root).length, 1);
    writeFileSync(join(f.root, 'example', 'config.json'), JSON.stringify({ ...f.config, id: 'different' }));
    assert.throws(() => loadAgentCatalog(f.root), /no coincide/);
  } finally { f.cleanup(); }
});

test('cada puesto recibe sus datos mientras los catálogos de equipos muestran solo metadatos', async () => {
  const demo = createCompanyDemoIntelligence();
  let sawManager = false;
  const intelligence: OfficeIntelligence = {
    ...demo,
    async coordinate(context) {
      assert(context.coordinator!.context);
      assert(context.agents.every((agent) => !agent.context && !agent.instructions && !agent.knowledge));
      return demo.coordinate(context);
    },
    async delegate(context) {
      sawManager = true;
      assert(context.manager.context);
      assert(context.team.every((agent) => !agent.context && !agent.instructions && !agent.knowledge));
      return demo.delegate!(context);
    },
    async execute(context) {
      assert.match(context.agent.context!, /Datos confirmados/);
      return demo.execute(context);
    },
  };
  const output = await createOfficeWorkflow(intelligence, officeRegistry, new MemorySaver()).invoke(
    { order: createCompanyDemoOrder() }, { configurable: { thread_id: 'file-context' }, recursionLimit: 500 },
  );
  assert.equal(output.order.status, 'completed');
  assert(sawManager);
});

test('un cambio de contexto impide reanudar silenciosamente un expediente anterior', async () => {
  const saver = new MemorySaver();
  const demo = createDemoOfficeIntelligence({ askFirst: true });
  const config = { configurable: { thread_id: 'context-changed' }, recursionLimit: 500 };
  await createOfficeWorkflow(demo, officeRegistry, saver).invoke({ order: createDemoOrder() }, config);
  const changed = new AgentRegistry(officeRegistry.list().map((agent) => agent.id === 'cfo'
    ? { ...agent, context: agent.context + '\nNueva política.' } : agent), officeRegistry.organization!.snapshot());
  await assert.rejects(createOfficeWorkflow(demo, changed, saver).invoke(new Command({ resume: 'Continuar' }), config), /versión/);
});
