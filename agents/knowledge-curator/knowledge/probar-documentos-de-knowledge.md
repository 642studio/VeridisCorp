> Adaptado de superpowers (obra, MIT) y anthropics/skills (Anthropic, Apache-2.0): writing-skills, skill-creator.

# Probar que un documento de knowledge cambia el comportamiento

Si no viste al agente fallar sin el documento, no sabes si el documento enseña lo correcto. Cada documento declarado viaja completo en cada llamada del puesto: cuesta tokens siempre, así que se gana su lugar con evidencia.

## Antes de empezar
Busca primero en la memoria corporativa; pide lo que falte y márcalo FALTANTE:
- El documento candidato (o el cambio) y el puesto que lo recibiría, con su `instructions.md`, `context.md` y los documentos que ya tiene.
- El fallo que motiva el documento: un encargo real donde el agente decidió mal, con su salida.
- Quién puede lanzar corridas con modelo real. Tú diseñas escenarios, rúbrica y lectura de resultados; correr y declarar en `config.json` lo hace un humano o software.

## El ciclo
1. **Base (sin el documento):** corre los escenarios con el puesto tal como está. Para editar un documento existente, la base es la versión anterior. Anota textual qué decidió y con qué excusas.
2. **Si la base no falla, no hay nada que escribir.** No se agrega el documento.
3. **Con el documento:** mismos escenarios; el agente ahora decide bien.
4. **Cerrar huecos:** si aparece una excusa nueva, agrega el contra concreto y vuelve a correr todo.
Escribe lo mínimo que ataca los fallos vistos, no casos hipotéticos.

## Escenarios
2–3 encargos como los diría Adrián o un cliente: concretos, con nombres de archivo, cifras, prisa y datos incompletos. Según el tipo de documento:
| Tipo | Cómo probar |
|---|---|
| Disciplina (una regla que se salta) | Presiones combinadas, al menos tres: prisa, autoridad ("Adrián dijo que ya"), costo hundido, cansancio, "ser práctico" |
| Técnica (un método) | Aplicarlo a un caso nuevo, variaciones e información faltante |
| Patrón (una forma de pensar) | ¿Reconoce cuándo aplica y cuándo no? Incluye contraejemplos |
| Referencia (datos y criterios) | ¿Encuentra el dato correcto y lo aplica bien? |
Incluye siempre casos cercanos donde el documento **no** debe aplicarse: comparten palabras con el tema, pero piden otra cosa.

## Forma según el fallo
| Fallo en la base | Forma que sirve | Forma que estorba |
|---|---|---|
| Conoce la regla y la salta bajo presión | Regla explícita, tabla de excusas con su respuesta, señales de alerta | Sugerencias suaves ("considera...") |
| Cumple, pero la salida tiene mala forma | Receta o contrato: las partes de la salida, en orden | Lista de prohibiciones |
| Omite un elemento | Campo obligatorio en la plantilla de entrega | Recordatorios sueltos |
| Depende de una condición | Condicional con algo observable ("si existe el brief, cítalo") | Regla general con excepciones |
Evita cláusulas de matiz ("no hagas X salvo que importe"): reabren la negociación. Explica el porqué en vez de gritar con mayúsculas.

## Micro-pruebas de redacción
Antes de los escenarios completos, prueba la frase misma:
- Una muestra limpia por llamada, con el prompt real del puesto, no la frase aislada.
- Siempre un control sin la guía. Si el control no falla, para.
- 5 o más repeticiones por variante: una sola muestra miente.
- Lee a mano cada coincidencia marcada; los conteos automáticos confunden ecos de la plantilla con aciertos.
- La varianza es una métrica: si cinco corridas dan cinco interpretaciones, la redacción no amarra.

## Evaluar
- **Lo objetivo:** aserciones verificables con nombre descriptivo ("marca FALTANTE en vez de estimar", "no inventa la tasa", "escala a un humano antes de enviar"). Una aserción que pasaría con cualquier salida no prueba nada.
- **Lo subjetivo** (tono, diseño): juicio humano. Opcional: un revisor compara dos salidas sin saber cuál tuvo el documento.
- Lee las transcripciones, no solo el resultado: si el documento hace perder pasos, recorta esa parte.
- Generaliza: si solo funciona con los ejemplos de prueba, no sirve.

## Título y arranque
En VeridisCorp no hay disparo por descripción: lo declarado se carga completo. El riesgo es que el agente no reconozca cuándo aplica o que lo aplique donde no va. Por eso:
- El `title` en `config.json` nombra la tarea con las palabras del encargo, no con jerga interna.
- Las primeras líneas dicen cuándo aplica, con los términos y síntomas que traería el pedido.
- Los casos cercanos negativos lo comprueban.

## Regresión
Propón una fila en `docs/agent-scenario-catalog.md` (encargo, agente, id del documento, frase guardarraíl exacta) para `test/agent-scenarios.test.ts`. Esa prueba solo confirma que la frase sigue ahí, no que el modelo decida bien; la corrida real se repite cuando cambia el documento o el modelo del puesto. Límites del motor: 10 documentos, 32,000 bytes por documento y 64,000 por puesto.

## Qué entregas
```
Documento: <ruta>   Puesto: <id>
Escenarios: <encargo, tipo, presiones>
Base: <decisión y excusas textuales>
Con documento: <resultado por aserción>
Huecos cerrados: <cambio y nueva corrida>
Veredicto: cambia / no cambia / empeora — recomendación: declarar, ajustar o retirar
```
Declarar o retirar lo aprueba un humano.

## Errores comunes
- "Es obvio, no hace falta probar."
- Escribir el documento antes de ver la base.
- Probar solo el caso feliz y sin presión.
- Ajustar el texto al ejemplo de prueba.
