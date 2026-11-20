# Plantilla: plan semestral y cascada de campañas

Esta plantilla conecta tres documentos que ya existen y no se repiten aquí: la **ficha de marca** (`docs/ficha-de-marca.md`, qué es la marca), la **investigación de competencia y tendencias** (`agents/market-research/knowledge/competidores-y-clientes.md` y `tendencias-de-mercado.md`, qué está pasando alrededor) y el **plan de marketing trimestral** (`agents/cmo/knowledge/plan-de-marketing.md`, cómo se ejecuta un trimestre). Este documento es el que falta: el único lugar por marca donde se ve de un vistazo el objetivo del semestre, sus dos trimestres y los seis meses que los componen. Sirve igual para cualquier marca o cliente — la cascada no cambia, solo lo que se escribe dentro.

## Cómo usarla

1. Llena un plan por marca por semestre. No mezcles dos marcas ni dos semestres en el mismo documento.
2. Antes de llenarlo, lee la ficha de marca vigente de esta marca y la investigación de competencia y tendencias más reciente (si tiene más de un trimestre de antigüedad, pide que se refresque antes de fijar nada).
3. Copia desde la línea `# Plan semestral — <marca> — <semestre>` hacia abajo. No pegues estas instrucciones.
4. Escribe cada respuesta de modo que se entienda sola, repitiendo el nombre de la marca: "El Mismo Sazón busca…", no "Busca…".
5. Si un dato no es seguro, escríbelo con la marca POR CONFIRMAR. Si no se sabe, "Sin dato" en vez de inventarlo.
6. Los bloques que empiezan con `## Decisión:` o `## Proyecto:` se importan a memoria en MEMORIA → **+ IMPORTAR TEXTO** (mismo mecanismo y tipos que `docs/plantillas-memoria.md`). El "Panorama del semestre" y el "Seguimiento mensual" son documentos de trabajo: se actualizan en el archivo, no se importan.
7. Para pasar al siguiente semestre, no borres este documento: crea uno nuevo con el semestre que sigue. El histórico de qué se decidió y qué resultó es parte del valor — sirve para el aprendizaje de campañas anteriores que ya pide la ficha de marca.
8. Cambió la oferta, el presupuesto o el objetivo a medio semestre: actualiza el bloque correspondiente, cambia la fecha de "Elaborado" y vuelve a importar con el mismo título.
9. **El borrador lleno de una marca real nunca se comitea a este repositorio** — trae objetivos, precios y datos de negocio sensibles. Redáctalo fuera del repositorio e impórtalo directo a la memoria corporativa; solo esta plantilla en blanco vive aquí.

---

# Plan semestral — <nombre de la marca> — <semestre, ej. H1 2027>

Elaborado: AAAA-MM-DD. Responsable: <quién lo llenó>. Insumos usados: ficha de marca del <fecha>, competencia del <fecha>, tendencias del <fecha>.

## Panorama del semestre

> De un vistazo, sin repetir el detalle de abajo.

| Nivel | Contenido |
|---|---|
| Objetivo semestral 1 | <una frase medible con fecha> |
| Objetivo semestral 2 (si aplica) | <una frase medible con fecha, o "Sin segundo objetivo este semestre"> |
| Trimestre 1 (meses 1-3) | Tema de campaña: <…> · Meta: <…> |
| Trimestre 2 (meses 4-6) | Tema de campaña: <…> · Meta: <…> |

## Decisión: Objetivo semestral — <marca> — <semestre>

Si la ficha de marca no tiene público o meta confirmados, no inventes un objetivo único: presenta 2 a 4 opciones candidatas con su motivo y su riesgo, con una recomendación, y deja la elección al responsable humano — mismo criterio que ya usa el motor para encargos ambiguos o creativos (`docs/company-organization.md`). Marca el bloque como "(pendiente)" hasta que se elija.

Qué se decidió: <el objetivo de negocio principal de <marca> para este semestre, en una frase medible y con fecha — "más reservas entre semana", no "más presencia">.

Quién la tomó y cuándo: <CMO/responsable, fecha>.

