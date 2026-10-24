# Hoja de ruta v1: asistente general en el servidor de oficina

Fecha: 2026-10-23. Fase: Arranque. Decisión de alcance, todavía sin implementar — documenta qué herramientas nuevas se priorizan para que el sistema deje de ser mayormente conversacional + consultas de solo lectura y sirva como asistente de uso diario una vez montado en el servidor de oficina (ver [despliegue continuo](runtime-pilot.md#despliegue-continuo-en-el-servidor-de-oficina-pendiente)).

## Diagnóstico de partida

De los 56 perfiles en `agents/`, solo 20 tienen alguna herramienta real conectada (`src/office/tools.ts`), y todas son de lectura/cómputo: `web.search`, `calculator`, `cve.lookup`, `code.sandbox` (Docker efímero, `--network none`, no toca el host), `clickup.read`. Nada escribe todavía a ningún sistema externo real; el único conector de entrega (`httpDeliveryConnector`) es un PUT/GET genérico a un receptor que el operador debe implementar, sin integración con redes sociales, email o CRM. Tampoco hay notificación proactiva (ningún canal tipo Telegram/Slack/email) ni memoria entre conversaciones.

## Prioridad para v1

1. **Generación de documentos (PDF y similares) — implementado (2026-10-23).** Ver detalle abajo.
2. **Correo, solo borrador — implementado (2026-10-24), adelantado en el orden.** Ver detalle abajo.
3. **Drive, Calendar, Sheets, Meet y Slides reales — implementado (2026-10-24), adelantado en el orden.** Ver detalle abajo.
4. **Notificación proactiva** (Telegram o correo) — sin esto, el asistente corriendo en el servidor es ciego: nadie se entera cuando termina algo o cuando necesita una respuesta.
5. **ClickUp con escritura** — ya existe `clickup.read`; es la escritura con menos fricción de gobernanza porque extiende un patrón que ya funciona, en una herramienta central del flujo de trabajo real del equipo.
6. **Comandos reales en el VPS** — ver diseño abajo. Es la pieza con más gobernanza nueva, por eso va al final.

## Generación de PDF (`pdf.generate`) — implementado

El agente no escribe HTML/CSS: compone un documento como secuencia de bloques tipados
(encabezado, párrafo, lista, tabla, cita, callout, divisor — `src/office/tools.ts`, schema
`pdfGenerateSchema`), eligiendo cuáles usar y en qué orden; el motor es dueño por completo de
la tipografía, el espaciado y el color (`accentColor` es una paleta curada de cinco opciones,
no un color libre). Esto da agencia real sobre el diseño del documento sin arriesgar
consistencia visual ni abrir inyección — confirmado en vivo: un primer PDF real generado por
el agente `content` tenía más páginas de las pedidas, y el revisor independiente lo rechazó y
exigió corregirlo antes de aceptarlo, exactamente el comportamiento de gobernanza esperado.

Render con WeasyPrint (Python, sin motor JS) en una imagen Docker propia
(`docker/pdf-renderer/`, construida localmente con `docker build -t veridis-pdf-renderer:latest
docker/pdf-renderer` — no se baja de ningún registro de terceros), en un contenedor
`--network none` igual que `code.sandbox`. Los bytes se guardan en PostgreSQL
(`veridis_runtime_v1.office_files`, columna `bytea`), vinculados al `order_id` del expediente
que los produjo — nunca se tocó `AccessScope` en `office/`: la verificación de scope sigue
viviendo solo en `runtime/office-runtime.ts`, contra `office_orders.scope_key`, igual patrón
que `scheduled_tasks`. La herramienta es idempotente por `(order_id, input_hash)`: `review()`
nunca vuelve a ejecutarla (a diferencia de `calculator`/`web.search`/`code.sandbox`, que sí se
re-verifican de forma independiente) porque duplicaría el archivo real.

Nueva ruta `GET /office/files/{id}` en `http.ts` — primera ruta binaria del servidor, con
`content-disposition: attachment`. Mismo patrón de autorización que el resto: existencia del
archivo dentro del ámbito antes que el permiso (`data.read`), 404 para otro cliente, nunca 403.

`allowedTools: ["pdf.generate"]` está activo para v1 en los perfiles cuyo entregable natural
es un documento: `content`, `market-research`, `research`, `investment-research`,
`data-analyst`. Ampliar a más agentes es un cambio de una línea en su `config.json`.

Sin marca real todavía: la plantilla es profesional pero genérica (sin logo, sin los colores
exactos de 642 Studio) — sustituir por la identidad real queda pendiente, no bloqueó v1.
Fuera de alcance explícito: más tipos de bloque (imagen, dos columnas), control de CSS libre
por el agente.

## Correo real (`email.draft`, `email.read`) — implementado

Se descartó depender de cualquier conector/plugin de Gmail de una sesión de Claude: el que se
probó falló con `Incompatible auth server: does not support dynamic client registration` — ese
plugin intenta registrar un cliente OAuth al vuelo, algo que los servidores de Google rechazan
siempre, sin importar qué APIs tenga habilitadas el proyecto de Google Cloud. En su lugar,
VeridisCorp tiene su **propio Client ID de OAuth 2.0**, registrado por el operador en Google
Cloud Console (igual que ya funciona en n8n), conectado a una **cuenta de Gmail dedicada del
sistema** (no una personal), con alcance `gmail.compose` + `gmail.readonly`.

La herramienta nunca llama `users.messages.send`: solo `users.drafts.create` (crea un borrador
real). El envío lo decide un humano revisando la bandeja de Borradores de esa cuenta — la
aprobación que esta hoja de ruta ya exigía para correo, resuelta reusando la propia interfaz de
Gmail en vez de construir un flujo de aprobación nuevo dentro de `office/`.

Primer secreto reversible del proyecto: el refresh token se cifra (AES-256-GCM,
`src/runtime/secrets.ts`, clave en `VERIDIS_TOKEN_ENCRYPTION_KEY`) antes de guardarse en
`veridis_runtime_v1.gmail_accounts` — a diferencia de `sessions.token_hash`, que es un hash de
una sola vía, este sí se desencripta al arrancar el servidor para reconstruir el cliente OAuth2.
Autorización de un solo uso vía CLI (`npm run runtime:gmail-authorize`, patrón calcado de
`provision`): abre la URL de consentimiento de Google, levanta un listener local temporal para
capturar la redirección (`http://localhost:8731/oauth2callback` por defecto — el único puerto
fijo que hace falta registrar en Google Cloud Console), intercambia el código por tokens y
guarda el refresh token cifrado. Dependencia nueva: `google-auth-library` (solo el cliente
OAuth2; las llamadas a la API de Gmail son `fetch()` directo vía `client.request()`, mismo
patrón que `clickup.read`, no el paquete `googleapis` completo).

`allowedTools` activo para v1 solo en `content`: `cm` (CommunityManager) quedó fuera a propósito
— solo tiene capacidad `department.plan`, que siempre se enruta por `delegate()`, nunca por
`execute()`, así que un `allowedTools` ahí nunca se dispararía (configuración muerta). Ampliar
a más agentes con capacidad de ejecución directa es, como con `pdf.generate`, una línea por
`config.json`.

`external.communicate` (enum `Operation`) se deja deliberadamente sin usar, igual razón que con
`pdf.generate`: la herramienta corre dentro de una tarea ya autorizada por `execute()`; la
puerta real es `allowedTools` por agente, no una operación de gobernanza nueva.

## Drive, Calendar, Sheets, Meet y Slides reales — implementado

Mismo cliente OAuth2 y misma cuenta dedicada que Gmail (`contacto@642studio.com`) — una sola
reautorización amplió los scopes en vez de crear un cliente o una tabla nueva (`gmail_accounts`
conserva su nombre a propósito, aunque ya autorice más que Gmail: la fila real ya existía, un
renombre no aporta nada). Ninguna de las cinco guarda nada en nuestra Postgres: a diferencia de
`pdf.generate`, el contenido real vive en la infraestructura de Google y cada herramienta
devuelve su propio enlace real, mismo patrón que ya usaba `email.draft`.

- **`drive.upload`** — scope `drive.file`: solo ve archivos que esta misma herramienta crea,
  nunca el resto del Drive de la cuenta. `POST .../upload/drive/v3/files` (multipart).
- **`calendar.create_event`** — scope `calendar.events`. **Decisión explícita del usuario,
  distinta de correo**: con `attendees`, Google manda la invitación real de inmediato
  (`sendUpdates: 'all'`) — nadie la revisa antes, a diferencia de `email.draft`. Documentado
  como riesgo mayor a propósito, no una omisión. `withMeetLink` agrega un enlace real de Meet
  al propio evento (`conferenceData.createRequest` + `conferenceDataVersion=1`).
- **`sheets.create`** — scope `spreadsheets`. A diferencia de `drive.file`, este scope **no**
  tiene un equivalente acotado a "solo archivos que la app creó" — da acceso a todas las hojas
  de cálculo de la cuenta. Es más amplio por cómo es la API de Sheets, no por decisión nuestra.
- **`meet.create_space`** — scope `meetings.space.created`, API dedicada
  (`meet.googleapis.com/v2/spaces`), sin evento de calendario asociado — para cuando solo hace
  falta un enlace de videollamada para compartir.
- **`slides.create`** — scope `presentations` (mismo caso que Sheets: sin equivalente acotado).
  v1 solo compone portada + diapositivas de encabezado y viñetas con diseños predefinidos de
  Google (`TITLE`, `TITLE_AND_BODY`); sin imágenes, tablas ni dos columnas todavía — misma
  frontera ya puesta en `pdf.generate`.

Las cinco están en `SIDE_EFFECTING_TOOLS` (`src/office/intelligence.ts`): `review()` nunca las
vuelve a ejecutar — exactamente el error que se escapó una vez con `email.draft` (duplicaba un
borrador real en cada ronda de revisión hasta corregirlo), generalizado para que no se repita.

`allowedTools` activo para v1: `content` (Drive, Calendar, Meet, Slides — el agente con el
alcance más amplio, ya tenía correo), `market-research` y `research` (Drive, y Slides solo
`market-research`), `investment-research` y `data-analyst` (Drive, Sheets). `calendar.create_event`
y `meet.create_space` quedan solo en `content` por ahora, al ser las más sensibles.

Creación de salas de Meet por API puede exigir que la cuenta sea Google Workspace, no Gmail
personal gratuito — `contacto@642studio.com` es de dominio propio, así que casi seguro ya lo es;
verificado en vivo antes de darlo por bueno, no asumido de antemano.

## Comandos reales en el VPS: administración con aprobación

Decisión tomada: no se limita a comandos de solo lectura ni al sandbox Docker ya existente (`code.sandbox`, que sigue existiendo aparte para código/scripts sin tocar el host). Esta herramienta nueva puede cambiar estado real del servidor (reiniciar un servicio, por ejemplo), así que cada ejecución exige aprobación humana explícita antes de correr — mismo patrón que ya usa `content.publish` en el piloto de contenido (un agente propone, un humano designado decide, la decisión referencia la huella exacta de la acción).

Piezas que hacen falta, ninguna existe todavía:

- **Operación de gobernanza nueva** en `src/governance/contracts.ts` (el enum `Operation` hoy tiene `data.read, draft.create, data.write, content.publish, external.communicate, contract.commit, people.hire, finance.move, task.assign, approval.decide` — ninguna cubre "ejecutar en el host"). Necesita su propio verbo, análogo a `content.publish`: un agente puede *proponer* el comando (`infra.exec` o similar, operación de propuesta), pero *ejecutarlo* es una operación aparte que solo el humano aprobador dispara, igual que `execute()` en el runtime de contenido re-verifica permisos del ejecutor además de la aprobación.
- **Lista blanca de comandos**, no shell arbitrario — un conjunto cerrado y versionado de operaciones permitidas (reiniciar un servicio nombrado, por ejemplo), nunca una cadena libre que el modelo construya.
- **Agente(s) con alcance restringido**: no los 56 perfiles, probablemente solo el área de infraestructura (`infrastructure-lead` y sus subáreas), con `allowedTools` explícito como ya se hace para `cve.lookup`/`code.sandbox`.
- **Auditoría del comando y su resultado real** (stdout/stderr, código de salida), no solo de la decisión de aprobarlo — consistente con cómo `runtime/` ya registra cada intento antes de contactar al proveedor en el piloto de contenido.
- **Revisión independiente** antes de la ejecución, no solo la aprobación humana — mismo patrón de `review()` ya usado en `office/` para no confiar en el autoreporte del agente que propuso el comando.

No se ha escrito código para ninguna de las cinco piezas de esta sección; es el diseño acordado, pendiente de implementación.
