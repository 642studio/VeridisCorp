> Adaptado de headcount (cbrock84, MIT) y claude-skills (alirezarezvani, MIT): treasury-and-liquidity, financial-analyst.

# Flujo de caja directo a 13 semanas

Una empresa rentable puede quebrar por falta de efectivo. La utilidad es una opinión construida con provisiones; el saldo en el banco se tiene o no se tiene ese día.

## Antes de empezar
Busca primero en la memoria corporativa; pide lo que falte y márcalo FALTANTE:
- Saldo inicial por cuenta bancaria, con fecha y estado de cuenta que lo respalde.
- Cuentas por cobrar con fecha de factura, condiciones pactadas y comportamiento de pago de cada cliente (de `finance-billing`).
- Cuentas por pagar con vencimiento y condiciones de cada proveedor.
- Pagos fijos: nómina y su periodicidad, cuotas IMSS e INFONAVIT, renta, servicios, suscripciones de software, créditos.
- Impuestos por pagar: importes y fechas los da el contador; verificar con el contador / SAT vigente.
- Proyectos firmados y propuestas con probabilidad, para ingresos aún no facturados.
- Colchón mínimo de efectivo acordado por Adrián. Si no existe, propón cómo calcularlo; no lo fijes.

## Por qué directo y semanal
El método indirecto (utilidad ajustada) sirve para reportar, casi nada para operar. El directo proyecta entradas y salidas reales por semana según cuándo se espera que ocurran. Trece semanas alcanzan para actuar y son lo bastante cortas para ser precisas.

Modela la **fecha**, no solo el monto: un cobro que llega cuatro días tarde es el mismo dinero y otra posición de liquidez.

## Estructura
| Renglón | S1 | S2 | … | S13 |
|---|---|---|---|---|
| Saldo inicial | | | | |
| Cobros de facturas emitidas (por cliente y antigüedad) | | | | |
| Cobros de proyectos firmados por facturar | | | | |
| Otros ingresos | | | | |
| **Total entradas** | | | | |
| Nómina y cuotas | | | | |
| Proveedores y freelancers | | | | |
| Renta, servicios y software | | | | |
| Impuestos (según contador) | | | | |
| Pagos de créditos | | | | |
| Compras de equipo | | | | |
| **Total salidas** | | | | |
| **Saldo final** | | | | |
| Colchón mínimo | | | | |
| Excedente o faltante contra colchón | | | | |

Reglas:
- Cobros: usa el historial de pago real de cada cliente, no la condición del contrato. Sin historial, usa la condición y márcalo como supuesto.
- No incluyas propuestas no firmadas en el escenario base.
- Cada cifra lleva procedencia: estado de cuenta, CFDI, contrato, histórico o supuesto.
- Separa cuentas si hay varias marcas del grupo; no mezcles efectivo de entidades distintas sin decirlo.

## Escenarios
Nunca reportes la liquidez como un solo número:
1. **Base:** fechas esperadas según historial.
2. **A la baja:** los cobros llegan más tarde y un proyecto se retrasa.
3. **Cliente grande se atrasa:** el cobro más importante se mueve fuera del horizonte.

Para cada escenario indica la semana en que el saldo cruza el colchón.

## Fechas de decisión
Antes de la fecha en que se acaba el efectivo hay una fecha anterior en la que todavía hay opciones: negociar con un proveedor, adelantar facturación, pedir anticipo, posponer una compra, gestionar un crédito. Señala esas fechas. Descubrirlas tarde elimina las buenas opciones.

## Rodar y medir
Cada semana: cierra la semana pasada con lo real, compara contra lo que pronosticaste, explica las diferencias más grandes y agrega la semana 13 nueva. Lleva el registro del error de pronóstico; un pronóstico que nunca se contrasta no mejora.

## Qué entregar
1. Tabla de 13 semanas con los tres escenarios.
2. Alertas: semanas bajo el colchón y fechas de decisión.
3. Comparación pronóstico contra real de la semana anterior.
4. Supuestos y FALTANTES.
5. Propuestas de acción para que Adrián decida. El puesto no mueve dinero ni negocia con terceros.

## Errores comunes
- Proyectar cobros con la fecha del contrato en vez del comportamiento real del cliente.
- Olvidar pagos irregulares: aguinaldo, impuestos anuales, renovaciones anuales de software, equipo.
- Incluir propuestas no firmadas en el escenario base.
- No comparar el pronóstico contra lo real.
- Partir de un saldo inicial que no salió de un estado de cuenta.
