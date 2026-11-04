# SPEC — El expediente que viaja (explainer VeridisCorp, con voz en off)

## Qué receta aplica y por qué (de agents/video-production/knowledge/recetas-de-video.md)

Este video es un **explainer narrado** (`/hyperframes` → `references/types/explainer.md` es la base),
pero tres piezas del catálogo de recetas se adaptan encima, no se copian:

1. **Gancho "a medio hacer" (§1 del catálogo, formato corto)**: en vez de arrancar con un cursor
   parpadeando vacío, el prompt ya está parcialmente escrito en el cuadro 0. Esto no es solo estética
   viral prestada — corrige un bug real que encontré en la prueba de humo anterior de este mismo
   proyecto (`check` marcó `first_frame_empty`: el cuadro 0 mostraba solo el fondo). Aquí el cuadro 0
   ya muestra texto real.
2. **Forma Before–After–Bridge (§8 del catálogo, framework de ads)**: Tensión = el "antes" (un pedido
   sin quién lo revise), Prueba = el "bridge" (cómo pasa de verdad: especialista → revisor → humano),
   Pago = el "after" (el PDF ya aprobado). Encaja mejor que PAS/AIDA porque el dolor no es urgente ni
   emocional, es de control/gobernanza — BAB es, según la propia investigación, "la opción más visual",
   que es lo que un explainer necesita.
3. **Guion a dos columnas (§6 del catálogo, formato tutorial)**: cada shot de abajo lleva su línea de
   audio y su línea de imagen por separado y alineadas, igual que el formato profesional de guion de
   tutorial — porque ahora sí hay voz en off que debe cuadrar con lo que se ve, no solo con el tiempo.

Todo lo narrado es un hecho real documentado en `docs/office-architecture.md` — nada inventado:
el ejemplo de "cotización de redes sociales" es literal del test en
`test/runtime-postgres.test.ts`; "el revisor nunca repite una herramienta con efecto real" es
`SIDE_EFFECTING_TOOLS` en `src/office/intelligence.ts`; "un humano aprueba antes de que algo real
salga" es la regla de aprobación humana descrita en `office-architecture.md`.

