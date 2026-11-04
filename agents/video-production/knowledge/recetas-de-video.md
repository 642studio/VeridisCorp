> Investigación propia (búsqueda web, 2026-11-03), no una adaptación de ningún texto con licencia.
> La mayoría de las fuentes encontradas son blogs de herramientas de marketing/IA, no estudios
> controlados — las cifras exactas (retención, "x% más conversión") se marcan como **sin verificar**
> cada vez que aparecen; lo que se repite igual entre fuentes independientes se trata como patrón de
> oficio razonable, no como ciencia. Fuentes al final de cada bloque.

# Recetas de video: estructuras por tipo

Catálogo de estructuras narrativas/de edición por tipo de video, para elegir receta antes de
escribir `SPEC.md` (`/hyperframes`, `references/story.md`). Complementa, no sustituye, el trabajo
ya hecho en el skill `hyperframes` — `references/story.md` y `references/types/*.md` siguen siendo
la fuente principal para launch, explainer, música, datos, vertical, 3D y personaje; este documento
cubre lo que esas referencias no cubren (formatos virales de "receta rápida", frameworks publicitarios
genéricos) y los conecta.

## 0. El esqueleto común a casi todo

Casi cada fuente independiente converge en una variación de tres partes: **gancho → cuerpo → pago**.
Es literalmente la misma forma que ya usa `story.md` (`hook → tensión → reveal → prueba → pago →
claim → end card`), solo que las recetas de abajo son especializaciones de esa forma para un
objetivo de distribución distinto (scroll, buscador, venta, enseñanza) en vez de para una marca.

## 1. Corto "para el scroll" (TikTok/Reels/Shorts) — viral genérico

- **Gancho de 1-3s, no negociable.** La decisión de quedarse se toma casi de inmediato; el cuadro 0
  es la miniatura (nunca negro, nunca solo un logo) — coincide exactamente con la regla ya
  implementada en `references/types/vertical.md` de este proyecto. Muchos ven sin sonido: el gancho
  tiene que leerse sin audio (subtítulos quemados, imagen que ya dice algo).
- **Fórmulas de gancho repetidas entre fuentes**: pregunta directa: arranca a medio hacer algo (no
  desde cero); promesa con hueco a rellenar ("en los próximos [tiempo] vas a [resultado]"); bucle
  abierto (una pregunta sin responder que solo se cierra cerca del final).
- **Cierre en bucle**: terminar en un cuadro que conecta visualmente con el cuadro 0 es una elección
  de forma (re-ver), no un default — igual que ya advierte `story.md` §8 contra "todo lo que se
  repite por default sin decidirlo".
- **Ritmo**: planos de 1-2s, un beat nuevo cada 2-4s, el pago antes del swipe — igual que
  `references/types/vertical.md` §Pacing de este proyecto.
- Duración sugerida por las fuentes: 15-45s para feed estándar.

