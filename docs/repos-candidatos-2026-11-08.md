# Repos candidatos revisados (2026-11-08)

36 repos que propuso Adrián, revisados en solo lectura (no se ejecutó nada de ellos). Veredictos: INCLUIR,
PROBAR, SOLO IDEAS o DESCARTAR. Licencias: MIT/Apache/BSD se pueden adaptar con atribución; CC BY con crédito;
AGPL solo se usa como servicio sin modificar (llamado por HTTP), nunca copiando su código o texto; GPL igual
como servicio interno.

## Estado de lo decidido (actualizado 2026-11-08)

Adrián eligió hacer ahora: knowledge nuevo, Postiz, QC automático de video y mejoras del motor; y
después: subtítulos locales, puesto de ventas/prospección, puesto legal/cumplimiento y laboratorio
de visión.

| Paquete | Estado | Dónde |
|---|---|---|
| Knowledge nuevo | **Hecho**: 16 documentos en 14 puestos (commit `833ce37`) | `docs/skills-libraries.md` (ronda 2026-11-08), `docs/third-party-notices.md` |
| QC automático de video | **Hecho**, probado con FFmpeg local; falta probar dentro de la imagen Docker | `src/office/video-qc.ts`, `docs/office-architecture.md` |
| Postiz | **En arranque**: corre en el servidor; herramienta de borradores lista; faltan cuenta, llave, URL pública y apps por red | `deploy/postiz/README.md`, `docs/social-publishing-roadmap.md` |
| Mejoras del motor (sección 2) | **Pendiente**, sin empezar | esta página |
| Subtítulos locales (VoiceStudio) | Después | sección 3 |
| Puesto de ventas / prospección | Después | huecos |
| Puesto legal / cumplimiento LFPDPPP | Después | huecos |
| Laboratorio de visión (clearcam) | Después | sección 3 |

Puestos del mapa de knowledge que aún no tienen su documento: cfo, data-analyst, pm,
research-review, cm, campaigns, automation. Tampoco se usaron `master_audio.py` de cinecode
(se resolvió con `normalizeAudio` propio) ni el detector de impeccable.

### Huecos de código encontrados al escribir el knowledge (pendientes)

- `sheets.create` usa `valueInputOption: RAW`: las fórmulas quedan como texto. Con
  `USER_ENTERED` se calcularían.
- `finance-budget` no tiene `sheets.create` y `cmo` no tiene `slides.create`.
- El puente de Telegram solo lee texto, no notas de voz.
- El motor no tiene doble revisión independiente; el documento de `marketing-review` la
  describe como proceso manual hasta que exista.
- `market-research` no tiene `core.write`, 642CORE no tiene tabla de prospectos y no hay
  herramienta de DENUE.

## Resumen por veredicto

| Veredicto | Repos |
|---|---|
| INCLUIR | impeccable, ux-ui-agent-skills, unslop, anthropics/skills (selectivo), superpowers (2 skills), ECC (≈4 skills), awesome-llm-apps (5 piezas), cinecode (2 scripts de QC), postiz-app |
| PROBAR | logo-design-skill, bang-motion, VoiceStudio, earshot, clearcam (laboratorio, caras apagadas) |
| SOLO IDEAS | google-maps-scraping-apis, BillionMail, app-privacy-policy-generator, cindy, hypit, Claude-Code-Game-Studios, career-ops, mobilerun, reelmimic, OpenMontage, pentagi, neuromapa, train-llm-from-scratch |
| DESCARTAR | lead-gen-api-stack, FreeDomain, viralwave-studio-guide, ui-skill, karpathy-skill, Agent-Reach, deepface, Kronos |

## 1. Knowledge nuevo para puestos (bajo riesgo)

| Para | Qué | Fuente (licencia) |
|---|---|---|
| frontend | Diseño de interfaz con criterio y señales de UI hecha por IA (craft floor, layout, tipografía, color, estados límite, microcopy) | impeccable (Apache-2.0, conservar NOTICE), unslop (CC BY 4.0), anthropics `frontend-design` (Apache-2.0) |
| frontend, software-qa | Accesibilidad WCAG 2.2, patrones ARIA y estados de componentes | ux-ui-agent-skills `accessibility/*`, `components/*` (MIT) |
| software-qa, review | Crítica y auditoría de UI con puntaje P0–P3 | impeccable `critique`, `audit` |
| knowledge-curator | Probar que un documento de knowledge cambia el comportamiento (escenario sin y con el doc) | superpowers `writing-skills` (MIT), anthropics `skill-creator` |
| development | Recibir una revisión de código (verificar antes de aplicar, cuándo rebatir) | superpowers `receiving-code-review` |
| backend, automation | Diseñar herramientas MCP (nombres, paginación, formato, evaluaciones) | anthropics `mcp-builder` |
| cfo, finance-budget, data-analyst | Hojas de cálculo financieras: fórmulas, cero errores, supuestos documentados | anthropics `xlsx` (Apache-2.0 desde 2026-11-06) |
| cmo, pm | Diseño y control de calidad de presentaciones | anthropics `pptx` |
| review, research-review, human-task-coordinator | 2–3 preguntas de verificación al entregar propuestas | anthropics `discernment-nudge` |
| content, cm | Lectura previa con dos lectores simulados antes de publicar | awesome-llm-apps `first-reader` (Apache-2.0) |
| human-task-coordinator (Telegram) | Resumen auditado de notas de voz con supuestos separados | awesome-llm-apps `thinking-out-loud` |
| creative-strategy, marketing-review | Proceso de logotipo e identidad (brief, tipos de marca, pruebas a 16 px, crítica) + búsqueda en IMPI | logo-design-skill `references/*` (MIT; NO sus 1,432 logos) |
| video-production | Anti-"presentación" y menú de técnicas de motion | bang-motion `anti-ppt.md`, `techniques.md` (MIT, traducir del indonesio) |
| video-production | Análisis de referencia (planos, duración media, BPM) y zonas seguras por plataforma, −14 LUFS | ideas de reelmimic (MIT) y OpenMontage (AGPL: redactar desde cero) |
| market-research, campaigns | Prospección local responsable: DENUE del INEGI o Google Places oficial, criterios (sin web, reputación < 4.0 con 20+ reseñas, sin reseñas recientes), contacto uno a uno con aprobación, REPEP | idea de google-maps-scraping-apis (no su fuente de datos) |