Alcance: aplica a todos los canales y campañas de <marca> durante <semestre>; no aplica a <lo que queda fuera, si algo queda fuera a propósito>.

Motivo: <por qué este objetivo y no otro — qué de la ficha de marca o del resultado del semestre anterior lo sostiene>.

Cómo se mide y número actual: <indicador y, si se conoce, el número de partida>.

POR CONFIRMAR: <lo que falta para que este objetivo quede firme>.

## Proyecto: Campaña trimestral — Trimestre 1 de <semestre> — <marca>

Objetivo: <qué avance concreto del objetivo semestral busca este trimestre>.

Alcance: tema central de la campaña, oferta promovida, canal(es) principal(es) y presupuesto aproximado; qué queda fuera de este trimestre explícitamente.

Se considera ejecutado satisfactoriamente cuando: <criterios verificables, uno por frase — KPI con número y fecha, piezas mínimas publicadas, prueba o experimento corrido con su criterio de corte>.

Responsables: <cmo decide; campaigns estructura pauta y medición; creative-strategy define ángulos; content/cm ejecutan calendario>.

Tendencias y competencia consideradas: <1-2 hallazgos de `tendencias-de-mercado.md`/`competidores-y-clientes.md` que influyeron en este trimestre, con fecha>.

POR CONFIRMAR / EN DESARROLLO: <lo que aún no está cerrado de este trimestre>.

## Proyecto: Campaña trimestral — Trimestre 2 de <semestre> — <marca>

Objetivo: <qué avance concreto del objetivo semestral busca este trimestre — puede ser continuar lo que funcionó en el Trimestre 1 o corregir lo que no>.

Alcance: tema central, oferta, canal(es) principal(es) y presupuesto aproximado; qué queda fuera.

Se considera ejecutado satisfactoriamente cuando: <criterios verificables>.

Responsables: <mismo reparto que el Trimestre 1, salvo que cambie>.

Tendencias y competencia consideradas: <hallazgos vigentes al iniciar este trimestre — revisar que no hayan vencido desde el Trimestre 1>.

POR CONFIRMAR / EN DESARROLLO: <…>.

## Seguimiento mensual (documento de trabajo, no se importa)

Se actualiza mes por mes a partir del calendario que entregan `content`/`cm` (`contenido-social.md`) y la pauta que entrega `campaigns` (`anuncios-pagados.md`). No se fija oferta ni público nuevos aquí: ejecuta lo que ya decidió el trimestre al que pertenece.

| Mes | Trimestre | Pilares de contenido del mes | Fechas clave | Estado | Resultado vs meta del mes |
|---|---|---|---|---|---|
| Mes 1 | Trimestre 1 | | | Pendiente | |
| Mes 2 | Trimestre 1 | | | Pendiente | |
| Mes 3 | Trimestre 1 | | | Pendiente | |
| Mes 4 | Trimestre 2 | | | Pendiente | |
| Mes 5 | Trimestre 2 | | | Pendiente | |
| Mes 6 | Trimestre 2 | | | Pendiente | |

## Revisión del ciclo

- **Mensual:** contenido y pauta del mes contra su meta — `content`/`cm`/`campaigns`, con `marketing-review` antes de cualquier publicación.
- **Trimestral:** la campaña central contra su meta — `campaigns` reporta, `cmo` decide si se continúa, se ajusta o se cierra. Dispara refrescar competencia y tendencias antes de armar el siguiente trimestre.
- **Semestral:** el objetivo de negocio contra su resultado — `cmo` con `ceo`. Decide si el siguiente semestre continúa el mismo objetivo, lo ajusta o fija uno nuevo.

## Decisiones abiertas y riesgos del semestre

<lo que no se confirmó durante la planeación va aquí, nunca como supuesto sin marcar — mismo criterio que la ficha de marca y el plan de marketing trimestral>.

## Aprendizajes para el siguiente semestre

<se llena al cierre, no al inicio: qué funcionó y qué no de este semestre, para alimentar la ficha de marca (sección "Aprendizajes de campañas anteriores") y el plan del semestre que sigue>.
