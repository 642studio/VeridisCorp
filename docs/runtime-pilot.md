# Ruta vertical gobernada de contenido

Fecha: 2026-10-22. Fase: Arranque. Esta entrega conecta gobierno, LangGraph, API HTTP y PostgreSQL en un proceso acotado de generación y entrega de contenido. La regla de ingeniería es: un componente se considera operativo únicamente en las rutas donde tiene integración y pruebas de autorización, persistencia, recuperación y fallo. Un contrato disponible no implica protección del resto del sistema.

## Recorrido implementado

1. Una sesión opaca identifica a una persona y su ámbito. El token se guarda como hash en PostgreSQL, con vencimiento y revocación; la solicitud no acepta identidad ni ámbito.
2. La persona solicita un borrador. El orquestador determinista del piloto verifica permisos y capacidad para asignar `content.draft` a `content`, y crea expediente y tarea propios persistentes.
3. Un grafo LangGraph ejecuta generación y revisión independiente con `review`. Cada llamada reserva presupuesto y registra el intento antes de contactar al proveedor. Entradas y salidas se validan contra JSON Schema mediante Ajv y contra los contratos del piloto.
4. El contenido se guarda en PostgreSQL como artefacto con versión y hash. La revisión aceptada crea una solicitud de aprobación para un humano designado; la revisión del agente no autoriza la entrega.
5. Ese humano decide desde su sesión. Debe tener autoridad de aprobación y publicación. La aprobación referencia la huella de la acción concreta, incluida versión y hash del contenido.
6. El ejecutor central verifica nuevamente permisos humanos y de servicio, aprobación vigente, versión e integridad del artefacto. Reserva presupuesto, registra la operación y cambia su estado a dispatching en una transacción corta antes del envío.
7. El conector entrega el contenido a un receptor configurado por el operador. El resultado, consumo y auditoría se guardan en PostgreSQL. Ningún destino procede del modelo o de la solicitud de usuario.
8. Si se desconoce el resultado, se consulta al receptor por clave y hash. No se reenvía por recibir un 404 o por perder una respuesta.

El plan inicial es una receta determinista, no un plan libre generado por el CEO. Permite validar el núcleo con los agentes actuales sin crear más puestos. La tarea implementada es para agente; la persistencia y aceptación de tareas de empleados siguen pendientes.

## Autorización y compatibilidad

La ruta HTTP solo usa el módulo de gobierno como punto de autorización. `OrganizationDirectory.canDelegate` se conserva para las simulaciones anteriores; no es una alternativa que permita saltar permisos de la API. Las entradas CLI antiguas `run`, `resume`, `office:run`, `office:resume` y `office:answer` se suspendieron para ejecución real. Se mantienen simulaciones, migraciones y consultas administrativas de checkpoints con acceso directo a la base. No se migraron ni reinterpretaron checkpoints existentes.

El piloto concede permisos sobre el recurso `workflow/content-pilot`, dentro del ámbito exacto de empresa, división, cliente y proyecto. La lectura autorizada cubre los expedientes de ese workflow en el ámbito, no se limita a quien creó cada expediente. Las delegaciones usan recursos `agent/content` y `agent/review`. No hay comodines. Los datos compartidos entre divisiones requieren otra ruta que conecte explícitamente relaciones y vínculos: ese contrato todavía no se utiliza en este piloto.

Las sesiones se aprovisionan mediante una utilidad administrativa local, no mediante una ruta HTTP. Esto autentica una credencial emitida por un operador; aún no hay login, SSO, recuperación de cuenta ni verificación externa de identidad. Los agentes usan identidades fijas del servidor y no pueden elegir un actor desde su respuesta. El permiso de crear borradores no concede permiso de publicar. Antes de llamar al conector se comprueban tanto los permisos del usuario que inicia la ejecución como los del servicio y del aprobador designado.

## Persistencia y concurrencia

El esquema separado `veridis_runtime_v1` contiene sesiones, grants, expedientes, tareas, versiones, aprobaciones, intentos, operaciones y auditoría. Las migraciones son explícitas, idempotentes para esta primera versión y usan un bloqueo de migración. No se modifican tablas del ERP ni las de checkpoints existentes.