## 2. Mejoras del motor (ideas a implementar con código propio)

- **Doble revisión independiente** para lo público (publicaciones, entregas a clientes): dos revisores con la
  misma rúbrica, ambos deben aprobar (ECC `santa-method`).
- **Libro de aprobaciones con hash del borrador**, decisión ligada a la versión y recibo de envío: nada se publica
  o envía dos veces (ECC `operator-approval-loop`).
- **Evaluación dorada antes de cambiar de modelo**: conjunto etiquetado por un modelo fuerte, reproducible sin
  costo; un modelo barato solo pasa si su acuerdo supera un umbral (career-ops `eval-golden`). Encargos sin estado
  con veredicto PASS/FIX/ESCALATE (awesome-llm-apps `advisor-orchestrator-worker`).
- **"Médico" de la memoria**: hechos con vencimiento, duplicados, contradicciones con commits posteriores,
  refuerzo y olvido por uso (neuromapa, solo ideas).
- **RAG correctivo**: calificar la relevancia de lo recuperado, reescribir la consulta y recurrir a la web
  (awesome-llm-apps `corrective_rag`, mismo stack LangGraph).
- **Compuertas de revisión con id y pruebas de comportamiento de los perfiles** (Claude-Code-Game-Studios).

## 3. Servicios y herramientas

| Qué | Para | Notas |
|---|---|---|
| **Postiz** (AGPL, autoalojado) | Programar publicaciones; TikTok, YouTube, LinkedIn, carrusel de IG, Threads, Google Business… | API REST `/public/v1` con `draft/schedule/now`, MCP y nodo n8n. Herramienta nueva `social.schedule_post` que crea `draft` y la aprobación humana lo pasa a `schedule`. 9 contenedores (~3–4 GB). Llamar por HTTP, nunca importar `@postiz/node`. Cada red sigue necesitando su app aprobada. No resuelve Reels de Facebook. |
| **QC automático de video** | video-production | Adaptar `qc.py` (arranque con movimiento, congelados, negros, silencios, cortes, repeticiones, destellos) y `master_audio.py` (−14 LUFS) de cinecode (MIT). Hace verificable la regla de ritmo dopamínico. No instalar la skill (mete hooks). |
| **earshot** (MIT) | video-production | MCP en contenedor: ¿el sonido cae en los cortes?, crítica de mezcla, LUFS, 252 efectos generados sin licencias. Torch, ~1.1 GB. |
| **VoiceStudio** (AGPL) | content, video-production | Transcripción con marcas por palabra (subtítulos), doblaje, voz local de respaldo. Consentimiento escrito para clonar voces. Lento en CPU. |
| **Detector de impeccable** | software-qa | `npx impeccable detect` solo dentro del sandbox; nunca su instalador ni el modo `live`. |
| **clearcam** (GPL) | VERIDIS visión | Solo laboratorio, cámara propia, caras apagadas, detrás de login. |

## 4. Fuera por ahora y por qué

- **Agent-Reach**: raspa redes con tu sesión y navegador anti-detección; arriesga las cuentas de Meta de 642.
- **deepface**: biometría (dato sensible en la LFPDPPP), inferencia de raza y pesos con licencia no comercial.
- **pentagi**: herramienta ofensiva autónoma; solo en una VM aislada con alcance escrito, nunca en el servidor.
- **BillionMail**: servidor de correo completo; solo cuando haya una lista con opt-in, nunca para correo en frío.
- **mobilerun**: solo para QA de una app propia en emulador; telemetría activada por defecto.
- **Kronos, lead-gen-api-stack, FreeDomain, viralwave, ui-skill, karpathy-skill**: no aportan o son publicidad.

## Huecos que quedaron a la vista

- No hay puesto de **ventas / prospección** ni de **legal / cumplimiento LFPDPPP**.
- `frontend` no tenía criterio de diseño ni de accesibilidad (cubierto por el punto 1).
