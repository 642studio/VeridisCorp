> Adaptado de heygen-com/hyperframes (HeyGen, Inc., licencia Apache-2.0): el contrato de render, el flujo de trabajo y el catálogo de la CLI de las skills `hyperframes`/`hyperframes-cli`/`hyperframes-registry` (commit `e46ecd8`, revisado el 2026-11-03), resumido, traducido y reorganizado para VeridisCorp — ningún archivo completo se copió. Ver `docs/third-party-notices.md`.

# HyperFrames: contrato y flujo de trabajo

HyperFrames es el motor (open source, Apache-2.0) detrás de este puesto: convierte un proyecto de
HTML + CSS + medios en un MP4 determinista, pausando un timeline y avanzándolo cuadro por cuadro con
Chrome headless + FFmpeg. No es Remotion ni requiere React: la composición es HTML plano.

**`video.render` es una herramienta real** (`src/office/tools.ts`, tool `render_video`, en
`allowedTools` de este puesto), corre dentro de `docker/video-renderer/` sin red en tiempo de render.
Por eso GSAP nunca viene de un CDN: cada composición referencia `assets/vendor/gsap.min.js` (el
contenedor ya la provee, no incluirla al llamar la herramienta). Historia completa de cómo se construyó
y qué se aprendió: memoria corporativa, `video-production/video-render-herramienta-real` y
`video-production/limites-reales-encontrados`.

## Antes de construir: verificar el entorno

`npx hyperframes doctor --json` antes de cualquier cosa — no asumir que Chrome o FFmpeg están
disponibles. Revisa (entre otras): FFmpeg/FFprobe, Chrome (del sistema o descargado), Docker (para
render reproducible), espacio en el caché de frames. `whisper-cpp`, TTS local (Kokoro) y BGM local
(MusicGen) salen en rojo si no están instalados, pero son opcionales: no hacen falta si la voz viene
del proxy de ElevenLabs y no se usa música generada localmente.

## Qué es un proyecto

- `index.html` es la composición raíz: declara las variables del video y monta una escena por
  sub-composición desde `compositions/`. Medios y fuentes viven en `assets/`.
- Cada escena pone su markup, estilos y script dentro de `<template>`, con su raíz como `#root`.
- Un video nuevo: 1920×1080 a 30 fps salvo que el encargo pida otra relación de aspecto (vertical para
  redes, por ejemplo).

## Cómo se monta una escena (forma real, probada)

```html
<!-- index.html: la raíz. Nunca lleva <template>. -->
<div id="root" data-composition-id="main" data-start="0" data-duration="12"
     data-width="1920" data-height="1080">
  <div id="intro" data-composition-id="intro" data-composition-src="compositions/intro.html"
       data-start="0" data-duration="4" data-track-index="1"
       data-width="1920" data-height="1080"></div>
</div>
<script>window.__timelines["main"] = gsap.timeline({ paused: true });</script>
```

```html
<!-- compositions/intro.html: una escena. Todo va dentro de <template>. -->
<template>
  <style>#root { position: absolute; inset: 0; }</style>
  <div id="root" data-composition-id="intro" data-width="1920" data-height="1080">
    <h1 id="headline" class="clip" data-start="0.4" data-duration="3">…</h1>
  </div>
  <script>
    const tl = gsap.timeline({ paused: true });
    tl.fromTo("#headline", { opacity: 0 }, { opacity: 1, duration: 0.18 }, 0.4); // fromTo, no from
    window.__timelines["intro"] = tl;
  </script>
</template>
```

Reglas que no son obvias leyendo solo el ejemplo:
- El id del host (`intro`), el `data-composition-id` del root de la escena y la clave de
  `window.__timelines[...]` deben ser el mismo string. Si no coinciden, cada render espera 45s por
  escena y entrega cuadros estáticos.
- Siempre `gsap.fromTo`, nunca `gsap.from`: el host vuelve a buscar (seek) la escena cada vez que
  aparece, y `from` graba su estado inicial una sola vez, así que se desalinea al buscar hacia atrás.
- Nunca `tl.add()` el timeline de una escena al de la raíz: el runtime ya mueve cada escena por su
  cuenta; anidarlo la hace buscar dos veces.
- El tamaño del root de la escena se fija con `inset: 0`, nunca con píxeles fijos.

## Reglas del contrato (lo que no puede violarse)

1. Todo elemento con tiempo propio lleva `class="clip"`, `data-start` y `data-duration` en segundos, y
   se muestra exactamente en `[start, start + duration)`.
2. La duración del video es `data-duration` de la raíz: lo que sobra se corta, lo que falta sostiene el
   último cuadro.
