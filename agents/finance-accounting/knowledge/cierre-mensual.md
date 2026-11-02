> Adaptado de headcount (cbrock84, MIT) y claude-skills (alirezarezvani, MIT): financial-reporting-and-close, month-end-close.

# Cierre mensual

El cierre es un proceso con orden, dependencias y control de calidad; su producto es una cifra con la que alguien va a decidir. Se acelera quitando trabajo de la ventana de cierre, no quitando revisiones.

## Antes de empezar
Busca primero en la memoria corporativa; pide solo lo que falte y márcalo FALTANTE:
- Entidad (642 Studio u otra marca del grupo), periodo y fecha de corte acordada.
- Catálogo de cuentas vigente y balanza de comprobación del periodo y del anterior.
- Estados de cuenta bancarios y de tarjetas del periodo completo.
- CFDI emitidos y recibidos del periodo (relación descargada del portal del SAT o del sistema del contador).
- Nómina del periodo y cuotas pagadas (IMSS, INFONAVIT) según las registre el contador.
- Quién prepara y quién revisa cada cuenta (no pueden ser la misma persona o agente).
- Umbral de importancia relativa definido por Adrián o el contador. Si no existe, pídelo; no lo inventes.

## Calendario y ruta crítica
1. Lista cada tarea con responsable, revisor, dependencias y duración.
2. Ordena por dependencias: lo que no depende de otra tarea corre en paralelo.
3. Identifica la ruta crítica (la cadena más larga). Solo acelerar esa cadena acorta el cierre; las demás tienen holgura.
4. Saca trabajo de la ventana de cierre: conciliar bancos semanalmente, registrar provisiones recurrentes desde una tabla, revisar CFDI recibidos conforme llegan.
5. Fija un **corte duro**. Lo que llegue después va al siguiente periodo con nota; el cierre no queda abierto para "una póliza más".

Orden típico: bancos → ingresos y cuentas por cobrar → gastos y cuentas por pagar → nómina → provisiones → impuestos (insumos para el contador) → balanza → variaciones → reporte.

## Conciliaciones: la prueba que cuadra a cero
Cada cuenta de balance tiene dueño y conciliación. Conciliar no es poner dos saldos lado a lado: es explicar la diferencia con partidas nombradas.

```
fuente ajustada   = saldo de la fuente (banco, auxiliar) + partidas en libros aún no en la fuente
libros ajustados  = saldo en libros + partidas en la fuente aún no registradas
diferencia sin explicar = fuente ajustada − libros ajustados → debe ser 0.00
```
- Empareja primero por referencia, luego por importe en una ventana de fechas.
- Pistas: una diferencia divisible entre 9 suele ser dígitos transpuestos; una igual a una partida (o al doble) suele ser un registro omitido, duplicado o con signo invertido.
- Si la diferencia ya estaba en el saldo inicial, viene del mes anterior: se corrige en esa conciliación, no se registra en este periodo.
- Partidas solo en la fuente (comisiones, intereses, cargos no registrados) requieren póliza propuesta con su soporte.
- Antigüedad de partidas pendientes en rangos 0-30, 31-60, 61-90 y más de 90 días. Una partida que sobrevive tres cierres ya no es "de tiempo": es un error arrastrado. El límite de escalamiento lo fija la política; si no hay, propón uno y márcalo como propuesta.
- **Nunca cuadres con una partida de ajuste sin explicar.** Una diferencia sin explicar es un hallazgo.

Cuentas mínimas: bancos, clientes, proveedores, impuestos por pagar y a favor, anticipos de clientes, nómina por pagar, acreedores diversos.

## Provisiones y estimaciones
Registra con la mejor evidencia disponible y documenta la base (contrato, cotización, consumo histórico). La base importa más que el número: el mes siguiente alguien decide si sigue vigente. Compara cada estimación contra lo real cuando llegue; un sesgo constante en un sentido es información del proceso.

## Variaciones del cierre
Compara la balanza contra el periodo anterior (y contra presupuesto si `finance-budget` lo entregó). Una cuenta es importante si rebasa el umbral, cambia de signo o aparece/desaparece. Su explicación debe decir qué se movió, cuánto, por qué y qué documento lo respalda. "Temporalidad" o "dentro de lo esperado" sin cifra no es explicación. La descomposición en volumen, precio, tiempo y mezcla vive en el knowledge de `finance-budget`.

## Qué entregar
1. Calendario con ruta crítica y responsables.
2. Una hoja de conciliación por cuenta: saldos, diferencia (0.00), partidas con antigüedad, pólizas propuestas.
3. Tabla de variaciones importantes con explicación y soporte.
4. Reporte: primero las dos o tres cosas que cambiaron y por qué; luego el detalle. Separa lo que es de tiempo (se movió de mes) de lo que cambia la tendencia.
5. Lista de pendientes y FALTANTES.

El puesto prepara y propone. El registro definitivo, las declaraciones y cualquier criterio fiscal los decide el contador; verificar con el contador / SAT vigente.

## Errores comunes
- Dejar el cierre abierto para registros tardíos.
- Arrastrar una partida sin explicar por segundo mes.
- Presentar una variación sin decir contra qué se compara.
- Reportar una cifra que no sale de una conciliación.
- Que quien preparó una conciliación sea quien la revisa.
- Acelerar tareas fuera de la ruta crítica creyendo que eso acorta el cierre.
