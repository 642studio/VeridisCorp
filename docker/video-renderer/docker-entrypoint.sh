#!/bin/sh
# El contrato de HyperFrames pide GSAP desde un CDN (ver referencia oficial de format.md), pero
# este contenedor renderiza con --network none (regla 4 del contrato: el render nunca llama a una
# API externa) — así que cada proyecto necesita su propia copia local. Se asegura aquí, en el
# entrypoint, para que ningún proyecto dependa de acordarse de copiarla.
set -e
mkdir -p /workspace/assets/vendor
if [ ! -f /workspace/assets/vendor/gsap.min.js ]; then
  cp /opt/vendor/gsap.min.js /workspace/assets/vendor/gsap.min.js
fi
# Three.js: mismo motivo que GSAP arriba, pero es un árbol de carpetas (build/ + examples/jsm/...),
# no un solo archivo — se copia entero si falta, nunca se pisa si el proyecto ya trajo el suyo.
if [ ! -d /workspace/assets/vendor/three ]; then
  cp -r /opt/vendor/three /workspace/assets/vendor/three
fi
exec hyperframes "$@"
