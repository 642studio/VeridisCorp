# Estrategia: la mejor aplicación del nicho

Fecha: 2026-10-31. Fase: Arranque. Objetivo: que VeridisCorp absorba todo patrón útil de otros
jugadores del nicho (orquestación de agentes de IA sobre trabajo real, con memoria que persiste
entre sesiones) sin copiar código ajeno ni retroceder en rigor frente a lo que ya construimos.
Este documento valida cada idea contra el código real de `src/`, no solo contra la intención.

## El nicho y nuestra posición en él

Dos formas de resolver el mismo problema — que varios agentes de IA trabajen con memoria
compartida sobre un objetivo real — compiten hoy:

1. **Envolver herramientas existentes** (madre, y en general los wrappers de CLIs de código como
   Claude Code/Codex/Gemini CLI/OpenCode/Cursor): un orquestador local que delega por texto libre
   entre procesos de terceros, con permisos por modo de sesión y memoria destilada automáticamente.
2. **Motor propio sobre las APIs de los modelos** (VeridisCorp): LangGraph + contratos Zod
   estrictos, sin intermediario de CLI, con protocolo `coordinate/dispatch/execute/review`
   auditable y una oficina de 56 perfiles con reglas de delegación departamental reales.

No competimos por ser un wrapper mejor — competimos por ser la oficina empresarial más confiable
del nicho: auditable, con costos y gobierno reales, no solo "varios agentes contestando a la vez".
Eso es lo que hace defendible la ruta (2): un revisor independiente que vuelve a ejecutar
herramientas de solo lectura (`src/office/intelligence.ts`, `SIDE_EFFECTING_TOOLS`), memoria que
nunca se autoaprueba, y un workflow que rechaza reanudar un checkpoint si cambió la política de
modelos (`assertVersion` en `src/office/workflow.ts`). Ningún wrapper de CLI que leímos tiene esas
tres cosas a la vez. Absorber de otros significa **llenar huecos reales sin bajar ese estándar**,
nunca adoptar un atajo (parseo de texto libre, autoaprobación, confianza en lo que el modelo dice
haber hecho) solo porque ahí funciona.

## Qué ya validamos de madre (`github.com/jossuealcacao-exe/madre`)

Repo clonado y leído a fondo (ver conversación). **Licencia: Business Source License 1.1 desde la
1.1.0** — no es código abierto permisivo, prohíbe explícitamente ofrecerlo como servicio hospedado
a terceros (justo lo que VeridisCorp quiere ser) y solo permite uso productivo a individuos u
organizaciones de ≤10 personas. Conclusión operativa: todo lo de abajo son **patrones de
arquitectura descritos en prosa**, no código portado. Ningún archivo de madre entra a este repo.

## Principios de absorción

- Absorbemos la **idea**, no la implementación — y la rediseñamos con el mismo rigor que ya exige
  este código (contratos Zod, scope fijo, `costStatus`/`trust` explícitos en vez de asumir).
- Preferimos extender un contrato ya existente (`UsageRecord`, `CorporateMemoryRecord`) antes que
  inventar uno nuevo paralelo.
- Un patrón que depende de confiar en texto libre del modelo (como el bloque `pulse` de madre para
  delegar) no se absorbe aunque funcione ahí: ya tenemos algo mejor (`CoordinatorDecision` validado
  por Zod) y bajar ese estándar sería retroceder, no "absorber todo lo que nos sirva".
- Ningún cambio que toque un contrato con muchos implementadores (`OfficeIntelligence`,
  `CorporateMemoryRecord.status`) se empuja sin dejar el diseño explícito primero — este proyecto ya
  trata esos contratos como versionados en serio (`assertVersion`, `modelPolicyFingerprint`); un
  cambio mal pensado ahí no se deshace con un revert simple una vez que hay checkpoints reales.

## Hecho hoy: módulo de precios

