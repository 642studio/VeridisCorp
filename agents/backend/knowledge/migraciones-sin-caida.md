> Adaptado de headcount (cbrock84, MIT), claude-skills (alirezarezvani, MIT) y agentic-awesome-skills (sickn33, CC BY 4.0): data-migration, migration-architect, drizzle-orm-expert.

# Migraciones sin caída con Drizzle y PostgreSQL

Durante un despliegue conviven el código viejo y el nuevo contra la misma base. Cada paso de esquema debe funcionar con ambos. Las migraciones se estiman como movimiento de datos y resultan ser un problema de calidad de datos.

## Antes de empezar
Busca primero en la memoria corporativa y en el repo; pide lo que falte y márcalo FALTANTE:
- Versión de PostgreSQL del servidor y cómo se aplican las migraciones (comando, quién, en qué ventana).
- Tamaño de las tablas afectadas y horas de menor uso.
- Qué consume la columna o tabla: endpoints, flujos de n8n, reportes, consultas manuales.
- Último respaldo y si su restauración se ha probado.
El agente propone SQL, plan y pruebas; nunca aplica migraciones. Las ejecuta un humano.

## Patrón expandir / contraer
1. **Expandir:** agrega lo nuevo junto a lo viejo (columna, tabla, índice). Nada se borra ni se renombra.
2. **Escritura doble:** el código escribe en ambos lados; lee todavía del viejo.
3. **Relleno (backfill):** copia el histórico en lotes pequeños, idempotentes y reanudables.
4. **Cambio de lectura:** el código lee de lo nuevo; se compara contra lo viejo.
5. **Contraer:** cuando nada usa lo viejo (verificado en código, n8n y reportes), se elimina en un despliegue posterior.

Cada fase es un despliegue separado y deja el sistema funcionando. Un renombre de columna es siempre expandir + contraer, nunca `RENAME` en caliente.

## Operaciones de PostgreSQL y su riesgo
Verifica cada punto con la documentación de la versión instalada:
- Columna nueva que acepta nulos: barata. Con default constante, en versiones modernas no reescribe la tabla; con default volátil sí.
- `NOT NULL` en tabla grande: primero `CHECK (col IS NOT NULL) NOT VALID`, luego `VALIDATE CONSTRAINT`, y al final `SET NOT NULL`.
- Llaves foráneas y `CHECK` nuevos: `NOT VALID` y después `VALIDATE` para no bloquear escrituras durante el escaneo.
- Índices: `CREATE INDEX CONCURRENTLY`, que no puede ir dentro de una transacción; si falla deja un índice inválido que hay que borrar.
- Cambiar el tipo de una columna suele reescribir la tabla: trátalo como columna nueva + relleno.
- Usa `lock_timeout` corto para que una migración que espera un candado no forme fila y detenga la aplicación.

## Drizzle Kit
- `drizzle-kit generate` produce SQL: léelo siempre. El SQL generado no prueba que los datos se conserven.
- Cuando detecta un renombre, pregunta si es renombre o borrar y crear; una respuesta equivocada borra la columna con sus datos.
- `drizzle-kit push` solo en desarrollo; en producción, archivos de migración versionados y `migrate`.
- Revisa si el ejecutor envuelve cada migración en transacción; las operaciones `CONCURRENTLY` van en un paso aparte.
- Mantén schema y relaciones en el repo como fuente; los tipos salen de `InferSelectModel` e `InferInsertModel`.

## Mover datos entre sistemas
Cuando la migración trae datos de otro sistema (hojas de cálculo, un sistema anterior):
- Perfila el origen antes de mapear: valores distintos, nulos, formatos, duplicados. Nunca mapees desde el esquema.
- Decide qué no se mueve; archivar reduce mapeo, conciliación y ventana.
- Mapeo campo por campo: origen, transformación, qué pasa si viene vacío y qué pasa si no cabe.
- Lo que no mapea va a una lista de excepciones que un humano trabaja, con conteo. Nunca se descarta en silencio ni se rellena con un valor inventado.
- Ensaya con una copia completa, no con muestra; el último ensayo debe salir limpio y cronometrado.
- Concilia conteos, totales de control en montos (MXN, IVA) y una muestra registro por registro; vuelve a conciliar una semana después.
- Conserva el origen legible hasta cerrar la conciliación. Los plazos de conservación de datos fiscales: verificar con el contador.

## Reversa
Nombra el punto sin retorno. Antes de él, la reversa es volver al código anterior porque lo viejo sigue intacto. Después de que lo nuevo recibe escrituras, revertir es otra migración. Una reversa que nunca se ensayó no es reversa.

## Qué entregas
Plan por fases con: SQL de cada paso, cambio de código asociado, riesgo de candados, verificación (consulta o prueba con su salida del sandbox), condición para avanzar y reversa. Coordina con data-engineer cuando la migración cambie modelos que alimentan reportes. Escala a software-lead el punto sin retorno y cualquier borrado.

## Errores comunes
- Renombrar o borrar en el mismo despliegue que cambia el código.
- Relleno en una sola transacción enorme que bloquea la tabla.
- Confiar en que nadie usa una columna sin revisar n8n ni los reportes.
- Contar filas y declarar éxito sin comparar valores.