```text
GOAL:    el viewer entiende que un pedido real pasa por un expediente con revisor independiente y
         aprobación humana antes de que algo con efecto real salga — y se queda con la sensación de
         "esto es seguro", no solo "esto es rápido".
OUTPUT:  HyperFrames, 1920x1080, 30fps
TIME:    37s x 30fps = 1110 frames; sin música con BPM fijo (cama ambiental sin pulso marcado, ver
         sonido abajo) — los cortes siguen el habla, no un compás.
LOOK:    fondo #0b0f14 (ya probado, sin textura); tinta de texto #d7e3df; acento único #35e0c0,
         racionado a: el prompt "$", el checkmark del revisor, el borde del end card;
         display: JetBrains Mono 500, 72px a 1080 (6.7% del lado corto), tracking -1%;
         cuerpo/diálogo: JetBrains Mono 400, 48px (4.4%), tracking 0;
         medio: tarjetas planas, borde 1px #1c2630, radio 8px, sin cristal ni gradiente;
         luz: sombra de tarjeta (0px, 4px, blur 12px, 15% opacidad), grano 0%, viñeta 0%.
OBJECTS: tarjeta de chat/terminal (prompt "$"); tarjeta de expediente (ícono carpeta + id corto);
         tarjeta de tarea (etiqueta "especialista"); insignia de revisor (check dentro de círculo,
         acento teal); vista previa de PDF (rectángulo con esquina doblada + líneas de texto);
         sello "aprobado" (rotado -6°, solo en el pago); wordmark "VeridisCorp" (mismo mono, mayor
         tracking +2% para el end card).
MOTION:  entra: power2.out, 0.18-0.22s; transición tarjeta-a-tarjeta (cadena objeto-a-objeto):
         power1.inOut, 0.3s, la tarjeta saliente se encoge al 85% mientras la entrante aparece desde
         el punto exacto donde la anterior terminó (regla de la forma: cada plano termina en lo que
         abre el siguiente); sale: power2.in, 0.15s; sin springs (el tono es de gobierno, no juguetón).
SHOTS:
  - f0-90 (0-3s) HOOK. Imagen: tarjeta de chat ya con "necesito una cotiza" escrito (NO vacía en el
    frame 0 — corrige el bug de first_frame_empty), termina de escribirse "ción de redes sociales" y
    se envía (el cursor parpadea, nunca play/pause de media). Audio (VO): "Un pedido real le llega al
    asistente de VeridisCorp." (9 palabras) + tecleo suave bajo la voz. Entrega: el mensaje enviado se
    encoge en una miniatura que abre el siguiente plano.
  - f90-210 (3-7s) TENSIÓN / "antes" de BAB. Imagen: se amontonan 4-5 tarjetas de expediente sin
    marcar, superpuestas, sin insignia de revisor ni sello — visualmente desordenado pero sin glitch
    ni grano, solo desalineación real de tarjetas. Audio: "Sin control, cualquier pedido se queda sin
    quién lo revise, sin quién lo apruebe." (13 palabras). Entrega: una de las tarjetas se endereza y
    se vuelve el expediente protagonista del siguiente plano.
  - f210-300 (7-10s) REVEAL. Imagen: el wordmark "VeridisCorp" se teclea con el mismo tecleo del
    hook (mismo gesto, ahora como marca, no como mensaje). Audio: "VeridisCorp lo convierte en un
    expediente real." (7 palabras). Entrega: el wordmark se encoge a esquina y el expediente del plano
    anterior ocupa el centro.
  - f300-384 PRUEBA 1/5. Imagen: tarjeta de expediente con id se abre (líneas de detalle aparecen).
    Audio: "Se abre el expediente." (4 palabras) + pop discreto al abrirse.
  - f384-468 PRUEBA 2/5. Imagen: tarjeta de tarea con etiqueta "especialista" se encadena a la derecha
    del expediente (conector visual entre ambas). Audio: "Un especialista lo atiende." (4 palabras).
  - f468-552 PRUEBA 3/5. Imagen: la insignia de revisor aparece sobre la tarjeta de tarea, girando de
    perfil a frente (revisión activa, no estática). Audio: "El revisor comprueba por su cuenta" (6
    palabras).
  - f552-636 PRUEBA 4/5. Imagen: una herramienta con efecto real (ícono PDF) se tacha brevemente con
    un trazo que se desvanece (lo que NO se repite). Audio: "— sin repetir lo que ya tiene efecto
    real." (8 palabras).
  - f636-720 PRUEBA 5/5. Imagen: silueta de mano/cursor hace clic sobre un botón "aprobar". Audio:
    "Un humano da el visto bueno." (6 palabras) + click.
  - f720-930 (24-31s) PAGO / "after" de BAB. Imagen: la vista previa de PDF se arma línea por línea
    (hero del plano, ocupa >40% del alto de cuadro) y el sello "aprobado" golpea una vez, acento teal.
    Audio: "El PDF sale ya aprobado, no antes." (7 palabras) + riser corto una sola vez en el film,
    aterriza en el golpe del sello.
  - f930-1020 (31-34s) CLAIM. Imagen: una sola línea grande, centrada verticalmente pero no
    horizontalmente forzada (alineada a la izquierda, 96px de margen). Audio: "Nada con efecto real
    sale sin que alguien lo apruebe." (10 palabras).
  - f1020-1110 (34-37s) END CARD. Imagen: wordmark "VeridisCorp" se teclea una vez más, sostiene 2.5s
    quieto (no parpadea, no respira). Audio: silencio — solo la cama de fondo bajando a su nivel más
    bajo, sin voz nueva.
BANNED:  vacío negro/azul-marino con elementos flotando; glow/bloom/neón/destellos de lente/partículas;
         gradientes morados o azules, tarjetas de cristal; fondo papel/crema con serif, cursiva de
         acento, etiquetas "01/02", chips píldora; todo centrado; todo apareciendo igual o al mismo
         tiempo; texto que sigue moviéndose después de aterrizar; etiquetas de esquina o brackets HUD
         decorativos; tres tarjetas en fila como grid de KPI; logo anclado en una esquina fuera del
         end card; cuadro 0 vacío o solo fondo (ya nos pasó una vez en este proyecto — ver arriba).
QA:      snapshot --at 0 (debe mostrar texto real, no cuadro vacío), 3 (mensaje ya enviado), 10
         (wordmark completo del reveal), 17 (tarjeta de especialista visible), 27 (PDF + sello
         "aprobado" visibles juntos), 33 (línea de claim legible, contraste AA), 36 (wordmark del end
         card quieto, sin parpadeo).
```

## Sonido (`references/sound.md`)

Narrado: la voz es el reloj de cada beat (no la música). Cama instrumental ambiental de catálogo
gratuito (`/media-use`, buscar "ambient minimal pad, no percussion, corporate but not stock"), entra
tras el hook (f90) casi imperceptible, sube un peldaño en el reveal (f210) y en el pago (f720), baja
en el end card. Efectos: tecleo suave bajo el hook y el reveal (mismo gesto, mismo sonido — no dos
tecleos distintos), un "pop" por tarjeta que aparece en Prueba, un "click" en f636, un riser corto
una sola vez en el golpe del sello de "aprobado" (f900 aprox). Nada de dings ni tonos sintetizados.

## Voz en off: texto completo, en orden

1. "Un pedido real le llega al asistente de VeridisCorp."
2. "Sin control, cualquier pedido se queda sin quién lo revise, sin quién lo apruebe."
3. "VeridisCorp lo convierte en un expediente real."
4. "Se abre el expediente."
5. "Un especialista lo atiende."
6. "El revisor comprueba por su cuenta"
7. "— sin repetir lo que ya tiene efecto real."
8. "Un humano da el visto bueno."
9. "El PDF sale ya aprobado, no antes."
10. "Nada con efecto real sale sin que alguien lo apruebe."

74 palabras en total, ~34s de las 37 totales con pausas naturales entre líneas — holgado contra los
37s reales. Voz: ElevenLabs, voz y modelo por defecto del proxy (`eleven_multilingual_v2`), salvo que
se pida una voz de catálogo distinta.
