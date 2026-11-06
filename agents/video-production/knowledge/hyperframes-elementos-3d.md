> Escrito para VeridisCorp a partir de investigación visual y pruebas propias; referencias descritas en el contenido.

# Elementos 3D (estilo "clay"/claymorphism) en HyperFrames

Investigación a partir de reels reales (cuenta `clienty.co`, estilo CRM) que muestran objetos 3D
redondeados tipo plastilina — un mono de soporte con headset, un robot, una cadena de esferas tipo
collar, tarjetas de UI inclinadas en perspectiva. No se confirmó con qué herramienta exacta se
hicieron esos reels puntuales (no hay créditos públicos), pero el estilo visual y el patrón técnico
son identificables y reproducibles con lo que ya tenemos disponible.

## Qué es el estilo

"Claymorphism" / 3D clay icons: geometría simple (esferas, cápsulas, formas con esquinas muy
redondeadas), material mate con un leve brillo (roughness medio, sin metalness), luz de estudio
suave (key cálida + rim fría sobre un entorno oscuro), sombra de contacto suave debajo del objeto —
exactamente la receta que ya trae `references/types/3d.md` de la skill `hyperframes`: "warm key, a
cool rim and a dark environment... roughness about 0.45 or more... a contact shadow under the
object." No es casualidad: es la forma estándar de iluminar geometría 3D simple para que lea como
objeto físico y no como render plano.

## Cómo se hacen en la práctica (fuera de VeridisCorp)

Según la búsqueda: casi todo este tipo de contenido se arma en **Spline** (spline.design, editor
3D en navegador, exporta a `.glb`/`.gltf` o directo a video/PNG) o parte de **packs de íconos 3D
con licencia** (IconScout, GetIllustrations — "Clay 3D Icon Packs", "Clay Robot Characters",
mascotas de plastilina) que ya vienen en `.glb`/`.fbx`/`.blend`. No encontré un pack gratis con
licencia clara que calce exacto con "cadena de esferas + mono + robot" — paquetes así casi siempre
son de pago o exigen atribución/Figma. Esto importa para VeridisCorp: cualquier asset 3D de
terceros necesita licencia verificada para uso comercial en video, igual que ya se exige para
fuentes y assets 2D (`docs/third-party-notices.md`) — **esa decisión de costo/licencia la toma
Adrián, no se autoaprueba.**

## Cómo lo consume HyperFrames hoy (ya soportado, verificado leyendo código real)

`references/runtimes.md` de la skill lista Three.js/WebGPU como runtime soportado: se dibuja desde
`e.detail.time` en un listener `hf-seek`, o — patrón alternativo, visto en componentes reales del
catálogo — se conduce un render determinista con un `gsap.timeline` sobre un objeto reloj plano
(`{t:0}`) cuyo `onUpdate` llama `render(clock.t)`; ambos logran lo mismo: el frame es función pura
del tiempo, nunca de un loop `requestAnimationFrame`.

Dos componentes del catálogo ya resuelven esto de punta a punta — instalarlos y leerlos vale más
que cualquier tutorial:

```bash
npx hyperframes add product-turntable --json   # objeto 3D real girando, carga .glb/.gltf por URL
npx hyperframes add three-orbiting-cards --json  # escena Three.js más simple, tarjetas orbitando
```

`product-turntable` (`compositions/product-turntable.html` tras instalarlo) es la referencia más
completa:

- Three.js vía ESM desde jsdelivr (`three@<versión fija>/+esm`), con `GLTFLoader` y
  `RoomEnvironment` de los ejemplos oficiales — mismo patrón de CDN fijado a versión que ya usa el
  resto del catálogo.
- Un `<canvas class="clip" data-start data-duration>` es el elemento temporizado real; el WebGL
  solo pinta dentro.
- `model_url` es una variable del propio componente (`data-composition-variables`): si viene vacía
  usa una lata procedural de respaldo, si trae una URL `.glb`/`.gltf` la carga con `GLTFLoader` y
  la encuadra automáticamente (`fitModel`: centra, apoya en el piso, escala al cuadro). **Esto es
  literalmente el gancho para meter un asset de un pack de íconos 3D con licencia**, el día que se
  compre uno — nada que programar de cero, solo apuntar `model_url`.
