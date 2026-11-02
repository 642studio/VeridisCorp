> Escrito para VeridisCorp (sin fuente externa).

# Proceso de facturación y cobranza

El puesto prepara solicitudes de factura, revisa que coincidan con lo vendido y da seguimiento a la cobranza. No timbra, no cancela, no envía mensajes ni aplica pagos: el contador o el sistema autorizado emite el CFDI y un humano envía y cobra. Todo lo normativo es general: verificar con el contador / SAT vigente.

## Antes de empezar
Busca primero en la memoria corporativa; pide lo que falte y márcalo FALTANTE:
- Cotización o contrato aprobado, orden de compra si el cliente la usa, y entregables o avance que justifican la factura.
- Datos fiscales del cliente (lista abajo) y su constancia de situación fiscal.
- Quién emite el CFDI (contador, proveedor de certificación o sistema propio) y con qué procedimiento.
- Condiciones de pago pactadas, anticipos recibidos y facturas previas del mismo proyecto.
- Contacto de cuentas por pagar del cliente y si exige portal de proveedores o requisitos propios.

## Datos a solicitar al cliente
- RFC y nombre o razón social tal como aparecen en su constancia de situación fiscal.
- Régimen fiscal y código postal del domicilio fiscal.
- Uso del CFDI que necesita.
- Forma de pago esperada y si pagará en una sola exhibición o en parcialidades o diferido (esto define el método de pago del CFDI; el contador confirma cuál corresponde).
- Correo para recibir el CFDI y contacto de pagos.
- Orden de compra, número de proveedor o referencia que deba ir en la factura.
Si el cliente retiene impuestos (depende del régimen de ambas partes), el contador indica cómo se refleja; el puesto no lo calcula por su cuenta.

## Solicitud de factura (prefactura)
| Campo | Contenido |
|---|---|
| Cliente y RFC | según constancia |
| Referencia | cotización, contrato, OC, proyecto |
| Concepto | descripción clara del servicio y periodo o entregable |
| Cantidad, unidad y precio | según lo aprobado |
| Impuestos | los que indique el contador |
| Moneda | MXN; si es otra, tipo de cambio según indique el contador |
| Método y forma de pago | confirmados con el cliente y el contador |
| Relación con otros CFDI | anticipo aplicado, sustitución, nota de crédito |
| Fecha propuesta de emisión y vencimiento | |
Antes de pedir la emisión, coteja contra la cotización: importe, alcance, periodo y datos fiscales. La mayoría de las facturas en disputa no coinciden con lo pactado.

## Situaciones que requieren al contador
- **Pagos en parcialidades o diferidos:** al recibir cada pago se emite un complemento de pago (recibo electrónico de pagos). Plazo y requisitos: verificar con el contador / SAT vigente.
- **Anticipos:** tienen un tratamiento propio en CFDI; seguir el procedimiento que indique el contador.
- **Descuentos, bonificaciones o devoluciones posteriores:** se documentan con nota de crédito (CFDI de egreso relacionado con el original).
- **Errores en una factura:** cancelación y, en su caso, sustitución. La cancelación tiene reglas y plazos y puede requerir aceptación del cliente; verificar con el contador / SAT vigente. Nunca prometas al cliente una cancelación sin confirmarlo.

## Cobranza
Registro por factura: folio, cliente, proyecto, importe, fecha de emisión, vencimiento, cobrado, saldo, complemento emitido (sí/no), último contacto, próximo paso.

Antigüedad de saldos: por vencer, 1-30, 31-60, 61-90 y más de 90 días vencidos, por cliente. Entrega la tendencia, no solo el total, y comparte el reporte con `finance-treasury` para el flujo a 13 semanas.

Etapas de seguimiento (los días de cada etapa los fija Adrián en la política de cobranza):
1. Recordatorio amable antes del vencimiento con folio, importe y datos de pago.
2. Aviso el día del vencimiento.
3. Seguimiento con el contacto de pagos: preguntar si hay algún problema con la factura.
4. Escalamiento al responsable de la cuenta en 642.
5. Escalamiento a Adrián: pausar trabajo, plan de pagos o acción según contrato. La decide él; si hay tema legal, verificar con el abogado.
Redacta cada mensaje como borrador; lo envía un humano. Tono firme y cordial, con datos verificables.

## Aplicar cobros
Empata cada depósito con su factura por importe, referencia y cliente. Pagos parciales, de más o sin referencia van a pendientes con nota para `finance-accounting`. No des por cobrada una factura sin verlo en el estado de cuenta.

## Datos personales y seguridad
Los datos de contacto de clientes se tratan según el aviso de privacidad de la empresa (LFPDPPP; verificar con el abogado). No guardes contraseñas de portales, datos bancarios completos ni la e.firma en notas ni en la memoria corporativa.

## Errores comunes
- Facturar con datos fiscales viejos o copiados de otra factura.
- Facturar alcance distinto al aprobado.
- Olvidar el complemento de pago de facturas en parcialidades o diferidas.
- Cancelar en vez de emitir nota de crédito, o al revés, sin consultar al contador.
- Dar seguimiento sin revisar antes si la factura tiene un error.
- Reportar cobranza con promedio en vez de antigüedad por cliente.
