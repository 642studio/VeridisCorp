# Plan de acceso financiero de los agentes

Estado: propuesta, no implementada. Fecha: 2026-11-05.

El diseño completo se mantiene junto al módulo dueño de los datos:
`/home/seis/642-Core-main/docs/FINANCE-CORP-PLAN.md`.

Dirección acordada para planificar: agentes financieros de Corp podrán consultar Core, revisar
información y capturar algunos datos. La propuesta recomienda empezar por los libros internos
de 642 Studio y borradores persistentes con comprobantes, sin efectos en saldos hasta confirmar.

Se reutilizarán servicios/catálogo del copiloto de Core, con autorización por usuario, agente,
libro y operación. Las tarjetas actuales deben evolucionar a aprobaciones persistidas ligadas a
versión/hash; registrar, auditar y consumir esa aprobación será atómico. El token de transporte
del puente y el título de un agente no bastan como autorización financiera.

Distribución inicial: CFO coordina; contabilidad captura/clasifica; facturación revisa cartera;
tesorería consulta flujo y propone conciliación; presupuestos prepara escenarios; revisión
financiera consulta y devuelve observaciones sin herramientas de escritura. CEO recibe resúmenes
autorizados. PM/marketing no adquieren acceso irrestricto a bancos o datos sensibles.

La primera entrega será de lectura pura; la segunda, bandeja de borradores. Solo después se
conectará confirmación humana y ejecución con auditoría atómica, idempotencia y recuperación.
No se activan pagos, transferencias, timbrado, cancelaciones fiscales o declaraciones con este plan.

No se cambiaron perfiles, código, permisos, base de datos o servicios para habilitar finanzas.
Las consultas de diagnóstico fueron de solo lectura. La comprobación final de proyectos queda
pendiente del aviso del usuario cuando termine el módulo; no se amplió ese trabajo en este turno.

## Reparación previa del flujo humano (2026-11-06 UTC)

Core implementó confirmación transaccional, origen de archivo/fila y revisión explícita de
cuenta/moneda. Pruebas aisladas correctas; migración remota pendiente de acceso administrativo
al proyecto real. Detalle: `/home/seis/642-Core-main/docs/FINANCE-IMPORT-REPAIR-2026-11-06.md`.
Esto no habilita herramientas ni permisos financieros para agentes.
