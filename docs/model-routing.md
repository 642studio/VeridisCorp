# Selección de modelos en la oficina Veridis

Fecha: 2026-10-22. Estado: implementada y verificada con invocaciones simuladas; llamadas reales a proveedores pendientes.

## Identidad, tarea y modelo

El agente define responsabilidades y permisos; el modelo es un recurso seleccionado para una intervención. El mismo agente puede usar distintos modelos según la capacidad requerida por la tarea y la etapa del workflow. La elección se hace con reglas explícitas, no a partir de los nombres comerciales de los modelos ni de una estimación automática de dificultad.

Ejemplo de la política incluida:

| Agente / etapa | Capacidad de la tarea | Perfil |
| --- | --- | --- |
| CEO, coordinación | `company.strategy` | `reasoning` |
| CTO, CFO, PM y RH, planificación | `department.plan` | `reasoning` |
| CM, planificación | `department.plan` | `routine` |
| Desarrollo, ejecución | `software.design` | `reasoning` |
| Desarrollo, ejecución | `software.implement` | `code` |
| Desarrollo, ejecución | `software.document` | `routine` |
| Investigación, ejecución | `news.research` | `research` |
| Investigación, ejecución | `news.summarize` | `routine` |
| Revisor | Cualquier capacidad | `reasoning` |

Los nombres de perfil expresan una intención del operador; no demuestran que un modelo sea más barato, rápido o preciso. Los identificadores reales y su disponibilidad los configura el operador según sus cuentas. Cambiar un modelo no concede herramientas nuevas: investigación sigue sin navegador y desarrollo sigue sin ejecutar código en esta etapa.

## Prioridad de selección

1. Regla para la etapa, el agente y la capacidad exactos.
2. Regla para la etapa y la capacidad, sin agente específico.
3. Perfil de ese agente para la etapa.
4. Perfil general de la etapa (`coordinate`, `execute` o `review`).
5. Perfil general de la oficina.

El orden en el archivo no permite que una regla general oculte otra más específica. Se rechazan selectores duplicados y referencias a perfiles inexistentes. La revisión selecciona por identidad del revisor y capacidad de la tarea revisada, no por la identidad del autor del resultado. La coordinación usa `ceo` según el organigrama; `coordinator` queda como identidad de compatibilidad para registros sin organización. Los responsables de departamento se seleccionan por su identidad y `department.plan` en la etapa `coordinate`.

## Configuración

`config/models.example.json` es una plantilla completa. Copia ese archivo, adapta los perfiles y asigna su ruta a `VERIDIS_MODELS_FILE` en `.env`. La ruta relativa se resuelve respecto del directorio donde se inicia el proceso.

Cada perfil define `provider`, el nombre de la variable de credencial en `apiKeyEnv` y un identificador literal `model` o una variable `modelEnv`, exclusivamente uno de los dos. También permite `maxOutputTokens`, `timeoutMs` y `maxRetries`. Los modelos referenciados mediante variables deben estar definidos al cargar la política; las credenciales se exigen cuando se instancia el proveedor elegido.

La plantilla utiliza estas variables:

```dotenv
VERIDIS_MODELS_FILE=config/models.example.json
VERIDIS_MODEL_ROUTINE=
VERIDIS_MODEL_REASONING=
VERIDIS_MODEL_RESEARCH=
VERIDIS_MODEL_CODE=
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
GOOGLE_API_KEY=
```

Completa cada modelo con un identificador real con soporte de salida estructurada. Elimina los perfiles que no necesites y ajusta sus referencias. No escribas valores de claves en el JSON. Para revisar la política pública resuelta sin llamar modelos ni conectar PostgreSQL:

```bash
npm run office:models
```

Si `VERIDIS_MODELS_FILE` no está definido, la oficina conserva compatibilidad con `OPENAI_MODEL` y `OPENAI_API_KEY`, usando un perfil único. La configuración nueva solo se aplica a los comandos `office:*`; el flujo secuencial inicial mantiene su adaptador anterior.

## Adaptadores

- `openai`: `ChatOpenAI`. Permite `baseURL` para un endpoint compatible, incluido uno local que implemente los contratos necesarios. Se usa una variable de clave explícita incluso si el endpoint exige solo un valor de autenticación de prueba. No se asume compatibilidad completa de todos los servidores locales.
- `anthropic`: `ChatAnthropic` con clave de la variable configurada.
- `google`: `ChatGoogle` del paquete `@langchain/google/node`, con plataforma Google AI y clave de la variable configurada. No incluye configuración de Vertex/ADC.

El timeout se aplica con una señal de cancelación por invocación. Los límites de salida y reintentos se pasan al cliente correspondiente. Cada perfil debe usar un modelo que acepte los esquemas estructurados del sistema; la validez de la respuesta se vuelve a comprobar localmente. Elegir un proveedor no garantiza que todos sus modelos o endpoints soporten el contrato.

No hay cambio automático a un proveedor alternativo. Un error queda en el nodo pendiente para continuar explícitamente. Así no se cambia de proveedor ni de destino de datos por un fallback implícito. El enrutamiento por confidencialidad, tamaño de contexto, complejidad, precio medido y presupuestos monetarios es trabajo posterior.

## Checkpoints y registro

El runtime guarda la huella de la política resuelta junto con la configuración del workflow. Incluye proveedores, modelos, parámetros y nombres de variables de credenciales, pero no sus valores. Si cambia la política, rechaza reanudar el mismo trabajo hasta disponer de una migración explícita. Los checkpoints del adaptador anterior sin esta huella también requieren migración. Una rotación de clave que conserve el nombre de variable no altera la huella; reinicia el proceso para renovar los clientes que ya estén en caché.

`modelCalls` conserva etapa, agente, capacidad, perfil, proveedor y modelo de las invocaciones completadas y registradas por el nodo. No incluye valores de claves ni constituye un registro contable de todos los intentos. Una llamada fallida o cuyo resultado no llegó a guardarse puede repetirse; los reintentos internos no aparecen como entradas independientes. No hay todavía conteo de tokens ni cálculo de costo por llamada.

## Pruebas y límites

Las pruebas cubren prioridad entre reglas, múltiples proveedores, un mismo agente con capacidades distintas, configuración inválida, creación de clientes sin llamadas, recorrido de la oficina con un invocador simulado y rechazo de cambios de política al reanudar. Los modelos de prueba `test-*` son ficticios.

No se probaron respuestas reales de OpenAI, Anthropic, Google o endpoints locales. La verificación de PostgreSQL sigue pendiente de una base dedicada. Antes de producción hay que validar los modelos elegidos con los esquemas reales y casos representativos, medir consumo y definir versiones de prompts y políticas de acceso a datos por proveedor.

## Referencias

- [LangChain: ChatAnthropic](https://docs.langchain.com/oss/javascript/integrations/chat/anthropic)
- [LangChain: ChatGoogle](https://docs.langchain.com/oss/javascript/integrations/chat/google)
- [OpenAI: salidas estructuradas](https://developers.openai.com/api/docs/guides/structured-outputs)
