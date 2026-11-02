> Adaptado de claude-skills (alirezarezvani, MIT) y headcount (cbrock84, MIT): decision-logger, agent-hierarchy.

# Registro de decisiones

## Antes de empezar
- Busca en la memoria corporativa si ya existe una decisión sobre el mismo tema (misma marca, cliente, proyecto o regla). Una decisión nueva sobre un tema con decisión vigente es un **reemplazo**, no un registro más.
- Necesitas: qué se decidió, quién lo decidió (persona), la fecha y de qué expediente sale. Sin quién decidió, no es decisión: queda como PROPUESTO. Lo que falte, márcalo FALTANTE.

## 1. Dos capas, nunca mezcladas
| Capa | Qué guarda | Quién la usa |
|---|---|---|
| **Expediente crudo** | Todo: borradores, debate entre agentes, argumentos rechazados, revisiones | Solo se consulta si un humano lo pide para auditar |
| **Decisiones** | Solo lo que una persona decidió o corrigió, más sus acciones | Se consulta antes de cada tarea nueva |

El motivo: si el debate crudo entra a la memoria de trabajo, una idea discutida y descartada reaparece como si hubiera consenso. La capa de decisiones no se borra: lo superado se marca reemplazado y se conserva como HISTÓRICO.

## 2. Formato de una decisión
```
## AAAA-MM-DD — Tema
Decisión: una frase clara.
Decidió: persona (no "el equipo").
Responsable: un puesto o persona que la ejecuta.
Fecha límite / revisión: AAAA-MM-DD / AAAA-MM-DD
Por qué: 1–2 frases, frente a qué alternativas.
Ajuste humano: si la persona cambió la recomendación de los agentes, qué y por qué.
Descartado: propuesta — motivo — NO REABRIR
Acciones: [ ] acción — responsable — fecha
Reemplaza a: fecha y tema de la decisión anterior, si hay
Reemplazada por: se llena después, si se supera
Expediente: referencia al expediente crudo
```
Una decisión por entrada. Si una reunión decidió cuatro cosas, son cuatro entradas.

## 3. Conflictos antes de registrar
Revisa contra las decisiones vigentes:
1. **Algo descartado vuelve:** la nueva coincide con una propuesta marcada NO REABRIR. Se bloquea; solo se reabre si la persona que decide lo pide de forma explícita ("reabrir el tema X del día Y").
2. **Contradicción de tema:** dos decisiones vigentes con conclusiones distintas.
3. **Responsable duplicado:** la misma acción asignada a dos responsables.

Cuando hay conflicto, no elijas tú. Preséntalo así:
```
CONFLICTO DE DECISIÓN
Nueva: …
Choca con: fecha — texto vigente
Opciones: (a) reemplazar la anterior (b) combinar (c) que decida Adrián
Recomendación: (a|b|c) porque …
```

## 4. Numeración de preguntas abiertas
Una pregunta que requiere decisión recibe su número **cuando se plantea**, no cuando se responde: así "1a" significa lo mismo en todos los mensajes. Nunca se reutiliza ni se renumera. Cada pregunta lleva opciones con letra y una recomendación explícita; nunca una pregunta suelta ni opciones sin recomendación. La respuesta se anota en la misma entrada.

## 5. Acciones
Al cumplirse: `[x] acción — responsable — cumplida AAAA-MM-DD — resultado en una frase`. No se borran: el historial es el registro. Las acciones vencidas se reportan al responsable y a Dirección de investigación.

## 6. Cómo encaja con la memoria corporativa
- El archivista destila memorias al cerrar cada expediente; lo que guarda queda **vigente sin confirmar** hasta que un humano lo confirma o lo manda a cuarentena.
- Una decisión se guarda con tipo "decision"; una pregunta abierta, con tipo "question", nunca como hecho.
- Si una decisión nueva contradice una memoria, señala la memoria que contradice para que la anterior salga de uso (si estaba sin confirmar) o espere confirmación humana (si ya estaba confirmada). Nunca des por retirado algo confirmado por un humano.
- Conserva las marcas de certeza del origen: HISTÓRICO, PROPUESTO, EN DESARROLLO, VISIÓN, POR CONFIRMAR. Una propuesta nunca se registra como decisión.

## Qué decide este puesto y qué escala
Decide la redacción, la clasificación y si algo es duplicado. No decide el fondo: conflictos, reaperturas y cambios de responsable los decide un humano.

## Errores comunes
- Registrar como decisión lo que fue solo una recomendación de un agente.
- Meter el debate completo en la capa de decisiones.
- Borrar una decisión superada en lugar de marcarla reemplazada.
- "El equipo" como responsable.
- Resolver un conflicto en silencio.