[src/office/prices.ts](../src/office/prices.ts) + [config/prices.example.json](../config/prices.example.json) +
[test/prices.test.ts](../test/prices.test.ts) (7 pruebas, todas pasan; `npm test` completo: 94
pass / 10 skip, sin romper nada existente). Mismo patrón que `config/models.example.json` →
`VERIDIS_MODELS_FILE`: un `VERIDIS_PRICES_FILE` que el operador llena con precios verificados a
mano contra la página oficial de cada proveedor — **nunca un precio inventado por el motor**.
`priceTokens()` es puro (sin red, sin Postgres) y devuelve `costStatus:'unknown'` — nunca un
`costMicros` a cero disfrazado de dato real — si falta la lista, el par `provider:model` no está en
ella, o falta un solo lado del conteo de tokens. Esto absorbe la honestidad de precios de madre
(`src/prices.mjs`: tabla fija, verificada a mano, nunca scrapeada) sin copiar su código, y reutiliza
la convención de dinero que ya existe en `governance/contracts.ts` (`costMicros`, `maxCostMicros`).

## Hecho: costo y tokens por llamada

Implementado completo, de punta a punta. `src/office/workflow.ts` ya colecciona
`modelCalls: ModelCallRecord[]` (antes `ModelSelection[]`) con `inputTokens`, `outputTokens`,
`costMicros` y `costStatus` reales por cada llamada — incluidos los intentos fallidos de
`withRetries()` que de todas formas consumieron tokens, no solo el que finalmente tuvo éxito.

Dos problemas reales descartaron la forma obvia de resolverlo, investigados contra el código fuente
instalado de LangChain.js (no contra la documentación ni la memoria del modelo):

1. **`createStructuredInvoker()` descartaba la respuesta cruda.** `withStructuredOutput()` sin
   `includeRaw: true` solo devuelve el valor ya parseado; el `AIMessage` con `usage_metadata`
   (confirmado en el código fuente instalado de `@langchain/core`, `@langchain/openai` y
   `@langchain/anthropic`: los tres pasan por el mismo `assembleStructuredOutputPipeline`) se
   perdía. Con `includeRaw: true`, una salida mal formada ya no lanza — cae a `parsed: null` — así
   que `intelligence.ts` sigue necesitando su propio `schema.parse()`, que lanza igual sobre `null`
   (mismo `ZodError` que `isMalformedModelOutput()` ya esperaba; el reintento no cambió de
   comportamiento, solo de dónde viene la excepción).
2. **Un canal lateral mutable habría sido una condición de carrera real.** `office-runtime.ts` reusa
   **una sola instancia** de `OfficeIntelligence` entre pedidos HTTP concurrentes de expedientes
   distintos. En vez de devolver `{result, usage}` (que hubiera cambiado la firma pública de
   `coordinate/execute/review/delegate` en `src/office/runtime-contracts.ts`, usada por varios
   implementadores de prueba), se optó por un **callback opcional `onUsage`** como segundo
   parámetro: cada nodo de `workflow.ts` pasa su propio closure por llamada, sin ningún estado
   compartido entre expedientes concurrentes, y ningún implementador existente
   (`workflow-demo.ts`, `company-demo.ts`) tuvo que cambiar — TypeScript acepta una función con
   menos parámetros donde se espera uno opcional de más.

Archivos tocados: `src/office/models.ts` (`ModelUsage`, `ModelCallRecord`),
`src/office/model-providers.ts` (`extractUsage`, `includeRaw: true`),
`src/office/runtime-contracts.ts` (`onUsage?` en la interfaz), `src/office/intelligence.ts` (lo
propaga en los cuatro métodos), `src/office/workflow.ts` (`callRecord()`, `recordedCallsMany()`
para registrar cada intento real, `priceList` cargado de `VERIDIS_PRICES_FILE` por defecto).
`GET /office/orders/:id` ya devolvía `modelCalls`, así que el total queda expuesto sin endpoint
nuevo; `web/src/components/InvolvedAgents.tsx` ahora muestra tokens y costo estimado, siempre
contando explícitamente cuántas llamadas quedaron sin conteo o sin precio en vez de tratarlas como
cero.

Validado con Postgres real (166 tests, 164 pass, 2 skip por Docker) y typecheck/build limpios en
backend y frontend. Pendiente explícito, documentado en el código (`intelligence.ts`, junto a
`gatherToolResults`): la ronda de herramientas que antecede a la decisión final de un especialista
(`bindTools().invoke()`, fuera del `invoker` de `createStructuredInvoker`) todavía no reporta sus
propios tokens — el costo que se registra hoy es el de la decisión final de cada llamada, no el de
esa ronda previa.

