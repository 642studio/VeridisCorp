> Adaptado de anthropics/skills (Anthropic, Apache-2.0): mcp-builder.

# Diseñar herramientas y servidores MCP

Un servidor MCP vale lo que permite a un modelo terminar tareas reales. VeridisCorp ya consume MCP (`src/office/mcp-tools.ts`); esto aplica cuando 642 construya los suyos (642API, ClickUp, n8n u otro servicio).

## Antes de empezar
Busca primero en la memoria corporativa y en el repo; pide lo que falte y márcalo FALTANTE:
- 5–10 encargos reales que los agentes harán con el servidor.
- Documentación del servicio: endpoints, autenticación, modelos de datos, límites de uso.
- Dónde correrá (servidor Linux de oficina, local o remoto) y quién lo expone con TLS (network, devops).

## Cómo lo usa VeridisCorp
- Un agente solo conecta servidores **https públicos**; la LAN o Tailscale los conecta un humano.
- Cada herramienta llega **apagada** hasta que un humano la activa.
- Se clasifica por anotaciones: `readOnlyHint: true` → lectura; `readOnlyHint: false` o `destructiveHint: true` → escritura; sin anotación → desconocida. El revisor (`mcp.use.readonly`) solo llama las de lectura: declara `readOnlyHint` siempre.
- Las anotaciones son pistas, no seguridad: los permisos los hace cumplir el servidor.

## Cobertura contra flujos
Ante la duda, cubre bien la API (operaciones básicas que el agente combina). Agrega herramientas de flujo solo para tareas frecuentes de varios pasos. Para escritura, prefiere operaciones que dejen un **borrador** que un humano aprueba (crear borrador, no publicar).

## Nombres
- snake_case, prefijo de servicio y verbo primero: `erp642_buscar_clientes`, `erp642_crear_borrador_factura`. El prefijo evita choques con otros servidores conectados. Un solo idioma en todo el servidor.
- Servidor en TypeScript: `<servicio>-mcp-server`, sin versión en el nombre.

## Descripciones y esquemas
- La descripción es lo único que el modelo lee para decidir: qué hace, qué devuelve, cuándo usar una herramienta hermana, uno o dos ejemplos. Debe coincidir exactamente con lo que hace.
- Cada argumento con `.describe()` en Zod: restricciones, formato y ejemplo ("RFC de 12 o 13 caracteres").
- `title`, `inputSchema`, anotaciones y, donde se pueda, `outputSchema` con `structuredContent`.
- Herramientas enfocadas y atómicas.

## Formato de respuesta
- Parámetro `response_format`: `markdown` (por defecto, legible) o `json` (completo, campos y tipos consistentes).
- En markdown: fechas legibles en la zona del negocio (Sonora: `America/Hermosillo`), nombre con id entre paréntesis, montos con moneda (MXN), sin metadatos de relleno.

## Paginación y tamaño
- Respeta `limit`; por defecto 20–50 elementos. Nunca cargues todo en memoria.
- Devuelve `total`, `count`, `offset`, `has_more` y `next_offset` (o cursor).
- Tope de caracteres por respuesta (25,000 como referencia general). Se respeta devolviendo **menos elementos**, nunca cortando texto; `next_offset` apunta al primero que quedó fuera.

## Errores accionables
- Errores de la herramienta dentro del resultado (`isError: true`), no como error de protocolo.
- Di qué falló y qué hacer: "Más de 500 resultados; filtra por `estado` o por rango de fechas."
- Sin trazas ni detalles internos hacia el cliente; regístralos en el servidor. Libera recursos al fallar.

## Transporte y seguridad
- **stdio** para uso local de un solo cliente; nunca escribas logs a stdout (usa stderr).
- **HTTP transmitible** para remoto y varios clientes, preferible sin estado con JSON. SSE está en desuso.
- HTTP local: escucha en `127.0.0.1`, no en `0.0.0.0`, y valida el encabezado `Origin`.
- Credenciales en variables de entorno, nunca en código, `config.json` ni checkpoints; valídalas al arrancar con un error claro.
- Con OAuth, acepta solo tokens emitidos para este servidor.
- Valida todo con Zod: rutas (sin `../`), URLs, tamaños y rangos; nada de concatenar entrada en comandos del sistema.

## SDK
TypeScript. El repo usa hoy `@modelcontextprotocol/sdk` (v1, cliente). La fuente indica que la v2 (`@modelcontextprotocol/server`) es la estable para servidores nuevos y que no se mezclan; confirma en la documentación oficial vigente antes de empezar.

## Probar
Compila (`npm run build`) y revisa con MCP Inspector en el sandbox. Prueba entradas válidas e inválidas, autenticación, límites y errores.

## Evaluaciones
10 preguntas que comprueben si un modelo logra tareas reales con el servidor:
- Independientes, de **solo lectura**, complejas (varias llamadas), realistas, con una respuesta única verificable por comparación de texto y estable en el tiempo.
- Proceso: lista las herramientas, explora datos con lecturas, redacta las preguntas y resuélvelas tú para confirmar la respuesta.
```xml
<evaluation>
  <qa_pair><question>…</question><answer>…</answer></qa_pair>
</evaluation>
```
Usa datos de prueba, nunca datos personales o fiscales reales de clientes.

## Qué entregas
Tabla de herramientas (nombre, descripción, entradas, salida, anotaciones, paginación), errores, transporte, autenticación y evaluaciones; implementación y pruebas en el sandbox. Desplegar, cargar credenciales, conectar y activar herramientas lo hace un humano.

## Errores comunes
- Envolver la API endpoint por endpoint sin pensar en los encargos.
- Omitir `readOnlyHint`: la herramienta queda "desconocida" y el revisor no la puede usar.
- Respuestas enormes sin paginar.
- Mensajes de error que no dicen cómo seguir.
