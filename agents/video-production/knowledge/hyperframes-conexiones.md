> Escrito para VeridisCorp a partir de investigación directa en heygen-com/hyperframes y hyperframes.heygen.com (HeyGen, Inc.) — registro de qué conexión/infraestructura exige cada forma de operar esto. Historia de cómo se validó: memoria corporativa (`video-production/video-render-herramienta-real`).

# Dos formas de correr HyperFrames, y qué exige cada una

## 1. Local, autoalojado — es la herramienta real (`video.render`)

`video.render` (`src/office/tools.ts`, tool `render_video`) corre la CLI de HyperFrames dentro de
`docker/video-renderer/` (imagen propia, `docker build`), con el mismo aislamiento que `code.sandbox`
— `--network none`, memoria y cpu acotadas, directorio del proyecto desechable por llamada — no el de
`pdf.generate`, porque aquí el modelo sí escribe HTML/CSS/JS libre. `video-production` ya tiene
`"video.render"` en su `allowedTools`. No es una "conexión MCP" en el sentido de
`docs/office-architecture.md` — es una herramienta más con efecto real, igual que `pdf.generate` (misma
intercepción en `intelligence.ts`: los bytes se guardan en `office_files`, el modelo nunca ve el base64).

**El contrato de HyperFrames pide GSAP desde un CDN (ejemplo oficial de `format.md`) — eso no funciona
aquí.** Sin red en tiempo de render, cada composición debe referenciar `assets/vendor/gsap.min.js`
(ruta local), nunca `https://cdn.jsdelivr.net/...`. No hace falta incluir ese archivo al llamar la
herramienta: el contenedor ya trae su propia copia (GSAP 3.15.0, build "standard-license" sin modificar)
y la coloca ahí solo si falta — ver `docker/video-renderer/docker-entrypoint.sh` y
`docs/third-party-notices.md`.

Sigue corriendo solo en la Mac de esta sesión, no en el servidor Linux de oficina — mover la imagen ahí
(mismo `docker build`, ya es portable) sigue pendiente.

- **No necesita cuenta de HeyGen.** El catálogo de música/imágenes y los créditos de generación de
  HeyGen son opcionales; sin sesión, `media-use` simplemente no los ofrece.
- **La voz sigue siendo el proxy de ElevenLabs ya existente** (`src/runtime/elevenlabs-proxy.ts`) —
  confirmado funcionando en la prueba real.
- **Responsable de mantenerlo: `infrastructure-lead`/`devops`, no `video-production`.** Construir
  (`docker build`) y mantener actualizada `docker/video-renderer/` en el servidor Linux de oficina es
  trabajo de infraestructura, igual que ya mantienen PostgreSQL o n8n. `video-production` solo usa la
  herramienta `video.render`.
- **Qué falta para que sea real en el servidor de oficina (no solo en esta Mac):** construir la misma
  imagen ahí (`docker build -f docker/video-renderer/Dockerfile docker/video-renderer`, portable, no
  debería cambiar nada) y confirmar que `docker` esté disponible para el proceso que corre `office/`.
  El render es síncrono dentro de la llamada a la herramienta (un video corto tarda ~40s dentro del
  contenedor, por debajo del límite de 5 minutos fijado en `VIDEO_RENDER_TIMEOUT_MS`); mover a una cola
  con `src/runtime/scheduler.ts` solo hace falta si algún día los videos son mucho más largos.

## 2. MCP alojado de HeyGen (sin instalar nada local)

HyperFrames también se ofrece como servidor MCP remoto en beta: `https://mcp.heygen.com/mcp/hyperframes/`.
El render ocurre en la nube de HeyGen (entrega MP4, WebM o MOV); no hace falta Node, FFmpeg ni Chrome
en el servidor propio.

- **Sí encaja, técnicamente, con el mecanismo de conexiones que VeridisCorp ya tiene**
  (`src/office/mcp-client.ts`/`mcp-tools.ts`/`mcp-store.ts`, descrito en
  `docs/office-architecture.md`): solo acepta transportes remotos HTTPS, y este servidor lo es.
- **Pero exige una cuenta de HeyGen con acceso al conector, por OAuth.** Crear esa cuenta y autorizar
  el OAuth es una acción que le toca decidir y hacer a un humano — no se hizo, y no se debe hacer sin
  que Adrián lo apruebe explícitamente (credenciales, posible costo).
- **Y exige tocar el catálogo de capacidades, no solo `allowedTools`:** conectar un servidor MCP nuevo
  necesita la capacidad `mcp.connect` (hoy solo la tienen `automation` y `devops`); usar sus
  herramientas necesita `mcp.use` (hoy: `automation`, `devops`, `development`, `backend`, `research`,
  `knowledge-curator`, `human-task-coordinator` — `video-production` no la tiene). Si se elige esta
  ruta, `video-production` tendría que pedir el render a uno de esos puestos en vez de hacerlo directo,
  o se le agregaría `mcp.use` a su config — decisión de diseño, no algo que se cambia solo.
- **No se sabe todavía si la voz del proxy de ElevenLabs se puede inyectar en un render por esta vía**
  (el MCP alojado probablemente resuelve sus propios medios del lado de HeyGen) — pendiente de probar
  si alguna vez se decide usar esta ruta.

## Recomendación

Seguir con la ruta local autoalojada como principal: no abre una cuenta nueva, mantiene la voz en
ElevenLabs (ya pagada y conectada), y sigue el mismo patrón que el resto de la infraestructura
("todo autoalojado"). Dejar el MCP alojado documentado como alternativa, solo si en algún momento
deciden no mantener Chrome/FFmpeg en el servidor propio o necesitan escalar renders más allá de lo que
el servidor de oficina pueda sostener.
