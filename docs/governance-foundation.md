# Núcleo de gobierno y evolución de VeridisCorp

Fecha original: 2026-10-22. Actualizado: 2026-10-24. Fase: Arranque.

Este diseño incorpora el checklist estructural y los ocho ajustes de arquitectura multiempresa. La primera entrega añadió contratos y funciones deterministas en `src/governance/`, verificadas localmente como módulo independiente. **Esa independencia ya no describe el estado actual**: `src/runtime/office-runtime.ts` usa `authorize()` de este módulo para decidir con permisos reales si una sesión puede crear, leer o escribir sobre un expediente, una tarea programada o un archivo — ver `permit()` en ese archivo y [runtime-pilot.md](runtime-pilot.md). Los 56 perfiles y checkpoints existentes conservan su formato.

## Integración posterior del piloto

La [ruta vertical gobernada de contenido](runtime-pilot.md) conecta estas reglas a sesiones verificadas, API HTTP, tareas, artefactos, aprobaciones, intentos, operaciones y auditoría persistentes en PostgreSQL. Es una ruta nueva y acotada; no transforma automáticamente `office.v1` en un servicio protegido. Las entradas antiguas de ejecución real se suspendieron para evitar un camino alternativo sin autorización. Las funciones aún independientes de este piloto mantienen el estado pendiente descrito abajo. El procedimiento del piloto contiene el alcance y las pruebas vigentes.

## Organización y ejecución

El organigrama seguirá expresando responsables y escalamiento. El nuevo módulo decide autorización por identidad, operación, recurso y alcance, independientemente del cargo: PM puede recibir permiso explícito para encargar una tarea a un agente de otra área sin alterar su superior organizacional. El destinatario debe poseer la capacidad requerida; recibir el encargo no concede permisos de datos o herramientas.

`authorizeDelegation` prueba esta separación. El motor actual aún usa `OrganizationDirectory.canDelegate`; su sustitución requerirá un contexto autenticado y una migración explícita, no una excepción dentro de un prompt. `agent-orchestrator` será la identidad de coordinación operativa cuando se conecte esta ruta; no se añadió un perfil que aparente operar con controles aún desconectados. CEO conservará dirección corporativa y excepciones.

## Entidades y acceso compartido

Una entidad conserva ID corporativo estable. `EntityRelationship` representa pertenencia, clientes atendidos por varias divisiones, participación en proyectos, suscripciones y recursos compartidos. Un cliente atendido por Studio, CRM y Media comparte identidad e historial de entidad; los registros y artefactos siguen teniendo acceso delimitado.

`AccessScope` exige workspace, empresa, división y cliente/proyecto explícitos. Un valor null identifica contexto sin cliente o proyecto, nunca un comodín. La primera política exige coincidencia exacta. Para acceder desde otro contexto se requieren tres condiciones: relación vigente, `ResourceAccessLink` explícito para recurso y operación, y permiso vigente de la identidad sobre el recurso de destino. Una relación comercial por sí sola no concede lectura. No se comparte entre workspaces.

El repositorio deberá resolver relaciones y vínculos actuales; una copia en un prompt o checkpoint no constituye una autorización. El transporte obtiene identidad y contexto de una sesión autenticada; los grants y el reloj proceden del servidor. Las funciones no autentican por sí mismas ni sustituyen filtros de consultas, protección de almacenamiento o control de acceso en la base de datos.

## Acciones y aprobaciones

`ActionRequest` vincula identidad solicitante, operación, recurso, parámetros, versión, vencimiento y clave de idempotencia. `actionDigest` calcula un hash determinista del contenido validado. Cambiar contenido, destino, versión o clave cambia la huella. Reordenar claves JSON no la cambia.

Una aprobación identifica un humano designado y la huella exacta de la acción. Solo ese humano, con permiso de aprobar y autoridad para la operación concreta, puede aceptar o rechazar; puede revocar una aprobación vigente. Antes de autorizar la ejecución se comprueban nuevamente los permisos del ejecutor y del aprobador. Una aprobación revocada, vencida o de otra versión no habilita la acción.

