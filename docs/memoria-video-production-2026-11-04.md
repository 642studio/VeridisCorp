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

## video-production/ensamblar-escenas-ya-probadas-tres-bugs-reales

Ensamblar 7 escenas de HyperFrames ya verificadas por separado en un solo video maestro
(`video-drafts/veridiscorp-deteccion/`) reveló tres bugs reales, ninguno visible en `check`/`snapshot`
de las escenas sueltas: (1) ids genéricos repetidos literal (`id="root"`, `id="scene-canvas"`, etc.)
copiados a varios archivos de escena colisionan al aplanarse todo en un solo documento —
`getElementById` siempre devuelve el primero, dejando las escenas 2 en adelante sin su canvas de
Three.js dimensionado (quedan en blanco); se arregla renombrando los ids por escena (sufijo), incluido
dentro de selectores de string en tweens de GSAP (`tl.fromTo("#caption", ...)`, que un script de
reemplazo por regex no cacha si solo busca `id=`/`#`/`getElementById`). (2) Anidar una composición dos
niveles o más (maestro → wrapper → escena) rompe el scoping de CSS del compilador para selectores que
apuntan a la raíz propia de la escena (`#mi-id-raiz { --token: ... }`): el compilador la reescribe como
combinador descendiente (`[data-composition-id="X"] [data-hf-authored-id="Y"]`), que nunca puede
matchear un solo elemento que lleva ambos atributos a la vez — sale bien en `check`/`snapshot` pero mal
en el render real, reproducido tras limpiar el pool de navegadores "warm"; la única corrección real fue
aplanar a un solo nivel de anidado (eliminar el wrapper). (3) Un componente del registro
(`telemetry-hud.html`) cae en su color default (azul marino) en vez del verde de la serie si al montarlo
falta `style="--bg: transparent"` o un `:root` real en el documento anfitrión — var(--bg, fallback) no
tiene nada útil de qué heredar sin eso. Detalle completo línea por línea en
`agents/video-production/knowledge/hyperframes-elementos-3d.md`.

## video-production/voiceturbo-heygen-no-cubre-el-free-aunque-la-doc-lo-diga

Con sign-in real de HeyGen (plan Free, cuenta `contacto@642studio.com`), el catálogo de música
(`bgm`) y los efectos de sonido vía Openverse de la skill `media-use` sí corrieron gratis sin fricción.
Pero Voice Turbo (TTS) falló para las 8 líneas de un guion corto (41s totales) con "This needs a
HyperFrames plan. Run `npx hyperframes billing subscribe`" — a pesar de que la skill documenta "3 min
de Voice Turbo al mes en el plan Free". Conclusión práctica: no asumir que Voice Turbo funciona solo
por estar firmado con HeyGen; verificar con una prueba real antes de construir un flujo que dependa de
él, y tener un plan B de voz listo (ver siguiente memoria).

## video-production/elevenlabs-canal-paralelo-fuera-del-proxy-y-de-la-cache

Cuando Voice Turbo falló, se generó la voz en off igual usando ElevenLabs directo (modelo
`eleven_multilingual_v2`, igual que `src/runtime/elevenlabs-proxy.ts`), pero por un canal distinto: el
motor de audio genérico de la skill `media-use` (`audio/scripts/audio.mjs`, fuera de
`src/office/tools.ts`), tomando la API key ya existente en `VeridisCorp/.env`
(`VERIDIS_ELEVENLABS_API_KEY`) y exportándola como `ELEVENLABS_API_KEY` (el nombre que espera esa
skill), más instalar localmente el paquete de Python `elevenlabs` (`pip install elevenlabs`), que no
estaba instalado. Esto generó voz real y facturable contra la misma cuenta de ElevenLabs de VeridisCorp,
pero sin pasar por `voice.generate`/`generate_voice` ni por `veridis_runtime_v1.media_library`: no quedó
cacheado, no de-duplica si el mismo texto se vuelve a pedir desde el runtime real, y no aparece en
ningún conteo que la plaza `video-production` lleve del proxy. Punto ciego a cerrar: si se repite este
patrón (usar la skill de HyperFrames directo sobre un proyecto en `video-drafts/`, fuera del runtime),
el gasto de ElevenLabs de esa sesión no se ve reflejado donde el resto de la organización lo espera ver.