## Hecho: cuarentena de memoria corporativa

`CorporateMemoryRecord.status` gana `'quarantined'` y dos campos opcionales (compatibles con
registros existentes, que simplemente no los tienen): `contradicts` (id de otra memoria que esta
propuesta refuta) y `quarantineReason` (texto obligatorio al poner algo en cuarentena).
`MemoryStore.validate()` (`src/runtime/memory-store.ts`) ahora pone en cuarentena, dentro de la
misma transacción, la memoria referenciada en `contradicts` — pero solo si sigue vigente en ese
momento; si ya cambió de estado por otra razón, valida igual sin error. También hay un
`MemoryStore.quarantine(scope, id, reason)` manual, solo desde `'validated'`, para cuando un humano
descubre por otro medio que algo vigente es falso, sin necesidad de una memoria nueva que lo
contradiga. `query()` sigue filtrando por `status = 'validated'`, así que una memoria en cuarentena
deja de aparecer en recall automáticamente, sin tocar esa consulta.

Expuesto end-to-end: `memory_write` (herramienta de agentes, `src/office/tools.ts`) acepta
`contradictsMemoryId` opcional; `POST /office/memory/{id}/quarantine` (nuevo, mismo permiso
`approval.decide` que `validate`) en `src/runtime/office-runtime.ts`/`http.ts`; pestaña CUARENTENA y
botón de cuarentena manual con motivo obligatorio en `web/src/screens/Memory.tsx`; el espejo a
Obsidian (`memory-export.ts`) ya refleja el estado y el motivo. Validado contra Postgres real
(`npm run test:postgres`: 163 tests, 161 pass, 2 skip por Docker no disponible — nada falló) y
`npm test`/`tsc --noEmit` en backend y frontend, ambos limpios.

Deliberadamente NO implementado: un grafo bidireccional de contradicciones, ni permitir poner en
cuarentena una simple propuesta (`'proposed'`) — eso ya tiene su propio diseño explícito en este
código ("una propuesta mala simplemente nunca se valida") y añadir un tercer camino ahí lo
contradiría sin necesidad real.

## Hecho: presupuesto por expediente con proyección

`WorkOrder.limits.maxCostMicros` (opcional, en la moneda de `VERIDIS_PRICES_FILE`) se fija al
crear cada expediente desde `VERIDIS_OFFICE_MAX_COST_MICROS` — copiado al expediente, así que
cambiar la variable no reinterpreta expedientes en curso, y como el dato vive en la orden y no en
la huella del workflow, los checkpoints existentes siguen reanudándose. `src/office/budget.ts`
(funciones puras) proyecta la próxima llamada como **la más cara de las últimas 5 con precio**, no
el promedio: el expediente alterna llamadas baratas del coordinador con caras de especialistas, y un
promedio subestimaría justo la que rebasa el tope. Antes de cada llamada al modelo (coordinate,
execute, review, delegate), `workflow.ts` pausa el expediente si ya se agotó o si la proyección lo
rebasaría — antes de gastar, no después. Con presupuesto configurado pero sin precio para el
`provider:model` de la próxima llamada, también pausa: un presupuesto que no se puede medir no es
presupuesto. Sin `maxCostMicros`, nada cambia respecto a antes.

`GET /office/orders/:id` devuelve `budget` (`spentMicros`, `projectedNextMicros`, `unpricedCalls`,
`level`: none/ok/warning 80%/critical 90%/exceeded), y el detalle del expediente en `web/` lo muestra
con el mismo medidor que los turnos. Límites honestos, documentados en el código: es una proyección,
no una garantía (una llamada puede salir más cara que todas las anteriores), y los hasta 3
reintentos internos de un mismo nodo no se vuelven a consultar entre sí. Validado: 9 pruebas nuevas
(`test/budget.test.ts`, incluido el corte exacto en un workflow real) y la suite completa sobre
Postgres real (175 tests, 173 pass, 2 skip por Docker). La pantalla nueva no se probó en navegador:
exige un backend con expedientes reales en curso.