- Setup de estudio ya resuelto: `PMREMGenerator` sobre una escena de dos tiras emisivas (key a
  -35°, rim a 120°) para el *environment lighting*, más una luz direccional key y otra rim encima,
  sombra de contacto por textura radial (sin shadow maps, sin costo por frame), tone mapping
  ACESFilmic. Es la implementación real de la receta de `3d.md`, no una interpretación.
- Carga pesada (el modelo) se espera con `window.__hf.buildReady["<id>"]`, resuelta cuando
  `GLTFLoader` termina — así el render nunca dispara antes de que el modelo esté listo.

## Qué falta para usarlo de verdad en un clip de VeridisCorp

1. **Decidir la fuente del asset 3D** con Adrián: comprar un pack de íconos clay con licencia
   comercial de video (IconScout/GetIllustrations u otro), encargar un modelo a medida, o modelarlo
   nosotros en Three.js con primitivas simples (esferas/cápsulas) siguiendo la receta de `3d.md` —
   sin asset de terceros, sin costo de licencia, pero con más trabajo de diseño.
2. Si se compra un pack: exportar en `.glb` (formato que `GLTFLoader` ya soporta sin cambios),
   guardarlo en `assets/` del proyecto del clip — nunca referenciarlo por URL externa en el render
   final (regla de `video.render`: sin red en tiempo de render, `docker/video-renderer/`).
3. Probar primero con `product-turntable` tal cual (cambiar solo `model_url`) antes de escribir una
   escena 3D nueva — valida que el modelo encuadra y gira bien antes de invertir en algo custom.

## Probado: funciona en local, falla en producción (sin red)

Construí `video-drafts/veridiscorp-3d-cadena` — una cadena real de esferas tipo collar (estilo
clay, misma receta de luz que arriba) con tres paradas que se encienden en orden (CEO → content →
pdf.generate), mismo contenido real que ya usan los otros drafts. `npx hyperframes render` local
la renderiza perfecto: `check` limpio, el bead chain con sombra de contacto y las luces se ven
igual que en `product-turntable`.

Pero corrida la misma composición dentro del contenedor real de producción
(`veridis-video-renderer:latest`, `--network none`, el que usa `video.render` de verdad) falla:

```
runtime errors: 2
- request_failed | Failed to load npm/three@0.184.0/+esm: net::ERR_INTERNET_DISCONNECTED
- request_failed | Failed to load .../RoomEnvironment.js/+esm: net::ERR_INTERNET_DISCONNECTED
```

Mismo problema que ya se resolvió para GSAP (`docker-entrypoint.sh` copia
`assets/vendor/gsap.min.js` porque el render corre sin red).

**Ya vendorizado y probado (2026-11-04), con aprobación de Adrián.** `docker/video-renderer/`
trae ahora Three.js 0.184.0 (MIT) completo bajo `vendor/three/`, con la misma estructura de
carpetas que el paquete de npm, y el entrypoint lo copia a `assets/vendor/three/` igual que GSAP.
Confirmado con un render real dentro del contenedor de producción (`--network none`): `check` da
`ok: true` y el MP4 sale completo (`video-drafts/veridiscorp-3d-cadena/draft-produccion.mp4` es
ese render real, no uno local).

Dos detalles que no son obvios y rompen el render si se saltan:

1. **`three.module.js` no alcanza solo** — desde la versión que usa el catálogo (0.184.0), el
   build se parte en `build/three.module.js` + `build/three.core.js` (el primero reexporta todo
   del segundo). Vendorizar solo `three.module.js` da `404 loading .../three.core.js` en
   producción. Los dos van juntos, siempre.
2. **Los addons (`GLTFLoader`, `RoomEnvironment`, etc.) importan `'three'` como specifier
   desnudo** (`import {...} from 'three'`), no con una ruta relativa — sin red, el navegador no
   sabe resolver eso solo. Hace falta un **import map** antes del `<script type="module">` que
   los usa:
   ```html
   <script type="importmap">
     { "imports": { "three": "assets/vendor/three/build/three.module.js" } }
   </script>
   <script type="module">
     import * as THREE from "three";
     import { RoomEnvironment } from "assets/vendor/three/examples/jsm/environments/RoomEnvironment.js";
   </script>
   ```
   Con el import map puesto, los imports internos entre addons (p. ej. `GLTFLoader.js` ->
   `../utils/BufferGeometryUtils.js`) resuelven solos porque se conservó la misma forma de
   carpetas que `examples/jsm/` de npm — no reescribir esas rutas relativas.

