> Adaptado de n8n-skills (czlonkowski, MIT): n8n-workflow-patterns, n8n-subworkflows.

# Patrones de flujos en n8n

## Antes de empezar
Busca primero en la memoria corporativa: flujos existentes con nombre parecido, subflujos reutilizables, credenciales ya dadas de alta (solo su nombre, nunca el valor), zona horaria de la instancia y quién responde por cada sistema conectado. Pide lo que falte y márcalo FALTANTE: origen y destino de los datos, volumen esperado, qué pasa si el flujo corre dos veces, y el responsable humano de las excepciones. Tú diseñas y entregas el flujo propuesto; activarlo, conectar credenciales nuevas o tocar producción lo hace un humano.

## Elige el patrón antes de los nodos
| Patrón | Úsalo cuando | Forma |
|---|---|---|
| Webhook | Otro sistema te avisa al instante (formulario, pago, WhatsApp, ERP) | Webhook → validar → transformar → acción → responder |
| HTTP API | Tú consultas un servicio externo | Disparador → HTTP Request → transformar → acción → manejo de error |
| Base de datos | Sincronizar, ETL, limpieza en PostgreSQL | Cron → consulta → transformar → escribir → verificar |
| Agente IA | Razonar con herramientas y memoria | Disparador → AI Agent (modelo + herramientas + memoria) → salida |
| Programado | Reportes, respaldos, revisiones periódicas | Cron → obtener → procesar → entregar → registrar |
| Lotes | Muchos registros con límites de API | Preparar → Loop Over Items → procesar lote → acumular → agregar |

Empieza por el patrón más simple que resuelva el problema; no mezcles patrones sin fronteras claras (sepáralos en subflujos).

## Reglas por patrón
- **Webhook:** los datos llegan en `$json.body`. Autentica siempre (encabezado con secreto, firma HMAC sobre el cuerpo crudo o lista de IP) y solo por HTTPS. Valida campos antes de actuar.
- **HTTP API:** credenciales en el sistema de credenciales, nunca en parámetros ni URL. Usa la paginación del propio nodo antes que un bucle. Respeta límites de tasa (espera entre llamadas, encabezados de límite).
- **Base de datos:** consultas parametrizadas, nunca concatenar texto. `LIMIT` en toda lectura. Pasos múltiples dentro de una transacción. Usuario de base con mínimo privilegio. Escrituras con `UPSERT` por llave natural para que repetir no duplique. Una consulta sin resultados detiene la rama en silencio: activa "Always Output Data" si el flujo debe seguir.
- **Agente IA:** modelo, herramientas y memoria van en sus puertos `ai_*`, no en `main`. Si el agente lee contenido de terceros (web, correo, MCP) y además puede hacer algo irreversible, pon revisión humana o permisos de solo lectura entre ambos: es la puerta de la inyección de prompt.
- **Programado:** fija la zona horaria de la instancia o del flujo (Sonora: `America/Hermosillo`; verifica la configurada). Si la instancia está apagada a la hora programada, esa ejecución no ocurre: diseña el flujo para que correr dos veces dé el mismo resultado y, si es crítico, que detecte la corrida perdida. Evita ejecuciones encimadas con un candado (tabla o registro con caducidad).
- **Lotes:** la salida "done" dispara una sola vez al final; el cuerpo del bucle va en la otra salida. Usa el tamaño de lote más grande que permita la API; tamaño 1 solo si la API acepta un id a la vez. Fuera del bucle, `$('Nodo').all()` solo trae el último lote: acumula explícitamente.

## Cuándo crear un subflujo
Extrae cuando la lógica servirá en otro flujo, es genérica (autenticar, reintentar, formatear, generar folios) o pasa de 5 nodos con un solo propósito. No extraigas una sola llamada HTTP sin lógica. Contrato:
- Busca antes de construir; nombre con verbo y dominio ("Cliente: obtener por id", "Notificar: responsable").
- Disparador con entradas tipadas ("Define Below"), no passthrough, salvo archivos binarios o cero entradas.
- Documenta entradas y salidas en la descripción. Termina con un nodo "Return" que fija la forma de salida.
- Errores esperados se devuelven como `{ ok: false, error }`; los inesperados se lanzan.
- Si escribe estado, dilo en el nombre y la descripción: quien lo llama necesita saber si es seguro reintentar.
- Renombrar una entrada rompe a los que llaman sin ningún error visible: migra a todos en el mismo cambio.

## Ciclo antes de activar
1. Validar la estructura. 2. Revisar a mano las conexiones (validar no prueba que estén bien conectadas). 3. Probar con datos de prueba: las pruebas disparan efectos reales (correos, escrituras), pide permiso si los hay. 4. Activar solo después, y vigilar las primeras ejecuciones. "Valida sin errores" no significa "hace lo correcto".

## Qué entregar
Diagrama en texto del flujo, tabla de nodos (nombre, función, entradas, salidas), credenciales requeridas por nombre, manejo de errores, qué pasa al repetir, datos de prueba, criterios verificables para el revisor y el responsable humano de las excepciones.

## Errores comunes
- Leer `$json.email` en lugar de `$json.body.email` en un webhook.
- Nodos Code para lo que hace un nodo nativo (Filter, IF, Merge, Summarize, Remove Duplicates); úsalo solo con una nota "Por qué Code".
- Escribir en Google Sheets con "append" sobre hojas con fórmulas, o mandar números como texto.
- Activar un flujo sin manejo de errores ni responsable.