## Prueba local de punta a punta (2026-10-31)

API real + `web/` en local, con un Postgres temporal aislado (nunca el `DATABASE_URL` del `.env`),
embeddings reales de Ollama (`nomic-embed-text`) y llamadas reales a OpenAI/DeepSeek. Verificado en
navegador: un expediente real completo (6 llamadas, 36,616 tokens de entrada, $0.0873 estimados con
`config/prices.active.json`), la propuesta de memoria del agente validada desde MEMORIA, un segundo
expediente real donde `knowledge-curator` encuentra esa memoria con `memory_query` y propone una
corrección con `contradictsMemoryId`, la cuarentena automática al validarla, la cuarentena manual con
motivo obligatorio, y un tercer expediente pausado por presupuesto ($0.0190 gastados de $0.0300,
antes de gastar la siguiente llamada).

Lo que la prueba en vivo encontró y se corrigió (ninguna prueba automática lo había detectado):

- **`memory_query` no devolvía el `id`** de cada memoria, así que ningún agente podía llenar
  `contradictsMemoryId`: el agente real lo reportó y se quedó bloqueado. Ahora lo devuelve.
- **El espejo de Obsidian no se actualizaba** para la memoria puesta en cuarentena como efecto de
  validar una corrección: seguía mostrando "validated". Ahora se reescriben ambos archivos.
- **La tarjeta de una propuesta no avisaba** que validarla pone otra memoria en cuarentena; ahora
  lo muestra con el contenido de la memoria afectada, antes del clic.
- **El chat trataba un expediente pausado como si esperara respuesta**; ahora un mensaje nuevo abre
  otra conversación, igual que con uno completado.
- **La barra fija de acciones** del detalle no tapaba el contenido al hacer scroll (`z-index`).
- Legibilidad: tokens con separador de miles y costo en su propio renglón.
- Preexistente, ajeno a estas entregas: con el `.env` actual el servidor **no arranca**, porque
  `config/models.active.json` exige `OLLAMA_GENERAL_MODEL` (el modelo 8b del VPS) y el `.env` no lo
  define; además el error salía como un mensaje genérico. Ahora `serve` muestra el nombre de la
  variable que falta (solo para errores de configuración de modelos, nunca valores).

## Hecho: memoria automática, archivista y mapa neuronal (2026-10-31)

Decisión de Adrián: memoria **automática como madre**, en vez del triaje híbrido recomendado y de la
validación humana obligatoria anterior. Lo que guarda un agente o destila el archivista queda
vigente "sin confirmar" y ya se usa; el humano confirma o manda a cuarentena. Salvaguardas que no
frenan el flujo: lo confirmado nunca cae solo (una corrección sin confirmar no lo tumba), y una
versión nueva con el mismo `entityId` solo reemplaza a la anterior si trata del mismo tema (coseno
≥ 0.8) — en vivo, el archivista reusó `642-studio` para dos conocimientos distintos y el segundo
borró al primero.

- **Archivista** (`OfficeRuntime.distill`, `distill` en `intelligence.ts`): al cerrar cada
  expediente, en segundo plano y una sola vez (`office_orders.memory_distilled_at`), destila hasta 5
  memorias (decisión, hecho, preferencia, pregunta) con el perfil barato de `knowledge-curator`. En
  vivo, tres expedientes produjeron decisiones, preferencias y preguntas abiertas con sentido.
- **Uso real** (`memory_recalls`): cada memoria que `memory.query` entrega a un agente queda
  contada; alimenta el "en uso" del mapa y el "la usaron los agentes N veces".