3. Cada composición registra su timeline pausado después de sus animaciones:
   `window.__timelines["<data-composition-id>"] = tl`.
4. Nada de `Date.now()`, `Math.random()` sin semilla, llamadas de red, temporizadores ni `repeat: -1`.
   Todo lo visible es función del tiempo del timeline — el render es determinista y no depende de
   internet en el momento de renderizar.
5. Nunca animar `display`, `visibility` o `autoAlpha` en un `.clip`; se anima un hijo.
6. No mezclar `transform` de CSS con lo que ya anima GSAP en el mismo elemento.
7. Nunca llamar `play()`, `pause()` ni buscar (seek) un medio por script. Un `<video>` conserva su
   audio con `data-has-audio="true"`, si no, va `muted`; música, voz en off y reemplazos de sonido son
   siempre un `<audio>` aparte.
8. Todo `<audio>` necesita un `id` o se queda fuera de la mezcla final.
9. Fuentes fuera del set incluido necesitan `@font-face` apuntando a un archivo en `assets/fonts/`.
10. Rutas de medios siempre `assets/...` (sin `/` inicial), también en sub-composiciones.
11. Gradación de color, grano, blur y viñetas sobre metraje real van por la CLI de tratamiento de
    medios, nunca por filtros CSS.

## Qué evitar por defecto (BANNED)

Esto es tan parte del contrato como las reglas técnicas: es a donde cae un video generado cuando nadie
decidió nada. Cada uno se banea salvo que el material real de la marca o del encargo ya lo use:

- un vacío negro o azul-marino con elementos pequeños flotando en medio;
- glow, bloom, neón, destellos de lente, partículas flotando como decoración;
- gradientes morados o azules, gradientes de malla, tarjetas de cristal;
- fondo papel/crema con una serif, palabras en cursiva de acento, etiquetas numeradas "01/02", chips o
  botones en forma de píldora;
- todo centrado; todo apareciendo a la vez; todo haciendo fade + deslizándose hacia arriba;
- texto que sigue moviéndose mientras se lee; títulos que siguen a la deriva después de aparecer;
- etiquetas de esquina, marcos de cuadro, brackets de esquina como decoración (HUD falso);
- tres tarjetas en fila, grids de KPI, un título sobre una captura de pantalla oscurecida;
- el logo anclado en una esquina.

Elige siempre un dispositivo concreto (una terminal real, un diagrama que crece, un mapa de nodos) en
vez de un vacío con texto flotando — ver `produccion-lista-para-publicar.md` para cómo elegirlo.

## Fuentes incluidas (resuelven por nombre, sin instalar nada)

Inter, Montserrat, Outfit, Nunito, Oswald, League Gothic, Archivo Black, Space Mono, IBM Plex Mono,
JetBrains Mono, EB Garamond, Playfair Display, Source Code Pro, Noto Sans JP, Roboto, Open Sans, Lato,
Poppins. Fuentes de sistema comunes (Helvetica, Arial, Times, Menlo) se sustituyen automáticamente por
la más parecida de esta lista. Cualquier otra familia necesita `@font-face` a un archivo en
`assets/fonts/` o el lint falla (`font_family_without_font_face`).

## Trampas reales ya encontradas (no hipotéticas — rompieron un render de verdad)

Todas pasaron `check --json` o lo rompieron en builds reales; revisar esta lista antes de dar un bug
por misterioso. Detalle narrativo completo con fecha y contexto en memoria corporativa
(`video-production/limites-reales-encontrados`).

- **`contrast_aa_failure`**: un texto a `rgb(95,122,130)` sobre `rgb(11,15,20)` dio 4.2:1; WCAG AA
  exige 4.5:1 en texto normal (3:1 si es "grande": ≥24px). El reporte trae `suggestedColor` — usarlo.
- **`text_below_floor`**: texto para leer, bajo 28px (2.6% del lado corto), falla. Subir `font-size`;
  `data-layout-ignore` solo si de verdad es textura, nunca para esconder texto que debía leerse.
- **`white-space: pre-wrap` en un contenedor con hijos en líneas separadas del HTML fuente**
  preserva los saltos de línea e indentación del propio código como espacio real — infla cada salto
  entre elementos y puede empujar contenido fuera del lienzo sin ningún error ni warning. Usar
  `white-space: normal` salvo que de verdad se necesite preservar espacio (código, ASCII art).
