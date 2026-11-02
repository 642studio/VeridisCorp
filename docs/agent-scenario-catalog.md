# Catálogo de escenarios por agente

Fecha original: 2026-11-01. Fase: Arranque. Arnés de regresión en `test/agent-scenarios.test.ts`,
corre con `npm test` (gratis, determinista, sin llamar ningún modelo).

## Qué comprueba y qué no

Cada escenario describe un encargo realista y el puesto responsable, y la prueba confirma que ese
puesto tiene declarado y cargable (`agents/<id>/config.json` → `knowledge/`) el documento que
necesitaría, y que ese documento conserva las frases de guardarraíl concretas de las que depende el
escenario — por ejemplo, que `campaigns` siga instruyendo marcar `FALTANTE` lo que no se tenga en
vez de estimarlo, o que `content` siga exigiendo la opción de baja de WhatsApp.

Esto es una prueba de **cobertura de contenido**, no de la salida de un modelo real: no invoca
ningún proveedor. Si alguien edita `instructions.md` o un documento de `knowledge/` y borra por
accidente la frase que un escenario necesita, la prueba falla de inmediato, sin esperar una corrida
en vivo. Pero no demuestra que un modelo real, leyendo ese contenido, de hecho producirá la
decisión correcta ante el escenario — eso sigue necesitando una corrida con IA real, como las que
ya hace `scripts/live-office-smoke.ts` para otras partes de la oficina (ver
[model-routing.md](model-routing.md), "Validación real del piloto").

## Formato de un escenario

- **Encargo**: una frase con lo que pediría un cliente o el negocio, en lenguaje natural.
- **Agente responsable**: el `id` del perfil que atendería el encargo.
- **Documento(s) de knowledge esperados**: el o los `id` declarados en `config.json` que ese
  encargo debería activar.
- **Guardarraíl(es) a conservar**: la frase o regla concreta del documento que no debe desaparecer
  (regex o substring exacto en la prueba).

## Catálogo actual (Marketing)

| Encargo | Agente | Knowledge | Guardarraíl que se conserva |
| --- | --- | --- | --- |
| Campaña de anuncios pagados con presupuesto y datos incompletos | `campaigns` | `mkt-anuncios-pagados` | Marcar `FALTANTE` lo que no se tenga; "Montar, publicar y gastar lo hace un humano." |
| Promoción por WhatsApp a clientes inactivos | `content` | `mkt-email-y-whatsapp` | Opción de baja obligatoria; ventana de 24 horas; "un humano revisa, carga y envía". |
| Revisar una pieza que afirma ser "el mejor del mercado" sin evidencia | `marketing-review` | `mkt-checklist-de-revision` | Rechazar afirmaciones sin fuente en memoria; "no verificado" nunca se marca "aprobado". |

Alcance deliberadamente acotado a Marketing: es el departamento con `knowledge/` e
`instructions.md` más maduros hoy (ver [office-architecture.md](office-architecture.md)). Extender
el catálogo a otros departamentos (Finanzas, Seguridad, RH) queda para cuando sus documentos de
knowledge estén igual de poblados — añadir un escenario sin un documento real que respalde su
guardarraíl solo daría una prueba que no prueba nada.
