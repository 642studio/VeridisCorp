> Adaptado de headcount (cbrock84, MIT) y goose-skills (gooseworks-ai, MIT): unit-economics, cost-accounting, plan-campaign/references/unit-economics.md.

# Rentabilidad por cliente y por proyecto en una agencia

La pregunta es simple y casi nunca se contesta: ¿un cliente o proyecto más deja mejor a la empresa, y en cuánto tiempo? En una agencia el costo principal son horas de personas; sin costeo de horas no hay margen real.

## Antes de empezar
Busca primero en la memoria corporativa; pide lo que falte y márcalo FALTANTE:
- Ingresos por cliente y proyecto del periodo (facturado y reconocido, de `finance-billing`).
- Horas registradas por persona, cliente y proyecto. Sin registro de horas, el análisis es una estimación y se marca así.
- Costo mensual de cada persona según nómina o contrato (sueldo, cargas y prestaciones que reporte el contador) y freelancers.
- Costos directos por proyecto: producción, equipo rentado, viáticos, software o licencias asignables, pauta adelantada no recuperada.
- Gastos fijos del periodo (renta, servicios, software general, administración), de `finance-accounting`.

## 1. Define la unidad
Proyecto, cliente (todos sus proyectos e igualas) o línea de servicio. Dilo al inicio: casi todos los desacuerdos sobre rentabilidad son desacuerdos sobre la unidad.

## 2. Costo por hora cargado
```
horas productivas por persona = horas pagadas − vacaciones, días festivos, capacitación y tiempo interno estimado
costo hora directo            = costo mensual total de la persona ÷ horas productivas del mes
```
- Usa horas productivas, no horas pagadas: dividir entre todas las horas subestima el costo.
- Clasifica el comportamiento: **fijos** (sueldos, renta), **variables** (freelancers, producción, comisiones bancarias) y **mixtos** (separa su parte fija y variable con el historial, no a ojo).
- Asigna los gastos fijos con un criterio que los cause, normalmente horas. Asignarlos por ingreso no es costear: hace que el cliente más grande siempre se vea peor.

## 3. Margen de contribución
```
margen de contribución = ingreso − (horas × costo hora directo) − costos directos del proyecto
margen después de fijos = margen de contribución − fijos asignados por horas
```
- Incluye todo lo que varía con el proyecto: revisiones extra, juntas, traslados, comisiones de cobro. Subestimar el costo variable es el error más común y infla todo lo que sigue.
- Compara horas reales contra horas cotizadas. La diferencia (sobreservicio) suele explicar más que la tarifa.
- Rentabilidad por cliente agrega el **costo de servirlo**: cambios de alcance no cobrados, juntas, cobranza lenta (efectivo que la agencia financia).

## 4. Punto de equilibrio y piso de precio
- Punto de equilibrio mensual = gastos fijos ÷ margen de contribución promedio por proyecto (o por hora vendida).
- El costo variable es el piso para aceptar un proyecto adicional puntual; el costo cargado completo es el piso para precios recurrentes. Cotizar igualas con costo variable lleva a volumen que pierde dinero.
- Una estructura con muchos fijos amplifica utilidad cuando hay trabajo y pérdida cuando no. Es una decisión que se toma a propósito.

## 5. Adquisición y recuperación
- Costo de adquirir un cliente cargado completo: marketing, propuestas no ganadas y horas del equipo comercial, entre clientes nuevos del periodo. Omitir las horas de personas lo subestima mucho.
- Recuperación (meses) = costo de adquisición ÷ margen de contribución mensual del cliente.
- Valor de vida = margen de contribución × permanencia **observada**, no supuesta. Una empresa con poco historial no puede observar permanencias largas; no las extrapoles.
- Compara la adquisición contra margen de contribución, nunca contra ingreso.

## Leer con honestidad
- **Segmenta antes de concluir:** el promedio esconde clientes que subsidian a otros. Ordena por margen después de fijos.
- **Usa cohortes:** si los clientes recientes renuevan menos que los antiguos, el negocio empeora aunque el promedio se vea estable.
- Separa precio, volumen y mezcla cuando cambie el margen total (ver `analisis-de-variaciones.md` en `finance-budget`).
- Cada cifra lleva procedencia: histórico propio, dato aportado o supuesto marcado.

## Qué entregar
| Cliente / proyecto | Ingreso | Horas reales / cotizadas | Costo de horas | Directos | Margen contribución MXN y % | Fijos asignados | Margen final | Observaciones |
|---|---|---|---|---|---|---|---|---|

Más: tres hallazgos, clientes o servicios a revisar (tarifa, alcance, anticipos o salida) y FALTANTES. Cambiar tarifas, renegociar o dejar un cliente lo decide Adrián.

## Errores comunes
- Medir rentabilidad sin registro de horas y no marcarlo como estimación.
- Asignar gastos fijos por ingreso.
- Cotizar recurrente con costo variable.
- Ignorar el sobreservicio y los cambios de alcance no cobrados.
- Celebrar mejores ratios cuando solo cambió la mezcla de clientes.
