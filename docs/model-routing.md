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

## Perfil local general para especialistas sin herramientas reales

Fecha: 2026-10-24. El usuario planteó usar en el servidor de oficina (Linux, `huihui_ai/qwen3-abliterated:8b` ya instalado en el VPS) un modelo local para el primer agente que atiende, coordinador o chat. Se desaconsejó ambas opciones: el coordinador decide `command`/`dispatch`/`review`/`ask_user`/`delegate` en cada turno de cada expediente — es el nodo de mayor frecuencia y mayor impacto si se equivoca de forma, y ya está en `complex`/`analysis` por esa razón (ver secciones anteriores). "El agente que atiende el chat" no es un rol propio en `office/`: el chat ASISTENTE pasa por el mismo CEO coordinador, no por un agente aparte. Se propuso en cambio un perfil nuevo, de propósito general, para agentes `specialist` sin ninguna herramienta real (`allowedTools` vacío) — el usuario aprobó esta alternativa explícitamente.

Se añadió `local-general` a `config/models.active.json`, mismo molde que `uncensored` (`http://127.0.0.1:11434/v1`, JSON Schema, cero reintentos, timeout de 120s), apuntando a la variable nueva `OLLAMA_GENERAL_MODEL`. Se clasificaron los 56 perfiles por `organization.level` y por conteo de herramientas reales (`agents/*/config.json`) y se asignó `execute: "local-general"` a los 14 agentes `specialist` con cero herramientas de `SIDE_EFFECTING_TOOLS` o de solo lectura asignadas: `automation`, `campaigns`, `continuity`, `creative-strategy`, `data-engineer`, `devops`, `network`, `onboarding`, `operations`, `people-development`, `procurement`, `recruiting`, `social-analyst`, `workforce`. Quedaron fuera a propósito:

- **Ejecutivos y heads** (`ceo`, `cto`, `cfo`, `cmo`, `coo`, `pm`, `hr`, `cm`, `research-lead`, `quality-lead`, `ciso`, `software-lead`, `infrastructure-lead`, `data-lead`): su trabajo principal es `coordinate()`/`delegate()`, no `execute()` directo — el perfil local-general solo se enruta a la etapa `execute`.
- **Todos los revisores** (`review`, `security-review`, `finance-review`): el mecanismo de seguridad de `review()` depende de que el revisor sea independiente y confiable; degradarlo a un modelo local de 8B debilitaría justo el control que atrapa errores de los demás perfiles, local-general incluido.
- **Especialistas con herramientas reales** (`content`, `research`, `investment-research`, `data-analyst`, `finance-budget`): quedan en `analysis` o arriba — ver siguiente punto.

Dos subidas de tier en la misma política, por la razón inversa (más riesgo, no menos costo):

1. **`content.execute` subió de `routine` (DeepSeek Flash) a `analysis` (DeepSeek-v4-pro)**. Es el agente con más herramientas de efecto real de todo el catálogo — siete: `pdf.generate`, `email.draft`, `drive.upload`, `calendar.create_event`, `sheets.create`, `meet.create_space`, `slides.create`. `calendar.create_event` en particular notifica a invitados reales de inmediato (`sendUpdates: 'all'`, decisión explícita del usuario documentada en `assistant-v1-roadmap.md`) sin revisión humana previa — no es el lugar para ahorrar con el modelo más barato de la política.
2. **`research.execute` pasó de heredar el default de etapa (`routine`) a `analysis`** por el mismo criterio de capacidad real: `news.research`/`news.summarize` (verificado contra `agents/research/config.json`) alimentan directamente lo que `content` termina publicando o enviando.

Nota de honestidad: los parámetros/cuantización exactos de `huihui_ai/qwen3-abliterated:8b` no se verificaron en vivo desde este Mac — `curl http://127.0.0.1:11434/api/tags` no responde aquí porque Ollama corre en el VPS de oficina, no en este portátil. A diferencia de la verificación de `local-code` (30.5B, Q4_K_M, confirmada en vivo en la sección anterior), esta asignación se basa en la descripción que dio el usuario del modelo ya instalado en el servidor, pendiente de confirmar en vivo cuando el runtime corra ahí.