- **Mapa** (`web/src/components/memoryMap/`): Canvas 2D propio, sin dependencias. Es la misma idea
  que madre (esfera de ángulo áureo, neuronas pre-renderizadas, brillo aditivo, se encienden las que
  se usan), pero con código nuestro.
  - El color va por tipo, con 3 tonos validados con el validador de dataviz contra el fondo real; la
    pregunta va en neutro.
  - La forma de la neurona es la segunda codificación, y el estado se marca sin tono: anillo si está
    confirmada, apagada si está en cuarentena.
  - Los enlaces son similitud de embeddings. El umbral es **0.72, no el 0.6 de madre**: medido en
    vivo, con `nomic-embed-text` dos textos sin relación ya dan 0.62–0.70.
  - El panel lateral permite confirmar y poner en cuarentena desde el mapa. El giro automático se
    detiene con el puntero encima, la neurona elegida se enfoca fuera del panel, hay atajos de
    teclado y respeta el movimiento reducido.
  - La vista LISTA es la alternativa en texto.

Pendiente honesto: el consumo del archivista va a la auditoría (`memory.distilled`), no al
presupuesto del expediente, que ya cerró. El mapa no se probó todavía con cientos de memorias:
la relajación es O(n²) y baja a 25 iteraciones arriba de 300 nodos, pero no se midió con datos reales.

## Hecho: importar texto a la memoria (2026-10-31)

MEMORIA → **+ IMPORTAR TEXTO**: se pega un documento, el servidor lo parte en secciones de forma
determinista (`src/runtime/memory-ingest.ts`, sin perder texto) y cada sección pasa por una llamada
del perfil barato de `knowledge-curator`, que devuelve hasta 12 memorias cortas. La UI muestra el
avance por sección, y si una sección falla, las demás siguen. Rutas: `POST /office/memory/import/plan` y
`POST /office/memory/import/section`. La opción **"Lo escribí yo: guardar como confirmado"**
(`confirm: true`) confirma cada memoria al importarla; la procedencia lo dice.

Prueba con el contexto maestro de Grupo 642 + la descripción de VERIDIS (28,514 caracteres):

- 13 secciones produjeron 105 memorias en unos 46 s.
- Consumo: 33.9k tokens de entrada y 8k de salida, unos $0.02.
- Ningún `entityId` quedó duplicado y estaban los 28 de 28 datos clave revisados.
- Se conservaron los marcadores de certeza: VISIÓN, POR CONFIRMAR, EN DESARROLLO y PROPUESTO.

## Prueba como asistente y como programador (2026-10-31)

| Prueba | Resultado |
|---|---|
| "¿Qué diferencia hay entre VERIDIS y Veridis Media?" | Correcta y basada en memoria. 55 s, 7 llamadas, $0.105. Llena de advertencias porque todo estaba sin confirmar. |
| Cotización de redes sociales | 4 tareas de marketing, 25 llamadas, $0.47 y 7 min. No inventó precios como hechos: todo va marcado como supuesto y sujeto a finanzas/Adrián. Se pausó porque la revisión devolvió una salida que no se pudo leer (ver abajo). |
| "¿Qué módulos de VERIDIS funcionan hoy en producción?" | El software-lead se bloqueó pidiendo un inventario, aunque el contexto ya estaba en memoria: no tenía acceso a ella. |
| Revisar el último commit con git | Bloqueado de forma honesta: no tiene herramienta de git ni acceso al repo, y no inventó nada. |
| Escribir un validador de RFC | Escribió el código; `code.sandbox` falló porque Docker no está corriendo en esta Mac, y pidió autorización para entregarlo sin verificar. |

Correcciones que salieron de estas pruebas:

- **Memoria para todos los agentes** (`gatherToolResults` en `intelligence.ts`). Antes de cada tarea, el
  motor consulta la memoria con el objetivo y la tarea, y la entrega como un resultado `memory_query`
  ya ejecutado. Antes solo 4 puestos tenían `memory.query`, y casi nunca la usaban. El revisor recibe su propia consulta
  (`track: false`) para poder verificar lo que el especialista cite de la memoria.
- **Respuestas truncadas.** Los perfiles `routine` (DeepSeek) y `review` cortaban la salida a 2000
  tokens; el JSON quedaba a medias. Con `includeRaw` (agregado para contar tokens), LangChain convierte
  ese fallo en `parsed: null` y el error decía solo "expected object, received null".
  - Se subieron ambos perfiles a 4000 tokens.
  - `recoverStructured()` recupera lo que el modelo sí devolvió y avisa cuando se cortó por el límite.
  - Lanza `OutputParserException` para que el flujo reintente en vez de tumbar la petición.