Los cambios de un expediente se serializan con bloqueo de fila y transacciones cortas. No se mantiene una transacción abierta durante llamadas a modelos o al conector. Dos solicitudes de ejecutar no pueden reclamar simultáneamente una misma versión: una registra dispatching y la siguiente se rechaza. La clave de operación es única en la base.

Modificar una pieza aprobada conserva el artefacto anterior y el historial de auditoría, revoca su aprobación y crea una versión nueva que requiere revisión y aprobación. Se impiden cambios mientras hay una entrega en curso o incierta. No se implementó todavía el cálculo general de impacto para grafos con múltiples artefactos dependientes.

El estado durable del piloto está en las tablas de aplicación. LangGraph se reconstruye y observa esas etapas; no se usa una segunda copia del estado de negocio en checkpoints. Un modelo en curso tiene una reserva temporal: tras vencerla, una continuación explícita puede registrar el intento anterior como desconocido y reclamar otro intento, conservando su reserva de costo. No se promete evitar una segunda llamada de pago si el proveedor ya respondió y el proceso murió antes de registrar el resultado.

## Recuperación de efectos externos

El receptor de contenido debe admitir:

- `PUT /deliveries/{key}` con `{text, contentHash}` y encabezado de idempotencia.
- `GET /deliveries/{key}` para consultar el resultado por clave.
- Respuesta `{reference, contentHash}` que confirme la versión exacta.

La URL es configuración confiable del operador, sin credenciales embebidas ni redirecciones. Este contrato de recepción no integra todavía redes sociales, email, CRM u otro proveedor comercial. En las pruebas se usa un receptor HTTP local controlado.

Se prueba la interrupción real de un proceso después de que ese receptor guarda la entrega y antes de que el emisor registre la respuesta. Otro proceso usa la misma base, espera el vencimiento de la reserva temporal, consulta al receptor y finaliza con un solo envío observado. Si no se puede confirmar, el expediente permanece en `outcome_unknown` para conciliación; una nueva petición de ejecutar se rechaza.

Esto no constituye una garantía de exactamente una ejecución para cualquier proveedor. No hay reenvío automático, outbox general, cola distribuida ni compensaciones ejecutables. Las futuras integraciones deben documentar sus garantías y permisos efectivos por conector. Cancelar una operación ya enviada no la deshace.

## Presupuesto y evidencia de consumo

Antes de cada llamada de generación, revisión, envío o consulta se comprueban plazo total, número de llamadas y saldo de reservas. Las reservas no se liberan al recibir un error o un costo desconocido. Cada intento tiene timestamps, estado, identidad de agente o servicio, proveedor, tokens disponibles y costo conocido o null. El servidor desactiva los reintentos automáticos del adaptador de modelos.

`Defaults` en `src/runtime/contracts.ts` es conservador a propósito: 15 minutos de plazo, 6 llamadas de modelo, 3 de herramienta, $0.10 de tope. Vencido el plazo, cualquier acción que reserve presupuesto (avanzar, regenerar, ejecutar, conciliar) responde 409 `Límite de ejecución o presupuesto alcanzado` — no hay forma de extender el plazo de un expediente ya creado, solo crear uno nuevo. `VERIDIS_MAX_DURATION_MS`, `VERIDIS_MAX_MODEL_CALLS`, `VERIDIS_MAX_COST_MICROS` y `VERIDIS_MAX_TOOL_CALLS` permiten ampliar estos límites por entorno (por ejemplo, para pruebas interactivas más largas); solo afectan a expedientes creados después de iniciar el servidor con esos valores.

El adaptador real extrae los tokens que devuelve el proveedor. No existe todavía conciliación con facturación ni un catálogo de tarifas verificadas. `VERIDIS_MODEL_RESERVATION_MICROS` debe configurarse por el operador conforme a tarifa, tamaño de entrada y máximo de salida. El límite monetario controla reservas declaradas, no acredita un tope financiero real si esa estimación es incorrecta. El plazo y número de llamadas sí se verifican directamente. Las pruebas usan modelos deterministas sin consumo de pago y comprueban también fallos y contratos inválidos.

## Preparación local

Requisitos: Node.js 22+, PostgreSQL 16 y una base dedicada. Mantener usuario de migración y aprovisionamiento separado del usuario del servicio al preparar despliegue. El servicio necesita DML en sus tablas y la secuencia de auditoría; no debe tener DDL ni modificar sesiones o grants. No se ha configurado esa separación de roles en una instalación de producción.

