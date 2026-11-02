> Adaptado de headcount (cbrock84, MIT): completion-verification, test-driven-development, code-review.

# Evidencia antes de dar algo por terminado

La distancia entre "debería funcionar" y "funciona" es donde se pierde más tiempo. "Las pruebas pasan" es una afirmación; el comando y su salida son evidencia. QA no da por ejecutada una prueba que solo se propuso.

## Antes de empezar
Busca primero en la memoria corporativa y en el entregable; pide lo que falte y márcalo FALTANTE:
- La solicitud original con sus palabras exactas y sus criterios de aceptación.
- El cambio a verificar (diff, rama o commit) y su estado base.
- La evidencia que aporta el autor: comandos, salidas, capturas, fecha de ejecución.
- Qué consume lo que cambió (otros módulos, frontend, flujos de n8n, reportes).

## Niveles de evidencia
| Nivel | Qué significa | Cómo se reporta |
|---|---|---|
| Ejecutada | Se corrió el comando sobre el estado actual y se leyó la salida | Comando, salida relevante, fecha, entorno (sandbox, local, servidor) |
| Inspeccionada | Se leyó el código o la configuración, sin ejecutar | "Revisado por lectura; no ejecutado" |
| Propuesta | Existe el plan o la prueba escrita, sin correr | "Propuesta; pendiente de ejecución por <quién>" |
| No verificable | Falta acceso, datos o entorno | Qué falta y quién puede darlo |

Un hueco no declarado se lee como cubierto. Si algo no se pudo correr, se dice explícitamente.

## Lista de verificación
1. **Corre la verificación real**, la misma con la que el proyecto decide (en VeridisCorp: `npm run check` y `npm test`; `npm run test:postgres` si toca la base), sobre el estado actual, no un subconjunto.
2. **Lee la salida.** Código de salida 0 con pruebas saltadas, cero pruebas ejecutadas o advertencias nuevas no es lo que parece.
3. **Relee la solicitud original**, no tu interpretación de hace varios pasos. Marca cada parte: cumplida, parcial o no atendida.
4. **Busca daño colateral:** qué más consume lo que cambió; contratos, migraciones, flujos.
5. **Busca residuos:** logs de depuración, pruebas con `skip` u `only`, TODO en lugar del caso difícil, timeouts ampliados, validaciones desactivadas.
6. **Revisa las pruebas mismas:** ¿se vieron fallar antes de la corrección? ¿Fijan el comportamiento o pasarían con cualquier implementación? ¿El mock autoriza todo?
7. **Para errores corregidos:** existe reproducción que fallaba antes y pasa después.

## Señales de alerta
- "Ya quedó" sin comando ni salida.
- Salida de una ejecución anterior al último cambio.
- Pruebas eliminadas, debilitadas o marcadas como saltadas en el mismo cambio.
- Evidencia solo del camino feliz en un cambio que toca permisos, dinero o borrados.
- Cobertura alta presentada como prueba de calidad.
- El autor revisando su propio trabajo como única revisión.

## Veredicto
- **Aprobado:** todos los criterios con evidencia ejecutada; huecos menores declarados y aceptables.
- **Aprobado con condiciones:** criterios cumplidos, pero hay verificaciones propuestas pendientes; se listan con responsable.
- **Rechazado:** un criterio sin cumplir, una prueba que falla, evidencia ausente en un punto crítico (P0) o residuos que cambian comportamiento.
El veredicto de QA es una recomendación: liberar y desplegar lo decide un humano.

## Qué entregas
```
Cambio: <rama/commit>   Solicitud: <resumen fiel>
Criterio | Estado | Evidencia (nivel, comando, salida)
Daño colateral revisado: <qué y cómo>
Residuos: <ninguno / lista>
No verificado: <qué, por qué, quién puede>
Veredicto: <aprobado / con condiciones / rechazado> — motivo
```
Lo parcial reportado con exactitud es útil. Lo parcial reportado como completo le cuesta a otro descubrirlo, y la confianza.

## Errores comunes
- Aceptar la palabra del autor en lugar de la salida.
- Confundir "compila" con "funciona".
- Reportar en verde con pruebas saltadas.
- Omitir lo que no se pudo verificar en lugar de declararlo.
