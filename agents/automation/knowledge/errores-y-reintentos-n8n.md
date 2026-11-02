> Adaptado de n8n-skills (czlonkowski, MIT): n8n-error-handling, n8n-node-configuration.

# Manejo de errores, reintentos e idempotencia en n8n

## Antes de empezar
Busca en la memoria corporativa el flujo de errores vigente (si existe), el canal de alertas, quién atiende cada sistema y los flujos que corren sin supervisión. Si falta el canal o el responsable, márcalo FALTANTE: un flujo desatendido sin alguien que reciba la alerta no se propone para activación.

Por defecto, si un nodo falla, todo el flujo se detiene sin avisar a nadie. Para un flujo que tú vigilas basta; para webhooks, cron, colas o herramientas de agentes no.

## Postura según el flujo
| Flujo | Manejo exigido |
|---|---|
| Webhook o API con "Respond to Webhook" | Obligatorio: cada nodo que puede fallar con salida de error conectada y código de estado correcto |
| Programado, cola o herramienta de agente | Obligatorio: flujo de errores asignado y reintentos en nodos de red |
| Prueba única que vigilas | Opcional |

## La trampa número uno: salida de error en dos pasos
1. En el nodo, "On Error" = "Continue (using error output)". Eso crea la segunda salida.
2. Conectar esa salida a un manejador real.
Si haces solo el paso 1, el error se descarta y la ejecución aparece como exitosa. Si haces solo el paso 2, el manejador nunca se alcanza. La validación no detecta ninguno de los dos casos: revisa ambos a mano.

Tampoco ve la salida de error: un error de JavaScript dentro de `{{ }}` (el campo queda `null` y sigue por el camino de éxito) ni algunos rechazos de nodos Code. Después de una transformación crítica, verifica con IF que el campo exista y manda el faltante al camino de error tú mismo.

## Reintentos primero
En todo nodo que llama a la red (HTTP, base de datos, correo, WhatsApp, IA) activa "Retry On Fail": como referencia general, 3 intentos con 5 segundos entre intentos (n8n limita a 5 intentos y 5,000 ms). Así un fallo pasajero no llega a nadie y las alertas reflejan problemas reales. El reintento aplica a cualquier error, sin filtrar por código.

## Idempotencia: reintentar sin duplicar
Un reintento o una corrida repetida no debe cobrar, facturar, enviar ni insertar dos veces.
- Escribe con `UPSERT` sobre una llave natural (folio, id del proveedor, UUID del CFDI, id del mensaje).
- Descarta repetidos con "Remove Duplicates" contra ejecuciones previas o con una tabla de ids procesados.
- Si el proveedor envía un id de evento o de idempotencia, guárdalo y rechaza el repetido.
- Separa "registrar" de "enviar": marca como enviado solo después de confirmar el envío.
- Antes de proponer reintentos en un paso que escribe, responde por escrito: ¿qué pasa si corre dos veces?

## APIs: códigos que dicen la verdad
Toda rama, de éxito o de error, termina en un "Respond to Webhook"; si no, quien llama espera hasta agotar el tiempo. El código por defecto es 200 incluso en ramas de error: fíjalo siempre.
| Causa | Código | Dónde se decide |
|---|---|---|
| Falta un campo o tipo incorrecto | 400 | Validación previa con IF |
| Sin autenticación / sin permiso | 401 / 403 | Validación previa |
| No existe el recurso | 404 | Según el resultado de la búsqueda |
| Duplicado o conflicto | 409 | Lógica |
| Falla interna | 500 | Salida de error |
| Falló o tardó el servicio externo | 502 / 504 | Salida de error del nodo HTTP |
Los 4xx se deciden antes de trabajar; los 5xx salen de las salidas de error. Clasifica errores con un Switch y respuestas fijas por código, con salida de respaldo. Cuerpo: `{ "error": "codigo", "message": "texto" }`. Nunca devuelvas trazas, SQL, tokens ni respuestas crudas del proveedor: regístralos en privado.

## Flujo de errores (red de seguridad)
Un flujo aparte que empieza con "Error Trigger" atrapa lo que se escapa: nodos sin conectar, caídas entre nodos, tiempos agotados. Alerta mínima: nombre del flujo, liga a la ejecución fallida, nodo que falló y el mensaje real del error.
- Notifica por un canal distinto al que vigilan tus flujos y deja un registro de respaldo (tabla), por si el canal también cayó.
- Si conectas una salida de error a un nodo que no hace nada, n8n lo da por manejado y el flujo de errores no se dispara.
- Asignar el flujo de errores es un ajuste de cada flujo en la interfaz (Settings → Error Workflow): indícale al humano el paso exacto.

## Qué entregar
Por cada nodo que puede fallar: reintentos, salida de error y destino. Tabla de códigos de respuesta, prueba de idempotencia (qué pasa al repetir), flujo de errores asignado y responsable de atender la alerta.

## Errores comunes
- Capturar el error en un Code y devolverlo como dato normal: el flujo sigue con datos rotos.
- Un solo 500 para todo: no se distingue el error del cliente de tu caída.
- Ramas de error que responden 200.
- Confiar en una ejecución verde: revisa los valores de salida, un `null` inesperado es la señal.