Esta receta (CDN para iterar en local, local+importmap para el render real) es la misma dualidad
que ya existe para GSAP en el resto de `video-drafts/`: un draft local no necesita tocar nada, el
cambio a rutas locales se hace recién cuando el clip va a pasar por `video.render` de verdad.

Si hace falta otro addon de Three.js que no esté vendorizado (`OrbitControls`, otro loader): se
agrega con el mismo método — bajar el archivo del mismo tag de versión fijado (0.184.0) con la
misma ruta relativa que trae en npm, revisar sus propios `import` por si trae más dependencias
internas, y sumarlo a `docker/video-renderer/vendor/three/` antes de usarlo en un render real.

## Figura holograma: primitivas a mano no alcanzan, un modelo real gratis sí

Primer intento (`video-drafts/veridiscorp-retro-figura`, versión 1): armar la figura a mano con
primitivas de Three.js (esfera + `CapsuleGeometry` para torso/brazos/piernas) y un
`ShaderMaterial` de Fresnel propio. Rindió — pero el resultado real, visto en frames del render,
no se lee como una persona: las proporciones y las uniones entre piezas quedan mal sin un rig de
verdad detrás (Adrián lo describió bien: "parece un cactus"). Las primitivas sirven para un objeto
abstracto (la cadena de esferas de arriba), no para una silueta humana creíble.

**La corrección no fue comprar un pack de pago — fue usar un modelo real y gratis con rig.**
Primer modelo probado, `CesiumMan.glb` de `KhronosGroup/glTF-Sample-Assets` (el repositorio
oficial de modelos de referencia de glTF, CC BY 4.0 © 2017 Cesium, bajable directo por URL cruda
de GitHub) — tiene rig y animación real, pero su cabeza es desproporcionada ("parece un martillo"
visto en el render real). Cambiado por `Soldier.glb`, el modelo de ejemplo que trae el propio
repositorio de three.js (`examples/models/gltf/Soldier.glb`, MIT, originado en Mixamo y
redistribuido ahí para sus propias demos oficiales) — proporciones humanas normales, y trae clips
nombrados (`Idle`, `Walk`, `Run`, `TPose`) en vez de uno solo sin nombre:

```
https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/models/gltf/Soldier.glb
```

Cada modelo usado así queda con su propio `assets/<Modelo>-LICENSE.txt` en el proyecto, con la
fuente exacta y los términos — ver el de `veridiscorp-retro-figura` como plantilla. Como con
CesiumMan, el material y la textura propios del modelo se descartan por completo y se reemplazan
por el wireframe + relleno verde de abajo: solo se usan su geometría y su esqueleto, no su arte.

Técnica para el look wireframe + relleno sobre un modelo con rig real (más robusta que un shader a
mano sobre un `SkinnedMesh`, que necesitaría reimplementar el skinning): dos instancias del mismo
modelo — una con `MeshBasicMaterial({ wireframe: true })`, otra clonada con
`SkeletonUtils.clone()` (import nombrado `clone`, no un objeto `SkeletonUtils.clone` — el error
típico) y un material de relleno translúcido (`opacity` baja, `depthWrite: false`). Cada clon
tiene su propio `THREE.AnimationMixer`; la pose en cada frame sale de `mixer.setTime(t)`, nunca de
`update(delta)` — `setTime` recalcula la pose entera desde `t`, así que buscar hacia atrás o
repetir el mismo tiempo da siempre la misma pose, que es la exigencia de determinismo del render.

Cuándo usar primitivas y cuándo un modelo real: una forma abstracta (nodos, cadenas, objetos
geométricos) se arma a mano sin problema. Una silueta humana reconocible necesita un rig real —
ahí vale la pena buscar un modelo gratis con licencia clara (como este) antes de intentarlo a
mano.

## Encuadrar un modelo con rig (`SkinnedMesh`) sin saber su tamaño de antemano

Un modelo descargado (de Sketchfab u otra fuente) no trae garantía de estar centrado en el
origen, orientado "de pie", ni a una escala conocida. `new THREE.Box3().setFromObject(model)`
mide la geometría en **bind pose** (la pose de reposo del esqueleto, sin animar) e ignora
cualquier deformación de piel — sirve para un objeto rígido, no para saber qué tamaño ocupa un
personaje animado en su clip.

