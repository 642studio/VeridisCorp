# Estándar de calidad para clips de VeridisCorp

Nivel de detalle exigido antes de llamar "listo" a cualquier draft de HyperFrames. Cada regla de
aquí viene de un bug real encontrado construyendo los tres primeros drafts de práctica
(`video-drafts/veridiscorp-explainer`, `-organigrama`, `-un-dia-de-adrian`), no de teoría — ver
`video-production/bugs-reales-de-produccion` en memoria corporativa para el detalle narrado de
cada uno.

## La regla que más se rompe: nunca confiar solo en `check`

`npx hyperframes check --json` en verde **no** significa que el video se vea bien. Dos bugs reales
pasaron `check` limpio y solo se vieron al mirar el render de verdad:

- Un componente del catálogo (`state-chip-rail`) desaparecía a mitad de clip porque su duración
  interna quedó fija en el valor de ejemplo (`5`) en vez de la duración real del montaje — `check`
  no lo detecta, solo se ve sacando snapshots en el rango completo del clip, no solo al principio.
- Un texto "hero" grande repetía casi la misma frase que el caption de abajo y ambos quedaban
  encimados — `check` pasó limpio esa vez también; el `content_overlap` del linter no siempre lo
  cacha si los elementos no están en el mismo árbol de medición.

**Antes de entregar cualquier draft:** renderizar con `render --quality draft`, extraer frames
reales del MP4 con `ffmpeg -ss <t> -i draft.mp4 -frames:v 1 out.png` en varios puntos de **cada**
escena (no solo el primer segundo — el bug de duración se ve a la mitad o al final del clip, nunca
al principio), y mirarlos uno por uno. `check` y `snapshot` son el primer filtro, no el último.

## Duplicación de texto: el bug más caro

Nunca mostrar la misma frase (o una muy parecida) dos veces a la vez en pantalla — una vez como
"hero" grande (número, ícono con label) y otra vez como caption quemado abajo. Si el caption ya
dice "Cincuenta y seis perfiles trabajan en VeridisCorp.", el hero visual va **solo** con el
número/ícono, nunca con una repetición en texto de la misma frase cerca. Esto se rompió dos veces
en el mismo proyecto (hook y review de `-organigrama`) antes de corregirlo quitando la etiqueta
redundante del hero, no moviendo píxeles.

## Componentes del catálogo: la duración interna hay que parcharla siempre

`count-up`, `state-chip-rail` y cualquier primitivo similar traen su propia duración de ejemplo
fija en **tres lugares del mismo archivo** (`data-composition-duration` en el `<html>`,
`data-duration` del `#root`, y `data-duration` del `.clip` interno que de verdad controla la
ventana de visibilidad). Si se monta con una duración distinta al ejemplo, el elemento sigue
animando internamente con la duración vieja pero su propio `.clip` se corta a esa misma duración
vieja — desaparece de pantalla antes de que el montaje termine. **Cada vez que se instala uno de
estos componentes para un clip nuevo, los tres valores se editan a mano a la duración real del
montaje, antes de la primera prueba**, no después de encontrar el bug.

También: su mount contract pide host **sin** `data-width`/`data-height` (root elástico,
`container-type: size`) — copiar el mismo host que usan las escenas propias (con ancho/alto fijo)
rompe su sizing.

## Zonas seguras verticales (1080×1920)

Nada en los primeros 168px (barra de estado/búsqueda de la plataforma); contenido entre 168 y
1330px; debajo de 1330px solo textura/decoración (ahí van caption, @handle, botones de la
plataforma). El caption quemado va entre 1150-1300px aprox. — si el bloque de caption tiene 2
líneas a ~50px con line-height 1.3, calcular su altura real (`líneas × fontSize × lineHeight`)
antes de fijar el `top`, no adivinar: un `top` que se ve bien con una línea puede invadir el margen
inferior con dos.

## Overlays de pantalla completa (claim, end card)

Un `div` `position:absolute;inset:0` con fondo opaco que aparece a mitad de video necesita
`opacity:0` **en el CSS por defecto**, no solo en un `gsap.set()` a mitad de timeline — si no,
`check` lo marca (`gsap_fullscreen_overlay_starts_visible`) y, peor, cualquier contenido que siga
vivo debajo (un caption, el panel anterior sin hacer fade) queda tapado a medias y se ve roto en el
frame de transición. Antes de que aparezca ese overlay, todo lo que estaba debajo tiene que haber
terminado su propio fade-out — nunca asumir que el overlay solo "lo tapa".

## "Una sola toma continua": crossfade no es gratis, no uses un lienzo gigante

Para simular que la cámara nunca corta sin tener de verdad una escena 3D:
- **No** armar un lienzo altísimo (p. ej. 1080×7680) y mover un contenedor con `translateY`: el
  linter de layout lo marca como `escaped_container`/`canvas_overflow` en cada panel fuera del
  cuadro visible, aunque esté bien recortado por `overflow:hidden` — señal real de que el propio
  verificador no confía en el patrón, mejor no pelear contra eso.
- En vez de eso: paneles apilados en la misma posición (`inset:0`), cada uno con su propio
  `opacity:0` por defecto salvo el primero, y una transición de **slide + blur**, no un dissolve
  plano — el saliente sube y se desenfoca (`y:-140px`, `blur(14px)`, ~0.3s), el entrante entra
  desde abajo desenfocado y llega nítido (~0.34s), con un pequeño desfase (~0.12-0.15s) para que
  nunca estén los dos 100% legibles al mismo tiempo. Un dissolve de dos paneles con texto real
  (no un solo ícono) se ve sucio — lo comprobé renderizando ambas versiones.

## Tipografía: nunca asumir herencia

Cada clase que pinta texto declara su propio `font-family` (`var(--font-display, Inter,
sans-serif)` o el mono), incluso si "debería" heredar de un ancestro. Un overlay que no hereda del
contenedor esperado (por ejemplo porque es hijo directo de `#root` y no de `.panel`) cae al serif
por defecto del navegador sin ningún error de `check` — se vio literalmente así en un render real
antes de agregar la línea que faltaba.

## Cada número y cada frase, trazable

Todo dato que aparece en un video (un conteo, un estado real, una cita) sale de un documento o del
código del repo, nunca se inventa para que "se vea bien" — ver `hyperframes-contrato-y-flujo.md`
para las reglas de contrato del renderer, este documento es sobre qué tan fino hay que pulir antes
de mostrarlo.
