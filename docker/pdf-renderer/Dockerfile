# Imagen propia para renderizar documentos (herramienta pdf.generate, ver docs/assistant-v1-roadmap.md).
# No JS: la composición es por bloques tipados que el motor arma como HTML+CSS, nunca HTML libre
# del modelo, así que WeasyPrint (sin motor JS) es suficiente y mucho más liviano que Chromium.
FROM python:3.12-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpango-1.0-0 libpangocairo-1.0-0 libgdk-pixbuf-2.0-0 libcairo2 \
    fonts-dejavu-core shared-mime-info \
 && rm -rf /var/lib/apt/lists/*

# pydyf fijado explícito: weasyprint no acota su propia dependencia de pydyf con suficiente
# cuidado (Kozea/WeasyPrint#2200) y una versión de pydyf demasiado nueva para esta versión de
# weasyprint rompe en tiempo de ejecución (AttributeError en pdf/stream.py), no al instalar.
RUN pip install --no-cache-dir weasyprint==70.0 pydyf==0.13.0

COPY render.py /usr/local/bin/render.py
RUN chmod +x /usr/local/bin/render.py

WORKDIR /workspace
# El contenedor corre con --read-only salvo /workspace (tmpfs); fontconfig necesita un caché
# escribible para listar fuentes, así que lo apuntamos ahí en vez de la ruta por defecto.
ENV XDG_CACHE_HOME=/workspace/.cache
ENTRYPOINT ["python3", "/usr/local/bin/render.py"]
