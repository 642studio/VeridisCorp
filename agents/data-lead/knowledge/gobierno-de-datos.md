> Adaptado de headcount (cbrock84, MIT): data-governance, chief-data-officer.

# Gobierno de datos y priorización

Los problemas de datos se presentan como discusiones sobre números: dos reportes dan ventas distintas, nadie está equivocado y la junta se va en conciliar. Bien hecho, el gobierno no es una fila de aprobaciones: hace que los datos se puedan usar sin preguntar a nadie.

## Antes de empezar
Busca primero en la memoria corporativa; pide lo que falte y márcalo FALTANTE:
- Inventario de fuentes (ERP 642APP, CFDI, hojas de cálculo, plataformas de anuncios y redes, n8n, memoria corporativa) y quién las alimenta.
- Métricas que hoy usa la dirección y dónde se calculan.
- Quién tiene acceso a qué, y qué datos personales o fiscales hay en cada fuente.
- Solicitudes de datos pendientes con su solicitante y fecha.

## Una métrica, una definición, un dueño
El artefacto de más valor es el diccionario de métricas. Por cada métrica:
- **Definición en lenguaje simple:** qué cuenta y qué excluye a propósito.
- **Cálculo sin ambigüedad:** tabla fuente, filtros, grano, zona horaria, con o sin IVA, tratamiento de cancelaciones y notas de crédito.
- **Dueño:** una persona que decide cuando hay disputa.
- **Advertencias:** cuándo engaña y qué cambió en su historia (con fecha).
Cuidado con las que parecen obvias: "venta", "cliente activo", "lead", "proyecto cerrado" tienen varias definiciones defendibles. Pocas métricas que de verdad se usan valen más que un diccionario de cientos que nadie lee. Cambiar una definición es una decisión con fecha; las cifras anteriores se reexpresan a propósito, no en silencio. Un área no bifurca una definición para que su número se vea mejor.

## Fuente autorizada y dueños
- Para cada tipo de hecho, una sola fuente autorizada (p. ej. ingresos facturados: CFDI emitidos; reservas: ERP). Dos sistemas que dicen ser la verdad del mismo hecho es un defecto.
- Cada conjunto de datos tiene un dueño con nombre, responsable de su calidad y acceso. El dueño está del lado del significado de negocio, no del pipeline.
- Lo que no tiene dueño se degrada sin que nadie lo note.

## Calidad, medida en la decisión
Las pruebas de frescura, volumen, unicidad, integridad y distribución las diseña data-engineer (`calidad-de-datos.md` en su puesto). Aquí se decide qué columnas son críticas y qué umbral aceptar. Los errores más caros son semánticos: un campo que cambió de significado tras una migración, un filtro que excluye un segmento, un join que pierde filas. Ninguna prueba técnica los detecta: se atrapan conciliando totales contra una fuente independiente (finanzas, conteo físico, bitácora operativa).

## Acceso y datos personales
- Datos internos no personales: abiertos por defecto dentro del equipo. Restringir de más alimenta las hojas de cálculo paralelas, que son menos seguras.
- Datos personales, financieros y fiscales: mínimo privilegio, propósito declarado, revisión periódica, y aviso de privacidad y bases de tratamiento según la LFPDPPP vigente: verificar con el abogado.
- Nuevo uso de datos de clientes (incluido darlos como contexto a agentes o modelos externos): revisión previa con el abogado y ciberseguridad.
- Los cambios de acceso los ejecuta un humano; el puesto los propone.

## Linaje
Saber de dónde sale cada número y qué alimenta. Sin linaje no se responde lo que importa en un incidente: qué se rompió arriba y qué quedó mal abajo. Mínimo: fuente → transformación (flujo de n8n, script, vista) → tabla → tablero, con dueño en cada paso.

## Capa paralela
Siempre aparecen hojas, exportaciones y tableros sin gobierno porque el camino oficial era lento. Combatirlo con reglas falla. Haz el camino gobernado más rápido que el atajo; cuando no puedas, el atajo te dice qué le falta a la plataforma.

## Priorizar solicitudes
Ordena con valor de la decisión × urgencia ÷ esfuerzo (1 a 5 cada uno, con razón escrita):
1. Medición rota o cifra publicada equivocada.
2. Datos de dinero y fiscales sin conciliar.
3. Definiciones en disputa que cambian lo que ve la dirección.
4. Fuentes sin dueño que alimentan decisiones.
5. Tableros y análisis nuevos.
Asigna a data-engineer (pipelines, modelos, calidad), data-analyst (métricas, tableros, diagnóstico) o automatización (flujos). Lo que es esquema del ERP va a software y lo que es servidor a infraestructura, vía el CTO; no se duplica.

## Qué entregas
Respuesta o decisión en una frase; definición usada; fuente y su calidad (frescura, completitud, huecos); certeza y qué la subiría; lo que el dato no dice; dueño del seguimiento. Para el gobierno: diccionario, mapa de dueños y fuentes autorizadas, matriz de acceso propuesta y cola priorizada. Escala a Adrián las disputas de definición que cambian el desempeño reportado.

## Errores comunes
- Arbitrar un número sin arreglar la definición detrás.
- Corregir calidad en el tablero en lugar de la fuente.
- Retirar un conjunto "porque nadie lo usa" sin anunciarlo: primero deprecar y avisar.
- Dar acceso a datos sin saber qué contienen.
