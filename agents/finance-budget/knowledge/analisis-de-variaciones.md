> Adaptado de headcount (cbrock84, MIT) y claude-skills (alirezarezvani, MIT): budgeting-and-forecasting, cost-accounting, financial-analyst, month-end-close.

# Presupuesto contra real: análisis de variaciones

Una variación solo sirve descompuesta y con una base declarada. Una variación sin decir contra qué se compara es solo un número.

## Antes de empezar
Busca primero en la memoria corporativa; pide lo que falte y márcalo FALTANTE:
- Reales del periodo ya cerrados y conciliados por `finance-accounting` (no uses cifras preliminares sin marcarlas).
- Presupuesto aprobado y último forecast, con su versión.
- Datos de motores: horas trabajadas y facturables, proyectos entregados, clientes activos, tarifas aplicadas.
- Umbral de importancia relativa. Si no hay política, propón uno (porcentaje y monto mínimo en MXN) y márcalo como propuesta; ninguna norma lo fija.

## Paso 1: elegir la base
Declara siempre la comparación: contra presupuesto (compromiso), contra forecast (creencia más reciente) o contra el mismo periodo del año anterior. Lo útil suele ser presupuesto y forecast lado a lado.

## Paso 2: filtrar lo importante
Una partida es importante si rebasa el umbral (porcentaje y monto a la vez), cambia de signo o aparece o desaparece. Explica las de mayor valor, no todas: un reporte que cubre cada renglón se lee como si no dijera nada.

Clasifica cada una como favorable o desfavorable según su naturaleza: más ingreso es favorable; más gasto, desfavorable.

## Paso 3: descomponer
Para cada variación importante separa:
- **Volumen:** ¿se hizo más o menos? (proyectos, horas, clientes).
- **Precio o tarifa:** ¿cada unidad costó o se cobró distinto? (tarifa real contra presupuestada, descuentos, costo por hora).
- **Tiempo:** ¿solo se movió de mes o se perdió? Un proyecto que se factura el mes siguiente no es un problema de desempeño.
- **Mezcla:** ¿cambió la composición? Más producción audiovisual y menos desarrollo cambian el margen aunque el ingreso total cuadre.

Fórmulas de ingreso, como referencia general:
```
efecto precio   = (precio real − precio presupuestado) × volumen real
efecto volumen  = (volumen real − volumen presupuestado) × precio presupuestado
efecto mezcla   = diferencia de margen por el cambio en la proporción de cada línea
```
Las de tiempo no requieren acción y suelen confundirse con desempeño. Las de tarifa en costos recurrentes (software, renta, sueldos) se acumulan mes a mes y suelen subestimarse.

## Paso 4: explicar
Cada explicación dice qué se movió, cuánto, por qué y con qué documento se respalda. Rechaza las frases de cajón: "temporalidad", "en línea con lo esperado", "ajustes varios". Si no sabes la causa, escríbelo como pregunta abierta con responsable.

## Formato del reporte
| Campo | Contenido |
|---|---|
| Encabezado | entidad, periodo, base de comparación, umbral, versión, quién preparó |
| Resumen | dos o tres variaciones que cambiaron el resultado y si son de tiempo o de tendencia |
| Tabla principal | ingresos, costos directos, margen de contribución, gastos fijos, resultado: real, presupuesto, diferencia MXN y % |
| Por variación importante | descomposición, causa, efecto en resultado y en flujo, acción propuesta, responsable, fecha |
| Por línea de negocio | real contra presupuesto por servicio o por cliente principal |
| Efecto en el forecast | qué cambia en los meses siguientes |
| FALTANTES | |

## Qué decide el puesto y qué escala
El puesto analiza y propone acciones. Escala al `cfo` y a Adrián: variaciones que comprometen la meta del año, cambios de tarifas, recortes o contrataciones, y cualquier diferencia que sugiera error de registro (se devuelve a `finance-accounting`).

## Errores comunes
- Comparar contra cifras sin cerrar ni conciliar.
- Llamar ahorro a un gasto que solo se retrasó.
- Atribuir un cambio de ingreso a precio sin separar volumen y mezcla.
- Explicar cada renglón en lugar de las pocas partidas importantes.
- No llevar el registro del error del forecast.
