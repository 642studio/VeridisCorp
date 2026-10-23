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

El adaptador real extrae los tokens que devuelve el proveedor. No existe todavía conciliación con facturación ni un catálogo de tarifas verificadas. `VERIDIS_MODEL_RESERVATION_MICROS` debe configurarse por el operador conforme a tarifa, tamaño de entrada y máximo de salida. El límite monetario controla reservas declaradas, no acredita un tope financiero real si esa estimación es incorrecta. El plazo y número de llamadas sí se verifican directamente. Las pruebas usan modelos deterministas sin consumo de pago y comprueban también fallos y contratos inválidos.

## Preparación local

Requisitos: Node.js 22+, PostgreSQL 16 y una base dedicada. Mantener usuario de migración y aprovisionamiento separado del usuario del servicio al preparar despliegue. El servicio necesita DML en sus tablas y la secuencia de auditoría; no debe tener DDL ni modificar sesiones o grants. No se ha configurado esa separación de roles en una instalación de producción.

```bash
npm ci
npm run runtime:db
npm run runtime:provision -- config/runtime-session.example.json /ruta/privada/token.txt
npm run runtime:serve
```

Editar ámbito, identidad, permisos y vencimiento del ejemplo antes de aprovisionar. `runtime:provision` escribe el token en un archivo nuevo de modo 0600 y no lo imprime. `.env` y tokens no se guardan en repositorios. Usar un cliente HTTP con encabezado Authorization Bearer; evitar poner el secreto en comandos registrados en el historial.

El servidor escucha solamente en 127.0.0.1. No se despliega ni abre puertos automáticamente. Antes de publicarlo faltan TLS, autenticación de usuarios de producción, control de tasa, políticas operativas de secretos y de retención de datos, además de verificación con conectores reales. Los errores HTTP omiten cuerpos y credenciales; los rechazos de una sesión verificable se registran en auditoría.

| Ruta | Uso |
| --- | --- |
| POST /runs | `{brief, approverHumanId}`; crea expediente y tarea |
| GET /runs | Lista expedientes del ámbito autorizado; filtro `status`, `limit` (máx. 100) y `cursor` opaco |
| GET /runs/{id} | Consulta ámbito autorizado, versiones, consumo y auditoría |
| GET /organization | Organigrama y catálogo de 56 perfiles (`agents/<id>/`), sin instrucciones ni contexto |
| POST /runs/{id}/advance | Genera o continúa generación/revisión pendiente |
| POST /runs/{id}/revise | `{text}`; nueva versión, invalida aprobación afectada |
| POST /runs/{id}/approve | `{version, decision, reason}`; decide el humano designado |
| POST /runs/{id}/execute | Ejecuta únicamente una versión aprobada |
| POST /runs/{id}/reconcile | Consulta una operación incierta sin reenviarla |

`GET /runs` reutiliza exactamente la misma autorización que el resto del piloto (`data.read` sobre `workflow/content-pilot`); no hay chequeo por fila porque la lectura ya cubre todo el ámbito. Cada fila trae un resumen del expediente y `needsAttention`, calculado por el servidor a partir del estado (`awaiting_approval`, `failed` u `outcome_unknown`) para que el cliente no deba repetir esa regla. No incluye artefactos, intentos ni auditoría por fila; eso sigue solo en `GET /runs/{id}`, para no transportar ese volumen en una lista. La paginación es por cursor opaco (no por offset) para no duplicar ni saltar filas si llegan expedientes nuevos entre páginas; el cursor codifica la fecha de creación y el id de la última fila devuelta y el cliente no debe interpretarlo. El esquema añadió `status` y `created_at` como columnas generadas a partir de `data` únicamente para indexar el filtro y la paginación; `data` sigue siendo la única fuente de verdad.

`GET /organization` es la primera ruta donde el servidor gobernado sirve datos de `office/`: el organigrama y el catálogo de 56 perfiles son estáticos (se cargan de `agents/<id>/` al iniciar el proceso, no de PostgreSQL) y no pertenecen a ningún cliente o proyecto — no tienen un `AccessScope` propio, a diferencia de un expediente. Se protegen igual que `GET /runs` (`data.read` sobre `workflow/content-pilot`) por consistencia con el resto del piloto, no porque ese sea realmente su recurso: es una simplificación deliberada, no una afirmación de que el organigrama es parte de ese workflow. De los 56 perfiles, solo `content` y `review` corresponden a identidades que `runtime/` ejecuta de verdad (`worker` y `reviewer` en `contracts.ts`); el resto del catálogo solo participa en las simulaciones de `office/`. La respuesta nunca incluye `instructions`, `context` ni `knowledge` de ningún perfil — `agentSummary()` ya los excluye antes de salir del proceso.

## Verificación reproducible

```bash
npm run check
npm run build
npm run test:postgres
```

`test:postgres` crea un clúster temporal aislado en loopback, ejecuta toda la suite con PostgreSQL real y elimina ese clúster al terminar. No usa `DATABASE_URL` ni cambia instancias existentes. En Linux, configurar `VERIDIS_POSTGRES_BIN` con la carpeta de binarios; en Mac se usa `/opt/homebrew/opt/postgresql@16/bin`. Requiere ejecutar como usuario no root. También puede ejecutarse `npm test` con `VERIDIS_TEST_DATABASE_URL` apuntando a una base exclusiva de pruebas; sin esa variable se omiten las pruebas PostgreSQL.

Casos cubiertos: identidad inválida o revocada, acceso a otro cliente, identidad inyectada, flujo completo, doble ejecución concurrente, nueva versión después de aprobar, permisos del ejecutor revocados, límites antes de llamar, costo desconocido ante fallo, JSON Schema inválido, artefacto alterado, resultado incierto sin confirmación, reinicio real del proceso tras envío, listado con filtro por estado, paginación por cursor y aislamiento por ámbito, y organigrama con sesión revocada o inventada.

Si `pg_ctl` falla al iniciar el clúster temporal con `postmaster became multithreaded during startup`, es un problema de locale del shell (no del código): ejecutar con `LC_ALL=C LANG=C npm run test:postgres`.

No se realizaron llamadas pagadas, publicaciones externas ni despliegues en el servidor de oficina. La próxima ampliación debe mantener estos controles al agregar un conector real y persistencia para tareas humanas.
