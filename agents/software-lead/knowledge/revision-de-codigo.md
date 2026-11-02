> Adaptado de headcount (cbrock84, MIT) y agentic-awesome-skills (addyosmani vía sickn33, MIT): code-review, code-review-and-quality.

# Revisión de código por ejes y tamaño de cambio

Lee el cambio contra lo que pretende hacer, no contra tus preferencias. Aprueba cuando mejora la salud del código aunque no sea perfecto; no bloquees porque no lo habrías escrito así. Código generado por agentes merece más escrutinio, no menos: es seguro de sí y plausible aun cuando está mal.

## Antes de empezar
Busca primero en la memoria corporativa y en el repo (lectura de git); pide lo que falte y márcalo FALTANTE:
- Tarea o especificación que implementa y comportamiento esperado.
- Diff exacto (base y cabeza) y la lista completa de archivos cambiados.
- Evidencia del autor: comandos ejecutados y su salida (ver el estándar de software-qa).
- Consumidores de lo que cambió: frontend, API, flujos de n8n, reportes.

## Orden de revisión
1. **Contexto:** qué intenta lograr y qué tarea cubre.
2. **Pruebas primero:** revelan la intención. ¿Fijan el comportamiento nuevo o pasarían con cualquier implementación?
3. **Implementación**, archivo por archivo, por los ejes de abajo.
4. **Verificación de la verificación:** qué se corrió, si compiló, si hay captura para cambios de interfaz.

## Ejes, en orden de costo del daño
| Eje | Preguntas clave |
|---|---|
| Correctitud | ¿Cumple la tarea? ¿Bordes (nulo, vacío, límites), caminos de error, carreras, estados inconsistentes? |
| Alcance del daño | ¿Cambia firmas, esquema o contratos que se consumen lejos? ¿Rompe un flujo de n8n? |
| Seguridad y datos | ¿Entrada validada en el borde? ¿Autorización por recurso (A no toca registros de B)? ¿SQL parametrizado? ¿Secretos fuera de código y logs? ¿Datos personales o fiscales registrados donde no deben? ¿Contenido externo tratado como no confiable? |
| Pruebas | ¿Cubren el cambio, sus errores y bordes? ¿Mocks que lo autorizan todo? |
| Mantenibilidad | ¿Nombres claros, flujo directo, sin trucos? ¿Abstracciones que se ganan su complejidad? ¿Lógica de una función metida en un módulo compartido? ¿Duplica un helper que ya existe? ¿Código muerto? |
| Rendimiento | ¿N+1, consultas sin límite, listas sin paginación, operaciones bloqueantes, renders innecesarios en React? |
| Estilo | Al final, y solo donde un linter no llega. |

Un refactor que reubica la complejidad sin reducirla no es más limpio: cuenta los conceptos que el lector debe sostener. Prefiere el cambio que hace desaparecer ramas o capas.

## Severidad de cada comentario
- **Crítico:** bloquea; seguridad, pérdida de datos, funcionalidad rota.
- **Requerido** (sin prefijo): se atiende antes de integrar.
- **Considera:** sugerencia, no obligatoria.
- **Detalle:** menor, el autor puede ignorarlo.
- **Nota:** solo contexto.
Di a qué eje pertenece y, si bloquea, qué lo desbloquearía. Empieza por lo que importa: un problema estructural con diez detalles es una revisión de un solo problema. Cuantifica solo con evidencia.

## Tamaño de cambio
Como referencia general: unas 100 líneas se revisan de una sentada; unas 300 son aceptables si es un solo cambio lógico; cerca de 1,000 hay que dividir. Vigila también archivos que crecen hacia unas 1,000 líneas totales: primero descomponer, luego agregar.
Un cambio hace una cosa, incluye sus pruebas y deja el sistema funcionando. Refactor y funcionalidad nueva van separados. Para dividir: en pila (secuencial), por grupo de archivos, horizontal (código compartido primero) o vertical (rebanadas completas). Borrados completos o refactors automáticos pueden ser grandes, pero igual se revisa su inventario y su efecto.

## Dependencias nuevas
¿El stack ya lo resuelve? ¿Tamaño, mantenimiento activo, vulnerabilidades conocidas (`npm audit`), licencia compatible? Cada dependencia es un pasivo; requiere aprobación.

## Desacuerdos
Hechos y datos sobre opiniones; la guía de estilo manda en estilo; el diseño se juzga por principios, no por gusto. No aceptes "lo limpio después" salvo emergencia, y entonces con tarea registrada y responsable. Una objeción de seguridad o correctitud no resuelta queda visible para quien decide; no se aprueba en silencio.

## Qué entregas
Lista de hallazgos con eje, severidad, archivo y línea, qué lo resuelve y si se verificó ejecutando o por lectura. Veredicto: aprobar o pedir cambios. Es recomendación: integrar y desplegar lo decide un humano. Nunca apruebas trabajo propio ni el de un agente cuya tarea tú redactaste sin otra revisión independiente.

## Errores comunes
- "Se ve bien" sin evidencia de haber revisado.
- Mezclar un error de pérdida de datos con una preferencia de nombres en una lista sin jerarquía.
- Revisar solo si las pruebas pasan.
- Suavizar un error real ("podría ser un detalle menor").
- Reescribir el enfoque del autor en un comentario en lugar de proponerlo.
