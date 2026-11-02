> Adaptado de headcount (cbrock84, MIT) y claude-skills (alirezarezvani, MIT): test-driven-development, tdd-guide.

# Estrategia de pruebas y huecos de cobertura

Una prueba vale por el comportamiento que fija, no por las líneas que recorre. QA decide qué se prueba, en qué nivel, y dónde están los huecos que importan.

## Antes de empezar
Busca primero en la memoria corporativa y en el repo (lectura de git); pide lo que falte y márcalo FALTANTE:
- Especificación o criterios de aceptación del cambio, numerados si es posible.
- Pruebas existentes y cómo se corren (en VeridisCorp: `npm test` con el ejecutor de Node vía `tsx --test`; `npm run test:postgres` para lo que toca la base).
- Errores pasados en el módulo (memoria corporativa, historial de commits "fix").
- Reporte de cobertura si existe; si no, no lo inventes.

## Qué probar y qué no
Pregunta por cada unidad: si esto se rompiera en silencio, ¿quién lo notaría y cómo? Si nadie, sobra el código, no falta la prueba.
- **Sí:** lógica con ramas, límites (0, vacío, máximo, fechas en cambio de día), caminos de error, todo lo que ya falló una vez, contratos entre módulos (API ↔ frontend, API ↔ n8n), permisos.
- **No:** getters, comportamiento del framework, helpers privados ya cubiertos por la ruta pública, el texto exacto de un log.

## Niveles
| Nivel | Para qué | Ejemplo en el stack |
|---|---|---|
| Unitaria | Reglas de negocio puras | Cálculo de IVA por línea, validación de RFC, disponibilidad de turnos |
| Integración | Consultas y transacciones reales | Endpoint Express contra PostgreSQL de prueba, migración de Drizzle aplicada en limpio |
| Contrato | Que el consumidor no se rompa | Forma de respuesta que espera el frontend o un flujo de n8n |
| Extremo a extremo | Un flujo crítico completo | Alta de cliente → reserva → confirmación |
| Manual | Lo que no se automatiza aún | Revisión visual, impresión de un PDF |

Mockea la red y el reloj, no tus propios módulos: mockear tu código prueba el mock. La base de datos se prueba con una base real de prueba, no con un mock del ORM.

## Trazabilidad desde la especificación
Cada criterio de aceptación tiene al menos una prueba con nombre de comportamiento y referencia: `rechaza_reserva_en_horario_cerrado` (CA-3), no `test_reservas`. Un criterio sin prueba es un hueco; una prueba sin criterio se pregunta.

## Huecos de cobertura por prioridad
- **P0, crítico:** caminos de error sin probar en autenticación, permisos, dinero (cobros, facturas, CFDI), borrados y migraciones.
- **P1, alto:** ramas de la lógica central sin probar (descuentos, inventario, estados de una reserva).
- **P2, bajo:** utilidades y formato.
Cierra P0 primero. Un porcentaje de cobertura no es meta: cuenta líneas ejecutadas, no comportamiento fijado. Para detectar aserciones débiles en módulos P0, propone pruebas de mutación (cambiar `<` por `<=` y ver si alguna prueba falla) o de propiedades (codificar y decodificar devuelve lo mismo) cuando el espacio de entradas es grande.

## Reglas de calidad de una prueba
- Un comportamiento por prueba; si falla, se sabe qué se rompió.
- Debe haberse visto fallar al menos una vez por la razón correcta. Una prueba que pasa de inmediato no prueba nada; una que truena con error en lugar de fallar prueba otra cosa.
- Nunca debilitar una aserción para obtener verde.
- Cada error corregido trae su prueba de regresión escrita antes de la corrección.
- Sin dependencia de orden ni de estado compartido; cada prueba prepara y limpia sus datos.

## Cuándo parar y preguntar
Criterios contradictorios o ausentes, límites que solo conoce el negocio (monto máximo, horario), servicios externos sin comportamiento documentado, y lógica de seguridad o de dinero: los escenarios los aprueba un humano. Si el plan propuesto supera unas 50 pruebas, presenta un resumen por áreas y pide prioridad.

## Qué entregas
Matriz criterio → prueba → nivel → estado (ejecutada con salida / propuesta / no ejecutable y por qué), huecos P0-P2 con justificación, lo que se deja sin probar deliberadamente y por qué. La verificación de lo ejecutado sigue `evidencia-de-terminado.md`.

## Errores comunes
- Pruebas escritas después que confirman lo que el código hace, no lo que se pidió.
- Mockear el módulo bajo prueba.
- Suites que solo prueban el camino feliz.
- Borrar o saltar una prueba que falla para liberar.
