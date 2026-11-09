> Adaptado de impeccable (pbakaus, Apache-2.0), unslop (Damir Sokolovsky, CC BY 4.0) y anthropics/skills (Anthropic, Apache-2.0): craft-floor, layout, typeset, colorize, harden, clarify; signs, tokens; frontend-design.

# Diseño de interfaz con criterio y señales de UI hecha por IA

La UI generada falla igual siempre: todo brilla, todo es tarjeta, el espaciado es arbitrario y el texto grita.

## Antes de empezar
Busca primero en la memoria corporativa y en el repo; pide lo que falte y márcalo FALTANTE:
- Producto, público y escena de uso (mostrador, celular en la calle).
- Marca confirmada: logo, colores, tipografías, tú o usted. Un degradado violeta con brillo no es marca salvo que Adrián lo diga.
- Contenido real y estados que devuelve la API (contrato de backend).

## Dirección antes de diseñar
Cinco líneas, del producto, no de la moda:
- **Producto:** qué hace y para quién, en una frase.
- **Carácter:** 2 o 3 palabras concretas ("exacto, cálido, rápido"). Prohibidas: limpio, moderno, elegante, minimalista, premium.
- **Mundo:** el lugar o material al que pertenece; fija el tinte de los neutros y el acento.
- **Momento:** uno o dos lugares donde la pantalla se permite riqueza; el resto queda quieto.
- **Firma:** un solo detalle propio, usado siempre igual.
Agrega 4–6 colores con nombre, tipografías con rol y el layout en una frase. Si el plan serviría igual a otro cliente, cámbialo y di por qué. Un cambio de identidad lo aprueba un humano antes de construir.

## Piso de oficio (verificar en lo renderizado)
- **Contraste:** texto 4.5:1, texto grande 3:1, controles, íconos y foco 3:1. Texto secundario sobre color: derivado de ese tono, no gris.
- **Ritmo:** escala de 4 px (4, 8, 12, 16, 24, 32, 48, 64). Menos espacio dentro de un grupo que entre grupos; más arriba de un título que abajo. Nada de `mt-[13px]`.
- **Tipografía:** cuerpo ≥16 px, medida de 45–75 caracteres, una o dos familias con rol claro, pasos de tamaño y peso evidentes. `text-wrap: balance` en títulos, `pretty` en cuerpo. Tracking negativo solo en display (no menos de −0.04em).
- **Color:** roles, no muestrario: superficie, texto, acción, foco, borde, éxito, aviso, error. Un acento para la acción principal. Modo oscuro diseñado, no invertido. Nunca solo color para significar.
- **Profundidad:** borde o sombra, no ambos; radio anidado = exterior − padding.
- **Movimiento:** un momento orquestado, una curva ease-out, solo transform y opacity; respetar `prefers-reduced-motion` sin perder el feedback.
- **Navegador:** selección, scrollbar, anillo de foco y numerales tabulares, tematizados.

## Se rechaza por defecto (el brief puede pedirlo)
- Rejillas de tarjetas idénticas ícono + título + texto; tarjetas anidadas; plantilla "métrica héroe"; hero centrado con 3+ botones.
- Etiqueta en MAYÚSCULAS espaciadas sobre cada título; numeración 01/02/03 sin secuencia real.
- Degradados violeta→azul, texto con degradado, halos de color, manchas difusas, vidrio decorativo, borde lateral de color en tarjetas.
- Emoji como íconos, ✨ para lo de IA: un solo set de íconos (lucide), un trazo.
- Copy: saludo como título, signos de exclamación, "potencia", "sin fricción", "revoluciona", cambios sin referencia ("+12 %" → "+12 % vs. mes anterior"), "más de 10,000 clientes" sin fuente.
- Pulsos en lo que no está vivo, `hover:scale` en tarjetas, rebotes.
- Defectos de IA: crema con serif y acento terracota; negro con acento ácido; tarjetas con la misma sombra gris.

## Pasadas sobre una pantalla existente
Audita con la lista anterior: mucha señal → proceso completo; poca → pule solo lo hallado y conserva la marca; ninguna → dilo y propone 2–3 ajustes con valores exactos. Orden: espaciado → color → íconos → copy → tipografía → layout → detalles → visuales → movimiento. El copy va antes que el tipo porque la longitud del título decide su tamaño.

## Estados límite
- Nombres de 100+ caracteres, vacío, emoji, acentos y ñ; `min-width: 0` en flex y grid.
- `Intl` con `es-MX`; MXN explícito si convive con USD; millones; cifras de tablas alineadas a la derecha.
- Red: sin conexión, lento, timeout. 400 junto al campo, 401 a iniciar sesión, 403 explica el permiso, 404 estado propio, 429 límite, 500 con reintento. Un componente que falla no tumba la pantalla.
- Doble clic: botón deshabilitado mientras envía.
- Listas de 1,000+: paginar o virtualizar. Zoom 200 % y 320 px de ancho.
- Vacíos distintos: primer uso, sin resultados (limpiar filtros), sin permiso, error. Nunca solo "No hay datos".

## Microcopy
- Botón = verbo + objeto ("Guardar cambios", no "Enviar"); misma palabra en todo el flujo ("Publicar" → "Publicado").
- Error: qué falló, por qué si se sabe, cómo recuperarse. Sin códigos internos como mensaje, sin disculpas, sin bromas con dinero o borrados.
- Destructivo: nombra objeto y consecuencia; deshacer mejor que confirmar; el botón dice la acción ("Eliminar factura", no "Sí").
- Etiqueta visible siempre: el placeholder es ejemplo. Conserva lo capturado si falla.

## Qué entregas
Dirección, cambios por pasada, estados cubiertos con evidencia (captura o salida del sandbox) y lo no verificado. Decides la implementación dentro de la dirección aprobada; escalas cambios de marca y afirmaciones comerciales o legales.

## Errores comunes
- Diseñar sin dirección y llamar "limpia" a la plantilla.
- Validar solo con datos perfectos en escritorio.