## video-production/pronunciacion-marca-en-voz-ia-no-confiar-sin-probar

ElevenLabs (voz "River", `eleven_multilingual_v2`, español) no pronuncia de forma confiable el nombre
inventado "VeridisCorp"/"Veridis": probado con tres variantes de texto ("VeridisCorp.", "Veridis Corp.",
"Véridis, Corp.") y las tres salieron mal al transcribir el audio real generado (`npx hyperframes
transcribe`, independiente del texto de entrada): "Veritas Corp.", "Veritas Corp." otra vez, "Very
Discorp." — el modelo normaliza la palabra desconocida hacia una palabra real conocida ("Veritas").
Verificado con transcripción real del propio audio generado, no solo leyendo el texto de entrada —la
única forma confiable de detectar esto. Solución aplicada: evitar que la voz en off diga el nombre de
la marca en la línea donde es difícil de verificar de oído (la tarjeta de título ya lo muestra en
pantalla), en vez de insistir con variantes de ortografía. Para cualquier video futuro que necesite que
la voz diga "VeridisCorp" en voz alta, probar primero con una transcripción real antes de confiar en el
render final.

## infrastructure/gitignorar-renders-y-thumbnails-de-video-drafts

Ningún proyecto bajo `video-drafts/` estaba commiteado todavía (todos aparecían como "Untracked" en
`git status`, incluyendo escenas ya terminadas de sesiones anteriores). Al commitear
`veridiscorp-deteccion` por primera vez, su carpeta `renders/` sola pesaba 492 MB (varias iteraciones
de render acumuladas) y `.thumbnails/` 218 archivos de cache — ninguna de las dos es necesaria para
reproducir el video (son salida/cache, no fuente). Se agregó `video-drafts/*/renders/` y
`video-drafts/*/.thumbnails/` al `.gitignore` raíz antes del primer commit de cualquier proyecto de
video, para que ningún futuro commit de un proyecto nuevo bajo `video-drafts/` vuelva a arrastrar esto
por accidente.

## video-production/telemetry-hud-se-corrompe-con-6-mounts-en-un-video

El componente del registro `telemetry-hud.html` (reusado tal cual, sin modificar) mostró
readouts corruptos o cruzados de OTRO proyecto (ej. apareció la etiqueta "ESCENAS" en una
escena que nunca definió esa clave) al montarse 6 veces dentro de un mismo video vertical
(`video-drafts/veridiscorp-antes-despues/`, 72s). Matar el pool de navegadores "warm" y
limpiar `.hyperframes/` cambió el síntoma (de texto corrupto a texto ausente) en vez de
arreglarlo — descarta que sea solo caché; el propio componente documenta que su animación de
"tecleo" usa un LCG de semilla fija construido antes de registrar el timeline, lo que sugiere
estado compartido entre instancias cuando se monta varias veces en el mismo documento
aplanado. Se usó 7 veces sin problema en `veridiscorp-deteccion` (41s) — el límite real no se
investigó (¿número de mounts? ¿duración total? ¿algo del orden de montaje?). Arreglo aplicado:
dejar de usar el componente compartido y escribir a mano, por archivo, las dos líneas de
readout + las esquinas del HUD (CSS/HTML estático, sin animación de tecleo) — más simple y
determinista, aunque se pierde el efecto de "decodificación". Si se vuelve a necesitar
`telemetry-hud.html` montado más de 2-3 veces en un mismo video, verificar primero con
frames reales extraídos del MP4 (no solo `snapshot`) antes de dar por buena la escena.