`test/models.test.ts` cubre: `content`/`research` en `analysis`, `workforce` (capacidad real `people.capacity`) en `local-general`, y que `router.profile('local-general').model`/`.baseURL` resuelven desde `OLLAMA_GENERAL_MODEL`/el `baseURL` fijo del perfil.

## 2026-11-01: campañas, creatividad, analítica social y automatización salen de `local-general`

Al darles knowledge de su oficio (planes de campaña, flujos de n8n), su salida dejó de caber en `local-general`
(tope de 2,000 tokens). Probado en vivo con los mismos encargos:

- `campaigns` con `local-general`: un resumen de 1,300 caracteres sin calendario ni ganchos; el revisor lo rechazó tres veces.
- `automation` con `local-general`: el modelo local no respondió a tiempo.
- Con `routine` (DeepSeek Flash), tope de 8,000 tokens y 90 s: los dos se completaron y el revisor aceptó todos los
  criterios ($0.12 y $0.15 por expediente). Con el tope anterior de 4,000, la corrección del flujo de n8n se cortó.

Cambios: `campaigns`, `creative-strategy`, `social-analyst` y `automation` ejecutan con `routine`, y `routine` sube a
`maxOutputTokens` 8,000 y `timeoutMs` 90,000 (afecta a todos los que lo usan; una respuesta más larga cuesta más
tokens solo cuando hace falta). Los otros 10 especialistas siguen en `local-general`.

## 2026-11-03: Claude entra al roster, con dos cuentas separadas

Dos perfiles nuevos en `config/models.active.json`, adaptador `anthropic` (ya implementado en
`src/office/model-providers.ts` desde el diseño original de `ModelRouter`, solo no se había usado
en la política activa):

- **`claude-reasoning`** (`CLAUDE_API_KEY` / `CLAUDE_MODEL`, propuesto `claude-opus-5-5`): sustituye a
  `complex` en `agents.ceo.coordinate`. El CEO es el único nodo que arbitra entre todas las áreas y el
  de mayor impacto por decisión, pero de bajo volumen — justifica el modelo de mayor razonamiento
  disponible, y diversificar su proveedor evita que el nodo de coordinación de más alto riesgo
  comparta el mismo punto de falla (OpenAI) que casi todo el resto de la política.
- **`claude-review`** (`CLAUDE_API_KEY_2` / `CLAUDE_MODEL_2`, propuesto `claude-haiku-5-5`): sustituye a
  `review` en `agents.review.review` — la etapa `review` del agente genérico de revisión, por el que
  pasa la mayoría de las tareas de la empresa que no tienen un revisor especializado propio
  (`finance-review`, `security-review`, etc., que mantienen sus perfiles existentes sin cambio).
  Modelo económico a propósito por el volumen. La independencia del revisor es un control de
  seguridad explícito (ver más arriba, sección de `local-general`): que la revisión general corra en
  un proveedor distinto al de la mayoría de los autores aumenta esa independencia en todo el sistema,
  no solo en un departamento.

Dos claves distintas, no una sola repartida por código: así el consumo de cada una queda separado en
`byApiKeyEnv` (`src/office/usage.ts`), y una cuota agotada en una no bloquea a la otra.

Pendiente antes de dar esto por verificado: completar `CLAUDE_API_KEY_2` en el `.env` del servidor,
reiniciar el proceso (el router se cachea una sola vez al arrancar, ver `OfficeRuntime.router()` y
`createOfficeIntelligence()`), confirmar con `npm run office:models` que la política resuelve sin
error, y correr al menos una tarea real de `ceo` y una revisión real por `review` para verificar
respuesta y conteo de tokens de Anthropic en vivo — igual que se hizo con los demás proveedores en
las secciones anteriores. La asignación es un punto de partida, no un benchmark; se ajusta con los
mismos criterios de costo/riesgo que las secciones previas en cuanto haya datos reales de uso.