- **Chat:** contador de caracteres y bloqueo claro arriba de 4000, que sugiere importar el texto, en
  lugar del críptico "Solicitud o contrato inválido".

Segunda vuelta, con las correcciones:

- **Cotización:** ahora la hace el CMO directo, la revisión la aprueba, y el CEO pide al usuario los 6
  datos que faltan (giro, redes, volumen, ciudad, branding, presupuesto). Bajó de 7 min y $0.47 a
  27 s y $0.10.
- **Módulos en producción:** ya consulta la memoria (6 consultas), pero devops sigue pidiendo
  evidencia en vivo en vez de responder "según lo registrado: X; estado de hoy sin verificar". Es
  honesto, pero no fluido: confirma que hace falta una respuesta rápida para preguntas.

Lo que estas pruebas muestran que falta, en orden:

1. **Respuesta rápida para preguntas — hecho el 2026-11-01** (ver "Hecho: respuesta rápida en el chat").
2. **Capacidad de programar y revisar git — hecho el 2026-11-01** (ver "Hecho: leer git y ejecutar código").
   Falta escribir en repos y delegar en CLIs de código.
3. **Documento con error probable.** En el contexto maestro, la línea de "experiencia gastronómica
   vinculada con Cowork" está bajo 642 Sports. Además, VERIDIS Console quedó como hecho presente.
   Conviene corregirlo con cuarentena desde el mapa.

## Hecho: respuesta rápida en el chat (2026-11-01)

Antes, cada mensaje del chat era un expediente completo. Ahora el chat responde primero con **una
sola llamada** (`OfficeRuntime.ask`, `ask` en `intelligence.ts`, agente de enrutado `assistant`). Esa
llamada recibe la memoria corporativa ya consultada y las últimas 6 rondas de la conversación.

- El modelo decide `mode`. Con `answer` responde directo. Con `order` (cotizaciones, documentos,
  investigar en internet, código, correos, calendario…) redacta un encargo autocontenido y la UI lo
  abre como expediente; la respuesta enlaza al expediente y muestra su estado.
- Se guarda en `assistant_messages` (por hilo y ámbito): pregunta, respuesta, modo, encargo, copia
  de las memorias usadas, tokens, costo y latencia. Además se audita (`assistant.answered`).
- Solo cuentan como uso (`memory_recalls`) las memorias que la respuesta dice haber usado y que de
  verdad se le dieron; un id inventado por el modelo se descarta.
- UI (`OfficeChat.tsx`):
  - Las conversaciones rápidas y los expedientes van en una sola lista.
  - Cada respuesta muestra cuánto tardó y qué memorias usó (desplegable, con su estado).
  - Botón "Hacerlo con la oficina →" para mandar cualquier respuesta a un expediente.
  - Markdown ligero renderizado sin HTML (`components/RichText.tsx`).

Medido en vivo con DeepSeek (perfil `routine`) y el contexto maestro importado:

| Pregunta | Antes (expediente) | Ahora |
|---|---|---|
| Diferencia VERIDIS / Veridis Media | 55 s, $0.105 | 2.5 s, $0.001 |
| Módulos de VERIDIS en producción | se bloqueaba pidiendo evidencia | 2.1 s; responde con lo registrado y dice que el estado en vivo no lo puede comprobar |
| Seguimiento "¿y cuál deja más margen?" | — | 1.9 s; dice que no hay ese dato y ofrece encargar el análisis |
| Cotización de redes sociales | 7 min | 2.2 s para detectar que es trabajo y redactar el encargo; el expediente sigue aparte |

Pendiente: el puente de Telegram sigue abriendo un expediente por mensaje; debería usar la misma
respuesta rápida.

## Hecho: leer git y ejecutar código (2026-11-01)

- **`repo.read`** (`src/office/repo-tools.ts`). Development, backend, frontend, devops,
  security-appsec y security-audit pueden leer los repositorios de `VERIDIS_REPOS`, con siete herramientas:
  `git_log`, `git_show` (también un solo archivo con `path`), `git_diff`, `git_status`, `repo_search`,
  `repo_read_file` y `repo_list_files`.
  - Es solo lectura: git corre sin shell, con argumentos validados y sin textconv ni ext-diff.
  - Solo ve archivos versionados (un `.env` ignorado no existe para el agente).
  - La salida se recorta y se tapan cadenas con forma de credencial.
  - El especialista recibe la lista de repos con su rama y último commit, y tiene hasta 6 llamadas.