## video-production/ritmo-vertical-plantilla-de-beats-horizontal-no-sirve-igual

Al construir `veridiscorp-antes-despues` (vertical, 9:16) con la tabla de reparto de beats de
`story.md` (Hook 8%, Tensión 12%, Reveal 8%, Proof 40%, Payoff 20%, Claim 8%, End card 8%,
pensada para un lanzamiento horizontal de ~35s) escalada a 72s, cada escena quedó con una
duración fija de 6-14s mientras que las líneas de voz reales duraban 1.3-3.5s — dejando 3 a
9.4s de silencio entre el final de cada frase y el corte a la siguiente escena. El usuario lo
notó de inmediato ("habla y se queda en silencio... esto debe ser vital") a pesar de que
`check` pasó limpio (el chequeo `dead_stretch` solo exige que ALGO se mueva cada 3s, no que
el ritmo de corte siga a la voz — agregar una animación de "respiración" ambiental silencia el
lint sin arreglar el problema real). La propia guía interna ya lo decía y no se aplicó:
`vertical.md` — "Faster than landscape: shots of 1–2 s, a new beat every 2–4 s". Arreglo:
recortar cada escena a la medida real de su voz + ~1-1.5s de respiro (no 3-9s), y agregar un
beat nuevo (`notifica`, un callback visual al caos de la apertura) para no perder el minuto de
duración pedido al comprimir — de 72s/9 escenas a 64s/10 escenas, mismo contenido narrativo.
Lección: para redes verticales, la duración de cada escena la marca la duración real de su
voz/acción, nunca una plantilla de reparto porcentual pensada para otro formato — y que
`check` pase limpio no significa que el ritmo esté bien; eso solo se nota mirando/escuchando
el render real.

## video-production/estandar-permanente-ritmo-dopaminico-video-vertical

