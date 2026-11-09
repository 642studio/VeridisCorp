> Adaptado de anthropics/skills (Anthropic, Apache-2.0): xlsx.

# Hojas de cálculo financieras

Una hoja financiera debe recalcularse sola cuando cambia un supuesto. Si alguien tiene que rehacer cuentas a mano, la hoja está mal hecha.

## Quién la crea y qué hace hoy la herramienta
Presupuestos diseña la hoja; no tiene `sheets.create`. La crea `data-analyst` con `sheets.create` (Google Sheets) o un humano. Revisado en el código el 2026-11-08: `sheets.create` solo recibe título, encabezados y filas (máximo 20 columnas y 500 filas, celdas de texto de hasta 300 caracteres), escribe en modo RAW y en una sola pestaña. Por eso una fórmula como `=SUM(B2:B9)` queda guardada como texto y no calcula, los números entran como texto y no se aplican colores ni formatos. Mientras siga así, entrega la **especificación** completa (abajo) para que un humano capture fórmulas y formato, y nunca digas que una hoja creada así "ya calcula".

## Antes de empezar
Busca en la memoria corporativa y pide lo que falte, marcándolo FALTANTE:
- El encargo literal: nombres de pestañas, encabezados y fórmulas que pidió quien la solicita.
- Reales conciliados de `finance-accounting`, presupuesto o forecast vigente y su versión.
- La fuente de cada número fijo: estado de cuenta, CFDI, cotización, contrato, nómina o dato de Adrián.
- Si se trata de editar una hoja existente: el enlace y sus convenciones.

## Requisitos de toda hoja
- **Fórmulas, nunca resultados fijos.** El total es `=SUM(B2:B9)`, no el número que calculaste aparte.
- **Cero errores.** Ninguna celda con `#REF!`, `#DIV/0!`, `#VALUE!`, `#NAME?` o `#N/A`. Protege los denominadores que pueden ser cero con `IF(B5=0,0,B4/B5)`.
- **Sigue el encargo al pie de la letra.** Pestañas, encabezados y fórmulas tal como se pidieron. Un rediseño que calcula otra cosa es un error, aunque se vea mejor.
- **Cada supuesto y cada número fijo, documentado** donde se vea: nota en la celda o columna "Fuente". Si vino de Adrián o del cliente, dilo así.
- **Hoja para que otros la llenen:** una leyenda que diga qué celdas se editan y una fila de ejemplo con valores realistas. Esto no aplica cuando editas una hoja ajena.
- **Editar una hoja existente:** sus convenciones mandan sobre esta guía. Escribe solo en sus celdas de captura y no toques sus fórmulas.

## Supuestos separados
- Pestaña "Supuestos" con un supuesto por celda, con etiqueta, unidad y fuente: tarifa por hora, incremento salarial, tipo de cambio, tasa de IVA vigente (verificar con el contador).
- Las fórmulas apuntan a esa celda: `=B5*(1+Supuestos!$B$6)`, nunca `=B5*1.05`.
- Si una pestaña tiene espacios en su nombre, va entre comillas: `='Supuestos 2027'!$B$5`.
- La misma fórmula en todos los periodos de una fila. Una celda editada a mano a mitad de fila es el error silencioso más común.
- Montos con IVA y sin IVA en columnas distintas y con su etiqueta; nunca mezclados en una sola suma.

## Convenciones de color y formato (si la hoja no trae otras)
| Elemento | Convención |
|---|---|
| Datos capturados y palancas de escenario | texto azul |
| Fórmulas | texto negro |
| Vínculo a otra pestaña | texto verde |
| Vínculo a otro archivo (`IMPORTRANGE`) | texto rojo |
| Supuestos clave y celdas por llenar | fondo amarillo |

- Moneda con la unidad en el encabezado: "Ingresos (MXN)" o "(miles de MXN)".
- Negativos entre paréntesis y ceros como "-".
- Porcentajes guardados como fracción: 0.15 se muestra como 15.0 %. Si guardas 15, se muestra como 1500 %.
- Múltiplos en formato 0.0x. Los años van como texto ("2027"), no como 2,027.
- Una fuente legible en toda la hoja (Arial, salvo que pidan otra).
- Los nombres de funciones y el separador de argumentos dependen de la configuración regional de la hoja. Verifícalos en la hoja real.

## Pruebas antes de entregar
1. Escribe dos o tres fórmulas primero y confirma que toman los valores esperados. Después llena la cuadrícula.
2. Que no haya errores no significa que esté bien. Un rango recorrido una fila da números limpios y equivocados.
3. Cuadra la hoja: la suma por filas debe igualar la suma por columnas, y los totales deben coincidir con los reales de `finance-accounting`.
4. Cambia un supuesto y comprueba que todo lo que depende de él se mueve.
5. Busca números fijos dentro de filas de fórmulas y revisa todas las pestañas, no solo la primera.

## Modelos financieros
Separa Supuestos → Cálculos → Resultados. Los escenarios (base, conservador, optimista) solo cambian celdas azules de Supuestos. Lo fiscal y lo laboral (IVA, ISR, cuotas IMSS e INFONAVIT) va como supuesto con la leyenda "verificar con el contador". No escribas tasas de memoria.

## Qué entregar
```
Especificación: | pestaña | celda o columna | contenido | fórmula | formato | fuente |
Pruebas hechas: <cuáles y su resultado>
No verificado: <qué falta y quién debe confirmarlo>
```

## Errores comunes
- Pegar resultados en lugar de fórmulas.
- Poner un supuesto dentro de la fórmula (`*1.16`).
- Dar por buena una hoja porque no muestra errores.
- Porcentajes guardados como 15 en vez de 0.15.
- Presentar como hoja funcional una tabla que `sheets.create` cargó como texto.
