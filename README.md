# VeridisCorp

VeridisCorp es el ecosistema empresarial de agentes de Grupo 642, construido sobre el motor Veridis con LangGraph y TypeScript.

Fecha: 2026-10-22. Fase: **Arranque**. La carpeta de trabajo es `VeridisCorp/`, dentro del proyecto local CODE. Las referencias sincronizadas de `../sources/` son de solo lectura.

## Estado actual

La [ruta vertical gobernada de contenido](docs/runtime-pilot.md) conecta una API autenticada, autorización efectiva, tareas propias persistentes, generación y revisión con agentes existentes, artefactos versionados, aprobación humana, ejecución central y auditoría en PostgreSQL. Se verificó un reinicio real después de enviar a un receptor HTTP controlado, recuperando el resultado por consulta sin volver a enviarlo.

Las pruebas usan proveedores de contenido deterministas y un receptor local. No se han validado llamadas pagadas, publicaciones en plataformas comerciales ni un despliegue de producción. Los costos desconocidos permanecen como null; los límites monetarios se aplican a reservas configuradas, todavía sin conciliación con facturación.

La ruta usa un plan determinista de contenido y revisión, no un orquestador general autónomo. Los [contratos de gobierno](docs/governance-foundation.md) incluyen además relaciones multiempresa, memoria, decisiones, tareas humanas, eventos y credenciales; su disponibilidad no significa que todas esas funciones estén conectadas al piloto.

## Inicio y pruebas

Requisitos: Node.js 22 o superior; PostgreSQL 16 para las pruebas persistentes.

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

La [política de modelos](docs/model-routing.md) permite selección por agente, capacidad y etapa con OpenAI, Anthropic, Google y endpoints compatibles. `config/models.example.json` contiene la plantilla; los modelos y secretos se configuran en el entorno. El piloto utiliza `content` y `review` y desactiva reintentos automáticos del adaptador para registrar cada intento desde el servicio.

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
- `src/office/`: motor de oficina, registro de perfiles, organigrama, selección de modelos y simulaciones.
- `src/graph.ts`: flujo secuencial inicial conservado para compatibilidad.
- `agents/`: puestos editables; no concede permisos de ejecución por sí mismo.
- `test/runtime-postgres.test.ts`: ruta integrada, autorización, límites, concurrencia y recuperación de proceso.

## Próximas entregas

Mantener una ruta integrada antes de ampliar agentes: conectar un proveedor de negocio autorizado, persistir tareas humanas y disponibilidad, añadir memoria filtrada y evolucionar a eventos y workers cuando lo requiera el volumen. Siguen pendientes login/SSO, seguridad y operación de producción, roles PostgreSQL separados, bóveda de secretos, cola/outbox general, compensaciones y evaluación empresarial de resultados.

La arquitectura previa está en [office-architecture.md](docs/office-architecture.md). Su alcance de simulación debe distinguirse de la ruta gobernada nueva, documentada en [runtime-pilot.md](docs/runtime-pilot.md).
