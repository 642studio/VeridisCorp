> Adaptado de headcount (cbrock84, MIT) y claude-skills (alirezarezvani, MIT): budgeting-and-forecasting, financial-analyst.

# Presupuesto anual y forecast rodante

El presupuesto es un compromiso; el forecast es una creencia. Se mantienen separados: un presupuesto que se rehace cada mes deja de ser compromiso, y un forecast amarrado al presupuesto original deja de ser creencia.

## Antes de empezar
Busca primero en la memoria corporativa; pide lo que falte y márcalo FALTANTE:
- Entidad o marca, año y moneda (MXN; si hay ingresos o gastos en otra moneda, el tipo de cambio supuesto).
- Reales de al menos los últimos 12 meses por cuenta (de `finance-accounting`).
- Clientes con contrato o iguala vigente, proyectos firmados y propuestas abiertas.
- Plantilla: personas, costo mensual por persona según nómina o contrato, contrataciones planeadas.
- Gastos fijos: renta, servicios, software, equipo, créditos.
- Metas de Adrián para el año (ingresos, margen, inversión).
Sin datos no hay importes: escribe el supuesto y su procedencia o deja la celda FALTANTE.

## Ciclo del presupuesto anual
1. **Fija el marco primero:** metas, tamaño de plantilla y supuestos comunes (precios o tarifas, incremento salarial, tipo de cambio, temporalidad de clientes). Si cada área usa supuestos distintos, el consolidado no cuadra.
2. **Captura en una plantilla fija** por línea de negocio (estrategia digital, producción audiovisual, contenido, desarrollo de software, automatizaciones) y por mes.
3. **Construye por motores, no por inercia.** En servicios profesionales el ingreso sale de horas disponibles × utilización × tarifa, o de igualas × meses × probabilidad de renovación. Los costos, de plantilla × costo por persona más fijos más variables por proyecto (freelancers, producción, pauta del cliente si la adelanta la agencia).
4. **Cuestiona cada insumo:** ¿qué lo mueve?, ¿cuánto es por unidad?, ¿qué pasa si sale a la mitad?
5. **Consolida y encuentra la brecha** entre lo construido desde abajo y la meta. Siempre hay brecha. Ciérrala nombrando qué se recorta o se pospone, no con recortes proporcionales: esos dañan igual la línea que más rinde.
6. **Publica lo que no se financió** y por qué, para que no regrese la misma solicitud tres veces.

Incluye en el calendario mensual los pagos irregulares (aguinaldo, renovaciones anuales, impuestos anuales según el contador) para que el presupuesto sirva de base al flujo de `finance-treasury`.

## Forecast rodante
- Horizonte constante (por ejemplo, 12 meses hacia adelante) y frecuencia fija (mensual tras el cierre). La elección es de Adrián; propón una.
- Separa con claridad meses reales de meses proyectados.
- Actualiza solo lo que cambió y di qué cambió y por qué. Un forecast sin narrativa es otro juego de números sin información.
- Mide el error del forecast mes a mes por ingresos y gastos. Se corrige rápido cuando es visible y nunca mientras no se mide.
- Matriz de motores: los de alto impacto y alta incertidumbre (renovación de un cliente grande, contratación) llevan escenarios; los de bajo impacto, supuesto simple.

## Escenarios
Base, a la baja y al alza, moviendo los motores con mayor incertidumbre. Si la meta solo se cumple en el escenario al alza, dilo en la primera línea.

## Qué entregar
| Sección | Contenido |
|---|---|
| Encabezado | entidad, periodo, moneda, versión, fecha, quién preparó |
| Resumen | tres líneas: resultado esperado, principal riesgo, decisión que se pide |
| Supuestos | cada uno con procedencia: dato aportado, histórico, cotización o supuesto |
| Presupuesto mensual | ingresos por línea, costos directos, margen, gastos fijos, resultado |
| Escenarios | tres columnas |
| No financiado | qué quedó fuera y por qué |
| FALTANTES | lo que impide cerrar cifras |

Las variaciones contra real se analizan con `analisis-de-variaciones.md`. Lo fiscal (ISR, IVA, PTU) se presupuesta con cifras del contador; verificar con el contador / SAT vigente.

## Errores comunes
- Inventar importes para llenar celdas.
- Presupuestar ingresos por propuestas sin probabilidad.
- Que un área fije un supuesto que mueve las cifras de otra sin validarlo.
- Rehacer el presupuesto cada mes en lugar de actualizar el forecast.
- Presentar un forecast sin decir qué cambió.
