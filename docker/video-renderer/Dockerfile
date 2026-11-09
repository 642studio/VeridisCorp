# Imagen propia para renderizar video (herramienta video.render; ver
# agents/video-production/knowledge/). A diferencia de docker/pdf-renderer, aquí el modelo SÍ
# escribe HTML/CSS/JS libre — es el contrato de HyperFrames, no un descuido — así que el
# aislamiento es el de code.sandbox (sin red, memoria y cpu acotadas, contenedor desechable por
# llamada), no el de pdf.generate. No se usa --read-only: Chrome necesita escribir su propio
# perfil y caché de proceso; la contención real es --network none + recursos acotados + que el
# directorio del proyecto se borra después de cada render.
FROM node:22-bookworm

# Dependencias de sistema que cualquier Chromium headless necesita en Debian (lista estándar de
# Puppeteer), más FFmpeg para codificar, más chromium del propio Debian: el binario que hyperframes
# intenta bajar (Chrome Headless Shell) no tiene build para Linux ARM64, así que se usa el de
# Debian (funciona en cualquier arquitectura) y se apunta HYPERFRAMES_BROWSER_PATH a él, en vez de
# depender de la descarga propia de hyperframes.
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg chromium ca-certificates \
    libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 \
    libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libasound2 \
    libpango-1.0-0 libcairo2 libglib2.0-0 fonts-liberation \
 && rm -rf /var/lib/apt/lists/*
ENV HYPERFRAMES_BROWSER_PATH=/usr/bin/chromium

# Fijada a la versión probada el 2026-11-04 (0.9.9), no @latest: un render determinista no puede
# depender de qué versión bajó npx esa semana.
RUN npm install -g hyperframes@0.9.9

# Caché de fuentes de hyperframes: fuera de /workspace (ahí monta cada proyecto) y escribible en
# runtime por si hiciera falta, precalentado aquí mismo con red disponible en tiempo de build
# porque en tiempo de render no hay red (regla 4 del contrato: el render nunca llama a una API
# externa).
ENV HOME=/opt/hyperframes-home
RUN mkdir -p "$HOME" \
 && hyperframes doctor --json || true \
 && chmod -R 0777 "$HOME"

# GSAP 3.15.0 (build "standard-license" sin modificar, https://gsap.com/standard-license), vendorizado
# para que el contrato pueda cargarlo sin red en tiempo de render — ver docker-entrypoint.sh.
COPY vendor/gsap.min.js /opt/vendor/gsap.min.js

# Three.js 0.184.0 (MIT, sin modificar) para escenas 3D (`agents/video-production/knowledge/
# hyperframes-elementos-3d.md`): mismo problema que GSAP, el contrato de Three.js carga sus módulos
# desde un CDN y aquí no hay red en tiempo de render. Vendorizado el build principal
# (build/three.module.js) más los dos addons ya usados en el catálogo (GLTFLoader, RoomEnvironment)
# y sus propias dependencias internas (BufferGeometryUtils, SkeletonUtils), con la misma
# estructura de carpetas que el paquete de npm — los imports relativos entre addons (p. ej.
# GLTFLoader -> ../utils/BufferGeometryUtils.js) solo resuelven si esa forma se conserva. Un
# addon nuevo que haga falta se agrega igual: mismo árbol `examples/jsm/...` que npm.
COPY vendor/three /opt/vendor/three

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

WORKDIR /workspace
ENTRYPOINT ["docker-entrypoint.sh"]
