> Adaptado de headcount (cbrock84, MIT) y goose-skills (gooseworks-ai, MIT): benefits-realization, run-memory.

# Seguimiento de recomendaciones y beneficios logrados

Los proyectos se aprueban por beneficios prometidos y se cierran por alcance entregado. Seguimiento cierra esa brecha: revisa si lo recomendado se hizo, si funcionó y si el beneficio llegó.

## Antes de empezar
Busca en la memoria corporativa el registro de la revisión anterior, el caso o propuesta con que se aprobó el proyecto y la línea base. Pide lo que falte y márcalo FALTANTE. Sin registro anterior, dilo y empieza uno nuevo.

## Cada recomendación lleva
- **id** estable (si ya existe uno en ClickUp o en la minuta, usa ese; si no, `<YYYYMMDD>-<n>`). Una recomendación que se arrastra conserva su id; nunca dos ids para lo mismo.
- **Qué** en una línea y **dueño**: quién debe actuar (persona, agente o "pendiente de aprobación").
- **Revisar el:** fecha en que el efecto ya debería verse.
- **Cómo sabremos:** métrica, umbral y receta de la línea base (qué se mide, en qué ventana, de dónde sale el dato). Guarda la receta, no solo el número, para poder repetir la medición igual. Si no se puede medir, di "juicio" y qué mostraría que fue un error.

## Estados
| Estado | Solo cuando |
|---|---|
| hecho | Una fuente lo muestra: tarea cerrada, archivo entregado, cambio aplicado o el humano lo dice. Nunca por inferencia propia |
| no hecho | Una fuente muestra que no ocurrió o el humano lo dice |
| desconocido | Nada lo muestra. Di qué lo resolvería y pregunta una sola vez, con fecha |
| descartado | El humano lo descartó o otra recomendación lo reemplazó (di cuál) |
| abierto | Aún no llega su fecha de revisión. Se arrastra sin cuestionarlo |

Aprobado no es aplicado: la fecha que cuenta es cuando se ejecutó.

## Resultado de lo hecho
Al pasar la fecha de revisión, repite la medición con la misma receta y da un veredicto:
- **funcionó / no funcionó:** antes → después, con ventanas iguales y la fuente. Di qué empeoró, si algo empeoró.
- **muy pronto:** la fecha en que se podrá leer.
- **no se puede saber:** por qué (otros cambios en la misma ventana, datos incompletos, volumen muy bajo).
No repitas una recomendación que no funcionó salvo que algo importante haya cambiado (dilo). Una que el humano rechazó solo regresa con evidencia nueva y aclarando que ya se rechazó. Si algo lleva dos revisiones vencido sin evidencia, pregunta una vez si se mantiene o se descarta.

## Beneficios del proyecto
- Cada beneficio con medida, línea base, meta, fecha y un **dueño operativo después del cierre** (no el PM, que ya se fue a otro proyecto).
- Clasifícalos con honestidad:
  - **Ahorro real:** el gasto baja y se ve en una cuenta.
  - **Tiempo liberado:** vale solo si ese tiempo se usa en algo; no lo presentes como ahorro en pesos.
  - **Costo evitado:** legítimo y difícil de comprobar; trátalo con escepticismo.
  - **No financiero:** menos riesgo, cumplimiento, experiencia del cliente. A menudo es la razón real; dilo en vez de fabricar un número.
- Línea base **antes** del cambio, con el método anotado. Medida después de lanzar no es línea base.
- Revisiones programadas desde la aprobación (como referencia general: 90 días, 6 meses, un año) y se hacen aunque el resultado no guste.

## Revisión posterior
Dos preguntas: ¿llegaron los beneficios? ¿tomaríamos la misma decisión sabiendo lo que hoy sabemos? Incluye qué tan acertada fue la estimación; ese sesgo sirve para estimar el siguiente. Sin culpables, o no saldrá nada cierto.

## Entregable
"Desde la última revisión" en 3 a 5 líneas, tabla de recomendaciones (id, qué, dueño, revisar el, cómo sabremos, evidencia, estado) y tabla de resultados (id, veredicto, antes → después, ventanas, fuente). Sin datos personales de clientes ni de personas.

## Errores comunes
- Marcar "hecho" porque parecía lógico.
- Comparar ventanas de distinto largo o fuentes distintas.
- Presentar tiempo liberado como reducción de gasto.
- Recomendaciones sin dueño ni fecha que se arrastran para siempre.
