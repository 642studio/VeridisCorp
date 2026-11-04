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

## Para profundizar

- `references/types/3d.md` y `references/runtimes.md` de la skill `hyperframes` (contrato completo:
  determinismo, cámara, luz y materiales, qué revisar antes de dar un render 3D por bueno).
- `npx hyperframes catalog --query "<lo que necesitas, en inglés>" --tag 3d` para ver qué más hay
  ya construido (`three-orbiting-cards`, `vfx-iphone-device` con modelos GLTF reales de iPhone/
  MacBook, `app-showcase`) antes de construir algo desde cero.