Decisión de VeridisCorp (2026-11-04, Adrián, explícita y permanente: "esto tiene que ser
siempre, no nomas este video"): todo video de redes que construya `video-production` sigue
esta regla de ritmo, no solo como corrección puntual. Primer intento de arreglar
`ritmo-vertical-plantilla-de-beats-horizontal-no-sirve-igual` (recortar la cola muda de cada
escena a ~1-1.5s, 64s/10 escenas) seguía sin ritmo real ("literalmente no tiene ritmo... tiene
que ser dopamínico"). Reglas que sí funcionaron, verificadas con el render final (frames reales
+ `silencedetect` del audio real, no solo `check`):
(1) la voz del video arranca en el primer 1-2s, nunca después — un video que abre con 5-7s de
solo música/visual antes de la primera palabra ya se siente "en silencio" aunque técnicamente
haya música de fondo; (2) cada escena dura lo que tarda su voz + ~0.2-0.5s de respiro, nunca
1-2s ni un número redondo — los cortes deben sentirse cada 2.5-4.5s; (3) matemática real de
calibración: con ese ritmo, 10 ideas/líneas de guion solo llenan ~35-40s de video — para una
duración pedida de 60s+ hacen falta ~15 beats, no 10; si el guion no alcanza para la duración
pedida, decirlo y preguntar (más beats vs. video más corto) en vez de estirar los que ya
existen con silencio o con "respiración" ambiental que solo engaña al lint; (4) cuando una
escena ya muestra en pantalla el mismo texto que dice la voz (texto propio de la escena, no el
caption quemado del master), no agregar además un caption quemado idéntico debajo — se ve
como el mismo texto repetido dos veces a la vez; el caption quemado del master solo hace falta
donde la escena no tiene ya su propio texto en pantalla. Resultado real: `veridiscorp-antes-despues`
pasó de 72s/9 escenas (3-9.4s de silencio por corte) a 64s/10 escenas (aún sin ritmo real) a
57.5s/15 escenas (voz desde 1.6s, cortes cada 2.5-4.5s, aprobado por Adrián). Igual que con el
ritmo, el único chequeo confiable es ver/escuchar el render real.

## video-production/sunoapi-tambien-es-canal-paralelo-como-elevenlabs

Mismo punto ciego que `elevenlabs-canal-paralelo-fuera-del-proxy-y-de-la-cache`, pero con
música: para generar el BGM del video `veridiscorp-antes-despues` se llamó a sunoapi.org
directo (mismo contrato exacto que `src/runtime/sunoapi-proxy.ts` — endpoint
`https://apibox.erweima.ai/api/v1/generate`, el mismo workaround de `callBackUrl` falso porque
la API lo exige aunque su guía diga que es opcional, modelo V6, `instrumental:true`, polling a
`/generate/record-info`), replicado a mano en un script de una sola vez fuera de
`src/office/tools.ts`, usando la key ya existente en `VeridisCorp/.env`
(`VERIDIS_SUNOAPI_API_KEY`). Generó una pista real de 65.6s, facturable contra la misma cuenta
de sunoapi.org de VeridisCorp, pero sin pasar por `music.generate` ni por
`veridis_runtime_v1.media_library`: mismo punto ciego que con la voz — el gasto de esa sesión
no aparece donde el resto de la organización lo espera ver. Aplica la misma conclusión: si se
repite el patrón de usar la skill de HyperFrames directo sobre un proyecto en `video-drafts/`
(fuera del runtime real), tanto la voz como la música generadas ahí quedan fuera del conteo y
de la caché del proxy — es un hueco conocido, no una sorpresa nueva cada vez.

## video-production/video-1-de-5-camara-continua-funciona-sin-corte-duro

Primer video del plan de 5 para "perfeccionar la técnica" (`veridiscorp-motor-real`, 38.5s):
probó una cámara continua (cada capa "cae" a un punto con `scale` y la siguiente "emerge"
desde ese mismo punto — nunca un corte seco) en vez de los match-cuts de los videos
anteriores. Funcionó: la voz arranca a los 0.5s, nunca hay silencio, y el dispositivo en sí
mismo (el movimiento de cámara) hace que los cortes se sientan continuos sin necesitar tantos
beats distintos (8 capas, 38.5s). Aprendizajes nuevos:
(1) el chequeo `dead_stretch` NO distingue el dispositivo narrativo — aunque la cámara nunca
corta, si el CONTENIDO interior de una capa deja de moverse por 3s+ (ej. un diagrama ya
armado, esperando a que la voz termine de hablar) igual lo marca; se resuelve igual que antes,
con una respiración ambiental (pulso de opacity/boxShadow) durante el tramo donde solo habla
la voz — el dispositivo de cámara no exime de esta regla, se suma a ella;
(2) `first_frame_empty` esta vez SÍ era un bug real, no el falso positivo de la sesión
anterior — el panel de la escena 1 arrancaba en `opacity:0` puro (antes de su propio fade-in),
así que el frame 0 real estaba vacío; la lección correcta es verificar siempre con un frame
real extraído del MP4 en ambos sentidos: a veces el chequeo se equivoca, a veces no, solo el
frame real lo dice;
(3) acrónimos cortos en español también son un riesgo de pronunciación, no solo nombres
inventados — "IA" sola salió transcrita como "ya." (confirmado con `npx hyperframes
transcribe` del audio real); se arregló escribiendo "inteligencia artificial" completo en vez
de la sigla;
(4) "LangGraph" salió como "LandGraph" en las variantes probadas — mismo patrón que
"VeridisCorp"/"Veritas": términos técnicos en inglés no están garantizados, mejor no decirlos
en voz si el video ya los muestra en pantalla como texto (misma solución que para el nombre de
la marca);
(5) "cree"/"crea" (creer vs. crear) es una trampa real en español — una vocal de diferencia
cambia el significado y ElevenLabs no lo garantiza; se evitó reescribiendo con un verbo sin esa
trampa ("confía en" en vez de "le cree a").

## video-production/video-2-de-5-la-paleta-no-rompe-el-ritmo-pero-si-el-layout

Segundo video del plan de 5 (`veridiscorp-elenco`, 24s): cambió la identidad visual completa
(paleta teal/azul de `veridiscorp-organigrama` en vez del verde CRT de los 3 videos
anteriores) manteniendo la misma regla de ritmo. Resultado: el ritmo SÍ se sostiene fuera del
look ya probado — la regla de "voz desde <1s, 2-4s por corte" no depende del color. Lo que sí
rompió fue el LAYOUT: una cuadrícula de 56 puntos (uno por perfil real) calculada con
`grid-template-columns` + `aspect-ratio` resultó mucho más alta de lo estimado a mano
(698px reales vs. los ~340px calculados a ojo) y se metió debajo del texto del caption,
bajándole el contraste a 1:1 en el chequeo automático (`contrast_aa_failure`) — un bug de
layout real detectado por un chequeo pensado para otra cosa (contraste de texto). Lección:
con una cuadrícula de muchos elementos, calcular su alto real con aritmética exacta (N
elementos, tamaño fijo en px, columnas fijas) antes de posicionar cualquier texto debajo —
nunca estimar a ojo con unidades relativas (`1fr`, `aspect-ratio`). Segundo hallazgo: el mismo
`first_frame_empty` volvió a ser un bug real (no un falso positivo) — los 56 puntos "apagados"
en frame 0 eran casi invisibles contra el fondo oscuro (incluso con `opacity:1`, el color de
"apagado" elegido era demasiado cercano al fondo); se corrigió subiendo el contraste del
estado "apagado" (de `#1a2230`/`#2b3648` a `#202c3c`/`#3d5066`), no solo la opacidad.

## video-production/video-4-de-5-capitulos-funcionan-y-el-disco-se-llena-rapido

Cuarto video del plan de 5 (`veridiscorp-oficina-real`, 47.4s, 15 cortes en 3 capítulos — "se
mudó", "no se cae", "se puede probar"): probó si el ritmo de 2-4s por corte aguanta a mayor
escala/duración. Sí aguantó — los capítulos (tarjetas cortas de "Capítulo N" entre bloques de
contenido) funcionan como respiro natural sin romper el ritmo, y con 15 ideas reales (no
inventadas para rellenar) la duración salió sola en 47.4s, sin forzar un número redondo.
Dos hallazgos nuevos:
(1) el disco se quedó sin espacio a media sesión (870MB libres de 460GB) — cada iteración de
`npm run render` deja un MP4 nuevo sin borrar los anteriores, y 4 videos de este mismo plan ya
habían acumulado renders intermedios (`veridiscorp-deteccion/renders/` solo, 492MB en 8 copias).
Limpiar solo deja el render más reciente de cada proyecto — los intermedios son 100%
reproducibles con `npm run render` otra vez, nunca hace falta guardarlos. Si se van a producir
muchos videos seguidos en una sesión, revisar espacio en disco antes de que truene, no después;
(2) más riesgos de pronunciación confirmados con transcripción real: "ARM64"/"x86_64" salieron
como "ARMS 24"/"X86 24" (los números con guión bajo confunden al modelo); "systemd" como
"Sistem D." (aceptable, se mantuvo) pero "Reinicio" salió "Reinizio" (se evitó reescribiendo a
"se reinicia solo"); "ffprobe" salió "FFProp" (se evitó, nunca se dijo en voz, solo se mostró
en pantalla). Patrón que se repite en cada video nuevo: cualquier término técnico con números,
guiones bajos o mayúsculas mezcladas es sospechoso hasta que se verifica con una transcripción
real — mostrarlo en pantalla, no decirlo en voz, sigue siendo la solución más simple.

## video-production/video-5-de-5-gancho-de-pregunta-y-resumen-del-plan

Quinto video del plan de 5 (`veridiscorp-y-si`, 20.6s): probó un gancho de pregunta con un
input real tecleado en pantalla ("¿Y si tu empresa corriera así?" + "cotizar 3 unidades a
Acme" tecleándose letra por letra, mismo ejemplo que el video 1 — consistencia entre videos
del mismo universo). Es el video más corto del plan porque el guion real (7 líneas, varias de
1-2 palabras) no daba para más sin inventar relleno — exactamente la regla ya escrita:
duración real, nunca forzada. Mismo bug de `first_frame_empty` que en el video 1, mismo
arreglo (arrancar en opacity parcial, nunca 0 puro) — y esta vez se detectó el error real en
mi propia verificación: un primer collage de frames con `tile=` en ffmpeg mostró contenido ya
completo en lo que creí era el frame 0, pero un `select=eq(n\,0)` aislado mostró la verdad (vacío) —
un filtro `tile`/`select` combinado con varias condiciones puede no corresponder 1 a 1 con el
índice de frame esperado; para verificar frame 0 específicamente, aislarlo solo, no confiar en
un collage de varios frames a la vez.

## video-production/video-3-de-5-sin-avatar-cuota-de-voz-agotada-y-clave-propia

Tercer video del plan de 5 (`veridiscorp-eleccion-modelo`, 55.1s), el último en construirse.
Datos reales de `docs/model-routing.md`: los 4 perfiles activos (`routine`→deepseek-flash,
`analysis`→deepseek-v4-pro, `review`→gpt-5.4-mini-2026-03-17, `complex`→gpt-5.4-2026-03-05),
el orden de prioridad de 5 pasos (regla exacta → regla de etapa → perfil del agente → perfil
de la etapa → perfil de la oficina), la prueba real del piloto (338 tokens de entrada en
DeepSeek vs 277 en OpenAI, misma tarea) y la entrada de Claude al roster el 2026-11-03
(`claude-opus-5-5` para el CEO, `claude-haiku-5-5` para revisión, dos cuentas con `CLAUDE_API_KEY`
y `CLAUDE_API_KEY_2` separadas para que una cuota agotada no bloquee a la otra).

**Se descartó el avatar HeyGen**, el plan original del video 3: la ruta automática
(`media-use resolve --type video`) shellea el CLI `heygen` aparte, no instalado; la ruta
directa (`media-use generate --type avatar`) no necesita ese CLI pero exige `--photo` (una
foto real que nadie dio) o `--avatar <look-id>` ("el look id **propio** de la persona en
HeyGen", no un catálogo público descubrible sin el CLI). Ante la elección explícita de Adrián
("Cambiar el formato del video 3"), se construyó en su lugar con el mismo kit de tarjetas/
diagramas ya usado en los videos 1 y 4 — sin presentador, consistente con el resto del plan.

**La cuota gratis de voz de HeyGen (3 min/mes) se agotó a mitad de este video**, consumida por
los videos 1, 2, 4 y 5 de la misma sesión — `media-use generate` empezó a devolver "This needs
a HyperFrames plan" para cada línea. Adrián proveyó una API key propia de ElevenLabs (cuenta
separada de HeyGen) pasada por chat; se usó solo como variable de entorno del proceso que
generó el audio (`ELEVENLABS_API_KEY=... node audio.mjs ...`), nunca escrita en
`audio_request.json`, en ningún archivo del proyecto ni en un checkpoint — igual que ya exige
`VeridisCorp/AGENTS.md` para credenciales de la empresa. Lección para el próximo video con voz:
revisar la cuota de HeyGen antes de generar, no después del primer fallo.

**Bugs reales nuevos, todos corregidos antes de renderizar:**
- Pronunciación real (`npx hyperframes transcribe` del audio real, no del texto de entrada):
  "el perfil del agente" se escuchó como "el perfil de la gente" — la secuencia "del agente"
  falla con ElevenLabs igual que ya fallaban siglas y términos técnicos; arreglo: reformular
  ("de ese agente"), nunca asumir que una frase común es segura solo por no ser una sigla.
- `line_unread`: una tarjeta con 13 palabras de texto (badge + headline + nombre de modelo)
  solo quedó 2.33s en pantalla contra un piso real de 4.40s (~0.5s + 0.3s por palabra) —
  density real de 2-4s por beat no aplica igual cuando el beat tiene mucho texto que leer, no
  solo un corte visual. Arreglo: alargar esa composición en vez de acortar el texto (el texto
  son datos reales de la empresa, no relleno) — subió la duración total del video de 52.69s a
  55.07s, con el mismo respiro repartido en el resto del timeline.
- `text_below_floor` en 7 elementos distintos (badges y tags a 20-24px): el piso real de
  lectura en vertical es 28px (2.6% del lado corto), no un número arbitrario — todo texto que
  se lee (no solo titulares) necesita cumplirlo, incluyendo badges pequeños tipo etiqueta.
- `audio_clip_silent`: un SFX de "click" colocado en los primeros 0-0.6s del archivo resultó
  silencioso ahí (confirmado con `ffmpeg -af silencedetect`, no asumido) — el sonido real
  estaba más adelante en el archivo (~0.9-1.9s). Arreglo: `data-media-start` para saltar al
  punto real del archivo donde suena, en vez de descartar el SFX. Lección: un SFX corto
  reutilizado de otro video puede tener silencio al inicio del archivo; verificar con
  `silencedetect` antes de asumir que el primer medio segundo es audible.

Verificación real post-render (nunca solo `check`): frame 0 aislado con
`ffmpeg -vf "select=eq(n\,0)"` — no vacío, confirma el patrón ya establecido. Transcripción del
audio YA MEZCLADO del MP4 final (no solo de los WAV de voz sueltos) contra el guion esperado —
coincide completo, sin errores de pronunciación nuevos en la mezcla final.

## video-production/resumen-plan-de-5-videos-completo

**Los 5 videos del plan están terminados.** La regla de ritmo (voz desde <1-2s, duración real
sin rellenar) se sostuvo en los 5 formatos probados — cámara continua (video 1, 38.5s), paleta
distinta (video 2, 24s), formato largo por capítulos (video 4, 47.4s), gancho de pregunta
(video 5, 20.6s) y tarjetas/diagramas con datos reales de la empresa sin presentador (video 3,
55.1s, el más largo porque es el que tiene más hechos reales que mostrar — 6 ideas contra las
~10 beats cortos de los otros). La duración de cada video salió siempre de la cantidad real de
contenido, nunca de un número objetivo, entre 20.6s y 55.1s según el guion.

Catálogo completo de bugs reales encontrados y corregidos en los 5 videos (todos documentados
arriba, sección por sección): layout de cuadrículas calculado mal a mano, pronunciación de
siglas/términos técnicos con números o guiones bajos **y de frases comunes no obviamente
riesgosas** ("del agente"), espacio en disco agotado por renders acumulados, cuota gratis de
voz agotada a mitad de sesión, un SFX reutilizado con silencio real al inicio del archivo, un
piso de lectura de texto (28px) que aplica a badges pequeños igual que a titulares, un piso de
tiempo en pantalla por cantidad de palabras (no solo por regla de corte 2-4s), y
`first_frame_empty` necesitando verificación frame por frame real en ambos sentidos (a veces es
bug real, a veces no). El dispositivo de avatar HeyGen fotorrealista quedó descartado para este
plan (bloqueo real: CLI `heygen` no instalado, sin foto real disponible) — si se retoma más
adelante, necesita decidir antes una foto real autorizada o un look id propio ya creado en
HeyGen, no un catálogo público sin el CLI instalado.
