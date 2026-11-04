# Storylines — explainer de VeridisCorp

El viewer entiende al final: un pedido real a ASISTENTE se convierte en un expediente que un
especialista resuelve, un revisor vuelve a comprobar por su cuenta (sin repetir las herramientas
con efecto real) y un humano aprueba antes de que algo salga de verdad.

Ejemplo concreto que recorre las tres (sacado literal del código, no inventado):
Adrián le escribe a ASISTENTE "necesito una cotización de redes sociales" → se abre un expediente
con el objetivo "Preparar una cotización de redes sociales." → un especialista de `content`
prepara el PDF real (`pdf.generate`) → el revisor vuelve a ejecutar solo las herramientas de
solo lectura, nunca `pdf.generate` otra vez → un humano aprueba.

---

## 1. El expediente que viaja — RECOMENDADA

Por qué: es el ejemplo real más literal (viene del propio test del código) y el más construible
primero sin perder el hilo humano.

Dispositivo: el objetivo del pedido ("Preparar una cotización de redes sociales.") es un objeto
físico de texto que viaja de tarjeta en tarjeta por el sistema.
Forma: cadena objeto-a-objeto — cada plano termina en lo que abre el siguiente (el mensaje se
convierte en expediente, el expediente en tarea, la tarea en PDF).

Qué ve y siente el viewer: empieza en un chat oscuro y familiar, ve su propio pedido convertirse,
plano a plano, en el trabajo real de una oficina — sin perder nunca de vista que alguien real
aprueba al final. Se siente como ver abrirse una caja dentro de otra caja, cada una más concreta.

Primeros 2 segundos, exacto: cursor parpadeando en el chat de ASISTENTE; empieza a teclearse
"necesito una cotización..." letra por letra, fondo terminal oscuro.
Beats: hook (el mensaje se escribe y se envía) → tensión (una fila de expedientes sin revisar se
amontona, "¿quién aprueba esto?") → reveal (título "VeridisCorp" se escribe con el mismo tecleo) →
prueba (expediente → tarea asignada → especialista trabaja → revisor reejecuta solo lectura,
checkmark) → pago (el PDF aparece, un humano hace clic en "aprobar") → claim ("Nada con efecto
real sale sin que alguien lo apruebe.") → end card.
Look: terminal/monoespaciada, fondo #0b0f14, acento teal #35e0c0 (ya usado en el proyecto), tarjetas
planas con borde fino, nunca cristal ni glow.
Sonido: tecleo suave + un "pop" discreto cuando cada tarjeta aparece, cama instrumental ambiental
que entra tras el hook y sube un peldaño en el reveal.

## 2. El organigrama que cobra vida — LA ARRIESGADA

Dispositivo: el propio grafo de organización (56 perfiles, 9 áreas — el mismo dato real de
`agents/INVENTORY.md` y la pantalla ORGANIGRAMA) ES la explicación; la cámara lo recorre.
Forma: vuelo continuo por un mundo — la cámara nunca corta, viaja del nodo CEO hacia el
departamento, el agente y la herramienta que de verdad se activan.

Qué ve y siente el viewer: un mapa vivo que se enciende nodo a nodo siguiendo un pedido real,
como ver la electricidad recorrer un circuito — imponente, pero exige que el nodo CEO ya sienta
que ahí llegó una persona, no solo un diagrama.

Primeros 2 segundos: el grafo completo, tenue, en reposo; el nodo CEO se enciende de golpe.
Beats: hook (CEO se enciende) → la cámara baja hacia el departamento correcto → tensión (un nodo
de agente sin herramienta real se ve apagado/gris, "41 de 56 perfiles siguen sin herramienta real
hoy") → reveal (la ruta del pedido se dibuja en dorado) → prueba (nodo tarea → nodo especialista
se enciende → nodo revisor confirma con un check) → pago (nodo herramienta dispara, el ícono de
PDF se materializa) → claim → end card: el propio grafo, ahora completo, como marca.
Look: canvas oscuro, nodos como círculos con la paleta categórica real de 9 colores ya validada
en `web/`, layout radial, Inter + Space Mono.
Sonido: pad evolutivo que se espesa con el vuelo de cámara, "blips" de conexión suaves en cada
nodo que se enciende, riser corto en el reveal.

## 3. Un día de Adrián — LA SEGUNDA OPCIÓN

Dispositivo: una persona hace una tarea real, de principio a fin, sin cortes.
Forma: una sola toma continua — la cámara empuja y se aleja, nunca corta.

Qué ve y siente el viewer: reconoce el gesto de escribir en un chat y mandar un pedido, y ve
exactamente a dónde va ese pedido sin perder nunca la sensación de estar mirando por encima del
hombro de una persona real.

Primeros 2 segundos: el cursor ya está a mitad de teclear "necesito una cotización de redes
sociales" (empieza in medias res, no desde cero).
Beats: hook (termina de escribir, envía) → la cámara empuja hacia el botón de enviar y sin cortar
aparece el dashboard del expediente → tensión (el estado salta pending→running→in_review, una
corrección parpadea "1 de 5 revisiones") → reveal (aparece el especialista trabajando) → prueba
(el PDF se arma dentro del mismo plano) → pago (la cámara se aleja hasta el clic en "aprobar" y
la descarga) → claim → end card, todavía en el mismo plano sin cortes.
Look: realismo de producto — pantallas reales, no abstractas, mismo tema oscuro y acento teal que
el dashboard de verdad.
Sonido: foley de oficina discreto (teclas, clic), un único sting ascendente en el pago.

---

Supuestos si no se dice lo contrario: duración 30–40s, 1920×1080 (16:9, no vertical — es para
explicar, no para redes), sin voz en off (los títulos grandes llevan el texto), música de cama
del catálogo gratuito de `/media-use` (si no hay sesión de HeyGen ni modelo local, se entrega en
silencio y se avisa) — `music.generate` (sunoapi.org, de pago) queda como alternativa si se pide
una pista hecha a medida.
