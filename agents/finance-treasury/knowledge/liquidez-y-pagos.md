> Adaptado de headcount (cbrock84, MIT): treasury-and-liquidity, internal-controls-and-audit.

# Liquidez, capital de trabajo y programación de pagos

El efectivo atrapado entre pagar insumos y cobrar el trabajo es financiamiento gratuito o una fuga. Tesorería propone cómo liberar ese efectivo y cuándo pagar; no ejecuta pagos.

## Antes de empezar
Busca primero en la memoria corporativa; pide lo que falte y márcalo FALTANTE:
- Flujo a 13 semanas vigente (ver `flujo-de-caja-13-semanas.md`).
- Antigüedad de saldos de clientes (de `finance-billing`) y de proveedores.
- Condiciones pactadas con clientes (anticipos, pagos por avance) y con proveedores.
- Cuentas bancarias, bancos y quién tiene facultad de autorizar en cada una (sin contraseñas ni tokens).
- Colchón mínimo y límites de autorización aprobados por Adrián, si existen.

## Colchón de liquidez
El colchón es el efectivo mínimo para operar si los cobros se detienen un tiempo. Propón calcularlo así y que Adrián fije el número:
1. Suma las salidas fijas de un periodo: nómina, cuotas, renta, software, créditos, impuestos estimados por el contador.
2. Elige cuántas semanas de cobertura quiere la empresa (decisión de Adrián).
3. Ajusta por concentración: si uno o dos clientes pesan mucho en los ingresos, el riesgo de un atraso grande es mayor.
4. Revísalo cuando cambie la nómina o entre un cliente grande.
Una cifra de colchón sin método ni aprobación no es política; márcala como propuesta.

## Capital de trabajo en una agencia
- **Cobranza:** facturar a tiempo y sin errores. La mayoría de las facturas en disputa vienen de una factura que no coincide con el contrato o la cotización. Vigila la tendencia de la antigüedad de saldos, no solo el promedio.
- **Anticipos y pagos por avance:** en proyectos largos, proponer anticipo o pagos por entregable reduce el efectivo que la agencia financia al cliente. Lo negocia el área comercial; tesorería aporta el efecto en el flujo.
- **Proveedores y freelancers:** paga en la fecha pactada, no antes. Pagar antes financia a quien no lo pidió.
- **Costos que se adelantan por el cliente** (pauta, producción, viáticos): identifícalos; sin anticipo, son préstamos al cliente.
Una semana menos en el ciclo libera efectivo de forma permanente y sin costo financiero.

## Dónde está el efectivo
- Concentrar toda la operación en un solo banco es un punto único de falla; considera una segunda cuenta operativa.
- El dinero con fecha de uso no se invierte buscando rendimiento. Reservas: en instrumentos cuyo plazo coincida con cuándo se necesitan. Cualquier inversión la decide un humano autorizado con el `cfo`; el puesto no da asesoría de inversión.
- Separa el efectivo de cada marca del grupo o documenta cómo se comparte.

## Programación de pagos (propuesta semanal)
| Proveedor | CFDI / folio | Importe MXN | Vence | Prioridad | Soporte completo | Fecha propuesta |
|---|---|---|---|---|---|---|

Prioridad sugerida cuando no alcanza: nómina y cuotas; impuestos; servicios críticos de operación (internet, servidor, software indispensable); proveedores que bloquean entregas a clientes; el resto según vencimiento y relación. El orden final lo decide Adrián, y los efectos de pagar tarde impuestos o cuotas se verifican con el contador.

Antes de proponer un pago verifica: CFDI o documento que lo respalde, que no esté pagado ya, que la cuenta destino sea la registrada y que el saldo resultante quede sobre el colchón.

## Doble aprobación
El control que importa no es una herramienta: es que la liberación de un pago requiera dos personas. Propón:
- Una persona captura el pago en la banca; otra lo autoriza.
- Altas y cambios de cuenta de proveedores se confirman por un canal distinto del que pidió el cambio.
- Si hoy una sola persona captura y autoriza, señálalo como brecha y propone control compensatorio (revisión semanal de movimientos por otra persona). Ver el knowledge de `finance-review`.

## Qué entregar
Propuesta de pagos de la semana, alertas de liquidez, acciones de capital de trabajo con su efecto estimado en el flujo y supuestos marcados.

## Errores comunes
- Pagar antes del vencimiento sin motivo.
- Absorber costos de terceros del cliente sin anticipo.
- Dar el colchón como hecho sin aprobación.
- Proponer pagos sin revisar duplicados ni cambios de cuenta.
- Mezclar el efectivo de varias marcas sin decirlo.