## 2026-11-08: Hardware real de `veridis-oficina` confirmado por SSH — corrige los modelos locales descritos arriba

Fecha: 2026-11-08. Motivo: evaluar si convenía sumar un modelo de NVIDIA (familia Nemotron) a `local-general`. Al conectar por SSH a `veridis-oficina`, el hardware y los modelos realmente configurados no coinciden con lo que describen las secciones anteriores de este documento.

**Hardware real:**
- CPU: AMD FX-6300, 6 núcleos (arquitectura Piledriver, ~2012). Ollama carga el backend `libggml-cpu-piledriver.so`.
- GPU: sí hay una — AMD Radeon RX 570 (driver `amdgpu`, cómputo vía Vulkan/Mesa `RADV POLARIS10`). `nvidia-smi` no la detecta porque es AMD, no NVIDIA; no es una falla de configuración. Confirmado en `journalctl -u ollama` que Ollama la usa y vuelca el 100% de las capas de ambos modelos instalados a la GPU (`offloaded 13/13` en el de 4B, `37/37` en el de 8B). No tiene ROCm instalado, y tampoco aplicaría bien: las versiones recientes de ROCm dejaron de soportar Polaris. `lspci` identifica el modelo por subsistema como "Pulse 4GB", pero la consulta directa de Ollama a la tarjeta en runtime reporta 8192 MiB de VRAM — tomo el dato de Ollama como más confiable por venir de una consulta directa al dispositivo, pero la cifra exacta de VRAM queda sin resolver del todo.
- RAM: 7.7 GiB totales, con margen muy ajustado al momento de revisar (192 MiB libres, ~3.3 GiB "available" contando cache reutilizable); swap de 4 GiB con 1.5 GiB en uso.

**Modelos realmente configurados hoy** (confirmado en `/home/seis/VeridisCorp/.env` y `ollama list` en el propio servidor; no coincide con lo descrito en las secciones de arriba de este mismo documento):
- `OLLAMA_MODEL=huihui_ai/qwen3-abliterated:8b` para el perfil `uncensored` — no `qwen3-coder-abliterated:30b`, como dice la sección "Perfil local de código con Ollama" más arriba.
- `OLLAMA_GENERAL_MODEL=huihui_ai/qwen3-abliterated:4b` para `local-general` — no el 8B que se asumía en `competitive-strategy.md`.

No se determinó cuándo ni por qué cambió esta asignación entre el 2026-10-24 (última fecha confirmada de la sección anterior) y hoy. Es posible que el modelo de 30B se haya probado en otro entorno, o que se haya reducido después por los límites reales de esta VPS: un 30B en Q4_K_M (~20GB) no cabe físicamente en 7.7GiB de RAM de sistema. Queda como discrepancia documentada, no resuelta — las secciones anteriores describen lo que se creía o se probó en su momento, no lo que hay instalado hoy.

**Conclusión sobre Nemotron (NVIDIA) para este servidor:** no conviene. El techo real es ~8GB de VRAM y ~7.7GB de RAM de sistema, ya casi sin margen — no la ausencia de GPU que se asumió al empezar a revisar esto. Eso descarta cualquier Nemotron mediano o grande (Lightning 30B-A3B, Bolt 74B-A9B, Super, Ultra) por el mismo motivo que descarta a Muse Spark Open de Meta: un MoE necesita todos sus expertos cargados en memoria aunque solo use una fracción por token, así que el tamaño total —no el de parámetros activos— es lo que importa para que quepa. El único candidato que entraría por tamaño es Nemotron 3 Nano 4B, mismo rango que el `qwen3-abliterated:4b` ya instalado, pero sin benchmarks confiables de coding/razonamiento encontrados y con el precedente ya documentado arriba (sección "2026-11-01") de que modelos de este tamaño no alcanzan para varios especialistas de `local-general`. La vía que ya funciona para lo que el local no sostiene sigue siendo delegar a la nube (`routine`/`analysis`).

