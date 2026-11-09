# Guía de lo que incorporamos de los repos candidatos (2026-11-08)

Qué se sumó a VeridisCorp a partir de los 36 repos revisados el 2026-11-08, para qué sirve cada pieza
y cómo usarla en el día a día. Fase: **Implementación** para el knowledge y el QC de video;
**Arranque** para Postiz.

Documentos relacionados:
- veredictos de los 36 repos: [repos-candidatos-2026-11-08.md](repos-candidatos-2026-11-08.md);
- licencias: [third-party-notices.md](third-party-notices.md);
- operación de Postiz: [deploy/postiz/README.md](../deploy/postiz/README.md).

## Resumen en una tabla

| Qué | Tipo | Para quién | Estado | Cómo se activa |
|---|---|---|---|---|
| 16 documentos de knowledge | Oficio de puesto | 14 puestos | Listo | Solo: viajan en cada llamada del puesto |
| QC automático de video | Herramienta (`video.render`) | video-production | Listo; falta probarlo dentro de Docker | Solo: cada render trae su reporte `qc` |
| Normalización de audio | Opción de `video.render` | video-production | Listo | Pedir audio a −14 LUFS o `normalizeAudio: true` |
| Postiz | Servicio autoalojado | Adrián (programar) | Corriendo, sin cuenta ni redes | Ver la sección de Postiz |
| `social.schedule_post` | Herramienta | content | Lista, sin probar contra Postiz real | Pedir "deja un borrador en Postiz" |

## 1. Cómo se usan las cosas en VeridisCorp (lo básico)

- **Tú no llamas a un agente ni a una herramienta directamente.** Le pides algo al ASISTENTE en
  `web/` o al bot de Telegram. Si es trabajo, abre un expediente y el CEO lo reparte al puesto que
  corresponde.
- **El knowledge no se invoca.** Cada documento declarado en `agents/<puesto>/config.json` va
  completo en el prompt de ese puesto, en cada llamada. Si pides algo que cae en su terreno, el
  puesto ya trabaja con ese criterio.
- **Las herramientas solo las usa el puesto que las tiene** en `allowedTools`. Las que tienen efecto
  real (render, borradores, correos) nunca se le dan al revisor.
- **Los agentes proponen; tú apruebas** lo que tiene efecto real: publicar, enviar o pagar.

Para pedir algo que use una pieza concreta, nombra el entregable y el criterio. Por ejemplo, "haz
la auditoría de UI de la pantalla de reservas con puntaje y severidad", no solo "revisa la pantalla".

## 2. Knowledge nuevo por puesto (16 documentos)

Todos están en `agents/<puesto>/knowledge/`, declarados en su `config.json`. Cada uno abre con su
línea de origen y licencia.

### Diseño y software

**frontend → `diseno-de-interfaz.md`**
- **Fuentes:** impeccable (Paul Bakaus, Apache-2.0), unslop (Damir Sokolovsky, CC BY 4.0) y
  `frontend-design` de anthropics/skills.
- **Qué enseña:**
  - Fijar la dirección visual antes de diseñar.
  - Un "piso de oficio" que se verifica en lo renderizado: espaciado con escala, jerarquía
    tipográfica y contraste.
  - Las señales de una UI hecha por IA, que se rechazan por defecto: todo es tarjeta, gradientes
    sin motivo, espaciado arbitrario y texto que grita.
  - Pasadas sobre pantallas existentes, estados límite y microcopy.
- **Cómo pedirlo:** "Diseña la pantalla de turnos de 642APP; dame dirección, layout y estados
  vacíos y de error." O bien: "Haz una pasada de pulido sobre el dashboard de inventario."

**frontend → `accesibilidad-y-estados.md`**
- **Fuente:** ux-ui-agent-skills (plugin87, MIT).
- **Qué enseña:**
  - WCAG 2.2 AA como piso propuesto; tú lo confirmas por proyecto.
  - Criterios ordenados por prioridad y cómo probarlos.
  - Los patrones ARIA esenciales.
  - Todos los estados de un componente (vacío, cargando, error, deshabilitado…) y formularios.
- **Cómo pedirlo:** "Revisa la accesibilidad del formulario de reservas y lista los estados que
  faltan."
- **Ojo:** cualquier obligación legal mexicana de accesibilidad se marca "verificar con el abogado";
  el documento no cita artículos.

