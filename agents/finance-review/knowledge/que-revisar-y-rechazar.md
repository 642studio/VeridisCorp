> Adaptado de headcount (cbrock84, MIT) y claude-skills (alirezarezvani, MIT): internal-controls-and-audit, financial-reporting-and-close, budgeting-and-forecasting, treasury-and-liquidity, month-end-close.

# Qué revisar y cuándo rechazar

La revisión es independiente: no corrige el trabajo, lo prueba. Si falta evidencia, se devuelve; no se completa con supuestos del revisor. Una estimación no acredita un movimiento real.

## Antes de empezar
Busca primero en la memoria corporativa; pide lo que falte y márcalo FALTANTE:
- El entregable y quién lo preparó (nunca revises algo que tú preparaste).
- Documentos fuente: estados de cuenta, balanza, CFDI, contratos, cotizaciones, presupuesto aprobado.
- Umbral de importancia relativa y límites de autorización vigentes, si existen.
- Versión anterior del entregable, para ver qué cambió.

## Veredictos
- **Aprobado:** todo cuadra y tiene soporte.
- **Aprobado con observaciones:** detalles que no cambian la decisión; se anotan.
- **Devuelto:** falta evidencia o hay un error que cambia una cifra importante. Se dice qué falta y dónde.
- **Escalado a Adrián:** posible fraude, pago irregular, conflicto entre áreas o algo que exige criterio fiscal o legal.

## Cierre mensual (de `finance-accounting`)
Rechaza si:
- Alguna conciliación no cuadra a 0.00 o se "cuadró" con una partida sin explicar.
- Hay partidas pendientes que rebasan el límite de antigüedad sin plan de resolución.
- Quien preparó una conciliación aparece también como revisor.
- Una variación importante no tiene explicación, usa frases de cajón ("temporalidad", "normal") o no trae cifra ni documento.
- El reporte presenta cifras que no salen de una conciliación.
- Se registraron movimientos después del corte sin nota.
Prueba por muestreo: elige partidas y rastréalas del estado de cuenta a la póliza y de la póliza al CFDI. Anota cuáles revisaste.

## Presupuesto o forecast (de `finance-budget`)
Rechaza si:
- No dice moneda (MXN), periodo, versión y fecha.
- Hay importes sin supuesto ni procedencia (dato aportado, histórico, cotización o supuesto marcado).
- Un forecast no explica qué cambió respecto al anterior.
- Las variaciones no separan volumen, precio, tiempo y mezcla en las partidas principales.
- Un supuesto que mueve las cifras de otra área lo fijó un área distinta sin validarlo.
- Los recortes son proporcionales en lugar de nombrar qué se deja fuera.
- Solo hay un escenario cuando la decisión depende de un supuesto incierto.

## Pago propuesto (de `finance-treasury` o `finance-billing`)
Antes de que un humano lo autorice, verifica:
| Revisión | Pregunta |
|---|---|
| Soporte | ¿Hay CFDI, contrato u orden aprobada? ¿Coinciden RFC, importe y concepto? |
| Autorización | ¿Lo aprobó quien tiene atribución por monto y por riesgo? |
| Duplicado | ¿Ya se pagó este CFDI o esta cotización? Busca por folio, importe y fecha. |
| Proveedor | ¿Es nuevo o cambió su cuenta bancaria? Exige confirmación por otro canal. |
| Fragmentación | ¿Hay varios pagos al mismo proveedor justo debajo del límite? |
| Liquidez | ¿El pago deja el saldo arriba del colchón en el flujo a 13 semanas? |
| Doble aprobación | ¿La liberación en banca requiere dos personas? Si no, señálalo. |
Ningún agente ejecuta ni libera pagos. Tu dictamen es una recomendación para quien autoriza.

## Señales de alerta que se escalan
- Proveedores con datos incompletos, sin CFDI o con RFC que no corresponde.
- Prisa inusual, peticiones por un canal no habitual o instrucciones de cambiar cuenta.
- Pagos a cuentas personales o entre marcas del grupo sin explicación.
- Diferencias pequeñas y repetidas en la misma cuenta.
- Ajustes manuales grandes al cierre sin soporte.

## Formato del dictamen
1. Veredicto y una línea de por qué.
2. Hallazgos: severidad (alta / media / baja), cifra afectada, evidencia, corrección pedida.
3. Qué revisaste y con qué documentos (incluye la muestra).
4. Qué no pudiste revisar y por qué.
Una aprobación sin decir qué se revisó no es evidencia de revisión.

Los criterios fiscales (deducibilidad, retenciones, cancelaciones de CFDI) no se dictaminan aquí; verificar con el contador / SAT vigente.

## Errores comunes
- Arreglar el trabajo en lugar de devolverlo, y así perder la independencia.
- Aprobar por confianza en quien preparó.
- Revisar solo la aritmética y no el soporte.
- Aprobar sin anotar qué se verificó.
- Tratar una proyección como si fuera un saldo real.
