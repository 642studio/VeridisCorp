# Selección de modelos en la oficina Veridis

Fecha original: 2026-10-22. Actualizado: 2026-10-24. Estado: implementada, con llamadas reales a proveedores (OpenAI, Anthropic, DeepSeek, Gemini) verificadas en vivo desde que `office/` corre con `VERIDIS_OFFICE_ENABLED=true` — ya no es solo simulación, ver [office-architecture.md](office-architecture.md).

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

## Política activa OpenAI y DeepSeek

Configurada el 2026-10-22 en `config/models.active.json`, seleccionada mediante `VERIDIS_MODELS_FILE` en el entorno local. La asignación inicial combina versiones y tipo de tarea; no es un ranking universal de calidad.

| Perfil | Modelo configurado | Uso inicial |
| --- | --- | --- |
| routine | deepseek-flash | Borradores, contenido y documentación sencilla; thinking deshabilitado |
| analysis | deepseek-v4-pro | Investigación, análisis de datos y financiero; thinking habilitado |
| review | gpt-5.4-mini-2026-03-17 | Revisión habitual y coordinación de proyectos; esfuerzo none |
| complex | gpt-5.4-2026-03-05 | Dirección, arquitectura, implementación y revisión de mayor riesgo; esfuerzo medium |

Las versiones de OpenAI quedan fijadas por snapshot. DeepSeek expone los nombres anteriores como identificadores del catálogo, por lo que no se presume que sus implementaciones internas sean inmutables. Las actualizaciones deben pasar las evaluaciones antes de cambiar los selectores locales.

Las reglas específicas de capacidad preceden al perfil del agente: Desarrollo implementa con complex y documenta con routine. Las revisiones de inversión, presupuesto, seguridad y diseño técnico usan complex. Los agentes sin excepción explícita heredan la etapa configurada. Esto selecciona modelos; no activa agentes, herramientas ni permisos.

DeepSeek usa el adaptador compatible con OpenAI, con `DEEPSEEK_API_KEY` y su propio endpoint. En el piloto su consumo se etiqueta como deepseek. Se configura JSON Mode y se envía el esquema en el prompt; Ajv y Zod siguen validando la salida localmente. No se confunde JSON válido con cumplimiento semántico. OpenAI utiliza salida estructurada JSON Schema.

### Validación real del piloto

Se verificó acceso al catálogo de los cuatro modelos. Se hicieron dos recorridos breves con DeepSeek Flash para generación y GPT-5.4 Mini para revisión, sobre PostgreSQL temporal y API gobernada. El primer contenido incumplió el formato y fue rechazado. Después de precisar que el campo text debe contener solo el entregable, el segundo recorrido produjo una pieza aceptada y quedó awaiting_approval. No se aprobó ni publicó contenido.

La segunda prueba registró 338 tokens de entrada y 26 de salida en DeepSeek, y 277 de entrada y 57 de salida en OpenAI. Son datos del proveedor de esa ejecución; no un benchmark ni un costo financiero calculado. Los perfiles analysis y complex tienen disponibilidad de catálogo confirmada, pero no se ejecutaron en esta prueba.

Para repetir explícitamente una prueba con consumo real:

```bash
npm run runtime:smoke:live
```

Esta orden crea una base temporal, utiliza únicamente un brief sintético y limita la ejecución a dos llamadas de modelo y cero herramientas. No usa la base operativa ni ejecuta publicaciones. Las pruebas habituales `npm run test:postgres` conservan sus modelos simulados y no consumen saldo de proveedores.

