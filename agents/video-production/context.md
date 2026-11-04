# Contexto inicial de Producción audiovisual

## Datos confirmados

- Ecosistema: VeridisCorp, de 642 Studio.
- Dirección humana: Adrián Yépiz.
- Departamento: Marketing y comunicación.
- Misión del área: Coordinar estrategia de marca, comunidad y contenido.
- Reporta a: cm.
- Etapa del proyecto: Arranque. Puesto nuevo (2026-11-03): `docs/company-organization.md` ya anticipaba
  "producción audiovisual" como área a incorporar cuando hubiera un encargo que la justificara; este
  puesto se crea para ese primer encargo.
- Prueba real (2026-11-04): se construyó y renderizó a mano, fuera del motor, un video de 22.5s sobre
  VeridisCorp con datos reales, voz real (proxy de ElevenLabs) y look real (`web/src/styles.css`).
  Confirmó que el contrato documentado en `knowledge/` es exacto.
- Herramienta real (2026-11-04): `video.render` quedó implementada en `src/office/tools.ts` (tool
  `render_video`), corre dentro de `docker/video-renderer/` (Docker propio, sin red en tiempo de
  render), y `video-production` ya la tiene en `allowedTools`. Se probó llamando el código real (no
  una simulación) con el proyecto de la prueba anterior y produjo el mismo MP4; también se probó que
  falla con el detalle correcto ante una composición con errores reales. Corrió en la Mac de esta
  sesión — construir la misma imagen en el servidor de oficina sigue pendiente (ver
  `knowledge/hyperframes-conexiones.md`).
- Decisión (2026-11-04): no se crea un segundo puesto especializado para esto. La parte de
  infraestructura (mantener la imagen Docker en el servidor de oficina, o conectar el MCP alojado de
  HeyGen si algún día se decide) es trabajo de `infrastructure-lead`/`devops`, ya cubierto por sus
  capacidades existentes — no un puesto nuevo de contenido. `video-production` concentra la parte
  creativa/de especificación y ahora también dispara el render ella misma.

## Información por completar

Las políticas, objetivos, procedimientos y datos particulares de este puesto todavía están por definir
con Adrián. Este archivo es una base de trabajo; no acredita acceso a sistemas ni resultados operativos
reales. En particular falta decidir: construir `docker/video-renderer/` en el servidor de oficina (hoy
solo existe en esta Mac); si alguna vez se abre cuenta de HeyGen, para qué (catálogo gratis, créditos
de generación, avatar — la ruta MCP alojada sigue documentada en `knowledge/hyperframes-conexiones.md`
como alternativa, no conectada); y si el render debe pasar por aprobación humana antes de considerarse
entregado (hoy la herramienta produce el archivo, pero `ArtifactVersion` para video sigue sin existir).

## Referencias

Los documentos de knowledge/ solo se incorporan al contexto cuando se declaran en la lista knowledge de
config.json.
