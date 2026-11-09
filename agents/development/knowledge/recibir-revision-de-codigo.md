> Adaptado de superpowers (obra, MIT): receiving-code-review.

# Recibir una revisión de código

Una revisión se evalúa técnicamente, no se actúa con cortesía. Verifica antes de aplicar, pregunta antes de suponer: la corrección técnica pesa más que la comodidad social.

## Antes de empezar
Busca primero en la memoria corporativa y en el repo (lectura de git); pide lo que falte y márcalo FALTANTE:
- Todos los comentarios de la revisión, completos, con su severidad.
- El cambio revisado (rama o commit) y la tarea o especificación que implementa.
- Decisiones previas registradas sobre ese módulo (ADR o memoria confirmada).
- Quién revisa: Adrián, software-lead, review, software-qa, security-review u otra fuente.

## El patrón
1. **Leer** todo sin reaccionar.
2. **Entender:** reformula cada pedido con tus palabras o pregunta.
3. **Verificar** contra el código real: `repo.read`, búsqueda de usos, pruebas en el sandbox.
4. **Evaluar:** ¿es correcto para ESTE código y este stack?
5. **Responder:** reconocimiento técnico u objeción razonada.
6. **Aplicar** uno por uno, probando cada uno.

## Comentarios poco claros
Si algún punto no se entiende, no apliques nada todavía: los puntos suelen estar relacionados y entender a medias produce un cambio equivocado. Responde: "Entiendo 1, 2, 3 y 6; necesito aclarar 4 y 5 antes de avanzar."

## Según quién revisa
- **Adrián:** confiable; aplica después de entender. Pregunta si el alcance no es claro. Si contradice una decisión registrada, señálalo antes de aplicar.
- **Agentes revisores o terceros:** antes de aplicar, comprueba: ¿es correcto para este código?, ¿rompe algo que funciona?, ¿hay una razón para la implementación actual?, ¿funciona en todas las versiones que usamos (Node, PostgreSQL, navegadores)?, ¿el revisor tenía el contexto completo?
- **Si no puedes verificarlo:** dilo. "No puedo comprobarlo sin X. ¿Investigo, pregunto o sigo?"
- **Si choca con una decisión de arquitectura:** para y escala a software-lead o a Adrián.

## Chequeo YAGNI
Cuando la revisión pide "hacerlo bien" (métricas, filtros, exportar a CSV, caché), busca primero si alguien usa ese código. Si nada lo llama: "Nada consume este endpoint; ¿lo retiramos en vez de ampliarlo?" Si se usa, se implementa bien. Tú y el revisor responden al mismo negocio: lo que no se necesita no se agrega.

## Orden de aplicación
1. Aclarar todo lo que no se entienda.
2. Bloqueantes: lo que la revisión marca **Crítico** (seguridad, pérdida de datos, funcionalidad rota).
3. Lo **Requerido** simple: nombres, importaciones, tipos.
4. Lo **Requerido** complejo: lógica, refactor.
5. **Considera** y **Detalle:** decide con criterio y di qué hiciste.
Prueba cada corrección por separado y al final corre la verificación completa (`npm run check`, `npm test`; `npm run test:postgres` si toca la base) para descartar regresiones.

## Cuándo rebatir
- La sugerencia rompe funcionalidad existente o una prueba que hoy pasa.
- El revisor no tenía el contexto (un consumidor en n8n, un contrato con el frontend).
- Viola YAGNI.
- Es incorrecta para este stack (Express, Drizzle, React).
- Hay razones de compatibilidad (datos ya guardados, clientes con versión anterior).
- Contradice una decisión de arquitectura aprobada.
**Cómo:** con razones técnicas, no a la defensiva; cita la prueba, el archivo y la línea o la salida del comando; haz preguntas específicas. Un Crítico que rebates queda visible para quien decide, nunca se cierra en silencio.

## Respuestas que no se dan
- "¡Tienes toda la razón!", "¡Excelente punto!", "Gracias por…": actuación, no información.
- "Lo implemento ahora" antes de verificar.
**En su lugar:** "Corregido: validación de RFC movida al esquema Zod (`src/clientes/schema.ts:42`); prueba nueva en verde." O simplemente el cambio con su evidencia.
**Si rebatiste y estabas equivocado:** "Verifiqué X y tenías razón: hace Y. Lo corrijo." Sin disculpas largas ni defensa del rechazo.

## Qué entregas
```
Revisión de: <quién>   Cambio: <rama/commit>
# | Comentario (resumen fiel) | Decisión | Evidencia
  Decisión: aplicado / rebatido / pendiente de aclarar / no verificable
  Evidencia: comando y salida, o archivo:línea
Verificación final: <comandos y resultado>
Escalado: <qué, a quién, por qué>
```
Propones el cambio; integrar y desplegar lo decide un humano.

## Errores comunes
| Error | Corrección |
|---|---|
| Aceptar por cortesía | Reformula el requisito o actúa |
| Aplicar sin verificar | Compara contra el código primero |
| Aplicar todo junto sin probar | Uno por uno, prueba cada uno |
| Suponer que el revisor tiene razón | Comprueba si rompe algo |
| Evitar rebatir | La corrección técnica manda |
| Aplicar solo lo que entendiste | Aclara todo primero |
| Seguir sin poder verificar | Declara el límite y pide dirección |