## 2026-11-10: `OPENAI_API_KEY`, `DEEPSEEK_API_KEY` y `GEMINI_API_KEY` inválidas — perfiles gratis de Groq y OpenRouter como respaldo

Fecha: 2026-11-10. Motivo: se probó cada credencial de `.env` con una llamada mínima de solo lectura
(listar modelos, sin generación) y tres de las seis fallaron con 401:

- `OPENAI_API_KEY` → "Incorrect API key provided" (perfiles `review`, `complex`).
- `DEEPSEEK_API_KEY` → "Authentication Fails... invalid" (perfiles `routine`, `deepseek-code`, `analysis`).
- `GEMINI_API_KEY` → "API key not valid" (perfiles `gemini-flash`, `search-google`).

Sí respondieron: `claude-reasoning`/`claude-review` (200, 15 modelos cada una), Brave Search
(`web.search`, 200 con resultados reales), ClickUp (200, ya no usado por perfiles activos) y
Ollama local en este Mac (modelo de 30B ya cacheado de una prueba anterior). El efecto práctico es
mayor que solo esos tres perfiles: casi todos los jefes de departamento coordinan con `analysis`
o `review` (ver tabla de `agents` arriba), así que una credencial muerta corta la delegación del
CEO hacia cualquier área antes de llegar al especialista — no hay cambio automático de proveedor
(ver "Adaptadores" arriba), el nodo queda pendiente.

Mientras se resuelve la facturación real (la cuenta de OpenAI es Business — hay un beneficio de
créditos de API para Business/Pro elegibles, hasta 500 USD/mes, que hay que vincular aparte de
arreglar la llave), se agregaron dos perfiles nuevos a `config/models.active.json`, mismo molde que
DeepSeek/Ollama (adaptador `openai`, `baseURL` propia, `jsonMode`, cero reintentos):

- **`groq-free`**: `https://api.groq.com/openai/v1`, `GROQ_API_KEY`/`GROQ_MODEL`. Sin tarjeta;
  limita por modelo (del orden de decenas de miles de solicitudes/día según el catálogo vigente de
  Groq, no verificado todavía en vivo desde esta cuenta).
- **`openrouter-free`**: `https://openrouter.ai/api/v1`, `OPENROUTER_API_KEY`/`OPENROUTER_MODEL`.
  Sin tarjeta; 50 solicitudes/día hasta acumular 10 USD de compra histórica (sube a 1,000/día
  después). Los modelos con sufijo `:free` rotan sin aviso — confirmar el identificador vigente en
  el catálogo de OpenRouter antes de fijar `OPENROUTER_MODEL`, no asumir el de ninguna guía.

`platformOf()` (`src/office/models.ts`) distingue ahora `api.groq.com`→`groq` y
`openrouter.ai`→`openrouter` para que el desglose de consumo por plataforma no los confunda con
OpenAI real — mismo motivo que ya distinguía `api.deepseek.com` de `openai` puro.

Ninguno de los dos perfiles está asignado todavía a ningún agente ni etapa — quedan definidos y
sin usar, igual que `gemini-flash` arriba, hasta tener la llave y confirmar en vivo (`npm run
office:models`, luego una llamada real con esquema estructurado) qué modelo gratis responde bien
al formato que exige cada capacidad. Intentar crear cuenta en Groq dio `signup_blocked` sin causa
clara (reportado por otros usuarios en su foro de comunidad, sin resolución confirmada); se sigue
con OpenRouter mientras tanto.

Pendiente: llave(s) reales, `GROQ_MODEL`/`OPENROUTER_MODEL` con un identificador confirmado en el
catálogo vigente de cada proveedor, prueba de conectividad (listar modelos) y una llamada real con
salida estructurada antes de apuntar ninguna capacidad rota de `routine`/`analysis`/`review` hacia
estos perfiles.

