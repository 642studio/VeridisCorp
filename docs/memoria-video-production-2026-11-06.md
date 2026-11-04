# Memoria corporativa — voice.generate, music.generate y la biblioteca de medios

Preparado el 2026-11-06 para importar a la memoria corporativa (MEMORIA → + IMPORTAR TEXTO). No se
escribió directo a Postgres: esta sesión no tiene `office/` real corriendo. Cada `##` es una memoria
aparte al importar.

## video-production/voz-y-musica-herramientas-reales

`voice.generate` y `music.generate` son herramientas reales de VeridisCorp desde el 2026-11-06
(`src/office/tools.ts`, en `allowedTools` de `video-production`). `voice.generate` usa el proxy de
ElevenLabs ya existente; `music.generate` usa sunoapi.org (IA, modelo V6 de Suno), cuenta nueva
conectada ese mismo día. Ambas se probaron con llamadas reales a los proveedores (no simuladas): voz
real de 3.7s y música real de 9.1s, descargadas y verificadas con ffprobe. music.generate es
asíncrono (sunoapi.org exige esperar la generación, ~20s en la prueba real, hasta 4 minutos de margen
antes de darla por fallida) y exige un `callBackUrl` aunque su propia guía diga que es opcional — se
usa un dominio inerte y se sigue el resultado por consulta (`record-info`), como la documentación
recomienda en vez de depender del webhook.

## video-production/biblioteca-de-medios

VeridisCorp tiene una biblioteca de medios generados desde el 2026-11-06:
`veridis_runtime_v1.media_library` (Postgres), a diferencia de `office_files` (que de-duplica solo
dentro de un mismo expediente), esta tabla reusa cualquier voz o música ya generada con los mismos
parámetros exactos, sin importar qué expediente la pida — un mismo texto o un mismo prompt/estilo no
se vuelve a generar ni a cobrar. `voice.generate` y `music.generate` la consultan antes de llamar al
proveedor. Sin Postgres configurado (`configureMediaLibrary` sin pool), ambas herramientas siguen
funcionando, solo que sin caché — nunca fallan por falta de biblioteca.

## video-production/sunoapi-limite-real

sunoapi.org es música generada por IA (Suno), no texto-a-voz — "Add Vocals" es canto dentro de una
canción, no narración hablada. No reemplaza al proxy de ElevenLabs, lo complementa: cierra el hueco de
cama de música de fondo que quedó documentado como pendiente en la prueba del video vertical del
2026-11-05 (sin cuenta de HeyGen ni MusicGen local disponibles entonces).
