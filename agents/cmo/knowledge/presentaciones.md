> Adaptado de anthropics/skills (Anthropic, Apache-2.0): pptx.

# Presentaciones: estructura, diseño y control de calidad

Una presentación sirve para que alguien entienda algo o tome una decisión. Si el público no sabe al final qué se le pidió, la presentación falló, aunque se vea muy bien.

## Quién hace qué y qué permite la herramienta
Dirección de Marketing define la narrativa, aprueba la estructura y revisa el resultado. `content` la arma con `slides.create`, una herramienta de Google Slides. Revisado en el código el 2026-11-08, `slides.create` hace solo esto:
- Una portada con el título.
- Hasta 15 diapositivas, cada una con un encabezado y de 1 a 8 viñetas de máximo 300 caracteres.
- Usa los diseños predefinidos de Google.

No permite imágenes, tablas, dos columnas, notas del orador, colores ni tipografías. Por eso:
- Primero se resuelve el contenido con esta herramienta.
- El pulido visual lo hace después un humano en Google Slides, con la guía visual de abajo.
- Lo que no cabe en la presentación, como el detalle y las fuentes, va en un documento aparte (`pdf.generate`) o en la entrega.

## Antes de empezar
Busca en la memoria corporativa y en la ficha de marca. Pide lo que falte y márcalo FALTANTE:
- Público, quién decide y qué sabe del tema.
- Objetivo: qué debe pensar, sentir o decidir el público al terminar.
- Duración y formato: se expone en vivo o se manda por WhatsApp o correo para leerse sin expositor.
- Datos con fuente. Un número sin fuente no entra.
- Paleta, tipografías y logotipo de la marca.

## Estructura
1. **Portada:** un título que diga de qué trata y para quién es.
2. **La conclusión primero.** Pon la recomendación o la petición en la segunda diapositiva y después la sustentas.
3. **Una idea por diapositiva.** Si una diapositiva necesita "y además", son dos diapositivas.
4. **Encabezados que afirman.** Escribe "Las reservas entre semana bajaron desde junio", no "Reservas". Si alguien lee solo los encabezados en orden, debe entender el argumento completo.
5. **Pocas viñetas y breves.** Las viñetas apoyan el encabezado; no son párrafos partidos. Si pasan de cinco o se cortan en varias líneas, divide la diapositiva.
6. **Cierre:** qué se decide, quién lo hace y para cuándo.
7. **Pide una sola cosa por presentación.** Si son varias, ponlas en orden de prioridad.

## Guía visual para el pulido humano
Estos son puntos de partida, no reglas fijas:
- **Paleta de la marca, no la de la herramienta.** Un color domina y los demás acompañan, con un solo color de acento.
- **Fondos:** oscuro en portada y cierre, claro en el contenido. Si la marca no define fondo, usa blanco, no beige.
- **Un recurso visual repetido** en todas las diapositivas, como íconos en círculos o fotos con el mismo marco.
- **Varía el diseño:** dos columnas, cifra grande con etiqueta, comparación antes y después, línea de tiempo.
- **Jerarquía de tamaños**, como referencia general: título de 36 a 44 pt en negritas y texto de 14 a 16 pt.
- **Alineación:** texto alineado a la izquierda. Solo los títulos van centrados.
- **Espacio:** márgenes de al menos 1.3 cm (media pulgada), espacios iguales entre bloques y aire alrededor.
- **Contraste fuerte** del texto y los íconos contra el fondo.
- **Evita las señales de diapositiva hecha por IA:**
  - Líneas decorativas bajo los títulos.
  - Franjas de color en un borde.
  - Diapositivas de solo texto en toda la presentación.
  - Una diapositiva muy cuidada entre otras planas. Se pule todo el conjunto o se deja todo sencillo.

## Control de calidad antes de entregar
**Contenido.** Revisa:
- Que no falte nada del encargo, que no haya errores de dedo y que el orden sea lógico.
- Que cada cifra tenga fuente.
- Que no queden marcadores como "lorem", "TODO", "[insertar]" o "xxx".

**Visual.** Alguien abre el enlace y revisa cada diapositiva, en este orden:
1. Texto que se desborda o se corta. Es el defecto más común.
2. Elementos encimados.
3. Márgenes y espacios desiguales.
4. Columnas desalineadas.
5. Poco contraste.
6. Marcadores olvidados.

**Quién revisa.** Quien armó la presentación tiende a ver lo que esperaba ver, no lo que quedó. La revisión visual la hace otra persona o un agente que no la armó. El agente no ve la presentación terminada, así que su entrega marca "no verificado visualmente" hasta que un humano la revise.

## Qué entregar (para que `content` la arme)
```
Título:
Objetivo y decisión que se pide:
| # | encabezado (afirma) | viñetas | fuente de los datos | recurso visual sugerido |
Pendientes de pulido humano: <imágenes, tablas, gráficas, notas>
No verificado: <visual, cifras por confirmar>
```

## Errores comunes
- Encabezados que son temas en vez de conclusiones.
- Meter todo el informe en las viñetas.
- Dejar la petición para el final o no hacerla.
- Cifras sin fuente "para que se vea completo".
- Entregar sin que nadie haya abierto la presentación.
- Usar el azul genérico en lugar de la paleta de la marca.