Referencias oficiales consultadas: [GPT-5.4 Mini](https://developers.openai.com/api/docs/models/gpt-5.4-mini), [GPT-5.4](https://developers.openai.com/api/docs/models/gpt-5.4), [modelos DeepSeek](https://api-docs.deepseek.com/quick_start/pricing/), [JSON Output de DeepSeek](https://api-docs.deepseek.com/guides/json_mode/).

## Perfil local de código con Ollama

Se añadió `local-code` a la política activa para `huihui_ai/qwen3-coder-abliterated:30b`. Se comprobó que Ollama responde en `127.0.0.1:11434` y que el modelo instalado tiene 30.5B parámetros y cuantización Q4_K_M.

- Implementación de `development`, `backend` y `frontend`: local-code.
- Diseño de arquitectura: complex, conservando GPT-5.4.
- Documentación sencilla: routine, conservando DeepSeek Flash.
- Revisiones: mantienen review o complex según la capacidad, con independencia del autor.

El perfil utiliza `http://127.0.0.1:11434/v1`, JSON Schema, cero reintentos y timeout de 120 segundos. `OLLAMA_MODEL` conserva el nombre exacto del modelo. `OLLAMA_API_KEY=ollama` es un valor de compatibilidad del SDK, no una credencial de OpenAI; el servidor local lo ignora según la [documentación oficial de Ollama](https://docs.ollama.com/api/openai-compatibility). Nunca se envía una clave real de otro proveedor a ese endpoint.

Se realizó una prueba de integración del adaptador local con el mismo selector y cliente de salidas estructuradas de VeridisCorp. Generó `function sumar(a, b) { return a + b; }` y una explicación en JSON validado por Zod, en 14.477 segundos. No se ejecutó el código generado ni se utilizaron proveedores externos. Es una prueba pequeña de compatibilidad, no una evaluación de calidad en proyectos completos.

La política prepara los encargos de código del motor de oficina; el pipeline HTTP actual sigue siendo de contenido y no constituye todavía una ruta de desarrollo de software. La ejecución de código generado necesita un entorno aislado separado. La disponibilidad del portátil no modifica los permisos ni habilita una sustitución automática por modelos cloud. Si el runtime se despliega en Linux, 127.0.0.1 apunta a esa máquina: habrá que instalar el modelo allí o configurar explícitamente una conexión autorizada antes de activar ese perfil en el servidor.

## Validación en vivo de la oficina con varios agentes reales

Fecha: 2026-10-23. `npm run office:smoke:live` (`scripts/live-office-smoke.ts`) corre el escenario `company-demo` con `createOfficeIntelligence()` real en vez de la simulación — MemorySaver, sin PostgreSQL, acotado por `VERIDIS_OFFICE_SMOKE_MAX_TURNS` (sin tope de dólares propio; a diferencia de `runtime/`, `office/` solo limita por turnos y decisiones rechazadas). Nunca corre en `npm test`.

La primera corrida real encontró y corrigió tres fallas reales que la simulación nunca hubiera revelado:

1. **OpenAI rechaza uniones discriminadas en modo `jsonSchema` estricto.** `CoordinatorDecision` y `WorkerReply` son `z.discriminatedUnion`; el modo nativo de salida estructurada de OpenAI no admite `oneOf` anidado en una propiedad. Se cambió `structuredOutputMethod` de los perfiles `review` y `complex` a `functionCalling` en `config/models.active.json`, que no tiene esa restricción.
2. **El modelo anida mal `delegate`/`dispatch`/`review`/`ask_user` dentro de `command`.** Con `functionCalling` el modelo deja de tener el esquema forzado estrictamente y repitió este error real varias veces. `src/office/intelligence.ts` ahora corrige ese anidado concreto antes de validar (nunca acepta una forma que el esquema no aceptaría igual) y el prompt del coordinador explica la distinción explícitamente.
3. **Una respuesta real con forma inválida tumbaba toda la ejecución.** Los nodos `coordinate`, `execute`, `review` y `delegate` en `src/office/workflow.ts` no atrapaban errores de `intelligence.*()`; una salida real que no se pudiera parsear crasheaba `graph.invoke()` entero en vez de tratarse como una decisión rechazada (el mismo límite de `maxRejectedDecisions` que ya aplicaba a violaciones de reglas de negocio). Se corrigió, distinguiendo por tipo de error: solo `ZodError` o `OutputParserException` de LangChain se tratan como forma inválida y se reintentan; cualquier otro error (p. ej. el proceso muriendo a mitad de una llamada) sigue propagándose sin tocarlo, para no interferir con la recuperación por checkpoint.

Con las tres correcciones, una corrida real completó un ciclo delegate → dispatch → execute → review dos veces (dos tareas `completed` con revisión real), toleró un fallo de forma real de un especialista sin caerse, y terminó con el CEO pidiendo información al humano (`ask_user`) de forma coherente al quedar bloqueado — una interrupción real, no un error. Participaron cinco agentes reales distintos con llamadas efectivas: `ceo`, `pm`, `project-planner`, `project-tracker`, `review`. No se verificó el camino completo de `ask_user` → `Command({resume})` con IA real en esta corrida (sí está cubierto con proveedor simulado en `test/office-workflow.test.ts`).

## Reordenamiento de costo y reserva del modelo sin censura

Fecha: 2026-10-23. Tres cambios a la política activa, cada uno con una razón de negocio distinta, no solo de costo:

1. **`uncensored` (antes `local-code`) queda reservado a ciberseguridad.** El perfil de Ollama ya no se usa para `software.implement`/`.backend`/`.frontend`; ahora responde solo a `security.audit`, `.appsec`, `.incident`, `.defense`, `.governance` y `.access`, en `execute` y `review`. La razón: contenido técnico de seguridad (detalles de explotación, análisis de incidentes) puede chocar con los filtros de seguridad de un modelo comercial, y mantenerlo en un modelo local además evita mandar ese contenido a un proveedor externo. Verificado en vivo: una tarea de inyección SQL se ejecutó (`security-appsec`) y revisó (`security-review`) completa en `huihui_ai/qwen3-coder-abliterated:30b`, visible en `modelCalls`.
2. **Desarrollo de software se movió a un perfil nuevo, `deepseek-code`** (DeepSeek Flash, `maxOutputTokens` ampliado a 4000 para implementaciones largas) — deja de ser gratis/local y pasa a ser de pago, el costo explícito de liberar Ollama para seguridad.
3. **Coordinación departamental bajó de `complex` (GPT-5.4 completo) a `analysis` (DeepSeek-v4-pro con razonamiento)** para `cto`, `cfo`, `quality-lead`, `software-lead`, `infrastructure-lead` y `ciso`. El CEO (`ceo`) es el único que conserva `complex`: es quien resuelve conflictos entre áreas y decide a nivel de toda la empresa: el resto es coordinación de un solo departamento.

Se intentó además un piloto de diversidad real de proveedor: `cmo` en un perfil nuevo `gemini-flash` (Gemini 3.8 Flash), para no depender solo de OpenAI/DeepSeek. No se pudo verificar en vivo — la cuota gratis de Gemini (ver sección de `web.search`, 20 solicitudes/día sin facturación habilitada) ya estaba agotada por las pruebas de esa misma sesión, y un reintento posterior devolvió primero `503 UNAVAILABLE` y después la cuota agotada de nuevo. `cmo` quedó en `analysis` mientras tanto; el perfil `gemini-flash` sigue definido en `config/models.active.json`, sin usar, listo para asignarse en cuanto haya facturación.