Para un personaje con clip de animación: tras `mixer.setTime(t)` y `model.updateMatrixWorld(true)`,
usar `skinnedMesh.computeBoundingBox()` por malla (no `geometry.boundingBox` directo, que sigue
siendo el bind pose) y unir esas cajas transformadas a mundo. Medir así en varios puntos del clip
(16-17 muestras repartidas) y tomar la de tamaño **mediano** — ni una muestra arbitraria ni la
unión de todas — sobrevive tanto a un clip con pose extrema puntual como a un vértice/hueso suelto
que infla una sola muestra, sin necesitar saber cuál muestra (si alguna) está mal.

**Export con piel rota (visto dos veces: `ghostly_chihuahua.glb` y `fixer_robot.glb`):** la señal
es que `computeBoundingBox()` devuelve el **mismo tamaño exacto en todas las muestras**, sin
importar el punto del clip — la deformación de piel no se está aplicando. Antes de descartar el
modelo (como con el chihuahua), comparar contra el `Box3.setFromObject(model)` sin animar: si esa
caja estática da un tamaño creíble para una figura de pie (como con `fixer_robot.glb`, cuyo bind
pose ya tenía los pies casi en y=0), usarla como respaldo es válido — el clip evidentemente no
aleja mucho la pose real del bind pose. Si la caja estática *también* es rara (como pasaba con el
chihuahua, con una animación de "pulso" de escala real de ~15x), ahí sí no hay atajo de software:
documentar y pasar al siguiente candidato. Detección automática usable: si el rango entre la
muestra más chica y la más grande es menor a ~1% del valor medio, es señal de bounding box
degenerada, no de un personaje real inmóvil.

## Red de nodos procedural con etiquetas de texto (`veridiscorp-red-agentes`)

Para visualizar algo como un organigrama o grafo en 3D (nodos + líneas) sin ningún modelo
externo: geometría simple (`IcosahedronGeometry` como nodo, `LineSegments` con un
`BufferGeometry` de pares de puntos para los enlaces) en el mismo wireframe + relleno verde ya
establecido. Cero riesgo de licencia — es el caso "forma abstracta" documentado arriba.

Para que cada nodo lleve su etiqueta de texto legible (un nombre de puesto, por ejemplo): no se
dibuja el texto en el canvas WebGL, se usa un `<div>` de HTML normal por nodo, posicionado cada
frame con `Vector3.project(camera)` (coordenadas normalizadas → píxeles) dentro del mismo
`host.render(t)`. Sigue siendo determinista (función pura de t vía la posición de cámara), y el
texto sale nítido (fuente del sistema, sin aliasing de un canvas) en vez de geometría 3D de texto.
`projected.z < 1` sirve como chequeo barato de "¿está delante de la cámara?" para ocultar una
etiqueta si su nodo quedara detrás en algún ángulo.

## Pipeline con paquetes viajando por una curva (`veridiscorp-flujo-tareas`)

Para un flujo/pipeline (tareas, datos, pasos de un proceso) en vez de un grafo estático: los nodos
de etapa van sobre una `THREE.CatmullRomCurve3` (curva suave entre puntos de control), y el camino
se dibuja con `THREE.Line` sobre `curve.getPoints(n)`. Los "paquetes" que viajan son esferas
chicas posicionadas cada frame con `curve.getPointAt(u)`, donde `u` es una fracción `[0,1]` que
avanza con `t` (p. ej. `(t / periodo + offset) % 1`) — varios paquetes con distinto `offset`
dan un tren continuo en vez de uno solo.

Cola tipo cometa, barata y determinista: no se acumula nada entre frames (eso rompería el
determinismo de seek), se dibujan 1-2 esferas más tenues un poco atrás en la MISMA curva en el
MISMO frame (`curve.getPointAt(u - 0.012)`, `u - 0.024`, con opacidad decreciente) — sigue siendo
función pura de `t`.

Mismo cuidado de encuadre que en cualquier escena con cámara que se acerca: si el último nodo de
la curva queda cerca del extremo del recorrido de cámara, verificar que no se corte en el borde
(`npm run check` avisa con `canvas_content_at_edge`) en vez de asumir que cabe.