La política inicial exige aprobación para modificaciones de datos, publicación, comunicación externa, contratos, contratación y movimientos financieros. Lectura, borradores y encargos entre agentes requieren permiso aunque no exijan aprobación humana adicional. Las operaciones internas de control usarán rutas específicas; estos contratos no son una API pública para que el modelo emita autorizaciones.

Los registros de aprobación deben leerse desde un repositorio confiable. El hash vincula contenido; no es una firma ni prueba de identidad. El módulo todavía no consume aprobaciones atómicamente, bloquea repeticiones ni persiste su historial. El ejecutor futuro deberá resolver eso junto con idempotencia y auditoría. Referencias de aprobación en artefactos y decisiones son vínculos; validar su existencia y correspondencia requiere el servicio de aplicación.

## Capacidades independientes de puestos

`CapabilityDefinition` describe ID y versión, entrada y salida en JSON Schema, requisitos, herramientas, riesgos, modalidades y criterios de éxito. `CapabilityBinding` relaciona agentes con capacidades y especialización. `CapabilityCatalog` admite varios candidatos, controla duplicados y versiones y devuelve copias.

Estos descriptores todavía no validan cargas contra JSON Schema ni seleccionan automáticamente candidatos por costo o calidad. Tampoco reemplazan las capacidades declaradas de los 56 perfiles. La siguiente integración registrará las capacidades del piloto, verificará sus bindings frente al registro de agentes y añadirá validación de entradas y salidas. El catálogo no concede acceso a herramientas.

## Trabajo humano y memoria

`HumanTask` define asignado y aprobador humanos, coordinador agente, criterios, dependencias, fecha y zona horaria, evidencia y revisión. `transitionHumanTask` comprueba permisos y revisión esperada: el empleado acepta e informa ejecución; el responsable humano valida el cierre con evaluaciones de todos los criterios y evidencia existente. Se conserva quién validó, cuándo y sus evaluaciones. Las dependencias completadas deben provenir del repositorio autorizado, no de la respuesta de un agente.

No hay directorio de empleados ni persistencia de este ciclo todavía. La comparación de revisión detecta conflictos en la función; la escritura deberá comprobarla también de forma atómica. La evidencia referenciada deberá verificarse mediante sus fuentes y permisos. El gestor será propio; ClickUp no es una dependencia del diseño.

`CorporateMemoryRecord` separa propuestas, conocimiento validado y versiones sustituidas, con procedencia, fechas y confianza. `CorporateDecision` representa decisiones formales con responsable humano, fundamento, alternativas, entidades afectadas, aprobación, vigencia y referencia a la decisión sustituida. Los futuros repositorios deben resolver la versión aplicable y sus permisos; no basta con recuperar semánticamente un texto antiguo.

## Artefactos y cambios de requisitos

`ArtifactVersion` identifica pieza, versión, propietario, ámbito, estado, ubicación, hash, tareas, fuentes y aprobaciones. Los bytes se almacenarán fuera del checkpoint, mediante referencias verificadas y acceso autorizado. Un guion, imagen o reporte será un objeto versionado, no solo un mensaje.

Ante un cambio de brief o contenido se conservará la versión anterior y se calcularán nuevas acciones. El servicio deberá recorrer dependencias de versiones para invalidar únicamente aprobaciones afectadas y reorganizar tareas sin duplicarlas. La vinculación de aprobación a la huella ya está probada; el cálculo de impacto entre artefactos y tareas está pendiente.

## Eventos, compensación y recuperación

`BusinessEvent` contiene tipo, identidad de origen, ámbito, sujeto, correlación, causa, clave de deduplicación y confianza del contenido. Describe eventos como lead.created, contract.signed, payment.overdue y client.feedback_received. Aún no hay bus ni triggers. El ingreso deberá autenticar la fuente, deduplicar, validar payload por tipo y resolver un workflow autorizado. El payload no se convierte en instrucciones o permisos.

`ExternalOperation` representa preparación, envío, confirmación, resultado desconocido, compensación y conciliación manual. `planExternalRecovery` decide consultar al proveedor o conciliar cuando el proceso se interrumpe tras enviar una operación. Un resultado confirmado se conserva; un resultado incierto no autoriza repetición ciega. La repetición con la misma clave solo se propone si el conector dispone de garantía vigente de idempotencia del proveedor.