### Validación real de `openrouter-free` (sin Groq — signup sigue bloqueado)

Fecha: 2026-11-10. Con `OPENROUTER_API_KEY` ya creada (cuenta gratis, sin tarjeta): `GET
/api/v1/models` devolvió 429 modelos, 13 con sufijo `:free`. De los que declaran soporte de
`response_format` (compatible con `jsonMode`), se filtró por tamaño/linaje razonable para tareas de
agente: `dots-studio/dots-3-note-preview`, `google/gemma-4-26b-a4b-it`, `google/gemma-4-31b-it`,
`liquid/lfm-2.5-2.6b`, `liquid/lfm-3-1.7b`, `nvidia/nemotron-3.5-super-vl`, `recursive/flint-v1.0`,
`xingchen-agi/xing4.0-29b-a4b`.

Se probó con el código real del motor (`ModelRouter` + `createStructuredInvoker` de
`model-providers.ts`, mismo perfil `openrouter-free` tal cual queda en `config/models.active.json`,
no un script aparte que simule el adaptador):

1. **`google/gemma-4-31b-it:free`** → `429 Provider returned error` ("temporarily rate-limited
   upstream", proveedor subyacente Google AI Studio, pool compartido gratis saturado en el
   momento). No es un problema de la llave ni del código — el mensaje de OpenRouter sugiere
   reintentar más tarde o fijar una llave propia del proveedor (BYOK) para no compartir el límite.
2. **`nvidia/nemotron-3.5-super-vl:free`** → 200 real, 7.5 s, salida JSON válida contra un esquema
   Zod de prueba (`resumen`, `pasos[]`), 152 tokens de entrada / 1040 de salida, costo real: 0.

`OPENROUTER_MODEL` queda en `nvidia/nemotron-3.5-super-vl:free`. Groq sigue sin cuenta
(`signup_blocked` persiste); ese perfil queda definido pero no probable hasta que el signup se
destrabe.

### Tarea real de `workforce` (`people.capacity`) con `openrouter-free`

