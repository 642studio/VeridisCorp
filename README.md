# VeridisCorp

VeridisCorp es el ecosistema empresarial de agentes de Grupo 642, construido sobre el motor Veridis con LangGraph y TypeScript.

Fecha: 2026-10-24. Fase: **Arranque**. La carpeta de trabajo es `VeridisCorp/`, dentro del proyecto local CODE. Las referencias sincronizadas de `../sources/` son de solo lectura.

## Estado actual

La [ruta vertical gobernada de contenido](docs/runtime-pilot.md) conecta una API autenticada, autorización efectiva, tareas propias persistentes, generación y revisión con agentes existentes, artefactos versionados, aprobación humana, ejecución central y auditoría en PostgreSQL. Se verificó un reinicio real después de enviar a un receptor HTTP controlado, recuperando el resultado por consulta sin volver a enviarlo.

Las pruebas usan proveedores de contenido deterministas y un receptor local. No se han validado llamadas pagadas, publicaciones en plataformas comerciales ni un despliegue de producción. Los costos desconocidos permanecen como null; los límites monetarios se aplican a reservas configuradas, todavía sin conciliación con facturación.

La ruta usa un plan determinista de contenido y revisión, no un orquestador general autónomo. Los [contratos de gobierno](docs/governance-foundation.md) incluyen además relaciones multiempresa, memoria, decisiones, tareas humanas, eventos y credenciales; su disponibilidad no significa que todas esas funciones estén conectadas al piloto.

