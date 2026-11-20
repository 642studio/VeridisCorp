# Plantillas para "Importar texto" a la memoria corporativa

Referencia para redactar documentos — a mano o con otro agente/asistente — que se van a pegar en
MEMORIA → Importar texto (`/office/memory/import/plan` + `/office/memory/import/section`). El
objetivo es que el partidor determinista (`src/runtime/memory-ingest.ts`) corte el documento en
secciones con sentido, y que el archivista (`intelligence.ts`, prompt de `ingestMemorySection`)
extraiga memorias completas, correctamente clasificadas y fáciles de encontrar después.

Once tipos de entidad válidos (`entityType`): `company`, `division`, `client`, `brand`, `project`,
`contract`, `person`, `product`, `decision`, `integration`, `process`.

## Reglas mecánicas (no negociables — así corta el partidor)

- **Un encabezado abre sección.** Markdown (`#`…`######`), subnumeración (`4.1. Título`) o un
  título numerado TODO EN MAYÚSCULAS (`4. ESTRUCTURA DEL ECOSISTEMA`). Una lista numerada normal
  (`1. Hacer esto.`) **no** cuenta — a propósito, para no partir una lista a la mitad.
- **Cada bloque bajo un encabezado necesita ~1800 caracteres propios para quedar solo en su
  llamada.** El partidor NO corta en cada encabezado — solo corta ANTES de uno nuevo si lo ya
  acumulado llega a 1800. Un bloque más corto se queda pegado al siguiente (y al siguiente, y al
  siguiente) hasta que la suma llegue a 1800; recién ahí el próximo encabezado sí abre llamada
  aparte. Probado en vivo: un documento con 17 encabezados de ~1300-1450 caracteres cada uno
  terminó en solo 7 llamadas reales, de dos temas cada una — nunca un tema solo.
  - Si quieres que un tema sea su propia llamada (más control, más predecible, memorias con
    `provenance` apuntando solo a ese tema): desarróllalo hasta rondar 1800 caracteres —
    contexto, ejemplos y fuentes incluidos, no relleno artificial.
  - Si no te importa que 2-3 temas relacionados se combinen en una llamada, no hace falta ajustar
    nada — probado en vivo con un documento real de 17 encabezados (7 llamadas, 2 temas cada
    una): salieron 77 memorias, cada una con el `entityType`/`kind` que le tocaba por su
    contenido real, no por el tipo "oficial" del encabezado bajo el que cayó (una frase sobre un
    proceso dentro de un encabezado "Proyecto:" salió como `process`, no `project` — correcto).
  - La etiqueta de sección que devuelve la API muestra como máximo 3 encabezados unidos con
    " · " aunque se hayan combinado más — es solo el nombre mostrado; el texto completo (con
    todos los encabezados y su contenido) sí llega íntegro al archivista.
  - Si un bloque sin encabezado nuevo pasa de 3500 caracteres seguidos, corta en el siguiente
    párrafo en blanco — deja líneas en blanco entre párrafos para que, si corta ahí, corte
    limpio. Tope duro: 6000 por llamada (más allá, se parte a lo bruto por tamaño).
- **Cada sección se manda sola al modelo**, sin el resto del documento. Nunca escribas "como se
  mencionó arriba" ni dejes un pronombre sin antecedente dentro de la misma sección.
- **No repitas la misma frase de apertura genérica basada en fecha en temas distintos.** El
  archivista nombra el `entityId` a partir de lo que lee en ESA sección nada más; si dos secciones
  no relacionadas abren igual ("La entrega del 5 de noviembre de 2026 registra...") puede ponerles
  el mismo `entityId` genérico, y el motor versiona automáticamente cualquier `entityId` repetido
  (v1, v2…) aunque el contenido no tenga relación — visto en vivo: dos hechos sin ninguna relación
  (un dashboard publicado vs. una compilación con pruebas) quedaron como v1/v2 de
  `642-core-entrega-5-noviembre-2026` solo por compartir esa apertura. No se pierde información
  (la búsqueda sigue encontrando ambas versiones por separado, nunca solo "la última"), pero quien
  revise memorias puede confundirlas creyendo que una actualiza a la otra. Nombra cada tema por
  **qué** es, no por **cuándo** pasó: `642-core-dashboard-finance-publicado` y
  `642-core-build-ddc5a10-pruebas`, no dos veces "entrega del 5 de noviembre".
