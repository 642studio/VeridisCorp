# Memoria corporativa — video.render y producción audiovisual

Preparado el 2026-11-05 para importar a la memoria corporativa (MEMORIA → + IMPORTAR TEXTO, como
documenta `README.md`). No se escribió directo a Postgres: esta sesión no tiene `office/` real
corriendo. Cada sección de abajo (`##`) es una memoria aparte al importar — se entiende sola, nombra
"VeridisCorp" o "video-production" explícitamente. Marcar "Lo escribí yo: guardar como confirmado"
solo si quien lo revisa validó el contenido de primera mano; si no, déjalo sin confirmar.

## video-production/video-render-herramienta-real

`video.render` es una herramienta real de VeridisCorp desde el 2026-11-04 (`src/office/tools.ts`, tool
`render_video`, en `allowedTools` de `video-production`). Renderiza un proyecto HyperFrames (HTML+CSS+
GSAP) a MP4 real dentro de `docker/video-renderer/`, un contenedor propio sin red en tiempo de render,
con el mismo nivel de aislamiento que `code.sandbox` (no el de `pdf.generate`, porque aquí el modelo sí
escribe HTML/CSS/JS libre). Validado llamando el código real dos veces: un video horizontal de 22.5s y
uno vertical de 70s con cinco escenas, ambos con voz real generada por el proxy de ElevenLabs ya
existente. Sigue corriendo solo en una Mac de desarrollo — construir la misma imagen Docker en el
servidor Linux de oficina queda pendiente, es trabajo de `infrastructure-lead`/`devops`.

## video-production/limites-reales-encontrados

Construir el video vertical de 70s (más escenas que la prueba anterior de 22.5s) reveló seis límites
reales, no hipotéticos, de VeridisCorp usando HyperFrames en sandbox: (1) `white-space: pre-wrap` en un
contenedor con hijos en líneas separadas del HTML fuente preserva saltos de línea del propio código
como espacio real, sin ningún error, y puede empujar contenido fuera del lienzo; (2) dos reglas CSS con
el mismo selector se pisan en silencio (la última gana) al copiar un componente del registro de
HyperFrames dentro de una escena propia; (3) reusar un componente del registro con otra fuente sin
actualizar también la fuente que usa para medir el ancho del texto desalinea el espaciado; (4) el
checker de HyperFrames da falsos positivos (`dead_stretch`, `line_unread`) sobre patrones creativos que
no anticipa, como un contador de dígitos rodando — no bloquean el render, pero no hay que confundirlos
con errores reales; (5) `check` limpio no es suficiente: varios de estos bugs solo se ven con
`snapshot`, nunca aparecen en el reporte JSON; (6) se encontró y corrigió un bug real en la propia
herramienta `video.render`: truncaba el stdout de `check` a 20 000 caracteres, lo que rompía el parseo
del reporte JSON en videos más largos/complejos y escondía el error real detrás de ruido de log — ya
corregido en `src/office/tools.ts` (el límite ahora es 2 MB). Un render de 70s / 2100 cuadros / 5
escenas tardó ~175s dentro del contenedor (GPU por software). Detalle técnico completo en
`agents/video-production/knowledge/hyperframes-contrato-y-flujo.md`.

## video-production/estandar-publicacion-lista

Decisión de VeridisCorp (2026-11-05): todo video que produzca `video-production` se construye desde la
planeación como si fuera a publicarse o mandarse a un cliente hoy mismo, nunca como boceto. Eso exige,
antes de escribir la composición: un ángulo deliberado nombrado (no el primero que ocurra), un CTA
explícito al cierre (nunca terminar solo con la marca), la regla pico-final (el mejor momento visual
va cerca del final, antes del CTA), más de un "mundo" visual si el video dura más de ~20s (nunca una
sola pantalla leyendo texto de principio a fin), sonido siempre salvo que se pida silencio, y
transiciones entre escenas en vez de solo cortes secos cuando hay más de 2-3 cambios de mundo. La señal
de que salió mal: si quitarle el audio y la animación lo deja igual a una tarjeta de texto con
viñetas, es una diapositiva con música, no un video. Prueba de que esta plaza ya tenía craft disponible
sin usarlo: `creative-strategy` ya tenía capturada la tabla de ángulos creativos, la regla de CTA y la
psicología de compra (pico-final, prueba social) desde antes — `video-production` no los estaba
aplicando al construir el primer video de prueba.

## video-production/voz-elevenlabs-costo-real

Las dos pruebas de `video.render` de VeridisCorp generaron voz real con el proxy de ElevenLabs ya
existente (`src/runtime/elevenlabs-proxy.ts`, modelo `eleven_multilingual_v2`), nunca con la voz nativa
de HeyGen. Primera prueba (22.5s, horizontal): 278 caracteres. Segunda prueba (70s, vertical, con mapa
de memoria, contador y texto cinético): 815 caracteres. Total acumulado de ambas pruebas: 1093
caracteres. En Multilingual v2, ElevenLabs cobra 1 crédito por carácter (precio oficial,
elevenlabs.io/pricing, revisado 2026-11-05) — el costo en dinero depende del plan contratado, que esta
sesión no conoce. Por plan (precio ÷ créditos incluidos × 1093 caracteres totales de ambas pruebas):
Starter ($6/30k) $0.219; Creator ($22/121k) $0.199; Pro ($99/600k) $0.180; Scale ($299/1.8M) $0.182;
Business ($990/6M) $0.180. En el plan Free (10k créditos/mes) ambas pruebas no cuestan nada extra. El
render en Docker no tiene costo de dinero (infraestructura propia, no nube facturada); la única
diferencia real entre una versión con voz y sin voz es el costo de ElevenLabs de arriba.
