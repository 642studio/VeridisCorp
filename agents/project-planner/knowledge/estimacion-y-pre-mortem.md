> Adaptado de headcount (cbrock84, MIT) y pm-skills (phuryn, MIT): estimating-and-contingency, pre-mortem.

# Estimación con contingencia y pre-mortem

Una estimación es una afirmación sobre un futuro incierto. Si se trata como compromiso de quien dijo el número, se infla, nadie la cree y se vuelve a inflar.

## Antes de empezar
Busca en la memoria corporativa proyectos parecidos (duración y costo reales, no los cotizados), tarifas internas y costos de proveedores. Pide lo que falte y márcalo FALTANTE: alcance con exclusiones, quién hará cada parte y qué tan seguro está el alcance.

## Descomponer antes de estimar
- Divide hasta que quien hará la tarea pueda imaginarse haciéndola: en general una o dos semanas de esfuerzo o menos.
- **Alcance olvidado** (la falla más grande): integración, migración de datos, ambientes, pruebas, documentación, capacitación, rondas de cambios, traslados a locación, coordinación con el cliente. Casi nunca tienen dueño y por eso no se estiman.
- **Contingencia doble:** colchón dentro de cada tarea y además una reserva encima. Elige una.

## Método según lo que sabes
- **Análogo:** escalar desde un proyecto pasado. Rápido; requiere historia real y decir en voz alta qué es parecido y qué no.
- **Paramétrico:** tasa × cantidad (horas por pieza de contenido, por pantalla, por flujo de n8n). Solo vale si la tasa sale de datos propios.
- **De abajo hacia arriba:** estimar cada pieza y sumar. Más preciso y más caro; úsalo cuando el trabajo ya se entiende.
Cuando el número importa, usa dos métodos. Si difieren por más de una cuarta parte (como referencia general), hay un supuesto que nadie ha dicho.

## Base de la estimación
Lo durable no es el número, es la base: qué incluye, qué excluye, tasas y cantidades usadas, supuestos y quién aportó cada dato. Sin base no se puede defender, actualizar ni aprender cuando el proyecto sale al doble.

## Rango y confianza
Entrega rango (optimista, probable, pesimista) y di qué significa: "lo lograríamos 8 de cada 10 veces" es distinto de "es el mejor caso". El rango se angosta cuando se aprende (tras descubrimiento, primera entrega, primera integración), no cuando se acerca la fecha. Publica la revisión; no sostengas en silencio el número viejo.

## Contingencia contra reserva
- **Contingencia:** cubre lo conocido que variará. Es del proyecto y se usa cuando un riesgo se materializa.
- **Reserva de dirección:** cubre lo que nadie ha imaginado. La libera Adrián o Finanzas, no el equipo.
Juntarlas hace que la contingencia se gaste temprano en variación normal y no quede nada para lo grave. En cotizaciones a clientes, cómo se refleja cada una lo decide un humano con Finanzas.

## Pre-mortem
Hazlo antes de comprometer fecha o precio, con el plan ya escrito.
1. Imagina que el proyecto se entregó y fracasó: tarde, sobre presupuesto o el cliente no quedó contento. ¿Qué pasó? ¿De qué estuvimos demasiado seguros?
2. Clasifica cada causa:
   - **Tigre:** problema real con evidencia o lógica clara. Requiere acción.
   - **Tigre de papel:** preocupación que parece válida pero es improbable o exagerada. Se documenta y se explica por qué no.
   - **Elefante:** algo que nadie está discutiendo y podría ser real. Se investiga.
3. Clasifica los tigres: **bloquea la entrega**, **se atiende en los 30 días siguientes** o **se vigila**.
4. Para cada tigre que bloquea: mitigación concreta, dueño, fecha de decisión. Pásalo al registro de `project-tracker`.
5. Ante la duda, cuéntalo como tigre. Repite el pre-mortem a 2 o 3 semanas de la entrega para ver si las mitigaciones avanzan.

## Entregable
Estimación: rango con nivel de confianza, base (incluye, excluye, método, tasas, supuestos, fuentes), contingencia y reserva por separado. Pre-mortem: tablas de tigres, tigres de papel y elefantes, con plan para los que bloquean.

## Errores comunes
- Dar un número puntual para trabajo sin descomponer.
- Recortar la estimación para que quepa en el presupuesto sin recortar alcance: eso es decidir un sobrecosto por adelantado.
- Estimar solo el camino feliz.
- Castigar la re-estimación: así nadie vuelve a estimar con honestidad.
- Usar el pre-mortem para culpar en vez de prevenir.