**software-qa → `critica-y-auditoria-de-ui.md`**
- **Fuente:** impeccable (`critique` y `audit`).
- **Qué enseña:** dos revisiones separadas.
  - **Auditoría técnica:** cinco dimensiones calificadas de 0 a 4.
  - **Crítica de diseño:** si la pantalla le sirve a su usuario.
  - Cada hallazgo lleva severidad de P0 a P3, con criterios de rechazo. QA documenta; frontend
    corrige.
- **Cómo pedirlo:** "Audita la pantalla de facturación con puntaje y severidad."
- **Límite:** `software-qa` solo tiene `mcp.use`, así que no puede correr el detector de impeccable.
  Todo lo que califique sin salida de una herramienta lo marca como "inspeccionado", no "medido".

**development → `recibir-revision-de-codigo.md`**
- **Fuente:** superpowers (Jesse Vincent, MIT), `receiving-code-review`.
- **Qué enseña:**
  - Evaluar cada comentario técnicamente: verificar antes de aplicar y preguntar antes de suponer.
  - El chequeo YAGNI, el orden de aplicación y cuándo rebatir.
  - Usa las mismas severidades que la revisión de `software-lead`: Crítico, Requerido, Considera
    y Detalle.
- **Qué entrega:** una tabla de comentario, decisión y evidencia.
- **Cómo pedirlo:** "Atiende la revisión del PR de 642API; dime qué aplicas, qué rebates y por qué."

**backend → `disenar-herramientas-mcp.md`**
- **Fuente:** `mcp-builder` de anthropics/skills (Apache-2.0).
- **Qué enseña:** cómo diseñar un servidor MCP propio (para 642API, ClickUp, n8n…):
  - cobertura de flujos, nombres, descripciones y esquemas;
  - formato de respuesta, paginación y errores accionables;
  - transporte, seguridad y pruebas.
- **Cómo encaja hoy:**
  - Un agente solo conecta servidores HTTPS públicos.
  - Cada herramienta llega apagada hasta que un humano la activa en CONEXIONES.
  - Las herramientas sin `readOnlyHint` quedan como "desconocida" y el revisor no puede usarlas.
- **Cómo pedirlo:** "Diseña el servidor MCP de 642API para consultar clientes y reservas."

**knowledge-curator → `probar-documentos-de-knowledge.md`**
- **Fuentes:** superpowers `writing-skills` y anthropics `skill-creator`.
- **Qué enseña:**
  - Un documento de knowledge se gana su lugar con evidencia: primero ver al agente fallar sin el
    documento y luego acertar con él.
  - Escenarios, micro-pruebas de redacción y regresión.
  - Los límites reales del motor: 10 documentos y 64 KB por puesto, 32 KB por documento.
- **Cómo pedirlo:** "Prueba si el documento X cambia de verdad lo que hace el puesto Y."

### Marketing, contenido y creatividad

**content → `lectura-previa.md`**
- **Fuente:** awesome-llm-apps (Shubham Saboo, Apache-2.0), `first-reader`.
- **Qué enseña:** antes de publicar, simular dos lectores.
  - **El que hojea:** decide en segundos si entra.
  - **El que lee completo:** dónde se pierde o deja de creer.
  - Se reporta con nivel de confianza y después se corrige.
- **Cómo pedirlo:** "Pásale la lectura previa al post de El Mismo Sazón antes de dejarlo en borrador."

**marketing-review → `doble-revision-de-lo-publico.md`**
- **Fuente:** ECC (Affaan Mustafa, MIT), `santa-method`, de origen de Ronald Skelton.
- **Qué enseña:**
  - Lo que se publica o se entrega a un cliente lo revisan dos revisores independientes con la
    misma rúbrica, y los dos deben aprobar.
  - Ciclo de corrección y cuándo escalar a un humano.
- **Límite:** hoy el motor asigna un solo revisor, así que el documento lo describe como proceso
  manual hasta que exista la mejora del motor. Aprobar esta revisión no publica nada.

**creative-strategy → `logotipos-e-identidad.md`**
- **Fuente:** logo-design-skill (kaankiziltug, MIT). Solo se tomaron sus referencias; no sus 1,432
  logotipos.
- **Qué enseña:**
  - Brief obligatorio antes de cualquier concepto.
  - Principios, y el orden para elegir el tipo de marca.
  - Pruebas antes de presentar: a 16 px, en una tinta y en negativo.
  - Búsqueda de registro en el IMPI.
  - Crítica de logos propios o ajenos y sistema de identidad.