```bash
npm ci
npm run runtime:db
docker build -t veridis-pdf-renderer:latest docker/pdf-renderer
npm run runtime:gmail-authorize
npm run runtime:provision -- config/runtime-session.example.json /ruta/privada/token.txt
npm run runtime:serve
```

El `docker build` solo hace falta si algún agente tiene `pdf.generate` en su `allowedTools` (ver [assistant-v1-roadmap.md](assistant-v1-roadmap.md)); sin la imagen construida, esa herramienta falla igual que cualquier otra sin configurar — nunca tumba `execute()`. `runtime:gmail-authorize` es igual de opcional: autoriza una vez (navegador, cuenta de Gmail dedicada del sistema ya iniciada) y guarda el refresh token cifrado; sin cuenta autorizada, `email.draft`/`email.read` fallan igual que cualquier herramienta sin configurar. Requiere antes `GMAIL_OAUTH_CLIENT_ID`, `GMAIL_OAUTH_CLIENT_SECRET` y `VERIDIS_TOKEN_ENCRYPTION_KEY` en `.env` (ver `.env.example` y [assistant-v1-roadmap.md](assistant-v1-roadmap.md) para el detalle completo, incluido qué configurar en Google Cloud Console). Editar ámbito, identidad, permisos y vencimiento del ejemplo antes de aprovisionar. `runtime:provision` escribe el token en un archivo nuevo de modo 0600 y no lo imprime. `.env` y tokens no se guardan en repositorios. Usar un cliente HTTP con encabezado Authorization Bearer; evitar poner el secreto en comandos registrados en el historial.

El servidor escucha solamente en 127.0.0.1. No se despliega ni abre puertos automáticamente. Antes de publicarlo faltan TLS, autenticación de usuarios de producción, control de tasa, políticas operativas de secretos y de retención de datos, además de verificación con conectores reales. Los errores HTTP omiten cuerpos y credenciales; los rechazos de una sesión verificable se registran en auditoría.

| Ruta | Uso |
| --- | --- |
| POST /runs | `{brief, approverHumanId}`; crea expediente y tarea |
| GET /runs | Lista expedientes del ámbito autorizado; filtro `status`, `limit` (máx. 100) y `cursor` opaco |
| GET /runs/{id} | Consulta ámbito autorizado, versiones, consumo y auditoría |
| GET /organization | Organigrama y catálogo de 56 perfiles (`agents/<id>/`), sin instrucciones ni contexto |
| GET /agents/{id} | Perfil completo de un agente: instrucciones (system prompt), contexto, capacidades y herramientas permitidas. Solo lectura — no hay ruta de edición todavía |
| POST /runs/{id}/advance | Genera o continúa generación/revisión pendiente |
| POST /runs/{id}/revise | `{text}`; nueva versión, invalida aprobación afectada |
| POST /runs/{id}/approve | `{version, decision, reason?}`; decide el humano designado. `reason` es obligatorio solo para `rejected` — `regenerate` depende de él |
| POST /runs/{id}/execute | Ejecuta únicamente una versión aprobada |
| POST /runs/{id}/reconcile | Consulta una operación incierta sin reenviarla |
| POST /runs/{id}/regenerate | Solo si la versión actual fue rechazada; genera una versión nueva con el modelo real, usando el texto anterior y el motivo del rechazo como entrada |

`GET /runs` reutiliza exactamente la misma autorización que el resto del piloto (`data.read` sobre `workflow/content-pilot`); no hay chequeo por fila porque la lectura ya cubre todo el ámbito. Cada fila trae un resumen del expediente y `needsAttention`, calculado por el servidor a partir del estado (`awaiting_approval`, `failed` u `outcome_unknown`) para que el cliente no deba repetir esa regla. No incluye artefactos, intentos ni auditoría por fila; eso sigue solo en `GET /runs/{id}`, para no transportar ese volumen en una lista. La paginación es por cursor opaco (no por offset) para no duplicar ni saltar filas si llegan expedientes nuevos entre páginas; el cursor codifica la fecha de creación y el id de la última fila devuelta y el cliente no debe interpretarlo. El esquema añadió `status` y `created_at` como columnas generadas a partir de `data` únicamente para indexar el filtro y la paginación; `data` sigue siendo la única fuente de verdad.