Fuentes: [Stop the Scroll: 12 Hook Formulas](https://faceless.so/blog/12-hook-formulas-to-stop-the-scroll), [Hook, Story, Offer framework](https://faceless.so/blog/hook-story-offer-framework-for-short-videos-1), [TikTok Hook Formulas](https://www.opus.pro/blog/tiktok-hook-formulas), [How to Write TikTok Hooks](https://dev.to/wedgemethoddev/how-to-write-tiktok-hooks-that-get-1m-views-10-formulas-5710).

## 2. "Sabías que" / dato curioso

- **Patrón central**: tema conocido → dato inesperado sobre ese tema (la brecha de curiosidad) →
  revelación cronometrada → cierre con gancho a la siguiente (serie numerada, "parte 2").
  La brecha de curiosidad se define como el espacio entre hacer la pregunta y dar la respuesta;
  mantener varias brechas abiertas a la vez da "recompensas" pequeñas que sostienen la atención.
- **Orden de escritura real**: el guion completo primero, el gancho al final — teaser del punto
  más fuerte del propio guion, no una frase genérica inventada antes de saber qué se va a decir.
- Formato típico de las fuentes: 15-30s, gancho + revelación + cierre en bucle.
- Énfasis narrado: mayúsculas o puntuación marcando el dato sorpresa para que "aterrice" al narrarlo.

Fuentes: [How to Write a Killer Script](https://videotoblog.ai/blog/master-scriptwriting-5-steps-to-captivate-your-video-audience), [How to Write Addictive Video Scripts (AWAI)](https://awai.com/2021/11/how-to-write-addictive-video-scripts), [Did You Know format](https://eliro.pro/make/did-you-know).

## 3. Edición "dopamínica" / pattern interrupt

Nota: "dopamínico" es lenguaje de marketing de creadores, no un mecanismo neurológico verificado en
ninguna de las fuentes encontradas — se documenta aquí como técnica de edición, sin la cobertura
pseudocientífica.

- **Qué es un pattern interrupt**: cualquier cambio que rompe lo que el cerebro ya predice que va a
  pasar — cuando el siguiente segundo es predecible, el espectador se desconecta.
  Corte rápido = energía; primer plano = cercanía; el interrupt resetea la atención cuando ambos ya
  se gastaron.
- **Frecuencia**: las fuentes no coinciden (cada 15-30s, en cada cambio de tema, o reactivo — meter
  un interrupt puntual donde las métricas reales muestran una caída). Ninguna cifra está respaldada
  por un estudio controlado en lo que se encontró.
- **Advertencia real, no solo de marketing**: una fuente de teoría de montaje cinematográfico
  (`Cutting Rhythms`, no un blog de ventas) sí advierte que el corte rápido constante puede producir
  sobrecarga sensorial, y recomienda alternar con planos más lentos — útil como contrapeso a las
  fuentes puramente virales de esta lista.
- Técnica concreta citada: jump cuts deliberados como mini pattern-interrupts; cambio de plano/lugar
  en cada transición de tema.

Fuentes: [Pattern Interrupts (2026 Guide)](https://joyspace.ai/pattern-interrupt-reset-attention-span), [9 Video Editing Techniques](https://faceless.so/blog/video-retention-editing-9-techniques-that-work), [Cutting Rhythms: Intuitive Film Editing (PDF)](https://cms.theglasshouse.org/Download_PDFS/mL3C13/601897/Cutting%20Rhythms%20Intuitive%20Film%20Editing.pdf).

## 4. Informativo / explicativo

Ya cubierto con más profundidad y ya en uso en este proyecto: `/hyperframes`,
`references/types/explainer.md` (una idea, un ejemplo real trabajado de principio a fin, formas de
información con su propia imagen, ~30-90s). No se repite aquí para no duplicar — ver ese archivo
antes de construir un explainer.

## 5. Listicle / Top N / cuenta regresiva

- **Patrón**: "Top [N] [categoría]" → revelar del número más bajo al más alto (o al revés para
  máxima tensión), guardando el #1 (el más sorprendente o valioso) para el final.
- **Ritmo citado**: 60-90s por entrada en formatos largos; Top 5 para shorts, Top 10 para video
  estándar, Top 25 para deep-dives largos.
- El propio número funciona como reinicio de atención: cada entrada es un "beat" nuevo con punto
  final claro, lo que evita la fatiga de un solo tema largo sin cortes.
- Gancho recomendado: adelantar el #1 en la intro como brecha de curiosidad, no revelarlo.

Fuentes: [How to turn a top 10 list into a video](https://faceless.so/convert/top-10-list-to-video), [Structuring Video Formats](https://app.studyraid.com/en/read/54763/2628463/structuring-video-formats-eg-listicles-how-tos).

## 6. Tutorial / cómo-se-hace

- **Estructura típica (5 partes)**: gancho → contexto/setup → pasos (desarrollados en detalle, cada
  uno explicado y mostrado) → pago (el resultado final) → llamado a la acción. Algunas fuentes la
  simplifican a introducción/cuerpo/cierre, pero el cuerpo siempre es "cada paso por completo", no
  un resumen.
- **Formato de guion profesional citado**: dos columnas, audio a la izquierda (todo lo hablado,
  efectos, música) y visual a la derecha, línea por línea — útil para cuando este proyecto
  escriba guiones narrados para HyperFrames (`references/sound.md` §2: la voz es el reloj).
  reloj de la escena).
- Consejo práctico repetido: probar el guion con alguien que nunca hizo la tarea antes de grabar.

Fuentes: [How to Write a Script For a YouTube Video](https://primalvideo.com/youtube-growth/optimization/how-to-make-a-good-youtube-video-simple-video-script-structure), [How to write a tutorial YouTube script](https://medium.com/@scriptwiz/how-to-write-a-tutorial-youtube-script-that-captivates-and-educates-732a2407ebe6).

## 7. Testimonial / UGC (contenido tipo usuario real)

- **Estructura de 5 partes**: gancho → problema personal → prueba rápida → resultado → CTA de baja
  presión. Variante narrativa: historia personal + resultado específico + recomendación.
- **El gancho no es la primera frase, es el primer 1-2s** — el momento exacto donde decide si le
  importa o no.
- **Tipos de gancho nombrados**: curiosidad, beneficio, problema, contrario (dice lo opuesto a lo
  esperado), testimonial directo. Una fuente recomienda probar 3-5 ganchos distintos para el mismo
  producto/pieza.
- **Beat de credibilidad**: un momento de "intentos fallidos" antes de la solución (ya probé X, Y,
  no funcionó) agrega realismo — equivalente directo al beat de "Tensión" de `story.md` (la forma
  vieja fallando en pantalla) pero contado en primera persona.

Fuentes: [UGC Video Ads: Script Template](https://www.admapix.com/blog/best-practices/ugc-video-ad-script-template), [Scripting UGC-Style TikTok Ads](https://cursa.app/en/page/scripting-ugc-style-tiktok-ads-hooks-structure-and-on-screen-communication).

## 8. Frameworks publicitarios clásicos (para el guion, no para la imagen)

Estos son estructuras de **copy**, no de forma visual — se eligen según qué tan "obvia" es la
necesidad del producto, y luego se les aplica un beat sheet de `story.md`/tipo de video:

| Framework | Orden | Cuándo según las fuentes |
| --- | --- | --- |
| **PAS** (Problem–Agitate–Solution) | dolor (0-5s) → se agrava → solución | producto de necesidad obvia ("must have") |
| **AIDA** (Attention–Interest–Desire–Action) | pregunta/estadística fuerte (0-3s) → interés → deseo → acción | producto "nice to have" |
| **BAB** (Before–After–Bridge) | antes → después → cómo se llega | la opción más visual, buena para video |
| **StoryBrand** | el espectador es el héroe, la marca es el guía | páginas de inicio, pitch decks; encaja con "marca-guía" más que con ads cortos |

Longitud citada: ~40-50 palabras para 15s, ~80-100 palabras para 30s (ritmo de habla estándar en
inglés; en español correr una prueba propia, el español suele necesitar ~15-20% más tiempo para el
mismo conteo de palabras).

Fuentes: [Script Video Ads That Convert](https://fluxnote.io/guides/how-to-script-video-ads-that-convert), [AIDA Video Marketing Guide](https://www.nemovideo.com/es-ES/templates/ranking-reveal-capcut-template), [Narrative Frameworks for Ads](https://benly.ai/learn/ad-creative/narrative-frameworks-for-ads).

## 9. Retención en formato largo (YouTube, no viral corto)

Todo lo citado sobre MrBeast en particular es análisis de terceros (no una fuente primaria del
propio equipo), así que se trata como patrón de oficio observado, no framework confirmado:

- Esqueleto repetido: idea simple → gancho inmediato → apuestas altas → progresión constante →
  escalada → pago satisfactorio.
- Los primeros 5s reflejan el título y la miniatura — la frase de apertura repite lo prometido en el
  título, el primer plano coincide con la miniatura.
- Variedad de ritmo citada: cambiar la estructura del video aprox. cada 30s, alternando cortes
  rápidos con momentos de plano único más lento — mismo principio que la advertencia de "Cutting
  Rhythms" en la sección 3, aplicado a formato largo.
- Revisión con espectadores reales después de editar para detectar tramos aburridos, en vez de
  confiar solo en el criterio del editor.

Fuentes: [Content Lessons from the #1 YouTuber's Leaked Memo](https://zackchewning.substack.com/p/content-lessons-from-the-1-youtubers), [MrBeast Video Analysis: Storytelling Strategies](https://recapio.com/digest/mrbeast-video-analysis-storytelling-strategies-by-dabi).

## Cómo se usa esto en VeridisCorp

1. Elegir la receta de esta tabla por **objetivo de distribución** (scroll vs. buscador vs. venta vs.
   enseñanza), no por tema.
2. Pasar a `/hyperframes` → `references/story.md` para las tres storylines y a `references/types/`
   si el tipo ya tiene archivo propio (launch, explainer, música, datos, vertical, 3D, personaje).
   Las recetas de este documento rellenan el hueco que esas referencias no cubren todavía
   (viral genérico, "sabías que", listicle, tutorial, testimonial, frameworks de ads clásicos).
3. Este archivo **no está enlazado todavía en `config.json`** de `video-production` (no llega al
   prompt de cada llamada real del agente) — es referencia de trabajo para quien construye el video
   en esta sesión. Enlazarlo es una decisión aparte (consume parte del presupuesto de conocimiento
   por puesto, máx. 10 documentos / 64 KB — ver `docs/office-architecture.md`).

## Caso real ya trabajado (no solo teoría)

`video-drafts/veridiscorp-explainer/SPEC.md` aplica tres piezas de este catálogo a un explainer
narrado concreto, con la razón de cada elección explicada ahí mismo:

- §1 (gancho "a medio hacer"): corrige un bug real encontrado en este mismo proyecto
  (`first_frame_empty` en `check`), no solo estética prestada de video corto.
- §8 (framework BAB): elegido sobre PAS/AIDA porque el dolor real (falta de control/gobernanza) no
  es urgente ni emocional — BAB es la opción más visual, que es lo que pide un explainer.
- §6 (guion a dos columnas de tutorial): cada shot del SPEC lleva su línea de audio y su línea de
  imagen alineadas, porque ahora el video sí lleva voz en off.

Si esta receta no sirvió para algo del SPEC, o faltó una, es la señal de que este catálogo necesita
otra vuelta — no darlo por cerrado solo porque ya tiene fuentes citadas.