- **Dos reglas CSS con el mismo selector**: la que va después gana. Si se copia un componente del
  registro con su propia regla para `.clase-x` y ya existe otra `.clase-x` propia, una calla a la otra
  en silencio (sin error de build) — por ejemplo un `color` que termina en `inherit` y hereda negro.
  Revisar duplicados de selector al pegar un componente ajeno dentro de la escena propia.
- **Reusar un componente del registro con otra fuente**: si el componente mide el ancho del texto con
  canvas (`context.font = ... + measureFont`) para calcular posiciones, y se cambia la fuente visual
  sin cambiar ese `measureFont`, las posiciones quedan mal calculadas (palabras pegadas o separadas de
  más). Cambiar ambas al mismo tiempo.
- **Un cuadro 0 negro, o `frame 0 is the thumbnail: never black`**: confirmar con `snapshot --at 0`.
- Nunca dar un render por bueno solo porque `check` pasó: sacar `snapshot` de los momentos clave y
  mirarlos — varios de los bugs de arriba no los detecta `check`, solo verlos.

## Cómo mantenerlo editable

- Una escena por sub-composición, con ids cortos y legibles.
- Los elementos con tiempo se escriben directo en el HTML (no se generan por script), cada uno con un
  id estable.
- Texto, colores de marca y medios intercambiables son variables (`data-var-text`, `data-var-src`,
  `var(--id)`) — así una misma plantilla sirve para variantes de marca o de campaña sin reescribirla.
- Contenido dentro del cuadro seguro de acción (90%) y texto/subtítulos dentro del cuadro seguro de
  título (80%).

## Flujo de trabajo (CLI: `npx hyperframes <comando>`)

1. **Spec antes de construir.** Para un video nuevo que cuenta algo (no una viñeta corta): proponer
   2-3 formas distintas de contarlo en palabras (storylines), dejar elegir, y solo entonces fijar una
   ficha técnica con cada adjetivo convertido en número (duración exacta por escena, qué se ve en cada
   corte) — igual que ya exige `instructions.md` para cualquier encargo creativo ambiguo.
2. **Construir** el proyecto: `init <dir>` para empezar; `capture <url>` si el video parte de un sitio
   real (producto, landing).
3. **Revisar antes de mostrarlo**: `lint` mientras se escribe; `check --json` como compuerta (lint,
   runtime, layout, contraste) — corregir todo error, sopesar cada advertencia.
4. **Ver sin renderizar**: `snapshot` saca cuadros fijos (PNG) de momentos concretos — así es como se
   revisa un video antes de gastar el render completo.
5. **Preview**: `preview --background` antes de pedir aprobación humana. Pasar las validaciones no es,
   por sí solo, motivo para renderizar.
6. **Render solo con aprobación humana explícita** (o si el encargo pidió el archivo sin pausas):
   `render --quality draft -o out.mp4` mientras se itera, `--quality delivery` para la entrega final.
   Confirmar que el archivo no esté vacío y que su duración (`ffprobe`) coincida con `data-duration` de
   la raíz antes de entregarlo.
7. Un video corto (~30 s) renderiza en uno o dos minutos en local; no hace falta cola para eso. Un lote
   grande o renders más largos sí deberían ir por `render --batch` o quedar fuera de esta plaza
   (`cloud render` delegado, con cuenta y costo que decide Adrián).

## Catálogo de bloques (antes de construir algo a mano)

Antes de escribir a mano una transición, lower third, título animado, gráfica o efecto con nombre
propio (glitch, CRT, grano de película), buscar primero en el catálogo (~450 piezas instalables como
código editable, no una caja negra):

```bash
npx hyperframes catalog --query "<qué debe hacer el efecto, en inglés>" --json
npx hyperframes add <nombre> --json
```

La búsqueda está indexada en inglés aunque el video sea en español. Un bloque se instala en
`compositions/<nombre>.html` y se monta con `data-composition-src` + `data-start`/`data-duration`; un
componente se copia dentro de la escena propia. Si nada del catálogo encaja, se reporta el hueco antes
de construir desde cero (`feedback --search-miss`) — eso evita reinventar lo que ya existe y mantiene
las piezas con la calidad y los ids ya probados por el catálogo.

## Cuándo usar otra skill en vez de ésta

| El encargo es | Ver |
|---|---|
| Medios: voz, música, imágenes, avatar, grabación real | `hyperframes-medios-y-voz.md` (este puesto) |
| Una presentación navegable, no un MP4 | skill `slideshow` del proyecto |
| Partir de código Remotion existente | skill `remotion-to-hyperframes` |
| Reconstruir un video ya existente como proyecto editable | skill `reverse-any-video` |
| Partir de un diseño de Figma | skill `figma` |
