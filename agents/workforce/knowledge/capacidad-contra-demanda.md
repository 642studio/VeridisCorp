> Adaptado de headcount (cbrock84, MIT) y claude-skills (alirezarezvani, MIT): capacity-and-demand-planning, capacity-planner.

# Capacidad contra demanda en una agencia con proyectos

Compara cuánto trabajo llega con cuánto puede absorber el equipo de verdad, persona por persona, y propone cómo resolver sobrecargas. PM conserva el seguimiento de entregas; tú das la foto de carga y opciones.

## Antes de empezar
Busca en la memoria corporativa; pide lo que falte (FALTANTE):
- Personas confirmadas (empleados, encargados, externos recurrentes), su rol, jornada y ausencias previstas (vacaciones, permisos, días festivos).
- Proyectos y servicios recurrentes por cliente, con fechas y estimación de esfuerzo en horas o en piezas (videos, publicaciones, sprints).
- Registro de horas reales o tareas cerradas en ClickUp de al menos los últimos meses.
- Picos conocidos: lanzamientos, campañas de temporada de los clientes, rodajes.
No inventes personas, disponibilidad ni estimaciones. Si solo hay promedios, dilo como limitación.

## 1. Demanda
Separa tres componentes:
- **Base**: lo recurrente (retainers de contenido, mantenimiento de 642APP, soporte del servidor). Estímala con el histórico propio, no con lo vendido.
- **Tendencia**: hacia dónde va en varios periodos, no en una semana.
- **Picos**: lanzamientos, temporadas, rodajes, incidentes. Los conocidos se planean; los desconocidos son para lo que sirve el margen.
Mide en la unidad en que llega el trabajo (horas por tipo de tarea, piezas, entregables), no en pesos facturados. Ingreso entre promedio es un pronóstico de promedios.

Planea con un escenario normal y uno alto (los días o semanas más cargados de tu histórico), no solo con el promedio: con el promedio fallas la mitad de las veces.

## 2. Capacidad efectiva
Capacidad = personas × horas disponibles × fracción dedicada al trabajo en cuestión.

La última parte es la que se olvida: juntas, revisiones con clientes, traslados a rodaje, capacitación, administración, interrupciones. Como referencia general, rara vez supera 70%. Calcula con horas efectivas, no con la jornada completa. Un plan al 100% falla la primera semana normal.

Incluye la curva de entrada: alguien nuevo no rinde como el resto en sus primeras semanas. No cuentes una contratación como capacidad completa desde el día 1.

## 3. Utilización y riesgo de sobrecarga
Utilización = horas asignadas ÷ horas efectivas, por persona y por semana.

| Banda (referencia general) | Lectura | Acción |
|---|---|---|
| Hasta ~70% | Holgura para picos e imprevistos | Puede tomar trabajo nuevo |
| ~70–80% | Zona sana de operación | Vigilar |
| ~80–85% | Las esperas crecen rápido y de forma no lineal | No asignar más; avisar a PM |
| >85% sostenido | Riesgo de colapso, retrasos y desgaste | Proponer reparto o renegociar fechas |

Mira también la **dispersión**: si entre la persona más cargada y la menos cargada hay una diferencia grande (como referencia, más de 30 puntos), el equipo está desbalanceado; repartir va antes que contratar.

Señales que anticipan el problema: tareas cuya antigüedad crece aunque la lista no crezca, la misma persona en el camino crítico de varios proyectos, horas fuera de horario, entregas que se mueven en cadena.

## 4. ¿Falta capacidad o hay problema de flujo?
- **Falta de capacidad**: llega más trabajo del que el equipo resuelve con utilización razonable → reasignar, externos, renegociar fechas o contratar.
- **Problema de flujo**: retrabajo, esperas de aprobación del cliente, entregas entre áreas, tareas en lote → enviar a process-improvement. Agregar gente aquí sube el costo y la coordinación.
La prueba: si el trabajo pasa más tiempo esperando que en proceso, es de flujo.

## 5. Opciones ante sobrecarga, en este orden
1. Repartir entre quien tiene holgura y la habilidad.
2. Repriorizar con PM y el responsable del cliente.
3. Mover fechas con acuerdo del cliente (lo negocia un humano).
4. Apoyo externo por proyecto (la clasificación laboral la valida el abogado).
5. Proponer contratación (ver `plan-de-personal.md`).

## Qué entregas
Tabla semanal: persona | horas efectivas | horas asignadas | utilización | proyectos | riesgo. Luego hallazgos, opciones con costo y efecto, supuestos y FALTANTES. Tú propones; la asignación la confirma el responsable humano con human-task-coordinator y PM. Nunca propones sanciones ni despidos por carga ni haces evaluaciones de desempeño.

## Errores comunes
- Planear con jornada nominal en vez de horas efectivas.
- Usar solo el promedio y no el escenario alto.
- Contratar para resolver un problema de flujo.
- Reportar el promedio del equipo y no ver a la persona al 110%.
