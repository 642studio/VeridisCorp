> Adaptado de claude-skills (alirezarezvani, MIT) y headcount (cbrock84, MIT): data-quality-auditor, data-engineering, data-governance.

# Calidad de datos: perfilar, probar y vigilar

La mayor parte del daño viene de datos válidos pero equivocados, no de código que truena. Las pruebas unitarias de transformaciones no lo detectan: hay que probar los datos mismos, dentro del pipeline, y fallar en voz alta. Mejor detener un pipeline que publicar datos en los que no confías.

## Antes de empezar
Busca primero en la memoria corporativa; pide lo que falte y márcalo FALTANTE:
- Conjunto o tabla, periodo, fuente y dueño.
- Columnas críticas: las que alimentan métricas clave o decisiones de dinero (montos, fechas, estados, llaves).
- Línea base conocida como buena (mes anterior, corte conciliado) si existe.
- Qué se va a hacer con el dato: tablero, conciliación, campaña, modelo.

## Auditoría de un conjunto nuevo
1. **Perfil por columna:** tipo, % nulos, valores distintos, más frecuentes, mínimo, máximo, formatos.
2. **Nulos:** cuántos, dónde se concentran (periodo, sucursal, canal) y por qué. Si faltan al azar se pueden imputar con cuidado; si faltan según el propio valor (quien más gasta no llena el campo), imputar sesga: escala al dueño.
3. **Atípicos:** rango intercuartil como método por defecto; z-score robusto (mediana y MAD) en distribuciones sesgadas como montos. Clasifica: error imposible (corregir o excluir), extremo legítimo (conservar y documentar) o desconocido (marcar, nunca borrar en silencio).
4. **Cruces:** llaves únicas, integridad referencial, duplicados, reglas lógicas (fecha de entrega ≥ fecha de pedido, total = subtotal + impuestos).
5. **Reporte** con hallazgos ordenados por impacto y plan de corrección.

## Fallas silenciosas típicas
- Nulos disfrazados: `0`, `-1`, `""`, `"N/A"`, `"null"`, `9999`. La completitud miente hasta que se detectan.
- Fechas sin zona horaria o en zona equivocada; fechas futuras o anteriores al arranque del sistema.
- Espacios y mayúsculas: `"activo "` ≠ `"Activo"` rompe joins.
- Codificación: acentos y ñ dañados al importar CSV.
- Montos con separadores mezclados (`1,234.50` contra `1.234,50`) o con y sin IVA en la misma columna.
- Texto libre usado como categoría con cientos de variantes.
- Llaves que no son únicas e invalidan joins y sumas.

## Pruebas dentro del pipeline
| Prueba | Detecta |
|---|---|
| Frescura: el registro más nuevo es suficientemente reciente | Fuente detenida que publica lo de ayer como hoy |
| Volumen dentro del rango esperado (no solo mayor que cero) | Carga truncada; caída a cero |
| Unicidad y no nulos en llaves | Duplicados, joins rotos |
| Integridad referencial | Ventas de clientes o productos inexistentes |
| Dominio: valores permitidos, rangos, formatos (RFC, código postal, correo) | Captura errónea |
| Distribución: cambio grande contra la línea base | Cambio en la fuente que nadie avisó |
| Total de control contra el sistema de registro | Diferencias en montos frente al ERP o los CFDI |

Elige de 5 a 8 columnas críticas para vigilancia continua, define umbrales con el dueño y corre las pruebas al ritmo de la ingesta. Una prueba que falla detiene la publicación y avisa; no se "arregla" en el tablero.

## Corregir
- Corrige en el origen o en la capa preparada, nunca en el tablero: si no, reaparece en cada consumidor.
- Confirma con el dueño la llave de unicidad antes de deduplicar.
- Si imputas, agrega una columna que indique que el valor fue imputado. Como referencia general de la fuente: con más de 30 % de nulos en una columna no imputes a ciegas; llévalo a revisión con el dueño.
- Toda corrección queda registrada: qué, por qué, cuántas filas, quién aprobó.

## Qué entregas
Reporte de calidad: alcance (tabla, periodo, filas), hallazgos por dimensión (completitud, consistencia, validez, unicidad, frescura) con conteos y ejemplos anonimizados, impacto en métricas, plan de corrección con responsable y pruebas propuestas para el pipeline. Datos personales: no copies registros identificables al reporte. Escala a data-lead lo que cambie una métrica publicada.

## Errores comunes
- Medir completitud sin buscar nulos disfrazados.
- Borrar atípicos porque "estorban".
- Probar solo que hay filas.
- Corregir el número en el reporte y no en la fuente.