- **Nombres propios, cifras, fechas, dominios y URLs exactos**, en prosa natural — el archivista
  los conserva literalmente, y la búsqueda es híbrida (semántica + léxica exacta en español):
  texto vago en viñetas sueltas da memorias vagas e imposibles de encontrar por nombre después.
- **Agrupa listas relacionadas bajo un encabezado**, no una viñeta aislada: "todos los servicios
  de la marca X" bajo un solo encabezado se vuelve una memoria coherente.
- **Marca el grado de certeza** cuando no sea un hecho firme, al inicio del párrafo:
  `HISTÓRICO:` · `PROPUESTO:` · `EN DESARROLLO:` · `VISIÓN:` · `POR CONFIRMAR:`. Sin esa marca
  puede guardarse como hecho vigente por error.

## Cómo usar estas plantillas con otro agente

Pégale la plantilla del tipo correspondiente más el material en bruto (notas, un chat, un PDF
resumido) y pídele que la llene **sin inventar** lo que falte — que deje cada hueco sin dato real
como `POR CONFIRMAR: <qué falta>` en vez de omitirlo o adivinarlo. El resultado se pega tal cual
en Importar texto.

---

## `client` — Cliente

```markdown
## Cliente: <Nombre del cliente>

Tipo: <giro/industria>. Estado: <ACTIVO/POTENCIAL/PAUSADO/TERMINADO>.
Servicios contratados: <lista agrupada en prosa, no viñetas sueltas>.
Vigencia: <fecha de inicio> a <fecha de fin, o "sin fecha de término definida">.
Inversión o tarifa: <monto y periodicidad>.
Decisores y contactos: <nombre, rol, cómo contactar>.

POR CONFIRMAR: <lo que falta — estado contractual formal, alcance exacto de cada
servicio, resultados comprometidos, lo que sea que no esté verificado>.
```
*Ejemplo real (642 Studio):* ficha de Liga Cibapac — tipo de cliente, estado, servicios
vinculados y una lista explícita de "Siguen POR CONFIRMAR" (estado contractual, fechas,
inversión, decisores, alcance, resultados).

## `project` — Proyecto

```markdown
## Proyecto: <Nombre>

Objetivo: <qué se busca lograr, para quién>.
Alcance: <qué incluye y qué NO incluye explícitamente>.
Se considera ejecutado satisfactoriamente cuando: <criterios concretos y verificables,
uno por frase — fechas, entregables, hitos técnicos aprobados>.
Responsables: <quién hace qué>.

POR CONFIRMAR / EN DESARROLLO: <lo que aún no está cerrado>.
```
*Ejemplo real:* el criterio de éxito de MOHOVERI, redactado como una lista de condiciones
verificables ("exista dirección editorial...", "se publiquen los entregables...").

*También aplica a una campaña trimestral de marketing* (ver `docs/plan-semestral-marca.md`): el
objetivo es el avance concreto que busca ese trimestre, el alcance es el tema de campaña, la
oferta, el canal y el presupuesto, y el criterio de éxito es el KPI con número y fecha.

## `person` — Persona