`GET /organization` es la primera ruta donde el servidor gobernado sirve datos de `office/`: el organigrama y el catálogo de 56 perfiles son estáticos (se cargan de `agents/<id>/` al iniciar el proceso, no de PostgreSQL) y no pertenecen a ningún cliente o proyecto — no tienen un `AccessScope` propio, a diferencia de un expediente. Se protegen igual que `GET /runs` (`data.read` sobre `workflow/content-pilot`) por consistencia con el resto del piloto, no porque ese sea realmente su recurso: es una simplificación deliberada, no una afirmación de que el organigrama es parte de ese workflow. De los 56 perfiles, solo `content` y `review` corresponden a identidades que `runtime/` ejecuta de verdad (`worker` y `reviewer` en `contracts.ts`); el resto del catálogo solo participa en las simulaciones de `office/`. La respuesta nunca incluye `instructions`, `context` ni `knowledge` de ningún perfil — `agentSummary()` ya los excluye antes de salir del proceso.

`POST /runs/{id}/regenerate` no es automático: el rechazo humano nunca dispara por sí solo una llamada real al modelo. Un clic explícito separado llama a esta ruta, que exige que la versión actual tenga una aprobación con `status: 'rejected'` (verificado bajo bloqueo de fila, no solo por el estado del expediente) y consume una reserva de presupuesto real, igual que cualquier otra generación. El modelo recibe el texto rechazado y el motivo exacto del rechazo como entrada (`content.draft` ahora acepta `text` y `feedback` opcionales, solo para este caso); produce una versión nueva que vuelve a pasar por revisión independiente antes de poder aprobarse — no se puede aprobar una regeneración sin que el revisor la acepte primero, igual que cualquier otra versión. La aprobación de la versión original permanece `rejected` en su historial; no se reescribe.

## Oficina real: expedientes, chat y tareas programadas

Fecha: 2026-10-23. `office/` deja de ser solo simulación cuando el servidor arranca con `VERIDIS_OFFICE_ENABLED=true`: reabre la ruta que las entradas CLI `office:run/resume/answer` tenían suspendida, con el CEO real coordinando sobre el mismo módulo de gobierno que protege `/runs`. `VERIDIS_OFFICE_MAX_TURNS` (por defecto 5) es el único tope — no hay presupuesto en dólares propio como en el piloto de contenido, así que una sola invocación puede encadenar varias llamadas reales de IA antes de responder.

| Ruta | Uso |
| --- | --- |
| POST /office/orders | `{objective}`; crea un expediente y lo hace avanzar hasta que el CEO lo cierre, lo pause o pregunte algo |
| GET /office/orders | Lista expedientes de oficina del ámbito autorizado |
| GET /office/orders/{id} | Expediente completo: tareas, eventos, llamadas de modelo reales, preguntas y respuestas ya intercambiadas (`exchanges`) y límites del flujo |
| POST /office/orders/{id}/advance | Continúa un expediente `active` sin pregunta pendiente |
| POST /office/orders/{id}/answer | `{answer}`; responde la pregunta pendiente (`ask_user`) y continúa |

Autorización: `draft.create` para crear o avanzar/responder, `data.read` para listar o consultar — siempre sobre `workflow/office-pilot`, igual patrón que `content-pilot`. La vista técnica completa vive en la pantalla OFICINA; la pantalla ASISTENTE (chat con animación de espera y efecto de máquina de escribir) se construye por completo sobre estas mismas rutas — no hay streaming real del backend ni un endpoint propio de chat, solo una sola petición HTTP que bloquea hasta terminar, con el hilo de conversación reconstruido en el navegador a partir de `objective` + `exchanges` + el estado final del expediente.

### Archivos generados (`pdf.generate`)

`GET /office/files/{id}` — primera ruta binaria del servidor (todo lo demás responde JSON). Sirve los bytes reales de un documento que un agente generó durante `execute()` (hoy solo PDF, vía la herramienta `pdf.generate`, ver [docs/assistant-v1-roadmap.md](assistant-v1-roadmap.md)), con `content-type` real y `content-disposition: attachment`. Autorización `data.read` sobre `workflow/office-pilot`, existencia-en-scope antes que permiso (404 para otro cliente, nunca 403) — el archivo se resuelve por `order_id` contra `office_orders.scope_key`, el mismo patrón que el resto de recursos hijos de un expediente.