- **`code.sandbox`** ahora acepta `typescript`. Antes todo iba a `main.js`, así que cualquier código con
  tipos fallaba por sintaxis; ahora va a `main.ts` con `--experimental-transform-types`. Docker Desktop
  tiene que estar encendido en el equipo donde corra la API.
- **Fallo silencioso corregido.** DeepSeek rechaza la llamada entera si el JSON Schema de una
  herramienta trae lookaheads, y `gatherToolResults` se tragaba el error: el agente solo veía "no tengo
  acceso".
  - Las rutas y referencias ahora se validan con `refine`.
  - Una prueba revisa que ningún esquema de herramienta lleve lookarounds.
  - Si la ronda de herramientas falla, el agente y el log ven el motivo (`tools.error`).

Prueba en vivo, por el mismo camino que el chat (respuesta rápida → encargo → expediente):

| Encargo | Resultado |
|---|---|
| Revisar el último commit de VeridisCorp | Completado en 64 s, $0.13. Citó el commit real (`4711ce9`, 9 archivos, +85/−45), separó lo visto en el diff de lo inferido, y aclaró que el diff llegó recortado y que el árbol de trabajo tiene cambios sin commitear. |
| Validador de RFC en TypeScript con dos ejemplos | Completado en 53 s, $0.12. Ejecutó el código en el sandbox, detectó que su ejemplo "válido" fallaba y lo corrigió con la salida real. |

Ojo con lo que "verificado" significa: el sandbox prueba que el código corre y es coherente consigo
mismo, no que el algoritmo sea el oficial. El dígito verificador del RFC usó el alfabeto
`0-9 A-Z Ñ &`. La tabla del SAT pone `&` entre N y O, y espacio y Ñ al final, así que el dígito de
un RFC real probablemente no coincide. Ni el especialista ni el revisor tenían fuente para notarlo.

Pendiente:

- Escritura en repos (rama propia + PR con aprobación humana, como los modos de checkpoint de madre).
- Delegar en CLIs de código.
- Que el revisor reciba fuentes de dominio (p. ej. la especificación del SAT) cuando el encargo dependa de ellas.

## Hecho: conexiones MCP con memoria (2026-11-01)

Pedido: que al hacer o solicitar una conexión MCP la empresa la guarde en memoria y la entienda después.
Decisión de Adrián: los agentes también pueden conectar, no solo él.

- **Conectar.** `mcp.connect` (automation, devops) conecta un servidor MCP remoto por https, o lo deja
  solicitado si no tiene la URL. Desde la pantalla CONEXIONES un humano puede conectar también su LAN (n8n),
  con credencial cifrada.
- **Usar.** `mcp.use` da `mcp_call` sobre las herramientas activas. Las que el servidor declara de lectura
  nacen activas; las que escriben o no declaran nada quedan apagadas hasta que un humano las active.
- **Recordar.** Cada conexión tiene una memoria `integration` que el motor reescribe en cada cambio: qué es,
  para qué sirve, cada herramienta, quién la conectó y en qué estado está. Una conexión pedida sin URL, o que
  pide credencial, queda como pregunta abierta. El asistente del chat recibe además el estado en vivo.
- **Revisar.** El revisor ve el estado real de las conexiones y las respuestas MCP que el motor observó al
  ejecutar, así comprueba sin repetir llamadas que escriben.

Prueba en vivo con servidores reales:

