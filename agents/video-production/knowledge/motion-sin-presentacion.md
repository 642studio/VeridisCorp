> Adaptado de bang-motion (Bang Tutorial, MIT): anti-ppt, techniques, opener-konsep.

# Motion que no parece presentación

Complementa la regla de ritmo (cortes rápidos, voz o golpe sonoro en el primer segundo, nada que se alargue) y la lista BANNED de `hyperframes-contrato-y-flujo.md`: si una técnica de aquí choca con BANNED, gana BANNED salvo que la marca ya la use.

## Antes de empezar

Del SPEC y la memoria corporativa: paleta y logo, formato, guion con tiempos de voz y los últimos videos hechos para esa marca (para no repetir su estructura). Lo que falte, FALTANTE.

## Error → corrección

| Se ve así | Corrígelo así |
|---|---|
| Etiqueta + título de 2 líneas + párrafo + chips | Una frase de ≤5 palabras + un objeto que llega |
| Más de 6 palabras en un plano | Partir en dos planos o volverlo visual (número, ícono, UI) |
| Todo en MAYÚSCULAS, centrado, misma entrada | Tipo oración, peso medio; alternar tamaño, posición y una de 8 entradas (arriba, abajo, izq., der., profundidad, máscara, por palabra, tecleado); sin punto final automático |
| Cámara quieta, solo el texto entra y sale | Cambio de tamaño de plano hacia lo que está contando |
| La misma transición en todos los cortes | Mínimo dos tipos, uno con profundidad |
| Fondo plano o quieto | Fondo de 2 capas que siempre se mueve |
| Captura de app con zoom | UI rearmada y usada (cursor, datos que llenan, botón que reacciona) |
| Copiar paleta y tipografía de la referencia | Tomar solo ritmo y energía; la piel sale de la marca |

Orden de atención en cada plano: frase → objeto principal → detalle. Entrada firme y más lenta que la salida (`power4.out` / `power2.in`); simétrico se siente mecánico.

## Cámara: tamaños de plano

Envuelve el mundo en un `#world` y anima escala y punto focal en el timeline:
- **General**: toda la composición, cuando hay que leer varias cosas.
- **Medio corto**: el elemento ocupa de un tercio a la mitad del cuadro.
- **Primer plano**: un detalle llena el cuadro; énfasis o acción.
Dos planos seguidos del mismo tamaño se sienten planos. El texto aparece cuando la cámara llega, no durante el movimiento. En un corte puedes nacer ya en primer plano y abrir. Captions y subtítulos van en una capa fuera de `#world`. Mundo más grande que el cuadro: nunca se ve su borde. Encima, un "respiro" lento de ±4 % hecho con tweens del timeline (nada de `repeat: -1`).

## Transiciones (elige del menú)

1. Empuje a través (*push-through*): máximo uno por video y con motivo (entrar a una pantalla, al hueco del logo).
2. Tarjeta u objeto que gira desde el fondo (`rotateY` −35° → 0 con `perspective`).
3. Objeto con grosor que pasa frente al lente y tapa el cuadro un instante.
4. Revelado con máscara en forma de la marca (`clip-path`).
5. Barrido rápido con desenfoque direccional (~0.3 s), alternando dirección.
6. Cambio de foco: lo viejo se desenfoca y se va atrás, lo nuevo llega nítido.
7. Coreografía encimada sin corte: lo viejo sale rápido mientras lo nuevo ya entra.
8. Cambio de fondo escondido detrás de 3, 4 o 5.

Prohibido por defecto: bloque de color plano que barre todo el cuadro, línea delgada que barre, barrido que deja ver el borde negro, giros o zooms sorpresa con blur en cada corte (lenguaje de preset de editor). Barridos: máximo dos por video.

## Fondo siempre en movimiento

Un lenguaje por video (dos si cambia de segmento), con colores de la paleta: degradado de marca que se desplaza lento; textura o grano cuyo desplazamiento sale del tiempo `t`; formas del logo girando lento en 2 capas de paralaje; retícula que respira (escala 1.0↔1.04); texto fantasma gigante de bajo contraste; foto con paralaje de 2 capas y oscurecida del lado del texto; campos de color de marca que cambian en el beat. Debajo del texto, zona tranquila con contraste. El color de fondo cambia solo con un disparador visible (algo tapa el lente, acción de UI, corte en el beat).

## Cómo abrir (primeros 3 s)

Antes del guion visual escribe 3 conceptos de una línea y elige uno por lo que convence al verse. Aperturas: acción ya empezada en el cuadro 0; el resultado primero (cerca y desenfocado) que se aleja para dar lugar a la frase; palabra gigante cortada por el borde y la cámara abre; el problema directo (caos que luego se ordena); textura en primer plano que resulta ser el producto; oscuro → una luz → el mundo; pregunta escrita dentro del mundo, no en una caja flotante. Anota la huella: `concepto · núm. de escenas · objeto por escena · apertura · cierre`; debe cambiar al menos 3 de 5 respecto al video anterior de la marca.

## Errores comunes

- "Gancho → función → función → promesa → logo → CTA" en todos los videos.
- El efecto más caro en todos lados: guárdalo para 1 o 2 momentos.
- Revisión rápida en un `snapshot`: si ese cuadro podría ser una diapositiva corporativa, rehazlo; si el ojo no sabe a dónde ir en 0.2 s, quita elementos.