```markdown
## Persona: <Nombre y rol>

Rol/relación con la empresa: <qué hace, desde cuándo>.
Preferencias de trabajo: <cómo prefiere que le hablen, le entreguen o le propongan algo>.
Criterios que aplica para decidir: <reglas o estándares propios, en prosa concreta>.

HISTÓRICO/POR CONFIRMAR: <datos de formación, trayectoria u otros que no cambian seguido>.
```
*Ejemplo real:* el criterio del fundador para usar IA ("que resuelva una necesidad real...,
en diseños que no parezcan genéricos..., en código que funcione en su arquitectura real...").

## `brand` — Marca

```markdown
## Marca: <Nombre de la marca>

Catálogo de servicios: <lista agrupada en prosa de todo lo que ofrece esta marca>.
Posicionamiento/identidad: <cómo se diferencia, a quién le habla>.

PROPUESTO/EN DESARROLLO: <servicios o líneas que aún no están lanzadas>.
```
*Ejemplo real:* el catálogo completo de servicios de 642 Studio en un solo párrafo agrupado
(estrategia digital, redes, diseño, fotografía, producción audiovisual, branding, web...).

## `company` — Empresa / hallazgo reutilizable

```markdown
## <Tema del hallazgo o marco de referencia>

Contexto: para qué sirve este hallazgo, de qué investigación o fuente viene (con fecha).

### <Subtema 1>
<Explicación concreta, con la fuente entre paréntesis si aplica>.

### <Subtema 2>
<...>

Fuentes: <lista de dominios o documentos consultados>.
```
*Ejemplo real:* el marco de "qué debe incluir una auditoría de presencia digital de calidad",
con 8 subtemas numerados, cada uno con su fuente citada entre paréntesis.

## `division` — División interna (642 News, 642 Cowork, Veridis Media, etc.)

```markdown
## División: <Nombre>

Qué hace: <alcance y tipos de trabajo que cubre, en una lista agrupada>.
Relación con el resto del grupo: <de quién depende, con quién colabora>.

EN DESARROLLO: <líneas de trabajo nuevas o aún no consolidadas>.
```
*Ejemplo real:* los tipos de producción audiovisual que trabaja Veridis Media, agrupados en
un párrafo (comerciales, testimoniales, reels, dron, streaming multicámara, bodas...).

## `contract` — Contrato

```markdown
## Contrato: <Cliente o proyecto al que pertenece>

Condiciones acordadas: <lo que sí está cerrado, con cifras/plazos exactos>.

POR CONFIRMAR: <condiciones pendientes de definir en el contrato definitivo —
porcentajes, terminación, derechos de uso, titularidad, lo que aplique>.
```
*Ejemplo real:* el contrato de MOHOVERI, con la continuidad del porcentaje comercial y los
derechos de uso explícitamente marcados como pendientes del contrato definitivo.

## `product` — Producto propio (VERIDIS, 642 Cards, etc.)

```markdown
## Producto: <Nombre>

Definición oficial: <qué es, en una frase citable, con quién la confirmó y cuándo>.
Estado: VIGENTE / HISTÓRICO — sustituye a: <versión anterior, si la hay>.

Convivencia con otras definiciones: <si hay otro concepto relacionado que NO
modifica esta definición, acláralo aquí para que no se confundan>.
```
*Ejemplo real:* la definición del acrónimo VERIDIS, marcada VIGENTE, con la aclaración
explícita de que coexiste con la definición funcional del producto sin contradecirla.

## `decision` — Decisión

```markdown
## Decisión: <Qué se decidió, en una frase>

Quién la tomó y cuándo: <nombre, fecha>.
Alcance: <a qué aplica y a qué NO aplica>.
Motivo: <por qué, en una frase — opcional pero valioso>.
```
*Ejemplo real:* el modelo automático de memoria desde 2026-10-31, "decisión de Adrián, tomando
como referencia la app madre" (ver `docs/competitive-strategy.md`).

*También aplica al objetivo semestral de marketing* que fija el CMO para una marca (ver
`docs/plan-semestral-marca.md`): qué se decidió es el objetivo de negocio medible, el alcance es
el semestre y los canales, y el motivo conecta con la ficha de marca o el resultado del semestre
anterior.

## `integration` — Conexión externa (servidor MCP, API, cuenta de proveedor)

```markdown
## Integración: <Nombre de la conexión>

Para qué sirve, según quien la conectó: <descripción funcional, en sus palabras>.
Servidor: <cómo se identifica, versión si la da>.
Herramientas activas: <nombre — qué hace, lectura o escritura>.
Herramientas apagadas hasta que un humano las active: <nombre — qué haría>.

Conectada por <quién> (humano/agente) el <fecha>; <confirmada por un humano / sin confirmar>.
Se usa con mcp_call (conexión "<id>") desde los puestos con mcp.use.
```
*Ejemplo real:* la ficha de la conexión MCP «kali-audit» — para qué sirve, cómo se identifica
el servidor, qué herramientas están activas vs. apagadas, quién la conectó y si está confirmada.

## `process` — Proceso o procedimiento interno

```markdown
## Proceso: <Nombre>

Cómo funciona: <pasos concretos, responsables, bajo qué mecanismo corre>.
Cómo se verifica: <comando o método real para comprobarlo, si aplica>.

Referencia: <documento o guía donde vive el detalle completo, si existe>.
```
*Ejemplo real:* cómo corre `runtime:serve` en el servidor de oficina (systemd, no nohup suelto),
con el comando exacto usado para verificarlo y la referencia a `docs/runtime-pilot.md`.