Con `VERIDIS_OFFICE_ENABLED=true`, `office/` deja de ser solo simulación: el CEO real coordina expedientes bajo el mismo módulo de gobierno (`/office/orders`), con una pantalla de chat (ASISTENTE) que responde al instante con la memoria corporativa (`/office/assistant/ask`, una sola llamada) y abre un expediente solo cuando lo pedido es trabajo. La pantalla CONEXIONES (`/office/connections`) administra servidores MCP que los agentes usan como herramientas; los puestos de integración también pueden conectarlos, y cada conexión queda descrita en la memoria corporativa. Con `VERIDIS_SCHEDULER_ENABLED=true` además, tareas programadas (`/office/schedules`) disparan esos expedientes solas en cron real, con candado contra solapamiento, límite de tasa y apagado automático tras fallos repetidos — detalle completo en [runtime-pilot.md](docs/runtime-pilot.md#oficina-real-expedientes-chat-y-tareas-programadas).

Memoria corporativa (ver `src/runtime/memory-store.ts`, `src/runtime/embeddings.ts`, las herramientas `memory.write`/`memory.query` en `src/office/tools.ts` y `/office/memory*`): `CorporateMemoryRecord` persistida y versionada por entidad, con embebido semántico (pgvector, `nomic-embed-text` en Ollama) y búsqueda léxica de respaldo. **Modelo automático desde el 2026-10-31** (decisión de Adrián, tomando como referencia la app madre — ver [docs/competitive-strategy.md](docs/competitive-strategy.md)): lo que guarda un agente con `memory.write`, o lo que el **archivista** destila solo al cerrar cada expediente (hasta 5 memorias: decisión, hecho, preferencia o pregunta), queda vigente **sin confirmar** y `memory.query` ya lo usa, marcado como tal. Un humano lo confirma (`POST /office/memory/{id}/validate`) o lo manda a cuarentena (`POST /office/memory/{id}/quarantine`, con motivo): ahí deja de usarse, pero se conserva para que nadie lo vuelva a guardar igual. Salvaguarda: algo que un humano ya confirmó nunca cae solo — una corrección que lo refuta (`contradicts`) solo lo pone en cuarentena cuando un humano confirma también la corrección; lo sin confirmar sí cae al instante. Cada uso real por un agente se registra (`memory_recalls`) y alimenta el **mapa de memoria** de la pantalla MEMORIA en `web/`: una esfera 3D en Canvas donde cada memoria es una neurona (color y forma por tipo, anillo si está confirmada, brilla si se usó en los últimos 7 días, apagada si está en cuarentena), enlazada a sus vecinas por similitud de embeddings (coseno ≥ 0.72, calibrado para `nomic-embed-text`, máx. 4 por memoria; `GET /office/memory/graph`), con panel para confirmar o poner en cuarentena desde el mapa; la vista LISTA tiene lo mismo en texto. Ámbito fijo por ahora (`VERIDIS_MEMORY_WORKSPACE_ID`/`COMPANY_ID`/`DIVISION_ID`): sin aislamiento real por cliente; una sesión de otro ámbito recibe 404. Confirmar con `VERIDIS_MEMORY_VAULT_PATH` configurada también escribe `<entityType>/<entityId>.md` en un vault de Obsidian (y reescribe el archivo de lo que esa confirmación pone en cuarentena); `npm run runtime:memory-export` exporta de una vez todo lo confirmado — ver [docs/runtime-pilot.md](docs/runtime-pilot.md#exportación-a-un-vault-de-obsidian). Verificado en vivo (2026-10-31) con Ollama, OpenAI y DeepSeek reales y Postgres temporal; el consumo del archivista queda en la auditoría (`memory.distilled`), fuera del presupuesto del expediente ya cerrado.

## Inicio y pruebas

Requisitos: Node.js 22 o superior; PostgreSQL 16 para las pruebas persistentes, con la extensión pgvector instalada (`brew install pgvector` en Mac; paquete `postgresql-16-pgvector` del repositorio PGDG en Linux) para la memoria corporativa.

```bash
npm ci
npm run check
npm run build
npm test
npm run test:postgres
```

`npm test` funciona sin credenciales y omite las pruebas PostgreSQL si falta `VERIDIS_TEST_DATABASE_URL`. `test:postgres` crea y elimina un clúster temporal aislado en loopback para ejecutar toda la suite, incluido un reinicio de proceso. En Linux, indicar `VERIDIS_POSTGRES_BIN` con la carpeta de binarios; el valor por defecto corresponde a Homebrew PostgreSQL 16 en Mac. No usa las bases existentes.

Para preparar la API, configurar `.env`, una base dedicada, la política de modelos y un receptor compatible, siguiendo el [procedimiento del piloto](docs/runtime-pilot.md):

```bash
npm run runtime:db
npm run runtime:provision -- config/runtime-session.example.json /ruta/privada/token.txt
npm run runtime:serve
```

Editar el ejemplo de sesión antes de aprovisionar. No se crean usuarios ni permisos predeterminados al iniciar el servidor. La utilidad administrativa guarda el token en un archivo privado nuevo; no lo imprime. La API escucha en loopback y las solicitudes no pueden elegir su identidad o ámbito. La ruta de inicio es `POST /runs` con `{brief, approverHumanId}` y una sesión Bearer. El resto de rutas se documenta en el procedimiento.

## Perfiles y modelos

El [inventario provisional](agents/INVENTORY.md) conserva **56 perfiles**, nueve áreas principales y cuatro subdepartamentos tecnológicos. Cada perfil vive en `agents/<id>/`, con `config.json`, `instructions.md`, `context.md` y referencias explícitas en `knowledge/`. Consulta la [guía de edición](agents/README.md) y el [organigrama](docs/company-organization.md).

La pantalla ORGANIGRAMA de `web/` tiene dos vistas: LISTA (árbol de texto plegable, con búsqueda) y GRAFO (árbol radial — `web/src/screens/OrgGraph.tsx`, `d3-hierarchy`/`d3-shape`), que recorre departamento → subdepartamento → agente → herramienta en un solo mapa visual. Color por una de las 9 áreas de primer nivel (paleta categórica validada contra el fondo real de la app con `scripts/validate_palette.js` del skill `dataviz`); el color es una codificación secundaria, la etiqueta de texto siempre visible es la primaria. Clic en un departamento expande o colapsa su rama; clic en un agente abre su ficha completa (mismo panel que la vista LISTA). Verificado en navegador contra un backend real, con los 56 perfiles y 13 departamentos cargando y navegando correctamente en varios niveles de anidamiento.

La [política de modelos](docs/model-routing.md) permite selección por agente, capacidad y etapa con OpenAI, Anthropic, Google y endpoints compatibles. `config/models.example.json` contiene la plantilla; los modelos y secretos se configuran en el entorno. El piloto de contenido (`runtime/`) usa `content` y `review`; `office/` real, con `VERIDIS_OFFICE_ENABLED=true`, ya ejecuta a cualquiera de los 56 perfiles, con algunos de ellos usando alguna de las quince herramientas reales descritas en [office-architecture.md](docs/office-architecture.md). Desactiva reintentos automáticos del adaptador para registrar cada intento desde el servicio.

## Simulaciones y compatibilidad

```bash
npm run demo
npm run demo:office
npm run office:demo
npm run office:company-demo
npm run office:organization
npm run office:models
```

Las simulaciones anteriores se conservan sin red. Sus reglas organizacionales no son una ruta alternativa de autorización del piloto. Las entradas antiguas de ejecución real `run`, `resume`, `office:run`, `office:resume` y `office:answer` están suspendidas para evitar llamadas fuera de los controles nuevos. Se conservan consulta administrativa de checkpoints y migraciones antiguas; no se modificaron su esquema, prefijos o identidades. Los adaptadores anteriores siguen disponibles como código de biblioteca para migración y pruebas, no como rutas de la API.

## Organización del código

- `src/runtime/`: API, sesiones, repositorios PostgreSQL, flujo gobernado, catálogo de capacidades del piloto y conector de entrega.
- `src/governance/`: contratos y reglas deterministas de permisos, aprobaciones, trabajo humano y recuperación.
- `src/office/`: motor de oficina (protocolo coordinar/despachar/revisar/delegar), registro de perfiles, organigrama, selección de modelos, herramientas reales (`tools.ts`) y simulaciones.
- `src/graph.ts`: flujo secuencial inicial conservado para compatibilidad.
- `agents/`: puestos editables; no concede permisos de ejecución por sí mismo.
- `test/runtime-postgres.test.ts`: ruta integrada, autorización, límites, concurrencia y recuperación de proceso.

## Próximas entregas

Mantener una ruta integrada antes de ampliar agentes: persistir tareas humanas y disponibilidad, añadir memoria filtrada y evolucionar a eventos y workers cuando lo requiera el volumen. Siguen pendientes login/SSO, seguridad y operación de producción, roles PostgreSQL separados, bóveda de secretos, cola/outbox general, compensaciones y evaluación empresarial de resultados. Evaluación de viabilidad (pendiente de ejecutar) de dejarlo siempre encendido en el servidor de oficina: [runtime-pilot.md](docs/runtime-pilot.md#despliegue-continuo-en-el-servidor-de-oficina-pendiente). De la hoja de ruta v1 ([assistant-v1-roadmap.md](docs/assistant-v1-roadmap.md)), PDF, correo, Drive, Calendar, Sheets, Meet y Slides ya están implementados; quedan notificación proactiva, ClickUp con escritura, y comandos reales en el VPS con aprobación humana.

[office-architecture.md](docs/office-architecture.md) explica el protocolo del motor (quién decide, cómo pasa el turno entre agentes, qué puede hacer cada herramienta) — con IA y Postgres reales, no solo en simulación. [runtime-pilot.md](docs/runtime-pilot.md) documenta el contrato HTTP, la autenticación y el despliegue.
