> Adaptado de headcount (cbrock84, MIT): quality-management.

# No conformidades y acciones correctivas

Una no conformidad es un entregable o un resultado que no cumple un criterio acordado. Se registra para corregir el caso y, sobre todo, para que no vuelva a pasar. El hallazgo que más se repite en cualquier revisión es una acción de la vez anterior que nunca se cerró.

## Antes de empezar
Busca en la memoria corporativa el registro de no conformidades, acciones abiertas y casos parecidos. Pide lo que falte y márcalo FALTANTE: el criterio incumplido, la evidencia del defecto (archivo, captura, mensaje del cliente) y la línea de tiempo.

## Cuándo se abre una
- Un defecto llegó al cliente (siempre).
- Un criterio bloqueante falló en revisión interna más de una vez para el mismo tipo de entregable.
- Una queja del cliente, aunque parezca menor.
- Un incidente operativo (automatización que mandó datos equivocados, publicación por error, archivo perdido).
Un error aislado detectado y corregido en revisión se anota en la revisión, no abre no conformidad.

## Registro
```
| id | fecha | entregable / cliente | criterio incumplido | evidencia | quién lo detectó (interno / cliente) | severidad | corrección inmediata | causa raíz | acción correctiva | dueño | fecha compromiso | medida de verificación | estado |
```
Severidad: **crítica** (daño al cliente, dinero, datos personales o reputación), **mayor** (incumple un criterio bloqueante), **menor** (incumple algo no bloqueante).

## Tres respuestas distintas
1. **Corrección inmediata:** arreglar el caso (rehacer la pieza, corregir el dato, retirar la publicación). Si implica cancelar o sustituir un CFDI, avisar a datos personales afectados o algo con el cliente, la decisión y la ejecución son humanas; verifica con el contador o el abogado.
2. **Acción correctiva:** quitar la causa para que no se repita.
3. **Acción preventiva:** aplicar lo aprendido a otros procesos donde podría pasar lo mismo.

## Causa raíz, no primera causa
"Error humano" es donde el análisis se detiene, no donde termina. Pregunta qué hizo el error fácil de cometer y difícil de notar: una plantilla ambigua, un paso que el sistema permite saltar, un encargo incompleto, una prisa premiada.
- Recorre la cadena hacia atrás (los "por qué" sucesivos) hasta llegar a algo que se pueda cambiar en la estructura: plantilla, campo obligatorio, paso que bloquea, criterio escrito, responsable claro.
- Si varias causas contribuyeron, regístralas todas y elige la acción que corta más.
- Sin culpables: un análisis que produce un nombre produce silencio la próxima vez.

## Acción correctiva que sirve
- **Estructural:** cambia el proceso, la plantilla o el sistema. "Tener más cuidado", "recordar al equipo" o "capacitar" solos no son acción correctiva: las mismas condiciones producirán el mismo error con otra persona.
- **Con dueño y fecha** aceptados por el dueño.
- **Con medida de verificación definida al abrirla:** qué tasa o señal debe moverse y en qué plazo.
- Pocas y hechas: una o dos acciones ejecutadas valen más que diez anotadas.

## Cerrar
Una acción se cierra con evidencia de que **el defecto dejó de ocurrir**, no con evidencia de que la acción se hizo. Revisa la tasa en la ventana acordada; si no se movió, la causa raíz era otra y se reabre. Si no hay volumen suficiente para saberlo, queda "implementada, sin verificar" con fecha de nueva revisión.

## Revisión mensual
- No conformidades nuevas por tipo de entregable y por origen (interno contra cliente).
- Acciones vencidas y sin evidencia: se escalan al CEO con su dueño.
- Patrones: el mismo criterio fallando en distintos proyectos apunta al proceso, no al proyecto.

## Qué escala
Calidad registra, analiza y propone. Comunicar al cliente, compensar, cancelar o rehacer con costo, y cambiar procesos de otra área lo aprueba un humano responsable.

## Errores comunes
- Cerrar por "acción realizada" sin ver si la tasa cambió.
- Atribuir a descuido y parar.
- Tratar la queja del cliente como caso aislado sin buscar el patrón.
- Acumular acciones abiertas que nadie revisa.