## Ensamblar varias escenas ya probadas en un solo video maestro

Al unir 7 escenas (cada una antes un proyecto HyperFrames independiente y ya verificado por su
cuenta) en un solo `index.html` maestro con `data-composition-src` secuenciales
(`veridiscorp-deteccion/`), aparecieron dos clases de bug reales que **`npm run check` y
`npx hyperframes snapshot` no detectaron, pero sí `npm run render`** — otro caso donde el
contact-sheet/snapshot no basta y hay que verificar con frames reales extraídos del MP4:

1. **Ids de DOM genéricos duplicados entre escenas hermanas.** Las 7 escenas se escribieron cada
   una como su propio proyecto, todas con la misma plantilla (`id="scene-canvas"`, `id="root"`,
   `id="glow-canvas"`, etc.). Al quedar todas aplanadas en el MISMO documento, `getElementById`
   siempre devuelve el PRIMER elemento con ese id en el DOM — las escenas 2 en adelante terminaban
   operando sobre el canvas de la primera escena en vez del suyo propio, y su propio canvas se
   quedaba en el tamaño por defecto del navegador (300×150), vacío. Solución: renombrar los ids
   de cada escena con un sufijo único (`scene-canvas-fr`, `-pw`, `-ey`, `-ra`, `-ft`) — en los
   `id="..."`, en los selectores CSS `#...`, en `getElementById(...)` Y en los selectores de
   cadena que usa GSAP (`tl.fromTo("#caption", ...)` — un cuarto lugar fácil de olvidar si solo se
   busca `id=`/`#`/`getElementById`).

2. **Dos-o-más niveles de anidación rompen las reglas CSS de un sub-componente que se auto-apunta
   (`#su-propio-id { --variable: valor }`).** Un componente mountado directo (`master → comp.html`,
   un nivel) funciona bien con cualquier id. El MISMO componente mountado un nivel más adentro
   (`master → wrapper.html → comp.html`) hace que el compilador reescriba ese selector como
   `[data-composition-id="comp"] [data-hf-authored-id="su-id"]` — un selector DESCENDIENTE que
   nunca puede matchear un elemento consigo mismo (el elemento lleva ambos atributos a la vez). El
   resultado: cualquier custom property declarada ahí (colores, tokens) queda sin definir —
   `yt-lcd-background.html` renderizaba en modo claro con tipografía por defecto en vez del look
   CRT verde, solo en el render real, nunca en `check`/`snapshot` (que sí resuelven el selector
   bien, por lo visto con un pipeline distinto al de render). Ni darle `id="root"` (el caso que
   documenta el propio lint `subcomposition_root_styled_by_class` como soportado) ni reaplicar los
   estilos por JS en cada tick de GSAP lo arregló — el único fix real fue **evitar la anidación de
   dos niveles**: mover el sub-componente para que el maestro lo monte directamente (un nivel),
   igual que todas las demás escenas, en vez de envolverlo en un `intro.html` intermedio.

3. **Un mount de `telemetry-hud` sin `style="--bg: transparent"` ni `:root{--bg:...}` en el
   documento maestro cae al azul por defecto del componente**, no al verde de la serie. En
   proyectos de una sola escena esto pasaba desapercibido porque el propio `index.html` siempre
   declaraba su paleta en `:root`; en el maestro, que no tiene contenido visual propio, hay que
   declarar esa misma paleta a mano (o poner el override por-mount) para que CUALQUIER mount de un
   componente del registro en ese archivo la herede.

Moraleja general: al ensamblar escenas ya probadas, **nunca asumir que lo que funcionaba aislado
sigue funcionando igual una vez compartiendo documento con otras seis** — verificar de nuevo con
frames reales del render completo, no solo con el check/snapshot de cada pieza por separado.

## Para profundizar

- `references/types/3d.md` y `references/runtimes.md` de la skill `hyperframes` (contrato completo:
  determinismo, cámara, luz y materiales, qué revisar antes de dar un render 3D por bueno).
- `npx hyperframes catalog --query "<lo que necesitas, en inglés>" --tag 3d` para ver qué más hay
  ya construido (`three-orbiting-cards`, `vfx-iphone-device` con modelos GLTF reales de iPhone/
  MacBook, `app-showcase`) antes de construir algo desde cero.
