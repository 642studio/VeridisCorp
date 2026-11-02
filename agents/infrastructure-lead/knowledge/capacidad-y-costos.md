> Adaptado de headcount (cbrock84, MIT): capacity-and-demand-planning, cloud-administration, it-asset-management, chief-information-officer.

# Capacidad y costos de infraestructura

## Antes de empezar
Busca en la memoria corporativa: especificaciones del servidor (CPU, RAM, disco, UPS), uso histórico, servicios que corren en él, clientes y flujos que dependen de él, suscripciones y servicios pagados (dominios, nube, APIs de IA, Google Workspace, herramientas) con monto en MXN o USD, forma de pago y fecha de renovación. Lo que falte, márcalo FALTANTE. No inventes precios ni consumos: cotiza o pide el dato. Tú propones; las compras y contrataciones las aprueba Adrián.

## Capacidad del servidor
Pronostica la demanda en la unidad en que llega el trabajo (ejecuciones de n8n por día, peticiones a la API, GB de datos y respaldos por mes), no en ventas. Separa:
- **Base**: el ritmo estable, tomado de tu historial.
- **Tendencia**: dirección medida en varios periodos, no en una semana.
- **Picos**: campañas, cierres de mes, lanzamientos de clientes. Los conocidos se planean; los desconocidos son para lo que sirve el margen.

Recursos a vigilar, con alerta antes de llegar al límite:
- **Disco**: base de datos, ejecuciones guardadas de n8n, logs, imágenes de Docker y respaldos locales. Es el que más causa caídas silenciosas.
- **Memoria**: cada contenedor, PostgreSQL y los trabajadores de n8n.
- **CPU**: trabajos simultáneos, procesamiento de video o imágenes.
- **Red e internet de oficina**: subida disponible para webhooks, clientes y respaldos externos.
- **Energía**: autonomía del UPS y apagado ordenado.
Por encima de alrededor de 80% de uso, los tiempos de espera crecen de forma no lineal (referencia general de la fuente): planea con margen, no al 100%.

## ¿Más capacidad o mejor flujo?
Antes de comprar hardware, distingue:
- **Falta real de capacidad**: la demanda supera lo que el servidor procesa con uso razonable → ampliar o mover un servicio.
- **Problema de flujo**: consultas sin índice, lotes de tamaño 1, flujos que corren encimados, ejecuciones que nunca se depuran, logs sin rotación → corregir primero; el hardware no lo arregla.
La señal: si el trabajo pasa más tiempo esperando que ejecutándose, es flujo.

## Decidir dónde corre cada servicio
Un solo servidor en oficina concentra el riesgo (luz, internet, disco, una persona). Para cada servicio crítico evalúa: quedarse en la oficina, servidor rentado o servicio administrado. Compara con la misma tabla: costo mensual en MXN, RTO alcanzable, esfuerzo de operación, dependencia de proveedor y dónde quedan los datos personales (aviso de privacidad y transferencias según la LFPDPPP vigente; verificar con el abogado). Ninguna opción se recomienda sin esa comparación.

## Costos
- Atribuye cada costo a quien lo consume (área, marca, cliente o proyecto). Un presupuesto global invita a recortes parejos porque nadie ve qué compra cada peso.
- Cada servicio pagado tiene dueño, fecha de renovación y clasificación de datos. Sin dueño no hay a quién preguntar; sin fecha, la negociación llega después de la renovación automática.
- Descubre suscripciones por los estados de cuenta y la tarjeta, no solo por lo que sistemas conoce.
- Revisión mensual de los rubros que más subieron, no de toda la factura.
- Recupera licencias de quien ya no las usa; vigila cobros por usuario, por uso o por tokens que crecen solos (APIs de IA, almacenamiento).
- Pagos en dólares: registra el monto original y el tipo de cambio usado; la factura o comprobante va con finanzas (CFDI cuando el proveedor lo emita; si es extranjero, verificar el tratamiento de IVA con el contador).
- Presupuesta la renovación de equipo como gasto recurrente; reemplazar cuando falla sale más caro y en mal momento.
- Si se propone un recorte, di qué servicio o protección se pierde.

## Qué entregar
Tablero mensual: uso de recursos contra umbral y tendencia, fecha estimada en que se llena el disco, riesgos de capacidad, lista de servicios pagados con dueño, costo en MXN y renovación, variaciones contra el mes anterior y propuestas con costo, beneficio y aprobación requerida.

## Errores comunes
- Planear al 100% de capacidad.
- Comprar hardware para un problema de flujo.
- Suscripciones sin dueño que se renuevan solas.
- Reportar solo el costo total sin lo que obtiene cada área.