- **Quién hace qué:** el puesto define el brief y los criterios; el trazo final es de un diseñador
  humano.
- **Cómo pedirlo:** "Arma el brief y tres direcciones para el logo de GLOW, con pruebas y búsqueda
  en el IMPI."

**cmo → `presentaciones.md`**
- **Fuente:** `pptx` de anthropics/skills.
- **Qué enseña:** estructura de una presentación que lleva a una decisión, guía visual, control de
  calidad y qué entregar.
- **Límite:** `cmo` no tiene `slides.create`. Define la presentación y `content` la arma.
- **Cómo pedirlo:** "Prepara la estructura de la presentación de propuesta para La Morralla."

**video-production → `motion-sin-presentacion.md`**
- **Fuente:** bang-motion (Bang Tutorial, MIT), traducida del indonesio.
- **Qué enseña:**
  - Cómo evitar que un video parezca PowerPoint, en formato error → corrección.
  - Tamaños de plano y un menú de transiciones.
  - Fondo siempre en movimiento y cómo abrir los primeros 3 segundos.
- **Si hay choque:** la lista BANNED del contrato de HyperFrames gana.

**video-production → `analisis-de-referencia-y-plataformas.md`**
- **Origen:** texto propio, con ideas de reelmimic (MIT) y OpenMontage (AGPL, redactado desde cero).
- **Qué enseña:**
  - Medir un video de referencia: planos, duración media de escena y BPM.
  - Copiar el ritmo, no el contenido.
  - Zonas seguras y especificaciones por plataforma; verificarlas antes de cada entrega.
  - Volumen a −14 LUFS.
- **Cómo pedirlo:** "Toma este reel de referencia, mide su ritmo y haz uno igual de rápido para OWTS."

### Coordinación, finanzas y prospección

**review → `preguntas-de-verificacion.md`**
- **Fuente:** `discernment-nudge` de anthropics/skills.
- **Qué hace:** cuando te entregan una propuesta que se va a usar, el dictamen cierra con 2 o 3
  preguntas concretas para que compruebes algo antes de aprobar, en vez de un "¿apruebas?" a ciegas.
- **Qué notarás:** las preguntas al final de cada entrega.

**human-task-coordinator → `notas-de-voz-y-mensajes.md`**
- **Fuente:** awesome-llm-apps, `thinking-out-loud`.
- **Qué hace:**
  - Ante un mensaje largo o dictado tuyo, devuelve primero un eco: lo que entendió, separando lo
    que dijiste de lo que supuso. Por ejemplo, "para el viernes" queda como una fecha que nadie fijó.
  - Solo actúa cuando confirmas.
- **Límite:** el puente de Telegram todavía solo lee texto; las notas de voz no llegan.

**finance-budget → `hojas-de-calculo-financieras.md`**
- **Fuente:** `xlsx` de anthropics/skills (Apache-2.0).
- **Qué enseña:**
  - Hojas que se recalculan solas, con los supuestos separados.
  - Convenciones de color.
  - Cero errores de fórmula antes de entregar, y cómo armar modelos financieros.
- **Límites:**
  - `finance-budget` no tiene `sheets.create`, así que entrega la especificación.
  - Además, `sheets.create` hoy guarda las fórmulas como texto (`RAW`).

**market-research → `prospeccion-local-responsable.md`**
- **Origen:** texto propio, con criterios inspirados en google-maps-scraping-apis, sin su fuente
  de datos.
- **Qué enseña:**
  - Listas cortas y justificadas de negocios locales, con una oferta para cada uno.
  - Fuentes legítimas: DENUE del INEGI o la API oficial de Google Places.
  - Señales: sin sitio web, reputación menor a 4.0 con más de 20 reseñas, sin reseñas recientes.
  - Contacto uno a uno con tu aprobación, respetando el REPEP.
- **Límites:**
  - El puesto no contacta, no da de alta en el CRM y no gasta en APIs.
  - No tiene herramienta de DENUE.
  - 642CORE no tiene tabla de prospectos.
- **Cómo pedirlo:** "Arma una lista de 10 restaurantes de mi ciudad con señales de que necesitan
  redes, y qué les ofrecerías."

## 3. QC automático de video (`video.render`)

**Qué es.** Después de cada render, el mismo contenedor aislado y sin red analiza el MP4 con
FFmpeg. La respuesta trae un campo `qc`, compacto (menos de 1.5 KB) y con hasta 10 hallazgos
legibles. Así la regla de ritmo dopamínico (cortes rápidos, nada de silencios, nada que se alargue)
se puede medir, no solo pedir. Las ideas vienen de cinecode (MIT); el código es propio y está en
`src/office/video-qc.ts`.