| Prueba | Resultado |
|---|---|
| Conectar DeepWiki desde la pantalla | Activa por Streamable HTTP, 3 herramientas leídas, memoria confirmada |
| Encargo: «usa deepwiki para averiguar cómo guarda LangGraph los checkpoints» | Completado, $0.14. automation consultó DeepWiki y el revisor aceptó comparando con lo que el motor observó |
| Encargo: «conecta el MCP de documentación de Cloudflare» | Completado, $0.14. automation lo conectó sola (2 herramientas de lectura), quedó sin confirmar y el revisor lo comprobó con el estado real |
| Chat: «¿tenemos forma de consultar la documentación de Cloudflare?» | 1.7 s. Encontró la conexión por significado, con sus herramientas y su estado |
| Chat: «¿qué integraciones tenemos ahora y cuáles puedo usar?» | 2.6 s. Las dos conexiones, qué herramientas están activas y que «sin confirmar» no impide usarla |

Lo que encontró la prueba y se corrigió antes de cerrar:

- DeepWiki no declara si sus herramientas escriben, y el sistema las mostraba como "escriben". Ahora hay un
  tercer estado, "no declara", y un humano puede clasificarlas.
- El revisor rechazaba porque no podía volver a llamar herramientas sin declarar: ahora compara con lo que
  observó el motor.
- Un agente se detuvo a preguntar si "sin confirmar" contaba como conectada; los mensajes ya lo aclaran.
- Al retirar y volver a conectar convivían dos memorias de la misma conexión; ahora la nueva sustituye a las
  anteriores.

Pendiente:

- OAuth de servidores MCP (Notion, GitHub, ClickUp remotos lo piden); hoy solo cabecera con token.
- Servidores locales por stdio, solo declarados por el operador.
- Que las respuestas observadas sobrevivan a un reinicio de la API (hoy viven en memoria del proceso).

## Backlog validado, priorizado, pendiente de decisión

1. **Reanudar un expediente pausado por presupuesto.** Hoy una pausa (por presupuesto o por
   cualquier otro motivo) no tiene comando para continuar ni para ampliar el tope — limitación que
   el proyecto ya documentaba antes de este cambio. Con presupuesto real, ahora sí hace falta.
2. **Tokens de la ronda de herramientas de un especialista.** `gatherToolResults()` en
   `intelligence.ts` llama al modelo por fuera de `createStructuredInvoker` (hasta 3 rondas de
   `bindTools().invoke()`) y hoy esos tokens no se contabilizan — documentado explícitamente en el
   código, no un olvido. Exige otro mecanismo porque puede haber varias llamadas por tarea, no una.
3. **Cuarentena de memoria corporativa — ya implementada** (ver arriba): zonas, contradicción
   automática al validar, endpoint, UI y espejo a Obsidian, todo probado contra Postgres real.
4. **Fusión léxico+semántica de memoria — ya implementada**, no es una brecha: `memory-store.ts`
   (`query()`) ya combina distancia coseno con `ts_rank` léxico (peso 0.15, sin calibrar con datos
   reales todavía — vale la pena revisar ese número cuando haya uso real, no antes).
5. **Endurecer el vault de conectores** (si se suman más allá de Gmail): un secreto por archivo,
   `chmod 0600`, nunca en logs/ledger/prompt — mismo patrón que ya sigue
   `src/office/tools.ts`/`configureGmail()` para OAuth; aplicar igual al próximo conector, no una
   reescritura.

## Descartado explícitamente (y por qué)

- **Parseo de bloques de texto libre para delegar entre agentes** (patrón `pulse` de madre): nuestro
  `CoordinatorDecision` validado por Zod ya es estrictamente más auditable. Adoptarlo sería
  retroceder, no absorber.
- **Marketplace de módulos firmado con Ed25519** (dos claves, catálogo remoto firmado): tiene sentido
  cuando terceros publican extensiones para instalar. Hoy `tools.ts` define todo de primera mano;
  no hay ecosistema externo que lo justifique.
- **Modos de permiso tipo checkpoint-git sobre el filesystem** (`#0`–`#4` de madre): relevante solo
  si algún agente de software obtiene escritura directa sobre el repo del host. Hoy `code.sandbox`
  corre en Docker efímero sin montar nada — no aplica.

## Próximo paso

1. Reanudar o ampliar el presupuesto de un expediente pausado (ítem 1 del backlog).
2. Tokens de la ronda de herramientas (`gatherToolResults`) — más trabajo de diseño, menor urgencia.
3. Otra prioridad del backlog, o una nueva que quieras meter antes en la cola.
