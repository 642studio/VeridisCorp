> Adaptado de claude-skills (alirezarezvani, MIT) y headcount (cbrock84, MIT): month-end-close, financial-reporting-and-close.

# Pólizas, clasificación y soporte documental

Un registro sin soporte no se puede revisar, y uno que no se puede revisar no sirve para decidir ni para el contador. El puesto clasifica movimientos y propone pólizas; el contador las valida y registra.

## Antes de empezar
Busca primero en la memoria corporativa; pide lo que falte y márcalo FALTANTE:
- Catálogo de cuentas vigente y criterios de clasificación ya acordados (centros de costo, cliente, proyecto, marca).
- Movimientos a clasificar: estado de cuenta, relación de CFDI, nómina o comprobantes.
- Quién es el contador o responsable que valida las pólizas.
- Reglas propias que existan (gastos que se cargan a proyecto, viáticos, caja chica).

## Tipos de póliza (uso general)
- **Ingreso:** cobros a clientes, intereses, otros ingresos. Soporte: CFDI de ingreso o complemento de pago relacionado, depósito en el estado de cuenta.
- **Egreso:** pagos a proveedores, nómina, impuestos, comisiones bancarias. Soporte: CFDI del proveedor, comprobante de transferencia, estado de cuenta.
- **Diario:** provisiones, depreciaciones, reclasificaciones y correcciones. Soporte: cálculo, contrato o tabla con la base de la estimación.

La nomenclatura y los requisitos de contabilidad electrónica (catálogo, balanza, pólizas ante el SAT) los define el contador; verificar con el contador / SAT vigente.

## Clasificación de cada movimiento
Para cada renglón del banco o de la relación de CFDI:
1. **Identifica la contraparte** (RFC y nombre según el CFDI, no según el concepto bancario).
2. **Empata con su documento:** CFDI, contrato, cotización aprobada o recibo de nómina.
3. **Asigna cuenta y dimensión:** cuenta contable, cliente o proyecto, marca del grupo. Si el gasto es de un proyecto de cliente, márcalo: alimenta la rentabilidad que calcula el `cfo`.
4. **Marca el estado:** completo / falta CFDI / falta autorización / no identificado.
5. **Propón la póliza** con cargo, abono, importe, fecha, referencia al documento y nota de la base si es estimación.

Señales que se escalan, no se resuelven solas:
- Pagos sin CFDI o con CFDI cuyo RFC, importe o fecha no coinciden. Si es deducible o acreditable lo decide el contador; verificar con el contador / SAT vigente.
- Depósitos sin cliente identificado.
- Movimientos entre marcas del grupo o con cuentas personales.
- Pagos fragmentados justo por debajo de un límite de autorización.
- CFDI recibidos que nadie reconoce (posible error o uso indebido del RFC).

## Conciliación de CFDI contra libros
Cada mes cruza tres listas: CFDI emitidos, CFDI recibidos y registros contables. Diferencias típicas: factura emitida sin registrar, CFDI cancelado que sigue en libros, pago en parcialidades sin complemento, gasto registrado sin CFDI. Cada diferencia lleva acción propuesta y responsable.

## Hoja de conciliación (una por cuenta y periodo)
| Campo | Contenido |
|---|---|
| Entidad / cuenta / periodo | |
| Saldo en libros y saldo de la fuente | con el documento de cada uno |
| Diferencia sin explicar | debe ser 0.00 |
| Partidas pendientes | fecha, importe, referencia, lado, acción, antigüedad, responsable |
| Pólizas propuestas | número o folio provisional |
| Preparó | nombre, fecha, documentos usados |
| Revisó (otra persona) | qué cotejó, contra qué documento, qué partidas cuestionó y resultado |
| Conclusión | aprobada / devuelta con motivo |

Una firma no prueba una revisión: el revisor anota qué verificó. Si el equipo es tan pequeño que no se puede separar, documenta el control compensatorio (por ejemplo, Adrián revisa las conciliaciones de bancos cada mes).

## Archivo del soporte
- Nombra los archivos con periodo, tipo y referencia para que otra persona los encuentre sin preguntar.
- El soporte se guarda al hacer el trabajo, no se reúne después para una revisión.
- No guardes contraseñas, tokens ni datos bancarios completos en notas, pólizas ni en la memoria corporativa.
- El plazo de conservación de la contabilidad y sus comprobantes lo fija la ley; verificar con el contador / fuente oficial vigente.

## Errores comunes
- Clasificar por el concepto del banco en vez del CFDI.
- Registrar un gasto sin documento "para no atrasar el cierre".
- Mezclar gastos personales o de otra marca del grupo sin marcarlos.
- Corregir sobrescribiendo en lugar de con una póliza de diario que deje rastro.
- Tomar como cierto un saldo que nadie ha conciliado.
