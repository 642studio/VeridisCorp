> Adaptado de headcount (cbrock84, MIT) y claude-skills (alirezarezvani, MIT): api-design, api-design-reviewer.

# Diseño de APIs REST y cambios incompatibles

Una API es una promesa que no se retira cuando alguien ya depende de ella (frontend de 642APP, flujos de n8n, integraciones de clientes). El costo de un mal diseño lo paga cada consumidor, todo el tiempo.

## Antes de empezar
Busca primero en la memoria corporativa y en el repo (lectura de git); pide lo que falte y márcalo FALTANTE:
- Quién consume el endpoint hoy (frontend, n8n, Make, terceros) y cómo se despliega cada uno.
- Convenciones existentes: prefijo de versión, formato de error, paginación, nombres de campos, autenticación.
- Contrato actual (OpenAPI, tipos compartidos, validadores) y sus pruebas.
- Reglas de negocio que dicta el dominio (facturación, inventario, reservas) y quién las confirma.

## Modela el dominio, no la tabla
- Expón conceptos que el consumidor entiende (`/clientes/123/reservas`), no la estructura de PostgreSQL. Si la API copia las tablas, cada cambio de esquema rompe consumidores.
- No expongas identificadores internos que no deban salir (secuencias, llaves de otro sistema); usa identificadores estables.
- Consistencia antes que perfección: mismo estilo de nombres, de fechas (ISO 8601 con zona horaria explícita) y de identificadores en toda la API. Montos en MXN con tipo decimal o en centavos enteros, nunca flotantes; dilo en el contrato.
- Rutas en sustantivos y plural; acciones que no son CRUD como subrecurso con POST (`/facturas/9/cancelar`).

## Errores como parte del contrato
- Código legible por máquina separado del mensaje para humanos: `{ "error": { "code": "VALIDATION_ERROR", "message": "...", "details": [{ "field": "rfc", "code": "INVALID_FORMAT" }], "requestId": "..." } }`.
- Cada error dice si se puede reintentar y cuándo.
- Validación (400/422), autenticación (401), permiso (403), no existe (404), conflicto o duplicado (409) y límite de peticiones (429) nunca comparten forma ni código.
- Nunca devuelvas trazas, SQL ni nombres de tablas: es un hallazgo de seguridad, además de mal diseño.

## Qué es un cambio incompatible
| Seguro (aditivo) | Rompe consumidores |
|---|---|
| Agregar campo opcional en la respuesta | Quitar o renombrar un campo |
| Agregar endpoint nuevo | Cambiar el tipo de un campo |
| Agregar parámetro opcional con default que conserva el comportamiento | Agregar parámetro o campo obligatorio |
| Agregar valor a un enum que el consumidor tolera | Endurecer validación, cambiar un default o un código de estado |

Los tres últimos rompen a consumidores que no hicieron nada mal. Endurecer validación nunca es "no incompatible".

Prefiere expandir a versionar: un campo opcional no le cuesta nada al consumidor; una versión nueva le cuesta una migración. Si hay que romper, versiona (p. ej. `/api/v2/`), y anuncia la fecha de retiro de la versión anterior: una deprecación sin fecha nadie la atiende. Mientras conviven, ambas versiones tienen pruebas.

## Colecciones, límites e idempotencia
- Toda colección que pueda crecer lleva paginación desde la primera versión; agregarla después rompe a todos. Prefiere cursor sobre offset en datos que cambian mientras se leen (offset salta y duplica registros con escrituras concurrentes).
- Límite máximo de página y límites de peticiones documentados en el contrato y comunicados en la respuesta.
- POST que crea cobros, facturas o pedidos acepta una llave de idempotencia para que un reintento de n8n no duplique el registro.

## Revisión antes de proponer
1. Lista los cambios contra el contrato anterior y clasifícalos con la tabla.
2. Revisa autenticación y autorización por recurso (que el usuario A no lea registros de B cambiando un id).
3. Valida entradas en el borde con un esquema en tiempo de ejecución; un cast de TypeScript no valida nada.
4. Ejecuta las pruebas de contrato en el sandbox y adjunta comando y salida. Sin salida, la revisión queda como "no ejecutada".

## Qué entregas
Contrato propuesto (OpenAPI o tipos), tabla de cambios con su clasificación, plan para consumidores afectados, pruebas propuestas o ejecutadas (separadas) y riesgos. Escalas a software-lead cualquier cambio incompatible, de autenticación o que toque datos fiscales o personales; el despliegue lo aprueba y ejecuta un humano.

## Errores comunes
- Documentación escrita a mano que se desfasa del código: genérala desde el contrato.
- Errores cuyo significado solo se deduce del texto del mensaje.
- Endpoint de lista sin paginación "porque hoy son pocos registros".
- Renombrar un campo por estética y llamarlo refactor.
- Dar por compatible un cambio sin revisar a los consumidores de n8n, que no tienen compilador que avise.
