import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitDocument, SECTION_MAX } from '../src/runtime/memory-ingest.js';

const para = (n: number) => Array.from({ length: n }, (_, i) => `Línea de contenido número ${i} con algo de texto para dar volumen.`).join('\n');

test('splitDocument nunca pierde texto y etiqueta cada sección con sus encabezados', () => {
  const doc = `1. PERFIL DEL USUARIO\n${para(40)}\n2. FORMA DE TRABAJAR\n${para(40)}\n# 1. ¿Qué es VERIDIS?\n${para(10)}`;
  const sections = splitDocument(doc);
  const kept = sections.map((s) => s.text).join('\n');
  for (const line of doc.split('\n').filter((l) => l.trim())) assert(kept.includes(line), `se perdió: ${line}`);
  assert.equal(sections[0]!.section, '1. PERFIL DEL USUARIO');
  assert(sections.some((s) => s.section.includes('¿Qué es VERIDIS?')));
});

test('una lista numerada normal no parte el documento como si fuera un encabezado', () => {
  const doc = `2. FORMA DE TRABAJAR\nPrincipios\n1. Automatizar procesos repetitivos.\n2. Construir tecnología propia.\n3. Pensar en escalabilidad.`;
  const sections = splitDocument(doc);
  assert.equal(sections.length, 1);
  assert.equal(sections[0]!.section, '2. FORMA DE TRABAJAR');
});

test('ninguna sección supera lo que acepta una llamada, aunque el texto no tenga líneas en blanco', () => {
  const sections = splitDocument('x'.repeat(SECTION_MAX * 2 + 10));
  assert(sections.every((s) => s.text.length <= SECTION_MAX));
  assert.equal(sections.map((s) => s.text).join('').length, SECTION_MAX * 2 + 10);
});