Fecha: 2026-11-10. Prueba con una regla temporal (`execute`+`workforce`+`people.capacity` →
`openrouter-free`, no commiteada en `config/models.active.json`) y el motor real
(`createOfficeIntelligence().execute()`, instrucciones y knowledge reales de `agents/workforce/`,
sin mock de ningún tipo): objetivo "software-lead reporta que devops y data-engineer están
saturados esta semana; PM pregunta si hay margen para una tarea nueva de 6h antes del viernes",
sin ningún dato real de disponibilidad en el contexto — a propósito, para ver si el modelo
inventa cifras o pide apoyo, que es justo lo que prohíben las instrucciones del agente ("no
inventa empleados, disponibilidad ni evaluaciones").

Resultado: `{"type": "support", "capability": "people.capacity", "question": "..."}` — pidió
explícitamente horas disponibles, horas ya asignadas y ausencias previstas de ambos roles, sin
inventar ninguna cifra. Pasó `WorkerReply.parse()` sin ajuste. 20.2 s, 4,943 tokens de entrada /
1,161 de salida, costo real: 0.

Con esto, `openrouter-free` queda validado con una tarea real (no solo un smoke test genérico):
produce el contrato JSON exacto que exige el motor y respeta la instrucción de no inventar datos
bajo presión de un objetivo concreto.

### Dos pruebas reales más (coordinate y review) y asignación permanente

Fecha: 2026-11-10. Dos pruebas adicionales, mismo método (overrides temporales no commiteados,
motor real sin mock):

1. **`cto.coordinate`** (reemplazando `analysis`, muerto por `DEEPSEEK_API_KEY`): objetivo real
   ("¿migrar PostgreSQL local a una instancia dedicada antes de fin de mes?"), sin presupuesto ni
   especificaciones en el contexto. Resultado: `{"type": "ask_user", ...}` pidiendo uso de RAM,
   specs actuales, presupuesto y quién aprueba — la decisión prudente, no una inventada. 21.4 s,
   8,951/2,985 tokens. Esto importa porque `coordinate()` usa el mismo esquema de unión
   discriminada (`command`/`dispatch`/`review`/`ask_user`/`delegate`) para **cualquier** agente que
   coordine, no solo `cto` — una sola prueba cubre la forma que usan los nueve jefes de área.
2. **`review.review`** (capacidad `people.capacity`, independiente de `claude-review` que ya
   funciona): se le dio una entrega que AFIRMABA haber encontrado margen, respaldada solo por una
   evidencia irrelevante ("el equipo se ve motivado"). Resultado: `accepted: false`, con la
   explicación exacta de por qué esa evidencia no respalda el criterio. El revisor gratis no
   aprobó una afirmación sin sustento real.

**Decisión:** se repuntaron los perfiles `routine`, `analysis` y `review` de
`config/models.active.json` de DeepSeek/OpenAI (muertos) a `openrouter-free`
(`OPENROUTER_API_KEY`/`OPENROUTER_MODEL`, `jsonMode`), conservando sus propios `maxOutputTokens`/
`timeoutMs` por tier. Se quitó `thinkingMode`/`reasoningEffort` de esos tres: eran ajustes
específicos de DeepSeek/OpenAI sin equivalente documentado en OpenRouter, no un valor que tuviera
sentido adivinar para un proveedor distinto. Como ninguno de los tres sirve de revisor
*independiente* de otro autor en este mismo proveedor (el único revisor real de otro autor que
usaba `review` es el agente `review`, que ya corre en `claude-review`, Anthropic, sin tocar), no hay
conflicto con la independencia autor/revisor que exige la arquitectura.

**Deliberadamente sin tocar, por falta de prueba específica:**
- **`deepseek-code`** (implementación de software — `software.implement`/`.backend`/`.frontend`):
  ninguna de las pruebas de hoy ejecutó una tarea de código; generar JSON de negocio y generar
  código son habilidades distintas. Sigue en DeepSeek, roto, hasta probarlo aparte.
- **`complex`** (revisión de inversión y presupuesto, `finance.investment-research`/
  `finance.budget`): decisiones de dinero, mayor riesgo que lo probado hoy. Sigue en OpenAI, roto,
  hasta una prueba financiera específica.

`GROQ_MODEL` quedó en `.env` con el valor explícito `pending-groq-signup` (no un modelo real) solo
para que el router construya sin tumbar el arranque del servidor — `groq-free` sigue sin cuenta y
sin usar en ningún agente; seleccionarlo fallaría de inmediato contra la API real de Groq, nunca en
silencio.

Efecto práctico: con esto, los nueve jefes de área (`cto`, `cfo`, `cmo`, `research-lead`,
`quality-lead`, `ciso`, `software-lead`, `infrastructure-lead`, `data-lead` vía `analysis`; `coo`,
`pm`, `hr` vía `review`; `cm` vía `routine`) y los especialistas de contenido/investigación/
marketing que dependían de DeepSeek/OpenAI vuelven a tener un modelo real que responde, sin costo,
mientras se resuelven las llaves de pago.

### `deepseek-code` (`software.implement`) probado y descartado por ahora — no se asigna

Fecha: 2026-11-10. Misma metodología (override temporal no commiteado, motor real sin mock) con
`development`/`software.implement`: implementar `clampPercentage(value: number): number`
(recortar a [0,100], redondear a 2 decimales, NaN/no-numérico → 0), con criterio explícito de que
el código debe verificarse realmente en `code.sandbox`, no solo describirse.

Docker no estaba corriendo en esta Mac — se levantó para la prueba (`node:22-slim` ya estaba
descargado de un uso anterior); `runSandboxed()` confirmado funcionando en aislamiento
(`console.log(1+1)` → `"2"`) antes de culpar al modelo.

Tres intentos, con el límite de salida ya subido a 8,000 (con 4,000 se cortó a medias, mismo patrón
que ya documentó este archivo con otros modelos el 2026-11-01):

1. JSON inválido: `{"tool_call": ...}` en vez de `{"reply": {...}}` — `ZodError`.
2. JSON inválido distinto: `evidence` puesto directo bajo `reply` en vez de
   `reply.submission.evidence` — `ZodError`.
3. JSON válido, pero `type: "support"` pidiendo que el motor ejecute el sandbox — con el código
   completo y bien escrito (incluidos los casos de NaN/Infinity/null) en el texto de la pregunta,
   pero sin haberlo verificado él mismo. La herramienta `code.sandbox` nunca llegó a invocarse
   realmente en ninguno de los tres intentos (sin mensaje de "herramientas no disponibles" en el
   log, así que no fue un error — el modelo simplemente no completó la llamada de herramienta
   dentro de la ronda de `gatherAllowedTools`).

Dos lecturas honestas de este resultado, ninguna descalificante por sí sola: el modelo *sabe*
escribir el código correcto (se ve en el intento 3) y *respeta* la regla de no afirmar una
verificación que no hizo (igual que en las pruebas de `workforce` y `review`) — pero la mecánica de
tool-calling de este modelo/proveedor vía `bindTools` no está completando la ronda de herramientas
de forma confiable para esta tarea, con 0 de 3 verificaciones reales logradas. Eso es justo lo que
`c3` pedía comprobar.

**Decisión: `deepseek-code` NO se reasigna.** Sigue en DeepSeek (roto, `DEEPSEEK_API_KEY` inválida)
hasta que haya una llave real o un modelo gratis que demuestre completar `code.sandbox` de forma
confiable — no alcanza con que escriba código razonable si nunca puede probarlo él mismo, ya que el
contrato del motor exige evidencia verificada, no solo descrita.

### `complex` (revisión financiera) probado y asignado — único éxito limpio de la ronda

Fecha: 2026-11-10. Última pieza rota: `complex`, usado solo por `review`+`finance.investment-research`
y `review`+`finance.budget` (dinero, el de más riesgo de los cinco). Prueba con `finance-review`
(revisor independiente, departamento finanzas) sobre una entrega que afirmaba con certeza que el
presupuesto de marketing podía subir 30% en Q4 sin afectar caja, respaldada solo por "el equipo
comercial se ve optimista" — sin una sola cifra real de ingresos, gastos fijos o caja disponible.

Resultado al primer intento, sin ningún error de formato: rechazó los dos criterios
(`accepted: false`), señalando con precisión que una percepción verbal del equipo comercial no es
un dato contable ni de tesorería, y que la entrega concluyó con certeza en vez de declarar la
limitación por falta de cifras reales — exactamente la falla que la prueba buscaba detectar. 16.1 s,
4,483/1,243 tokens, costo 0.

A diferencia de `deepseek-code`, esta prueba no involucra ninguna herramienta real de por medio
(sin ronda de `bindTools`) y el esquema de salida (`ReviewReply`, un arreglo plano de evaluaciones)
es más simple que el de `WorkerReply` — probablemente la razón de que saliera limpio al primer
intento, no una garantía de que toda tarea financiera vaya a comportarse igual.

**Decisión: `complex` se repunta a `openrouter-free`** en `config/models.active.json`, mismo molde
que `routine`/`analysis`/`review` (se quita `reasoningEffort`, específico de OpenAI). Con esto, las
cinco piezas rotas de la política quedan resueltas: cuatro reasignadas (`routine`, `analysis`,
`review`, `complex`) y una (`deepseek-code`) deliberadamente sin tocar hasta que un modelo gratis
demuestre completar la verificación de código que su contrato exige.

