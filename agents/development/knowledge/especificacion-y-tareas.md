> Adaptado de agentic-awesome-skills (addyosmani vía sickn33, MIT) y headcount (cbrock84, MIT): spec-driven-development, planning-and-task-breakdown, test-driven-development.

# Especificación antes del código y tareas verificables

Código sin especificación es adivinar. La especificación es la fuente compartida entre el agente y quien aprueba: qué se construye, por qué y cómo se sabe que está terminado.

## Antes de empezar
Busca primero en la memoria corporativa y en el repo (lectura de git); pide lo que falte y márcalo FALTANTE:
- Objetivo, usuario y resultado esperado, en palabras de quien lo pidió.
- Especificación, criterios de aceptación o decisiones (ADR) que ya existan: úsalos, no los dupliques.
- Comandos reales del proyecto (en VeridisCorp: `npm run check`, `npm test`); no inventes otros.
- Convenciones del código cercano: nombres, estructura de carpetas, estilo de pruebas.

## Cuándo hace falta
Siempre que el cambio toque varios archivos, cambie datos o contratos, implique una decisión de arquitectura o los requisitos sean vagos. Una tarea simple no necesita una especificación larga, pero sí criterios de aceptación: dos líneas bastan.

## Especificación mínima
1. **Supuestos primero.** Lista lo que estás asumiendo antes de escribir nada ("el usuario ya está autenticado", "la tabla `clientes` es la fuente"). Lo ambiguo no se rellena en silencio.
2. **Objetivo:** qué y por qué, para quién, cómo se ve el éxito.
3. **Alcance y fuera de alcance.**
4. **Criterios de éxito comprobables.** Convierte lo vago en condiciones: "más rápido" pasa a "la lista de reservas responde en menos de X ms con N registros" (X y N los confirma un humano).
5. **Estrategia de prueba:** qué nivel cubre cada criterio (unitaria, integración contra PostgreSQL, manual).
6. **Límites:** siempre (validar entradas, correr pruebas), preguntar antes (cambios de esquema, dependencias nuevas, cambios de configuración), nunca (secretos en código, borrar pruebas que fallan).
7. **Preguntas abiertas** para el humano.

Si cambian decisiones o alcance, actualiza la especificación antes que el código.

## De plan a tareas
- Mapea dependencias: esquema → tipos → endpoint → cliente del frontend → interfaz.
- Corta en rebanadas verticales: cada tarea entrega un camino completo que funciona ("el usuario crea una reserva": esquema + API + UI), no "toda la base", luego "toda la API".
- Primero lo riesgoso, para fallar pronto.
- Contrato primero cuando dos tareas comparten una API; luego se pueden hacer en paralelo. Migraciones y cambios de estado compartido van en secuencia.

Plantilla por tarea:
```
Tarea N: <título sin "y">
Criterios: <máximo 3 condiciones comprobables>
Verificación: <comando, prueba o revisión manual concreta>
Depende de: <tareas o "ninguna">
Archivos probables: <lista>
Tamaño: S (1-2 archivos) | M (3-5)
```
Si una tarea pasa de unos 5 archivos, tiene más de 3 criterios, toca dos subsistemas o su título lleva "y", divídela. Pon un punto de control tras cada 2 o 3 tareas: pruebas en verde, compila, el flujo principal funciona y un humano revisa.

## Cambios pequeños
- Un cambio hace una cosa e incluye sus pruebas. Refactor y funcionalidad nueva van en cambios separados.
- Deja el sistema funcionando después de cada tarea.
- Sigue el patrón existente; si propones uno nuevo, justifícalo en la especificación.

## Prueba primero
Para cada criterio: escribe la prueba, ejecútala y mírala fallar por la razón correcta; luego el código mínimo que la pasa; luego limpia con la prueba en verde. Una prueba escrita después del código toma la forma de la implementación y no detecta que esté mal. La estrategia completa de pruebas es de software-qa.

## Qué entregas
Especificación (o los criterios si es simple), plan de tareas con verificación, y por tarea ejecutada: diff propuesto, comando corrido en el sandbox con su salida, y lo que quedó sin verificar. El agente no escribe en repos: entrega el cambio para que un humano lo aplique. Escala a software-lead decisiones de arquitectura, dependencias nuevas y cambios de esquema.

## Errores comunes
- Empezar a codificar sin saber qué significa "terminado".
- Implementar lo que no está en la especificación "porque ya estaba ahí".
- Tareas que dicen "implementar la funcionalidad" sin criterios.
- Planes donde todas las tareas son enormes y no hay puntos de control.
- Tomar los ejemplos de comandos como verificados sin correrlos.
