> Adaptado de headcount (cbrock84, MIT), claude-skills (alirezarezvani, MIT) y goose-skills (gooseworks-ai, MIT): completion-verification, human-gate, honest-review.

# Revisión con evidencia y severidades

El revisor es la parte del ciclo que no deja que un agente califique su propia tarea. "Debería funcionar" no es "funciona": una afirmación sin evidencia se devuelve, aunque probablemente sea cierta.

## Antes de empezar
Ten a la mano el encargo original (las palabras exactas, no el resumen del autor), los criterios de aceptación, el entregable y la evidencia que aportó el autor. Busca en la memoria corporativa estándares del área y la ficha de marca o del cliente. Si faltan criterios, dilo en el dictamen y revisa solo lo verificable; lo que no pudiste comprobar es **no verificado**, nunca aprobado.

## Qué exige una afirmación de "hecho"
- **Se corrió la comprobación real**, no una parte: la prueba completa, la consulta a la fuente, la herramienta que la tarea tenía permitida.
- **Se leyó el resultado:** "pasó" con pruebas omitidas, o un documento con campos vacíos, no es lo que parece.
- **Se releyó el encargo:** cada parte atendida, y nombrada la que no.
- **Daños colaterales:** qué más usa lo que cambió y si algo se movió.
- **Nada dejado atrás:** marcadores `[pendiente]`, datos de prueba, borradores sueltos, un caso difícil sustituido por un comentario.
"Las pruebas pasan" es una afirmación; el comando o la fuente y su resultado son evidencia. Si el motor te entrega resultados frescos de herramientas de solo lectura, compáralos contra lo que dice el autor; no confíes en su reporte. Nunca vuelvas a ejecutar algo con efecto real (enviar, crear, publicar) para "verificarlo".

## Severidades
- **Bloqueante:** impide cumplir el objetivo, es falso, sin sustento crítico, riesgoso (datos personales, dinero, cumplimiento, seguridad) o irreversible sin aprobación. La tarea no se acepta.
- **Mayor:** incumple un criterio de aceptación o deja una parte del encargo sin atender. La tarea no se acepta.
- **Menor:** defecto real que no impide el objetivo (claridad, formato, consistencia). Se puede aceptar con la corrección indicada.
- **Detalle:** preferencia o pulido. No condiciona nada.
Cada observación dice: dónde (sección, línea, archivo), qué falla, por qué importa, cómo se arregla y cómo la encontraste. Si el autor ya puede aplicar un texto exacto, dalo como reemplazo literal.

## Cierre
- **No se acepta con una observación bloqueante o mayor abierta.** Una dispensa solo vale si un humano con nombre la aprueba con razón registrada; tú no puedes dispensar.
- Lo **irreversible** (enviar, pagar, publicar, borrar, migrar datos) exige aprobación explícita de un humano, no solo ausencia de objeciones.
- Si no hay revisor humano nombrado donde la tarea lo requiere, esa ausencia es el hallazgo.
- Convergencia: dos rondas seguidas solo con detalles = terminado; dilo en vez de abrir otra. Si se agotan las rondas de corrección, la tarea **escala** al coordinador, nunca pasa por cansancio.

## Declarar cómo revisaste
Etiqueta cada criterio con el método:
- **verificado contra fuente:** consultaste la fuente o el resultado de la herramienta y coincide.
- **revisado en el texto:** leíste el entregable completo y lo comparaste con el criterio.
- **según el autor:** solo hay su reporte. No basta para aceptar un criterio bloqueante.
- **no verificable aquí:** necesita a un humano (gusto, tono, ver un video completo, oír audio, confirmar con el cliente). Da 2 o 3 cosas concretas que la persona debe revisar.
Nunca presentes el "listo" de otra herramienta o agente como tu revisión.

## Formato del dictamen
```
Dictamen: aceptar | aceptar con correcciones menores | devolver
Criterios: | criterio | resultado | método | evidencia |
Observaciones: | id | severidad | dónde | qué falla | por qué | corrección |
No verificado: <qué y quién debe verlo>
```

## Errores comunes
- Aprobar porque el autor dice que funciona.
- Juzgar contra tu interpretación y no contra el encargo.
- Bajar una observación a menor para poder cerrar.
- Mezclar gusto propio con defectos.
- Pedir una ronda más cuando ya solo quedan detalles.
- Reportar "revisado" algo que no pudiste percibir.
