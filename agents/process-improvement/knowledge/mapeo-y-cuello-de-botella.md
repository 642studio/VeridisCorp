> Adaptado de headcount (cbrock84, MIT) y claude-skills (alirezarezvani, MIT): process-design, process-mapper.

# Mapear el estado actual y encontrar el cuello de botella

Úsalo cuando la misma falla se repite, una entrega entre áreas se cae, algo tarda mucho más que el trabajo en sí o antes de proponer automatizar con n8n o Make.

## Antes de empezar
Busca en la memoria corporativa el proceso documentado, quejas o incidentes previos y quién participa. Pide lo que falte y márcalo FALTANTE:
- Un caso real reciente de principio a fin (una cotización, un pedido, un alta de cliente, una pieza de contenido).
- Quién hace cada paso, con qué herramienta (WhatsApp, correo, ClickUp, 642APP, hoja de cálculo).
- Tiempos medidos o, si no hay, estimados marcados como estimados.
Si no existe ningún dato de tiempo, el primer paso es medir unas semanas, no mapear.

## 1. Mapear lo que pasa, no lo que debería pasar
- Sigue un caso real y anota cada paso, entrega, espera y retrabajo. Habla con quien lo hace: aparecerán pasos que no están escritos y otros que todos dejaron de hacer.
- Un proceso a la vez. Primero el estado actual; el estado futuro, después de encontrar la restricción.
- Por paso: nombre, responsable (persona o agente), tipo (**agrega valor**, **espera**, **retrabajo**), duración típica y duración en un mal caso, tamaño de lote (¿se junta todo para el viernes?).
- Carriles por responsable: así se ven las entregas entre áreas, que es donde se pierde el trabajo.

## 2. Medir
- **Tiempo de trabajo:** lo que de verdad toma hacerlo.
- **Tiempo total:** lo que tarda en salir.
- La diferencia es el proceso. En procesos rotos el trabajo suele estar esperando la mayor parte del tiempo (como referencia general, más de 90%); acelerar el trabajo casi no cambia nada. Ataca las esperas.
- Proporción de valor = tiempo que agrega valor ÷ tiempo total. Como referencia general: arriba de 25% sano, 10–25% típico en servicios, menos de 10% lleno de desperdicio.
- Retrabajo: cuántas veces regresa un caso. Los ciclos de retrabajo van en el mapa; esconderlos subestima el tiempo real.

## 3. Encontrar la restricción
Un solo paso gobierna cuánto sale. Es el que tiene fila delante. Señales (umbrales como referencia general):
- Un paso tarda más del doble que el promedio de los pasos de valor.
- Las esperas suman más de 40% del tiempo total.
- El retrabajo pasa de 15% de los casos.
Restricciones frecuentes que no son el paso obvio: un solo aprobador (muchas veces Adrián), una especialista por la que pasa todo, un sistema al que solo una persona tiene acceso, un lote semanal que hace esperar a todo.
Mejorar cualquier otro paso solo acumula trabajo frente a la restricción.

## 4. Rediseñar, en este orden
1. **Eliminar:** ¿el paso necesita existir? Muchos atrapan una falla que otro arreglo evitaría.
2. **Simplificar:** menos entregas, aprobaciones y sistemas. Cada entrega es un lugar donde el trabajo se detiene.
3. **Estandarizar:** una forma, escrita, con las reglas de decisión explícitas (ver `sop-con-dueno.md`).
4. **Automatizar:** al final. Automatizar un proceso sin revisar lo hace más rápido y más difícil de cambiar.
Baja la aprobación al nivel más bajo que pueda responder y pon umbrales para que lo rutinario no haga fila detrás de lo excepcional.

## 5. Que se sostenga
Un proceso que depende de disciplina se degrada en un trimestre. Mete el control al sistema: campos obligatorios, pasos que bloquean, valores por defecto correctos, entregas automáticas. **Nunca arregles una falla repetida con un recordatorio:** si la gente olvida un paso, el sistema permite olvidarlo.

## Entregable
1. Estado actual: pasos, responsables, tipo, tiempos (medido o estimado) y proporción de valor.
2. La restricción y su evidencia.
3. Rediseño con lo que se elimina, simplifica, estandariza y, si aplica, automatiza.
4. Costo de implementarlo (tiempo de personas, herramientas en MXN, riesgo).
5. La medida que mostrará que funcionó, su línea base y cuándo se revisa.

## Qué decide y qué escala
Mejora de procesos analiza y propone. Cambiar responsables, quitar aprobaciones o implementar automatizaciones lo aprueba el COO con el humano dueño del proceso; lo que toque datos personales o facturación se valida además con su área.

## Errores comunes
- Rediseñar desde el proceso documentado sin ver el real.
- Optimizar un paso que no es la restricción.
- Agregar una aprobación por una falla que pasó una vez.
- Meter más gente a un proceso que se atora en esperas.
- Entregar un proceso sin dueño ni medida.
