> Adaptado de heygen-com/hyperframes (HeyGen, Inc., licencia Apache-2.0): el oficio de resolver medios de la skill `media-use` (commit `e46ecd8`, revisado el 2026-11-03), resumido, traducido y adaptado a la infraestructura propia (proxy de ElevenLabs en vez de la voz nativa de HeyGen) — ningún archivo completo se copió. Ver `docs/third-party-notices.md`.

# Medios para un video de HyperFrames

Todo medio de un proyecto (voz, música, imagen, avatar, video) termina igual: un archivo local dentro
de `assets/` referenciado desde el HTML. El render nunca llama a una API externa — eso es parte del
contrato (`hyperframes-contrato-y-flujo.md`, regla 4). Por eso, de dónde viene cada archivo es una
decisión aparte del render en sí.

## Voz y música: herramientas reales, no pasos manuales

`voice.generate` (ElevenLabs, proxy ya existente) y `music.generate` (sunoapi.org, IA) son
herramientas reales de este puesto — no la voz nativa de HeyGen, no "Voice Turbo". Ambas pasan primero
por la **biblioteca de medios** (`veridis_runtime_v1.media_library`): el mismo texto/voz o el mismo
prompt/estilo ya generado antes, en cualquier expediente, se reusa sin gastar otra llamada ni otro
crédito — nunca regenerar por costumbre, siempre dejar que la herramienta busque primero.

Pasos: 1) llamar `generate_voice`/`generate_music` con el texto/estilo exacto — la respuesta nunca trae
el audio en sí (romper eso fue justo el bug que reventaba el límite de contexto del modelo con 1.3-1.8M
tokens en un solo expediente), trae un "mediaRef"; 2) en `render_video`, para ese archivo usa
`"mediaRef"` con ese valor exacto (nunca `"contentBase64"`) — el motor resuelve el audio real del lado
del servidor; 3) montarlo en el HTML como `<audio id="..." data-start=...>`; 4) no midas ni estimes la
duración tú mismo (no hay forma de hacerlo sin el audio en el contexto): corre `check` y ajusta la
composición según lo que reporte su sección `audio` (duración real, medida dentro del contenedor) —
si no cuadra con lo que armaste, corrige las escenas a lo que `check` midió, no al revés.
`music.generate` es instrumental por defecto (`instrumental: true`) — una cama de fondo nunca debe
cantar sobre la narración.

Un presentador/avatar hablando el guion (no solo voz sobre imágenes) sigue dependiendo de una cuenta
de HeyGen o equivalente — caso distinto, sin resolver, ver `hyperframes-conexiones.md`.

## Resto de medios (sin herramienta real todavía)

| Medio | Gratis | Gasta crédito de HyperFrames | Local / clave propia (solo si se pide) |
|---|---|---|---|
| Efectos de sonido | HeyGen / Openverse (créditos CC BY) / incluidos | | |
| Imágenes, íconos | Búsqueda HeyGen (con sesión) | Imagen generada | FLUX local, si está instalado |
| Logos | theSVG, GitHub avatar, favicon — **nunca redibujados** | | |
| Transcripción | | | `transcribe` (local) |
| Recorte de fondo (cutout) | | Video con `--type cutout` | `remove-background` (local) |
| Gradación, LUTs | siempre vía la CLI de tratamiento de medios, nunca filtros CSS | | |

Regla general: usar lo que da el mejor resultado para el encargo, no lo más barato, salvo que se pida
ahorrar costo. Nunca reportar precios ni créditos gastados al interesado — esa cuenta es interna.
