# Gestión interna de proyectos de 642 Studio

Fecha: 2026-11-05. Decisión del usuario: ClickUp está en retirada; la fuente nueva de proyectos
es el módulo interno de Core. Este registro amplía `operacion-core-2026-11-05.md` y sustituye
las recomendaciones de seguir construyendo la integración ClickUp.

## Cambios de Corp

- Se retira `clickup.read` de PM, project-planner, project-tracker y human-task-coordinator.
  Ningún perfil activo lo declara. El adaptador legacy queda en código para compatibilidad,
  sin concederlo a agentes. No se revocan credenciales del proveedor ni se borran datos.
- Lectores `projects.read`: CEO, COO y los cuatro perfiles anteriores. Escritor `projects.write`:
  únicamente PM. Planificación, seguimiento y coordinación humana no adquieren permisos de edición.
- Herramientas: `projects_list_tasks`, `projects_get_task`, `projects_create_task`,
  `projects_update_task`; usan el puente privado local de Core y metadata de agente/expediente.
- El prompt compartido explica fuente, paginación, versiones y claves estables. Las instrucciones
  de PM/coordinación humana dejan de presentar ClickUp como fuente de tareas. Un resumen no
  autoriza a cambiar fechas, responsables o avances.
- `projects.write` se excluye de revisión independiente. Sus resultados se conservan en la
  misma caché temporal de efectos observados que las escrituras de CRM; no se promete durabilidad
  de esa caché. La auditoría de las tareas vive en el historial persistente del cliente en Core.
- No se añadieron nuevas identidades ni se reinterpretaron checkpoints. Las definiciones editadas
  cambian el fingerprint; expedientes anteriores pueden necesitar iniciar trabajo nuevo.

## Qué usa el módulo

Core ya tenía tareas/subtareas por cliente, responsables, tablero `/proyectos`, plantillas y
automatización nativa. Las cuatro tablas estaban instaladas y vacías. Se reutilizan sin DDL
ni migración de ClickUp. Hoy “proyecto” se representa por cliente y tarea raíz; no se inventa
otra entidad ni dependencias que el módulo aún no tiene.

PM puede crear tareas `pending` y editar nombre, descripción, estado, prioridad y fechas con un
encargo explícito y motivo. No puede borrar, reasignar personal, mover de cliente ni reparentar
tareas existentes por estas herramientas. Los estados son los mismos de Core; declarar `done`
no acredita por sí solo aceptación humana o ejecución externa. Las instrucciones exigen evidencia.

Una creación usa `operationKey` estable dentro del expediente. Core registra el hash de la
intención y deriva un UUID: la repetición recupera la tarea sin duplicarla; cambiar el contenido
con la misma clave devuelve 409. Una edición exige `updated_at` exacto; el tablero humano ahora
renueva también ese campo. Ante un conflicto hay que releer, no imponer la copia antigua.

El corte `CORE_TASKS_PROVIDER=native` afecta únicamente a esta instalación de Core. El portal
no usa fallback externo aunque esté vacío; helpers, webhook, registro de webhooks, kickoff legacy
y rama mensual dejan de usar ClickUp. Las credenciales/columnas antiguas y otros despliegues no
se tocan. La única rutina actual de Corp es el pulso semanal de memoria, sin referencias a
ClickUp, por lo que no requirió modificación ni se disparó durante las pruebas.

Detalle de contratos, auditoría no atómica, límites y rollback:
`/home/seis/642-Core-main/docs/PROJECTS-CORP-NATIVE.md`.

## Pruebas y despliegue

Las pruebas de Corp verifican que ningún perfil conserva ClickUp y que solo PM obtiene las
herramientas nativas de escritura. Las de Core cubren esquema, permiso, cliente, fecha, versión,
repetición, auditoría, paginación y corte sin red externa. Una ejecución concurrente de la suite
completa de Core tuvo dos timeouts de inicialización PGlite en News; se verifica de nuevo sin
compilación ni suites concurrentes, conservando todos los casos y registrando el resultado final.

`scripts/verify-native-projects.mjs --live-fixture` prueba las herramientas contra Core desplegado:
cliente inactivo sintético, tarea raíz/subtarea, repetición, avance a revisión, conflicto y permisos;
después elimina sus datos de prueba. La identidad de PM/expediente de esa prueba es metadata
sintética de operador: no es un expediente real decidido por un modelo. No hay llamadas pagadas,
correos, asignaciones de personas o publicaciones de prueba.

Resultado final: **233 pruebas de Corp aprobadas**, **365 de Core aprobadas y tres omitidas**
por fixtures externos no configurados; build de producción y TypeScript aprobados. Core se
verificó con un solo worker después de compilar: ambos grupos PGlite pasaron con los límites
originales, sin omitirlos ni ampliar los timeouts. Prueba real del script aprobada y limpiada;
se conservan 17 clientes y cero tareas. No hay todavía proyectos reales cargados ni una
importación de tareas históricas. `/proyectos` respondió 200 por LAN y HTTPS Tailscale, y
el webhook ClickUp 410. Corp reconectó Telegram; la rutina semanal de memoria no fue disparada.

Core quedó configurado con `CORE_TASKS_PROVIDER=native`. Respaldo privado del entorno:
`.env.local.bak.native-projects-20261105`; compilación anterior `.next.before-native-projects-20261105`
(ignorados en git). Se ajustó `core642.service` para reconocer SIGTERM/143 como parada normal.
Los secretos administrativos de Supabase, cifrado y puente no aparecieron en los bundles públicos.
La verificación de la página fue HTTP; no se hizo una prueba visual interactiva del tablero.
