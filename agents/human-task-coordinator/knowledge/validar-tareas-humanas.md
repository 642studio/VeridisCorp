> Adaptado de claude-skills (alirezarezvani, MIT) y headcount (cbrock84, MIT): human-gate, completion-verification.

# Validar tareas humanas con evidencia

Una tarea de una persona solo se considera completada con evidencia y con la validación del responsable humano. Que el agente haya preparado la asignación no acredita que alguien la aceptó, la hizo o la revisó. Este documento cubre cómo pedir, esperar y registrar esa validación; la revisión de contenido con severidades la hace `review`.

## Antes de empezar
Busca en la memoria corporativa quién es la persona o encargado confirmado, el responsable de aprobación, la tarea original, sus criterios y el último seguimiento. Pide lo que falte y márcalo FALTANTE. No inventes nombres, fechas acordadas, disponibilidad ni datos personales; lo que no está confirmado queda "por confirmar".

## Preguntas que fijan la tarea (una a la vez si hay ambigüedad)
1. ¿Quién, con nombre, aprueba el resultado? Sin aprobador nombrado no hay validación posible; eso es el hallazgo.
2. ¿Qué haría que lo rechace de entrada? Escríbelo como criterio antes de que la persona empiece.
3. ¿Es reversible? Si no (enviar al cliente, pagar, publicar, firmar, borrar, cambiar accesos), se requiere aprobación explícita, no solo falta de objeciones.
4. ¿Qué evidencia mostrará que se hizo? Archivo, tarea cerrada en ClickUp, foto de la entrega, CFDI, captura, mensaje de aprobación.
5. ¿Hay alguien disponible ahora? Si no, deja la tarea preparada y registra cuándo se da el siguiente seguimiento.

## Estados y qué los acredita
| Estado | Se acredita con |
|---|---|
| propuesta | El agente la preparó |
| pendiente de aceptación | Se entregó al humano para asignar (constancia de quién la recibió) |
| aceptada | La persona o encargado confirmó, con fecha |
| en curso | Constancia de inicio o avance reportado por la persona |
| bloqueada | Qué bloquea, de quién depende, siguiente paso |
| pendiente de validación | La persona reporta terminado y aporta evidencia |
| completada | El responsable humano validó contra los criterios |
No afirmes que algo se notificó, aceptó o ejecutó sin constancia. "Me dijeron que ya" queda como "reportado, sin evidencia".

## Reglas de validación
- **No se cierra con objeciones abiertas.** Si el aprobador dejó una observación bloqueante o mayor, la tarea sigue en pendiente de validación hasta que se resuelva.
- **Dispensas solo con razón registrada** y nombre de quien la autoriza. Una dispensa acepta objeciones; nunca sustituye que la revisión haya ocurrido.
- **Las correcciones del aprobador se registran literales.** Si reemplazó un texto, se aplica tal cual; parafrasearlo es pasar por encima de su decisión.
- **No esperes bloqueado.** Entrega la tarea, registra la fecha del siguiente seguimiento y termina; la respuesta humana puede tardar horas o días.
- **Límite de seguimientos.** Si una tarea pasa varios seguimientos sin respuesta o con la misma discusión sin avanzar, deja de insistir y escala al PM con lo que sigue abierto; el agotamiento nunca equivale a aprobación.

## Conflictos y cargas
Cambios de prioridad, sobrecarga o choques de puestos se concilian con el PM, RH y el encargado de área. Horarios, jornadas y lo que se puede pedir a cada persona son temas laborales: los define RH conforme a la LFT y las políticas internas; no los supongas.

## Registro por tarea
```
id · objetivo · persona (o por confirmar) · área · agente coordinador · aprobador
prioridad · fecha objetivo (zona horaria) · disponibilidad (confirmada / por confirmar)
dependencias · criterios de aceptación · reversible sí/no
estado · evidencia · observaciones abiertas · siguiente seguimiento
```

## Qué escala
Coordinación prepara, da seguimiento y registra. Asignar formalmente, aprobar, dispensar y cerrar lo hacen los humanos responsables. Bloqueos sin dueño o que vencen la fecha objetivo se escalan al PM con la decisión requerida.

## Errores comunes
- Marcar completada porque el agente entregó su preparación.
- Cerrar con una observación abierta porque "ya casi".
- Inventar un aprobador para poder avanzar.
- Insistir sin fin en vez de escalar.
- Parafrasear lo que corrigió una persona.