**Qué mide y con qué umbral.** Todos son de referencia y viven en `VIDEO_QC_THRESHOLDS`.

| Medición | Se marca cuando… |
|---|---|
| Arranque | el primer movimiento llega después de 0.5 s, o se mueve menos de la mitad de los primeros 2 s |
| Congelados | hay 3 s o más quietos a mitad del video, o más de 4 s en el cierre |
| Negros | hay 0.5 s o más de negro, o el primer cuadro es negro |
| Silencios | hay 1 s o más por debajo de −50 dB, o el video no tiene pista de audio |
| Escenas | la más larga pasa de 4.5 s, o la media pasa de 4.5 s |
| Volumen | queda fuera de −14 ±2 LUFS, o el pico real pasa de −1 dBTP |

Ejemplo real, sobre el video aprobado `antes-despues`:

```json
{"clean":false,"durationS":57.5,"metrics":{"cuts":29,"meanSceneS":1.9,"longestSceneS":4.8,"loudnessLufs":-18.4},
 "findings":["escena de 4.8 s sin corte ni cambio fuerte en 00:32.6 (ref. ≤ 4.5 s)",
             "loudness -18.4 LUFS (ref. -14 ±2; \"normalizeAudio\": true lo corrige)"]}
```

**Cómo se usa:**
- **No hay que activarlo.** Todo render lo trae y el QC nunca hace fallar el render. Si FFmpeg
  falla, `qc` trae `error` y el MP4 se entrega igual.
- **Qué hace el agente con el reporte.** `agents/video-production/instructions.md` le pide leer el
  `qc` y, con cada hallazgo, corregir y volver a renderizar o justificar por qué se queda.
- **Normalizar el audio.** Pide "entrega con audio normalizado", o el agente usa
  `normalizeAudio: true`. Lleva el audio a −14 LUFS en dos pasadas sin recodificar la imagen.
  Úsalo en toda entrega con voz o música.
- **Con expediente,** el `qc` viaja junto con el `fileId` del video guardado.

**Qué falta:**
- Correr la prueba dentro de la imagen Docker (FFmpeg 5.1). Docker estaba apagado en la Mac.
- Recalibrar los umbrales con más videos aprobados; hoy salen de uno solo.

Para probarla con Docker arriba:

```bash
docker build -t veridis-video-renderer:latest docker/video-renderer
```

```bash
npx tsx --test test/video-qc.test.ts
```

## 4. Postiz y la herramienta de borradores

**Qué es Postiz.** Un programador de publicaciones autoalojado (AGPL-3.0, sin modificar) para
TikTok, YouTube, LinkedIn, Threads, carrusel de Instagram, Pinterest, X y otras. Corre en
`veridis-oficina`, solo en `127.0.0.1:4007`. VeridisCorp lo llama por su API HTTP; nunca importa
su código.

**Qué es `social.schedule_post`.** Una herramienta del puesto `content` con dos funciones:
- `list_social_channels`: lista los canales conectados en Postiz.
- `create_social_draft`: crea un **borrador** con texto, el video que salió de `render_video` o
  imágenes públicas, en uno o varios canales, con una fecha propuesta.

**Nunca publica ni programa.** El flujo es:
1. Le pides a VeridisCorp la pieza, por ejemplo: "Haz el reel de la promo de OWTS y déjalo en
   borrador en Postiz para TikTok y YouTube el viernes a las 6 pm."
2. `video-production` renderiza, con QC. `content` escribe el texto, le pasa la lectura previa y
   crea el borrador.
3. Tú abres Postiz, revisas el borrador y lo programas o lo descartas.

**Antes de que funcione (pasos tuyos):**
1. Crear la cuenta de administrador. Desde la Mac abre el túnel y entra a http://localhost:4007:

   ```bash
   ssh -L 4007:127.0.0.1:4007 veridis-oficina
   ```

   Después pon `DISABLE_REGISTRATION=true` en `~/postiz/.env` y corre `docker compose up -d`.
2. Generar la llave en Postiz (Settings → Public API). Ponla en el `.env` del runtime de
   VeridisCorp como `POSTIZ_API_KEY`, junto con `POSTIZ_URL=http://127.0.0.1:4007`, y reinicia
   el runtime.