### Tareas programadas

Cron real (vía `croner`) que dispara expedientes de oficina sin intervención humana, solo tiene efecto si `office/` ya está habilitado. Interruptor propio: `VERIDIS_SCHEDULER_ENABLED=true`, con `VERIDIS_SCHEDULER_MAX_PER_HOUR` (por defecto 10) como límite de tasa por `scope_key`. Un disparo automático se autoriza como el principal de servicio `scheduler` (`{kind:'service', id:'scheduler'}`), aprovisionado igual que `content-orchestrator`/`delivery-executor`: una entrada más en `permissions` al aprovisionar la sesión (ver `config/runtime-session.example.json`), sin mecanismo nuevo.

Controles de seguridad, todos verificados contra PostgreSQL real (`test/scheduler-postgres.test.ts`) y con una prueba de extremo a extremo sin intervención humana:

- **Candado contra solapamiento**: reclamo atómico (`UPDATE ... WHERE current_order_id IS NULL AND enabled RETURNING *`) — es la única fuente de verdad, no una revisión previa separada que podría tener una carrera real.
- **Apagado automático**: tres fallos consecutivos (`paused` o excepción) apagan la tarea sola; una pregunta pendiente sin resolver (`ask_user`) no cuenta ni a favor ni en contra. Reactivarla no borra su historial.
- **Límite de tasa**: por `scope_key`, no global; un salto por límite de tasa no cuenta como fallo.
- **Sin recuperación al reiniciar**: un disparo que debía ocurrir mientras el servidor estaba apagado simplemente no ocurre — comportamiento simple elegido a propósito, documentado para que no se confunda con un bug.

| Ruta | Uso |
| --- | --- |
| POST /office/schedules | `{name, objective, cronExpression, timezone}`; crea una tarea activa, valida cron y zona horaria antes de guardar |
| GET /office/schedules | Lista tareas programadas del ámbito, con `nextRunAt` calculado por el servidor |
| GET /office/schedules/{id} | Una tarea programada |
| POST /office/schedules/{id}/update | Campos parciales, incluido `enabled` (pausar/reactivar); cambiar cron o zona horaria revalida ambos juntos |
| POST /office/schedules/{id}/delete | Borra la tarea; no afecta expedientes ya creados por ella |
| POST /office/schedules/{id}/fire | Disparo manual para pruebas de operador — pasa por la misma `fireOnce` que usa el Cron real, respeta candado y límite de tasa |

Autorización: `data.write` para crear/editar/borrar, `data.read` para listar/ver, `draft.create` para el disparo manual — mismo recurso `workflow/office-pilot`. La existencia del recurso dentro del ámbito se verifica antes que el permiso de la operación (igual que `GET/POST /office/orders/{id}`): una tarea de otro cliente responde 404, nunca 403, sin importar qué permisos tenga la sesión en general.

La pantalla TAREAS_PROGRAMADAS no expone cron crudo: un selector Diario/Semanal (+ días)/Mensual (+ día del mes) + hora + zona horaria (autodetectada del navegador, editable) se traduce a la expresión cron del lado del cliente antes de enviarla; al editar, la misma pantalla interpreta de vuelta las formas simples que ella misma genera (si una tarea tiene un cron que no coincide con ese patrón — por ejemplo, migrada a mano en la base — el selector vuelve a un valor por defecto razonable en vez de intentar representarlo).

## Verificación reproducible

```bash
npm run check
npm run build
npm run test:postgres
```

`test:postgres` crea un clúster temporal aislado en loopback, ejecuta toda la suite con PostgreSQL real y elimina ese clúster al terminar. No usa `DATABASE_URL` ni cambia instancias existentes. En Linux, configurar `VERIDIS_POSTGRES_BIN` con la carpeta de binarios; en Mac se usa `/opt/homebrew/opt/postgresql@16/bin`. Requiere ejecutar como usuario no root. También puede ejecutarse `npm test` con `VERIDIS_TEST_DATABASE_URL` apuntando a una base exclusiva de pruebas; sin esa variable se omiten las pruebas PostgreSQL.

