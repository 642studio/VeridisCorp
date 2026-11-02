> Adaptado de headcount (cbrock84, MIT): business-intelligence, data-governance.

# Tableros por KPI y árbol de métricas

Sobran tableros y falta claridad: cuando todo se mide, nada se vigila. Cada reporte responde una pregunta para una audiencia que puede actuar.

## Antes de empezar
Busca primero en la memoria corporativa; pide lo que falte y márcalo FALTANTE:
- La decisión que informa el tablero y quién la toma (Adrián, responsable de marca, operación de sucursal, cliente).
- Qué haría distinto esa persona según lo que vea. Si nada cambiaría, no se construye.
- Definiciones de cada métrica en el diccionario de data-lead; si no existen, propónlas y márcalas por aprobar.
- Fuentes, frecuencia de actualización y dueño de cada una.
- Metas o rangos de "bien" que fije el negocio.

## Árbol de métricas
Un resultado principal arriba, descompuesto en los factores que lo producen matemáticamente, y cada uno otra vez:
```
Venta = pedidos × ticket promedio
  Pedidos = clientes nuevos + recurrentes
    Nuevos = visitas (o mensajes) × conversión
  Ticket = productos por pedido × precio promedio
```
Sirve para dos cosas: cuando el número de arriba se mueve, se baja por el árbol para encontrar dónde; y separa palancas (lo que un equipo controla: tiempo de respuesta en WhatsApp, frecuencia de publicación) de resultados (lo que solo influye: venta). A cada área se le mide por sus palancas. Adapta el árbol al negocio: agencia (proyectos × margen), restaurante (comensales × ticket), servicios con cita (citas × ocupación).

## Diseño
- **Una pantalla, una pregunta.** Si hay que bajar mucho, son varios tableros.
- **La respuesta primero:** el número principal, su comparación y si es bueno o malo. Un número sin comparación no informa.
- **Comparación siempre,** elegida a propósito: periodo anterior, meta, mismo periodo del año pasado o cohorte. Cada una cuenta una historia distinta; di cuál es.
- **Di qué es "bien":** meta o rango. Quien no sabe si 4.2 % es bueno no actúa.
- **Denominador y ventana visibles:** "conversión de mensajes a venta, 1-15 oct, 312 conversaciones".
- **Anota las anomalías:** el pico por el que todos preguntan lleva su explicación.
- **Frescura visible:** fecha y hora del último dato. Si la carga falló, se muestra la falla, no el dato viejo como si fuera actual.
- **Corta lo demás:** gráficas que nadie usa cuestan atención en cada visita.
- **Montos en MXN, con o sin IVA dicho explícitamente**; cifras financieras conciliadas contra el sistema de registro (ERP, CFDI). Lo contable lo valida finanzas.

## Ficha por KPI
```
KPI: <nombre del diccionario>
Pregunta y decisión: <qué responde, quién actúa>
Definición: <enlace al diccionario>   Fuente: <tabla o sistema>
Grano y ventana: <diario, semanal; zona horaria>
Comparación: <contra qué>   Meta o rango: <valor o FALTANTE>
Palanca o resultado: <cuál>   Dueño: <persona>
Frescura esperada: <cada cuánto>
```

## Confianza
Un tablero en el que nadie confía no se usa, y la confianza se pierde más rápido de lo que se recupera. Si un número publicado estaba mal, dilo pronto y visiblemente; corregirlo en silencio enseña a todos a revisar cada cifra a mano. La lógica de negocio no vive en el tablero: si hace falta una regla, va a la capa de métricas con data-engineer.

## Mantenimiento
Cada tablero tiene dueño. Revisa el uso periódicamente y retira lo que nadie abre, con aviso previo: quien lo usa quizá lo usa para algo importante. Las hojas de cálculo seguirán existiendo: planea la exportación.

## Qué entregas
Árbol de métricas, fichas por KPI, boceto del tablero (orden, comparaciones, anotaciones) y lista de datos faltantes. La herramienta concreta (hoja de cálculo, Metabase, tablero propio en React) la decide software o data-lead. Publicar o compartir con clientes lo aprueba un humano.

## Errores comunes
- Tablero sin decisión detrás.
- La misma métrica con dos definiciones activas.
- Porcentajes sin base.
- Tablero sin dueño que todos creen y nadie revisa.
