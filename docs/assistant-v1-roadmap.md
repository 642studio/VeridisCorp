# Hoja de ruta v1: asistente general en el servidor de oficina

Fecha: 2026-10-23. Fase: Arranque. Decisión de alcance, todavía sin implementar — documenta qué herramientas nuevas se priorizan para que el sistema deje de ser mayormente conversacional + consultas de solo lectura y sirva como asistente de uso diario una vez montado en el servidor de oficina (ver [despliegue continuo](runtime-pilot.md#despliegue-continuo-en-el-servidor-de-oficina-pendiente)).

## Diagnóstico de partida

De los 56 perfiles en `agents/`, solo 20 tienen alguna herramienta real conectada (`src/office/tools.ts`), y todas son de lectura/cómputo: `web.search`, `calculator`, `cve.lookup`, `code.sandbox` (Docker efímero, `--network none`, no toca el host), `clickup.read`. Nada escribe todavía a ningún sistema externo real; el único conector de entrega (`httpDeliveryConnector`) es un PUT/GET genérico a un receptor que el operador debe implementar, sin integración con redes sociales, email o CRM. Tampoco hay notificación proactiva (ningún canal tipo Telegram/Slack/email) ni memoria entre conversaciones.

## Prioridad para v1

1. **Generación de documentos (PDF y similares) — implementado (2026-10-23).** Ver detalle abajo.
2. **Notificación proactiva** (Telegram o correo) — sin esto, el asistente corriendo en el servidor es ciego: nadie se entera cuando termina algo o cuando necesita una respuesta.
3. **ClickUp con escritura** — ya existe `clickup.read`; es la escritura con menos fricción de gobernanza porque extiende un patrón que ya funciona, en una herramienta central del flujo de trabajo real del equipo.
4. **Correo, solo borrador** — el envío real queda detrás de aprobación humana en v1, igual que `content.publish` ya exige aprobación en el piloto de contenido existente.
5. **Comandos reales en el VPS** — ver diseño abajo. Es la pieza con más gobernanza nueva, por eso va al final.

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

## Comandos reales en el VPS: administración con aprobación

Decisión tomada: no se limita a comandos de solo lectura ni al sandbox Docker ya existente (`code.sandbox`, que sigue existiendo aparte para código/scripts sin tocar el host). Esta herramienta nueva puede cambiar estado real del servidor (reiniciar un servicio, por ejemplo), así que cada ejecución exige aprobación humana explícita antes de correr — mismo patrón que ya usa `content.publish` en el piloto de contenido (un agente propone, un humano designado decide, la decisión referencia la huella exacta de la acción).

Piezas que hacen falta, ninguna existe todavía:

- **Operación de gobernanza nueva** en `src/governance/contracts.ts` (el enum `Operation` hoy tiene `data.read, draft.create, data.write, content.publish, external.communicate, contract.commit, people.hire, finance.move, task.assign, approval.decide` — ninguna cubre "ejecutar en el host"). Necesita su propio verbo, análogo a `content.publish`: un agente puede *proponer* el comando (`infra.exec` o similar, operación de propuesta), pero *ejecutarlo* es una operación aparte que solo el humano aprobador dispara, igual que `execute()` en el runtime de contenido re-verifica permisos del ejecutor además de la aprobación.
- **Lista blanca de comandos**, no shell arbitrario — un conjunto cerrado y versionado de operaciones permitidas (reiniciar un servicio nombrado, por ejemplo), nunca una cadena libre que el modelo construya.
- **Agente(s) con alcance restringido**: no los 56 perfiles, probablemente solo el área de infraestructura (`infrastructure-lead` y sus subáreas), con `allowedTools` explícito como ya se hace para `cve.lookup`/`code.sandbox`.
- **Auditoría del comando y su resultado real** (stdout/stderr, código de salida), no solo de la decisión de aprobarlo — consistente con cómo `runtime/` ya registra cada intento antes de contactar al proveedor en el piloto de contenido.
- **Revisión independiente** antes de la ejecución, no solo la aprobación humana — mismo patrón de `review()` ya usado en `office/` para no confiar en el autoreporte del agente que propuso el comando.

No se ha escrito código para ninguna de las cinco piezas de esta sección; es el diseño acordado, pendiente de implementación.
