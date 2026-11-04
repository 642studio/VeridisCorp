# REVIEW — draft.mp4 (44.3s, post-fuentes/GSAP-local)

Medido, no solo visto: `check --json` (0 errores, 14/14 contraste AA, 0 craft), `snapshot --review`
(sheet de beats, 11 seams, sheet de teléfono a 360px) y `audio draft.mp4 --json` (el sonido se
midió, no se escuchó — nadie en esta sesión puede oírlo).

## Lectura beat a beat (como extraño, sin leer SPEC primero)

Alguien le escribe a un asistente pidiendo una cotización → una estadística real (20/56 perfiles
con herramienta conectada) → se revela qué agente y qué herramienta se activan → se abre un
expediente con el texto exacto del pedido → su estado avanza pending→running→in_review→completed →
el PDF se arma y un humano lo aprueba → la frase de cierre ("nada con efecto real sale sin
aprobación") → marca de cierre con el mismo mensaje. Se sigue sin esfuerzo, cada beat causa el
siguiente, ningún objeto necesita explicación. No encontré ningún tell de `story.md` §8 ni default
de `spec.md` "BANNED by default" en las 14 lecturas del sheet de beats.

## P0 — ninguno

Nada roto ni ilegible en las 14 lecturas del sheet de beats ni en el sheet de teléfono.

## P1 — resuelto

Se generó una pista real con `music.generate` (sunoapi.org, modelo V6, instrumental, prompt/estilo
"ambient corporate minimal, sin percusión, para sentarse bajo narración sin competir") — pista
"Stable Systems", 66.12s reales, recortada a los 44.3s exactos del video. Se colocó como cama con
`data-automation` (bajo a 0.38 bajo toda la narración, sube a 0.65 bajo el end card, baja a 0 justo
en 44.3s) más `data-fade-in="0.8"` de entrada. Medido de nuevo con `audio draft.mp4 --json`:
`silence: []` (antes había 4.16s mudos al final) y `tailEnd: 44.258` (el audio ahora llega casi
hasta el último frame). `lufsIntegrated: -19.4`, `truePeakDb: -1.5` — sin clipping, algo más bajo
que el -16/-14 LUFS que pide `sound.md` para entrega final en redes; ajustar con
`npx hyperframes normalize-audio` antes de la entrega definitiva, no antes (el nivel real se decide
en la mezcla final, no en cada iteración de draft).

## P1 original (para referencia, ya no aplica)

1. **`t=40.14s → 44.3s · todo el film · 4.16s de silencio total al cierre → agregar una cama de
   fondo (aunque sea solo bajo el end card) o acortar el silencio final; lo que se mantiene: el
   wordmark y el tagline tal cual.**
   La medición de `audio draft.mp4 --json` da `moments.tailEnd: 40.14` — la señal de audio termina
   ahí, y el video sigue hasta 44.3s en silencio total (el 9% final del film). No es una pausa
   entre líneas (esas son 0.3-0.6s, normales en narración); son más de 4 segundos continuos sin
   nada, justo en el end card. Se lee como que el audio se cortó, no como una elección.
2. **No hay cama de música, en ningún punto del film** — solo las líneas de voz con silencio entre
   ellas. `references/sound.md` §1: un film narrado de más de 15s "gets a music bed... unless the
   person asked for silence" — nadie pidió silencio aquí. El `SPEC.md` que escribí para mi propia
   versión ya dejaba esto como supuesto a resolver (sin sesión de HeyGen, `usage --json` confirmó
   `unsupported_auth`), pero sí hay una vía real disponible: `music.generate` (sunoapi.org, ya
   probado en vivo el 2026-11-06 según `docs/memoria-video-production-2026-11-06.md` — música real
   de ~9s generada y verificada con ffprobe). Generar una pista real cuesta una llamada paga; lo
   dejo para que Adrián decida antes de gastarla.

## P2 — pulido, no bloquea

- El sheet de teléfono (360px) hace los chips de estado (`PENDING/RUNNING/IN_REVIEW/COMPLETED`) y
  la etiqueta `EXPEDIENTE` difíciles de leer a esa escala reducida. `check` ya confirma que ninguno
  está bajo el piso de 2.6% del lado corto (`text_below_floor` no saltó), así que esto es solo
  relevante si este corte se reusa en vertical/feed — no es el canal actual (landscape 16:9, uso
  tipo demo). No lo toco salvo que cambie el destino del video.
- El corte de `s-reveal` a `s-proof-rail` (t≈16.99s) pasa por un cuadro casi vacío (seam-05) justo
  antes de que empiece `s-proof-rail` en 17.293s — 0.3s de nada. Está dentro del rango normal de
  pausa entre líneas de voz (coincide con el silencio de audio medido en 16.76-17.31s), no es un
  hueco aislado. Se deja así salvo que se decida apretar el ritmo.

## Lo que no se revisó

- Los otros 10 seams (solo se abrió el 05 a fondo); los demás se infieren limpios por el patrón de
  silencios medido (todos 0.3-0.6s, consistentes con pausas entre líneas), pero no se miraron cuadro
  a cuadro uno por uno.
- El plano más débil, con más tiempo: el beat de "proof" (pending→running→in_review→completed) es
  el más largo (≈14s) y el único con cuatro sub-estados — si algo se siente lento al verlo completo
  (no solo en contact sheet), ahí es donde recortaría primero.

## Afinado después de la revisión

- **Fuente del conteo**: el dígito grande de `count-up` (`.cu-value` únicamente, no el prefix/suffix
  ni el resto del video) pasó de Outfit a **Orbitron** (SIL OFL 1.1, `assets/fonts/`, @font-face
  local) — lee como panel de control digital, no calculadora literal (se consideró DSEG7, se
  descartó por sentirse demasiado kitsch contra el tono serio del resto del video).
- **Sonido al aterrizar el conteo**: un "pop" corto (`references/sound.md` §4: "pop | a badge, chip
  or number landing", exactamente este caso) resuelto del catálogo gratuito bundled de
  `media-use` (`assets/sfx/pop.mp3`). El timing se calculó primero del código del componente
  (`IN_BASE`/`COUNT`), dio una estimación de aterrizaje a los 7.79s — **incorrecta**: los fotogramas
  reales mostraron que "20/56" ya está completo entre 7.2s y 7.3s. Se corrigió al valor medido, no al
  calculado, y se confirmó con `audio draft.mp4 --json` que el onset más fuerte cerca de ese punto
  cae en t=7.35s, justo después de que el número aparece.

## Decisión pendiente de Adrián

¿Generar música real con `music.generate` (sunoapi.org, llamada paga) para cerrar el P1 de la cama
de fondo, o resolver el silencio final de otra forma (acortar el end card, o un fade simple con lo
que ya hay)?