Faltan diario persistente, transacciones, outbox, reservas de workers, conectores y ejecución de compensaciones. Cancelar un workflow no equivale a revertir sus efectos externos. Una compensación debe tener autorización, identidad y trazabilidad propias; los efectos irreversibles se escalan para conciliación. Las pruebas actuales simulan el resultado incierto y verifican la decisión de recuperación; no prueban un reinicio contra un proveedor real.

## Costos, resultados y credenciales

`UsageRecord` registra cada intento, incluidos fallos, con agente, departamento, ámbito, proveedor, duración y consumo. Costo y tokens desconocidos usan null. `ExecutionBudget` define límites de gasto, duración, llamadas y profundidad. No existe todavía medición automática ni reserva presupuestaria: estos contratos preparan su implementación.

`BusinessOutcome` registra tiempo ahorrado, ingresos, margen, puntualidad, retrabajo o satisfacción con periodo, unidad, línea base, método y evidencia. Distingue observaciones, estimaciones y experimentos. Consumir pocos tokens no demuestra valor generado; atribuir ingresos exige una metodología y datos de negocio.

`CredentialBinding` describe organización, conector, identidad de servicio, cuenta del proveedor, operaciones y scopes, rotación, revocación y referencia de bóveda. Se valida únicamente una referencia vault://; no se resuelven secretos. No hay bóveda conectada. El ejecutor deberá comprobar simultáneamente permiso de VeridisCorp y alcance efectivo del proveedor. Los secretos se resolverán fuera del modelo y de los checkpoints; no se expondrán al catálogo público de agentes ni al historial de auditoría.

## Secuencia de implementación

| Fase | Entrega siguiente | Comprobación de salida |
| --- | --- | --- |
| 1. Identidad y autorización | Repositorios de identidades, entidades, relaciones y permisos; catálogo de capacidades del piloto; resolución de credenciales | Acceso autorizado multicuenta y denegación de cruces no permitidos |
| 2. Ejecución durable | Tablas de aplicación, diario de operaciones, auditoría, outbox, eventos y recuperación | Reinicio tras envío sin repetir efectos confirmados; conciliación de resultados inciertos |
| 3. Aprobaciones y herramientas | Servicio de aprobación, artefactos versionados, ejecución autenticada, claves de idempotencia y compensaciones | Cambiar una pieza invalida las autorizaciones afectadas y conserva las demás |
| 4. Memoria y trabajo humano | Entidades compartidas, decisiones vigentes, directorio, persistencia de tareas y disponibilidad | Encargo mixto con aceptación y validación humanas verificadas |
| 5. Costos y evaluación | Medición y reservas de presupuesto, selección evaluada de modelos y KPIs de negocio | Límites durante la ejecución y resultados comparables con línea base |
| 6. Procesos y departamentos | Workflow de contenido y siguientes procesos por división, también disparados por eventos | Flujo completo con permisos, cambios de requisitos y recuperación externa |

Los límites básicos de gasto y tiempo se conectarán antes de realizar llamadas reales, aunque la fase 5 amplíe su medición. No se activarán todos los departamentos y perfiles a la vez.

## Archivos de esta entrega

- `src/governance/contracts.ts`: identidad, acceso, permisos, acciones, aprobaciones, tareas humanas, memoria, presupuesto, consumo y auditoría.
- `src/governance/enterprise-contracts.ts`: relaciones, capacidades, eventos, decisiones, artefactos, operaciones externas, KPIs y referencias de credenciales.
- `src/governance/authorization.ts`: permisos sobre recursos y asignación independiente del organigrama.
- `src/governance/approvals.ts`: vinculación y comprobación de aprobaciones.
- `src/governance/human-tasks.ts`: transiciones y validación humana.
- `src/governance/capabilities.ts`: catálogo versionado de capacidades y candidatos.
- `src/governance/recovery.ts`: decisión conservadora ante resultados externos inciertos.
- `test/governance.test.ts`: pruebas de reglas y contratos, sin acciones externas.
