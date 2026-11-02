> Adaptado de headcount (cbrock84, MIT): project-delivery.

# Entrega de proyectos de agencia

Un proyecto es trabajo acotado con un final: una campaña, un video, un sitio, un módulo de 642APP, una automatización de n8n. Varios proyectos hacia un mismo resultado se coordinan como programa, no como un proyecto grande.

## Antes de empezar
Busca primero en la memoria corporativa; pide lo que falte y márcalo FALTANTE:
- Cliente o marca, patrocinador (quien aprueba alcance y paga) y responsable humano del lado de 642.
- Objetivo de negocio y entregables concretos.
- Fecha pedida y si es fija (evento, lanzamiento, temporada) o deseable.
- Presupuesto o tope en MXN, anticipo y condiciones de pago acordadas.
- Personas y agentes disponibles y otros proyectos que compiten por ellos.
- Proyectos parecidos anteriores (duración real, problemas).

## Alcance por exclusión
Lo incluido se acuerda fácil y se entiende distinto. Lo que trabaja es la lista de exclusiones: qué **no** se entrega, por escrito y reconocido por el patrocinador.
- Ejemplos típicos en agencia: número de rondas de cambios, idiomas, música o fotos con licencia, pauta pagada, hosting, capacitación, mantenimiento después de la entrega.
- Lo que no se excluye por escrito regresa al final como "obviamente estaba incluido".

## Plan mínimo de entrega
1. Entregables con su **definición de terminado** acordada antes (qué criterio y quién lo acepta).
2. Estimación en rango con supuestos (detalle con `project-planner`).
3. Secuencia y ruta crítica: la cadena sin holgura. Solo un retraso en ella mueve la fecha; lo demás consume holgura.
4. Colchón a nivel proyecto, no escondido en cada tarea: el colchón por tarea se gasta solo.
5. Riesgos y dependencias con dueño y fecha de decisión (registro vivo con `project-tracker`).
6. Tareas de personas a través de `human-task-coordinator`; un entregable del agente no acredita que la persona hizo su parte.

## Avance: terminado o no terminado
El porcentaje de avance es optimismo autorreportado y se estanca en 90%. Mide entregables definidos como hecho / no hecho contra la definición acordada. Mira la tendencia: si lo que falta no baja al ritmo necesario, el proyecto va tarde aunque el reporte diga otra cosa.

## Control de cambios
- **Cambio** es todo lo que mueve alcance, fecha o costo, aunque llegue como "aclaración" o "detallito" por WhatsApp.
- Evalúa impacto en los tres antes de decidir: "sí, y suma una semana y $X" es una decisión; "sí" a secas rompe el plan sin avisar.
- Aprueba quien carga la consecuencia: si el cliente pide y el equipo absorbe la fecha, los cambios nunca paran.
- Registra también los cambios rechazados: evita que la misma petición regrese y explica por qué falta algo.
- Si el cambio altera precio, la cotización y la factura (CFDI) se ajustan con Finanzas antes de ejecutar.

## Recuperar un proyecto atrasado
1. Diagnostica la causa, porque los remedios no se cruzan: alcance mayor al entendido, capacidad menor a la planeada, dependencias que no entregan o estimación irreal desde el inicio.
2. Presenta opciones con consecuencias: recortar alcance (y qué), mover fecha (cuánto) o sumar capacidad (casi siempre tarde y lento al principio).
3. Re-planea una sola vez, a la vista. Varios aplazamientos de una semana destruyen la confianza más que un reinicio honesto.

## Qué decide el PM y qué escala
- Decide: secuencia, orden de tareas, a quién pedir insumos, qué reportar.
- Propone y escala a un humano: cambios de alcance, fecha o precio con el cliente, re-planeación, sumar personas, cualquier compromiso o pago.

## Entregable
Ficha del proyecto: objetivo, entregables con definición de terminado, exclusiones, fecha (estimada o acordada, dilo), ruta crítica, riesgos principales, decisiones pendientes con quién decide y para cuándo.

## Errores comunes
- Aceptar alcance sin exclusiones escritas.
- Dar una fecha puntual como compromiso sin rango ni supuestos.
- Reportar porcentaje de avance en vez de entregables terminados.
- Meter más gente a un proyecto atrasado y esperar que acelere.
- Tratar como aprobado lo que el cliente solo "vio" en una llamada.
