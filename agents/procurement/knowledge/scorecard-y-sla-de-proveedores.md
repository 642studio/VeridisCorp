> Adaptado de headcount (cbrock84, MIT) y claude-skills (alirezarezvani, MIT): vendor-management.

# Scorecard de proveedores y niveles de servicio

Después de comprar: medir desempeño, cuidar renovaciones y saber cómo salir. La mayoría de los proveedores solo se revisan al renovar, cuando ya es tarde.

## Antes de empezar
Busca en la memoria corporativa el catálogo de proveedores, contratos, fechas de renovación y la bitácora de incidentes. Pide lo que falte y márcalo FALTANTE. Los datos de desempeño salen de registros propios (tickets, mensajes, entregas, monitoreo del servidor), no de los reportes del proveedor: esos califican su propio trabajo.

## Catálogo mínimo
```
| proveedor | qué da | dueño interno | criticidad | gasto anual (MXN) | inicio | fin | renovación (automática/manual) | aviso para cancelar | ¿tiene datos nuestros o de clientes? | salida |
```
Criticidad:
- **Nivel 1:** si falla, se detiene la operación o una entrega a cliente (hosting, dominio, correo, internet de oficina, timbrado de CFDI, proveedor de IA del motor).
- **Nivel 2:** importante, con alternativa temporal.
- **Nivel 3:** prescindible.

## Términos que importan en la operación
Además de la revisión legal: niveles de servicio con consecuencia real, tiempos de respuesta por severidad, exportar nuestros datos en formato usable cuando se pida, aviso de cancelación suficiente para migrar y protección de precio en la renovación. Sin los dos últimos, salir sale caro.

## Diseño de un SLA
- Mide algo que el usuario vive (disponibilidad del servicio, tiempo de respuesta a un ticket, entrega a tiempo), con definición, fuente y ventana.
- Meta y consecuencia: qué pasa si no se cumple (bonificación, descuento, derecho a terminar).
- Excepciones explícitas (mantenimiento avisado, causas nuestras).
- Proveedores locales y pequeños rara vez firman SLA formales: entonces acuerda por escrito tiempos de entrega y respuesta y regístralos igual.

## Scorecard trimestral
Pesos acordados antes de calificar, ajustados a lo que la empresa valora:
- **Confiabilidad:** caídas, entregas tarde, incidentes.
- **Soporte:** tiempo de respuesta y solución.
- **Seguridad y datos:** cómo protege cuentas y datos; si trata datos personales, cumplimiento de lo pactado.
- **Comercial:** precio contra mercado, flexibilidad de renovación, facturación correcta y a tiempo (CFDI sin errores).
- **Ajuste:** criticidad contra gasto, si seguimos necesitándolo.
Veredicto (bandas como referencia general sobre 100): **mantener** (75 o más), **revisar** con el proveedor antes de renovar (50 a 74), **reemplazar** e iniciar búsqueda (menos de 50).

## Gestión
- **Un dueño interno con nombre** por proveedor. Sin dueño, el proveedor se desvía y se renueva solo.
- **Bitácora de problemas** con fecha y evidencia. En la renovación, un patrón documentado es palanca; un recuerdo no.
- **Alarma de renovación** con tiempo antes del aviso de cancelación (como referencia general, 60 a 90 días). La renovación automática no vista es la pérdida más común y más evitable.
- Si el proveedor reclama o pide aumento, compara contra el scorecard y cotiza una alternativa antes de responder.

## Concentración y salida
Para cada proveedor nivel 1: ¿qué pasa si falla, lo compran o triplica precio? Ten la ruta de salida y su costo aproximado. Mantén copia propia y actual de nuestros datos cuando el proveedor guarde algo crítico (coordinar con continuidad). Una salida nunca pensada no es opción, es esperanza.

## Entregable
Scorecard con veredicto por proveedor, SLA incumplidos con evidencia y si procede reclamar bonificación, renovaciones de los próximos 90 días, proveedores nivel 1 sin plan de salida y recomendaciones con dueño y fecha.

## Qué escala
Compras califica y recomienda. Reclamar, renegociar, cancelar, renovar o cambiar de proveedor lo decide el dueño interno con el COO y Finanzas.

## Errores comunes
- Calificar con los reportes del propio proveedor.
- Llegar a la renovación sin haberla empezado.
- Proveedores críticos sin dueño ni salida.
- Concentrar algo crítico en un proveedor sin decirlo y sin ponerle precio al riesgo.