3. Para adjuntar videos hace falta `VERIDIS_PUBLIC_BASE_URL` (la URL pública del servidor): Postiz
   no descarga desde direcciones privadas.
4. Para conectar redes hacen falta dos cosas:
   - Una URL pública con HTTPS para Postiz (por ejemplo, un túnel de Cloudflare).
   - La app de desarrollador de cada red. Meta, TikTok, YouTube y LinkedIn tienen revisiones que
     tardan semanas, y TikTok publica en privado hasta pasar su auditoría.

**Límites:**
- No resuelve los Reels de Facebook. Facebook e Instagram siguen con `social.publish_facebook` y
  `social.publish_instagram`.
- Límite de 30 peticiones por hora a la API.
- Algunas redes piden ajustes propios (por ejemplo, el título en YouTube).
- Verificado: que corre, la salud de la API y la memoria del servidor.
- Sin verificar: un borrador real, porque todavía no hay cuenta ni llave.

**Si algo falla:**
- **"Postiz no está configurado":** faltan `POSTIZ_URL` o `POSTIZ_API_KEY` en el runtime.
- **API con 502:** revisa `docker compose logs postiz` en `~/postiz`. El arreglo de Temporal está
  en el README de Postiz.
- **El contenedor `postiz` se reinicia:** sube su tope de memoria de 1.5 GB a 2 GB.

## 5. Lo que quedó como idea o para después

| Qué | De dónde | Estado |
|---|---|---|
| Doble revisión independiente en el motor | ECC santa-method | Pendiente (mejoras del motor) |
| Registro de aprobaciones con hash del borrador, para no enviar nada dos veces | ECC operator-approval-loop | Pendiente |
| Evaluación dorada antes de cambiar de modelo | career-ops eval-golden | Pendiente |
| "Médico" de la memoria: vencidos, duplicados, contradicciones | neuromapa (solo ideas) | Pendiente |
| RAG correctivo | awesome-llm-apps corrective_rag | Idea |
| Subtítulos con marcas por palabra y voz local | VoiceStudio (AGPL, como servicio) | Después |
| Sonido sincronizado con los cortes y crítica de mezcla | earshot (MIT) | Por probar |
| Puesto de ventas / prospección | hueco | Después |
| Puesto legal / cumplimiento LFPDPPP | hueco | Después |
| Laboratorio de visión con cámara propia | clearcam (GPL) | Después, solo laboratorio |

**Descartados, y por qué:**
- Agent-Reach: arriesga las cuentas de Meta.
- deepface: biometría, dato sensible.
- pentagi: solo en una VM aislada.
- BillionMail: solo con una lista con opt-in.
- Kronos, lead-gen-api-stack, FreeDomain, viralwave, ui-skill y karpathy-skill: no aportan.

**Huecos de código detectados:**
- `sheets.create` guarda las fórmulas como texto.
- finance-budget no tiene `sheets.create` y cmo no tiene `slides.create`.
- Telegram no lee notas de voz.
- No hay tabla de prospectos ni herramienta de DENUE.

## 6. Cómo sumar más en el futuro

1. Revisar el repo en solo lectura y anotar su veredicto y su licencia en un documento como
   [repos-candidatos-2026-11-08.md](repos-candidatos-2026-11-08.md).
2. Según la licencia:
   - **MIT o Apache:** se adapta con atribución.
   - **CC BY:** se adapta con crédito.
   - **AGPL o GPL:** solo como servicio sin modificar, o solo ideas con texto propio.
   - **Sin licencia o no comercial:** solo ideas.
3. Escribir el documento en `agents/<puesto>/knowledge/`.
   - La primera línea es `> Adaptado de <repo> (<autor>, <licencia>): <skills>.` o
     `> Escrito para VeridisCorp (…)`.
   - Se declara en el `config.json` del puesto.
   - Límites: 10 documentos y 64 KB por puesto, 32 KB por documento.
4. Agregar el aviso en [third-party-notices.md](third-party-notices.md) y la fila en
   [skills-libraries.md](skills-libraries.md).
5. Probarlo: el puesto debe fallar sin el documento y acertar con él (lo hace `knowledge-curator`).
   Correr `npm test`.

[[infraestructura_veridis]] [[repos-candidatos-2026-11-08]] [[skills-libraries-veridiscorp]] [[postiz]] [[video-qc]]
#veridis #veridiscorp #knowledge #herramientas #postiz #video #guia
2026-11-08
