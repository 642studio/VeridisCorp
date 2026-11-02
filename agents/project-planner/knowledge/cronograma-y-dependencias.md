> Adaptado de headcount (cbrock84, MIT): schedule-development-and-analysis.

# Cronograma con lógica y dependencias

Un cronograma es un modelo de cómo se conecta el trabajo. Una lista de fechas tecleadas se ve igual en una presentación y se comporta muy distinto cuando algo se mueve.

## Antes de empezar
Busca en la memoria corporativa y en la ficha del proyecto (`pm`); pide lo que falte y márcalo FALTANTE:
- Entregables con definición de terminado.
- Fecha pedida y si es fija o deseable.
- Personas, agentes y equipos (cámara, servidor, cuentas de cliente) que intervienen, y su disponibilidad real.
- Esperas externas: aprobaciones del cliente, proveedores, permisos de locación, revisión de plataformas (tiendas de apps, Meta), días festivos y temporadas.
- Proyectos que compiten por las mismas personas.
Distingue siempre **fecha estimada** de **fecha acordada**: solo es acordada si un humano la confirmó con el cliente.

## Construir desde la lógica
- Cada tarea, salvo la primera y la última, tiene antecesora y sucesora. Una tarea con fecha y sin antecesora es una afirmación, no un plan.
- **Fin-a-inicio** es el tipo normal. **Inicio-a-inicio** y **fin-a-fin** describen traslapes reales (editar mientras se termina de grabar); úsalos en vez de fingir el traslape con una fecha adelantada.
- Las **esperas** representan algo real: ronda de revisión del cliente, tiempo de entrega de un proveedor, propagación de DNS. Una espera puesta para cuadrar fechas es un supuesto escondido.
- **No fijes fechas a mano** dentro de la cadena: cortan la lógica y el cronograma sigue mostrando una fecha que ya no puede sostener.
- Tareas pequeñas: que ninguna dure más que un periodo de reporte (una semana).

## Holgura y ruta crítica
- Holgura: cuánto puede retrasarse una tarea sin mover el final. La ruta crítica es la cadena sin holgura; ahí va la atención.
- Revisa también las **cadenas casi críticas**: con una mala semana se vuelven críticas y de ahí salen las sorpresas.
- **Holgura negativa** significa que el cronograma ya dice que la fecha es imposible. Repórtalo de inmediato al PM.

## Cargar recursos antes de creer las fechas
Un plan donde la misma editora trabaja en cinco tareas paralelas es ficción que se resuelve como retraso. Carga el recurso que limita (la única persona que edita, Adrián como aprobador, el servidor de oficina) y nivela. Nivelar alarga el plan; ese tiempo siempre existió, solo no estaba escrito.

## Puntos de convergencia
Donde varias cadenas llegan a un mismo hito (grabación + guion + locación → rodaje), el hito espera a la más tardía. La probabilidad de cumplirlo es menor que la de cada cadena por separado; por eso los planes con muchos frentes paralelos se atrasan aunque ninguno parezca atrasado. Pon colchón **antes de cada convergencia**, no solo al final.

## Línea base
Guarda la línea base aprobada y compara contra ella: planeado a hoy, terminado a hoy y lo que costó. Sin línea base, "vamos al 70%" no es 70% de nada. Se re-planea solo cuando cambió el alcance, diciendo qué cambió.

## Auditar un cronograma heredado (en este orden)
1. Tareas sin antecesora o sin sucesora.
2. Fechas fijadas a mano.
3. Holgura negativa.
4. Tareas más largas que un periodo de reporte.
5. Tareas "al 90%" por más de un periodo.
6. Línea base re-hecha tantas veces que ya no significa nada.

## Entregable
Tabla: id, tarea, responsable (o "por confirmar"), duración en rango, antecesoras y tipo, holgura, crítica sí/no. Debajo: ruta crítica en una línea, convergencias con su colchón, recursos sobrecargados y supuestos que moverían la fecha.

## Qué decide y qué escala
Planificación propone secuencia y fechas estimadas. Comprometer fechas con el cliente, mover prioridades entre proyectos o asignar personas lo aprueba el PM con el humano responsable.

## Errores comunes
- Aceptar una fecha sin lógica detrás.
- Calendarizar personas al 100% de su tiempo.
- Ignorar las rondas de revisión del cliente y los festivos.
- Re-planear para esconder la variación.
