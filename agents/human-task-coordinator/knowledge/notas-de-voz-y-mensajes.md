> Adaptado de awesome-llm-apps (Shubham Saboo, Apache-2.0): thinking-out-loud.

# Mensajes y notas de voz de Adrián: resumen antes de actuar

Un mensaje largo o una nota dictada transmiten mucho contexto, pero el riesgo no está en lo que entendiste, sino en lo que completaste sin darte cuenta. Por ejemplo, "el de edición" se convierte en una persona concreta, "para el viernes" en una fecha que nadie fijó, o una idea que Adrián descartó a media nota sobrevive como decisión. Eso no se siente como duda, así que nunca se convierte en pregunta. La solución es un **eco**: un resumen corto y auditado que separa lo que dijo Adrián de lo que agregaste tú. Él corrige tres líneas en vez de deshacer asignaciones mal hechas.

Revisado en el código el 2026-11-08: el puente de Telegram solo lee texto. Una nota de voz llega al motor únicamente si viene dictada o transcrita como texto. Si Adrián menciona un audio que no llegó, pídele que lo reenvíe como texto.

## Antes de empezar
Busca en la memoria corporativa a las personas, proyectos y clientes que menciona el mensaje, junto con sus responsables y fechas ya confirmadas. Si algo no está confirmado, queda "por confirmar". No resuelvas apodos, roles ni fechas con suposiciones.

## Cuándo usarlo
- El mensaje es largo, con poca puntuación, frases que se reinician o cambios a media idea ("no, mejor…", "olvídalo").
- El mensaje viene dictado o tiene un aviso como "te lo dicto", "perdón por los errores".
- Adrián dice que quiere pensar en voz alta o que le ayudes a aterrizar una idea.

No se usa con encargos cortos y claros, ni con texto ya estructurado (una lista o una especificación pegada), ni cuando pide la transcripción literal o la minuta, ni ante una pregunta directa que solo espera respuesta.

## El contrato
1. **No actúes hasta que apruebe el eco.** No propongas asignaciones, no crees tareas ni avises a nadie. Primero reconstruye.
2. **Etiqueta todo lo que agregues.** Tus inferencias y supuestos van en su propia sección, nunca en boca de Adrián.
3. **Muestra cada cambio de postura.** Adopta la última y señala el cambio. Nunca promedies ni elijas en silencio.
4. **No pierdas nada.** Los temas sueltos se apartan; no se borran.
5. **No comentes errores de dictado.** Corrige palabras mal transcritas, muletillas y reinicios por contexto. Conserva sus palabras y los nombres de proyectos tal como los dice.
6. **Pregunta antes de guardar.** El resumen aprobado no se guarda en la memoria sin su permiso.

## El eco
Un solo mensaje, que se lea en el celular. Como referencia de la fuente, bastante menos de 250 palabras para una nota de diez minutos.

```
Objetivo: <una frase: qué quiere lograr de verdad>
Decidido:
- <decisiones y restricciones; marca la que dijo que es prioridad>
Abierto:
- <lo que el mensaje planteó y no resolvió>
Cambios y pendientes:
- Cambió: <A>, luego <B>. Voy con B.
- Aparte: <tema suelto, una línea>
Lo que agregué yo (corrige esto primero):
- Inferido: <implícito, nunca dicho>
- Supuesto: <hueco que llené>
Corrige lo que no cuadre, sobre todo lo que agregué. ¿Te pregunto lo abierto?
```

Reglas:
- Nada aparece dos veces.
- No repitas "dijiste que…". Todo lo que está fuera de "Lo que agregué yo" es de Adrián por definición.
- Una línea por punto.
- Lo vago nunca se resuelve en silencio. Expresiones como "lo de siempre", "el chavo de video", "pronto", "la otra semana" o "el cliente nuevo" van a Abierto o a Supuesto, nunca a Decidido como si fueran dato.
- En tareas para personas, cuida en particular quién la hace, quién aprueba y la fecha con zona horaria. Ninguno de esos datos se infiere.

## Preguntas (solo si las acepta)
- Pregunta solo por lo que está en Abierto o en Supuesto.
- Haz una pregunta por mensaje, empezando por la que más cambia el plan, y di en pocas palabras por qué importa.
- Haz cinco como máximo. Detente cuando las respuestas ya no cambien nada.
- Después, reenvía solo las secciones del eco que cambiaron.

## Si llega en varios mensajes
Si Adrián avisa que va a mandar varias partes, responde una sola vez: "Te escucho; dime 'listo' cuando quieras el resumen". Por cada mensaje siguiente, contesta con una confirmación mínima. No resuelvas, no analices ni preguntes a media explicación. Si hace una pregunta directa, contéstala en dos frases como máximo y vuelve a escuchar. Entrega el eco cuando diga "listo", "ya", "¿qué entendiste?" o algo equivalente.

## Después de aprobado
1. Ofrece tres opciones de guardado: en la memoria corporativa, en el expediente de la tarea o solo en esta conversación.
2. Convierte lo decidido en propuestas de tarea humana con el registro de `validar-tareas-humanas.md`. Lo que siga en Abierto pasa como "por confirmar".
3. El eco aprobado manda durante el resto del trabajo. Respeta lo decidido sin volver a preguntarlo.

## Errores comunes
- Empezar a asignar mientras Adrián sigue explicando.
- Convertir "el de edición" en un nombre propio sin confirmarlo.
- Quedarse con la primera versión de una idea que él cambió.
- Un eco más largo que el mensaje original.
- Corregirle la ortografía o comentar la transcripción.
- Guardar en la memoria sin preguntar.
