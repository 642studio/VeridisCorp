import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadAgentCatalog, projectAgentDirectory } from '../src/office/agent-files.js';

// Catálogo de escenarios de Marketing — ver docs/agent-scenario-catalog.md para el formato y por
// qué el alcance es de cobertura de contenido, no de salida de un modelo real.
//
// Cada caso comprueba que, para un encargo realista, el puesto responsable tiene declarado y
// cargable el documento de knowledge que necesitaría, y que ese documento conserva las frases de
// guardarraíl concretas de las que depende el escenario. No ejecuta ningún modelo: una edición que
// borre esa frase o esa declaración en config.json hace fallar la prueba sin esperar a una corrida
// en vivo.

function knowledgeTextOf(agentId: string, docId: string): string {
  const agents = loadAgentCatalog(projectAgentDirectory());
  const agent = agents.find((a) => a.id === agentId);
  assert(agent, `perfil ${agentId} no encontrado en el catálogo`);
  const doc = agent!.knowledge?.find((k) => k.id === docId);
  assert(doc, `${agentId} no declara (o no puede cargar) el documento de knowledge '${docId}'`);
  return doc!.content;
}

test('escenario: campaña de anuncios pagados con presupuesto y datos incompletos (campaigns)', () => {
  const texto = knowledgeTextOf('campaigns', 'mkt-anuncios-pagados');
  assert.match(texto, /FALTANTE/, 'debe instruir marcar como FALTANTE lo que no se tenga, no estimarlo');
  assert.match(texto, /Montar, publicar y gastar lo hace un humano/, 'debe conservar que un humano aprueba antes de gastar');
});

test('escenario: promoción por WhatsApp a clientes inactivos (content)', () => {
  const texto = knowledgeTextOf('content', 'mkt-email-y-whatsapp');
  assert.match(texto, /No recibir promociones|Responde BAJA/, 'debe conservar la opción de baja obligatoria');
  assert.match(texto, /ventana de 24 h/i, 'debe conservar la regla de ventana de 24 horas de WhatsApp');
  assert.match(texto, /un humano revisa, carga y envía/, 'debe conservar que el agente propone y un humano envía');
});

test('escenario: pieza de campaña con una afirmación sin evidencia ("el mejor del mercado") (marketing-review)', () => {
  const texto = knowledgeTextOf('marketing-review', 'mkt-checklist-de-revision');
  assert.match(texto, /Rechaza si hay cifras, reseñas, testimonios o logros sin fuente/, 'debe rechazar afirmaciones sin fuente en memoria');
  assert.match(texto, /nunca "aprobado"/, 'debe distinguir "no verificado" de "aprobado"');
});