Casos cubiertos: identidad inválida o revocada, acceso a otro cliente, identidad inyectada, flujo completo, doble ejecución concurrente, nueva versión después de aprobar, permisos del ejecutor revocados, límites antes de llamar, costo desconocido ante fallo, JSON Schema inválido, artefacto alterado, resultado incierto sin confirmación, reinicio real del proceso tras envío, listado con filtro por estado, paginación por cursor y aislamiento por ámbito, organigrama con sesión revocada o inventada, regeneración solo sobre una versión rechazada (nunca sobre una pendiente o ya aprobada), y aprobación sin motivo frente a rechazo sin motivo. `test/runtime-postgres.test.ts` también cubre `/office/orders`, `/office/schedules` y `office_files` completos (crear, listar, editar, disparo manual, 403 por falta de `data.write`, 404 por ámbito ajeno, pausar/reactivar, deduplicación de `pdf.generate` por `(order_id, input)`, descarga binaria real); `test/scheduler-postgres.test.ts` cubre `fireOnce` aislado (candado, límite de tasa, apagado automático) contra PostgreSQL real; `test/office-tools.test.ts` genera un PDF real con Docker/WeasyPrint y confirma que el documento resultante es un `%PDF-` válido (se salta sola si Docker no está disponible).

Si `pg_ctl` falla al iniciar el clúster temporal con `postmaster became multithreaded during startup`, es un problema de locale del shell (no del código): ejecutar con `LC_ALL=C LANG=C npm run test:postgres`.

No se realizaron llamadas pagadas, publicaciones externas ni despliegues en el servidor de oficina. La próxima ampliación debe mantener estos controles al agregar un conector real y persistencia para tareas humanas.

## Despliegue continuo en el servidor de oficina (pendiente)

Fecha: 2026-10-23. Evaluación de viabilidad, todavía no implementada: montar `runtime:serve` (con `VERIDIS_OFFICE_ENABLED` y `VERIDIS_SCHEDULER_ENABLED` activos) como proceso siempre encendido en el Linux de oficina, para que las tareas programadas disparen de verdad sin depender de que alguien deje la laptop prendida.

Es viable en principio: es un solo proceso Node + PostgreSQL, sin infraestructura pesada — el propio motor de disparo (`src/runtime/scheduler.ts`) ya está pensado para correr así, sin recuperación de lo perdido al reiniciar (ver sección anterior). Pero "siempre corriendo" expone de inmediato las brechas que esta misma guía ya señala como pendientes en **Preparación local** (TLS, autenticación de producción, control de tasa, roles de PostgreSQL separados): hoy el servidor solo escucha en `127.0.0.1` sin supervisor de proceso que lo reviva tras un cierre o un reinicio de la máquina, y `.env` guarda las credenciales en disco sin separación de roles.

Recomendación, pendiente de ejecutar:

- **Supervisor de proceso**: un unit de `systemd` para `npm run runtime:serve` (restart automático, logs a `journalctl`), en vez de dejarlo corriendo en una terminal o con `nohup`.
- **Acceso restringido, no expuesto por el router**: mantenerlo en `127.0.0.1` y acceder solo por la Tailscale que ya usan entre el Mac y la oficina (IP `100.110.27.75`), en vez de sumarlo a los puertos 80/443/3000 ya reenviados en el router para otros servicios — el riesgo no es solo la API en sí, sino que el scheduler dispara IA real sola; menos superficie expuesta importa más que de costumbre.
- **Rol de PostgreSQL separado**: el servicio solo necesita DML sobre sus tablas y la secuencia de auditoría, nunca DDL ni acceso a `sessions`/`grants` — esta separación de roles sigue sin configurarse en ninguna instalación, no solo en la de oficina.
- **Visibilidad de costo**: con el scheduler corriendo 24/7, revisar `VERIDIS_SCHEDULER_MAX_PER_HOUR` y los límites de `Defaults` (`src/runtime/contracts.ts`) con la frecuencia real de las tareas configuradas, no con los valores conservadores pensados para pruebas interactivas.

Nada de esto está hecho todavía; es una recomendación, no una descripción de la instalación actual.
