# Memoria corporativa — despliegue y verificación real en el servidor de oficina

Preparado el 2026-11-04 para importar a la memoria corporativa (MEMORIA → + IMPORTAR TEXTO). No se
escribió directo a Postgres: insertar filas en `veridis_runtime_v1.memory_records` a mano se saltaría
el embedding que genera `validate()`, dejando la memoria sin buscar por similitud. Cada `##` es una
memoria aparte al importar.

## video-production/video-render-herramienta-real-en-servidor-oficina

`video.render` (y `voice.generate`) dejaron de correr solo en la Mac de desarrollo: desde el
2026-11-04 están construidas y verificadas también en el servidor Linux de oficina (SEIS,
`/home/seis/VeridisCorp`, host `x86_64`). `docker build -t veridis-video-renderer:latest -f
docker/video-renderer/Dockerfile docker/video-renderer` corrió sin cambios al Dockerfile (la imagen
ya era portable entre ARM64 y x86_64, como se esperaba). Prueba real llamando a la herramienta tal
cual la usaría un agente (`render_video`/`generate_voice` de `src/office/tools.ts`, no la CLI de
HyperFrames a mano): una composición de 6s renderizó en ~27-29s en este hardware (vs. ~40s
reportados en la Mac para un clip más largo), el MP4 se verificó con `ffprobe` dentro del propio
contenedor (`duration=6.000000`, `codec_name=h264`, tamaño exacto al reportado por la herramienta).
`generate_voice` contra ElevenLabs desde este servidor tardó 1.2s y devolvió un MP3 real de 4.7s,
verificado con `ffprobe`/`file`. `veridis_runtime_v1.media_library` (migración de
`src/runtime/database.ts`) también se aplicó sobre la base real de este servidor
(`veridis_office`), idempotente, sin afectar datos existentes.

## infrastructure/veridiscorp-ya-corre-bajo-systemd-en-oficina

El runtime (`runtime:serve`) en el servidor de oficina (SEIS) ya corre bajo un unit de `systemd`
(`veridiscorp.service`, `enabled`, `Restart=on-failure`) — no es un proceso suelto en terminal/nohup.
Se confirmó con `systemctl status veridiscorp` (estaba `active (running)` ya antes de esta sesión) y
se usó `systemctl restart veridiscorp` para aplicar código nuevo, verificando después el PID nuevo,
el log de arranque y que el puerto `127.0.0.1:7777` volvió a responder. `docs/runtime-pilot.md`
todavía describe el supervisor de proceso como "pendiente" (sección de 2026-10-23) — ese documento
quedó desactualizado, el supervisor ya existe en la instalación real.
