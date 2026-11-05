# Plan: 5 videos para perfeccionar la técnica

Cada video estresa UNA dimensión técnica distinta (gancho, paleta, formato, duración). Todos
usan hechos reales de VeridisCorp — no hay marca/tema alterno con material real disponible
(`ficha-de-marca.md` está vacía; El Mismo Sazón/OWTS/GLOW/La Morralla solo se mencionan por
nombre, sin brief). Regla de ritmo base (memoria permanente, 2026-11-04): voz arranca en ≤2s,
cortes cada 2.5-4.5s salvo que el dispositivo narrativo pida otra cosa a propósito (video 1).
Después de cada video: retro corta + actualizar memoria (qué se rompió, qué se aprendió).

---

## Video 1 — "El motor, no un disfraz"

**Qué prueba:** un gancho de cámara continua (zoom/push sin cortes duros) en vez de match-cuts
— ¿se puede evitar el silencio/estancamiento con movimiento continuo en vez de cortes
frecuentes?

**Hechos reales** (`docs/office-architecture.md`, `docs/model-routing.md`):
- Coordinación real con LangGraph, checkpoints reales en Postgres (`PostgresSaver`).
- Ciclo de vida real de una tarea: `pending → running → in_review → completed` (con ramas
  `blocked`/`failed`).
- El coordinador decide entre `command / dispatch / review / ask_user / delegate`.
- `review()` nunca le cree al reporte del especialista: vuelve a correr las herramientas de
  solo lectura por su cuenta, y le quita las herramientas de efecto real antes de revisar.
- 17 herramientas reales con efecto secundario documentadas.
- `ModelRouter` enruta entre 4+ proveedores reales (OpenAI, Anthropic, DeepSeek, Google) más
  Ollama local — nunca una sola API envuelta.

**Forma:** una sola cámara empujando hacia adentro, capa por capa (nunca "el object/char
hace el trabajo" como en los anteriores). Vertical, verde CRT (misma identidad probada).

**Guion** (~44s, 6 capas de ~6s cada una, movimiento continuo dentro de cada capa):
1. 0-2s: un prompt cualquiera en pantalla, la cámara ya cayendo dentro — voz desde 0.8s:
   "Esto no es un prompt a otra IA."
2. 2-8s: nodos de LangGraph + sello Postgres — "Es un motor propio, coordinando con LangGraph,
   con memoria real en Postgres."
3. 8-14s: cuatro proveedores reales (OpenAI/Anthropic/DeepSeek/Google) con una regla eligiendo
   uno — "Elige entre cuatro proveedores reales, según la regla. Nunca al azar."
4. 14-20s: capa de revisión, quitando herramientas de efecto real antes de revisar — "Antes de
   cerrar, vuelve a revisar todo por su cuenta. Nunca le cree al reporte."
5. 20-26s: los 4 estados reales encendiéndose en secuencia — "Pendiente. Corriendo. Revisión.
   Completado. Un estado real, no una animación."
6. 26-32s: pull-back revelando todo el stack — "Diecisiete herramientas con efecto real. Nada
   es un disfraz."
7. 32-38s claim: "Un motor propio. No una envoltura." / 38-44s endcard.

---

## Video 2 — "El elenco"

**Qué prueba:** identidad visual distinta (paleta teal/azul de `organigrama`, no verde CRT) —
¿el ritmo de 2.5-4.5s por corte se sostiene fuera del look ya probado?

**Hechos reales:** 56 perfiles de agente en el organigrama (`company-organization.md`), 20 con
herramienta real. Las mascotas (robot/pcwoman/ojo/chihuahua/xbot, ya construidas) se muestran
como roster visual, sin inventar una especialidad falsa por personaje.

**Paleta:** `--bg:#0b0f14 --fg:#e7eef0 --brand:#35e0c0 --accent:#61a8ff` (la misma que ya usa
`veridiscorp-organigrama`, no una nueva inventada).

**Guion** (~30s, 9 cortes de ~3.3s):
1. Hook: el robot gira hacia cámara (toma ya existente). Sin voz, SFX.
2. 5 cortes rápidos, uno por mascota, cada una con un verbo genérico ("detecta", "vigila",
   "conecta", "avanza", "aprueba" — ya establecidos, sin inventar nuevos).
3. Stat: "56 perfiles. Veinte, con herramienta real."
4. Claim: "Un equipo, no una demo."
5. Endcard.

---

## Video 3 — "Así elige el modelo correcto"

**Qué prueba:** formato presentador/avatar (HeyGen) — nunca probado, todo lo anterior fue
motion graphics puro. **Necesita luz verde antes de generar** (consume créditos de avatar).

**Hechos reales** (`docs/model-routing.md`):
- Tabla real de ruteo: routine→`deepseek-flash`, analysis→`deepseek-v4-pro`,
  review→`gpt-5.4-mini-2026-03-17`, complex→`gpt-5.4-2026-03-05`.
- Orden real de prioridad: regla exacta agente+etapa+capacidad → etapa+capacidad → perfil del
  agente → perfil de etapa → perfil general de oficina.
- Ejemplo numérico real de una corrida: 338 tokens entrada / 26 salida en DeepSeek, 277/57 en
  OpenAI.
- Claude entró al roster el 2026-11-03: `claude-opus-5-5` para el CEO, `claude-haiku-5-5` para
  revisión general, con API keys separadas para no compartir cuota.

**Guion** (~40s, avatar hablando a cámara + overlays de la tabla real):
1. Hook (avatar, 0-3s): "¿Cómo elige VeridisCorp qué IA usa para cada tarea? Nunca al azar."
2. 3-12s: overlay de la tabla real (4 filas) mientras el avatar explica cada perfil.
3. 12-20s: el orden de prioridad real, como un diagrama de 5 pasos.
4. 20-28s: el ejemplo numérico real (338/26 vs 277/57 tokens) como prueba.
5. 28-35s: Claude entrando al roster el 2026-11-03, con keys separadas.
6. 35-40s: claim + endcard.

---

## Video 4 — La oficina real (infraestructura)

**Qué prueba:** formato más largo (60-90s, por capítulos) — ¿la densidad de 2.5-4.5s por corte
aguanta a mayor escala sin volverse pesado?

**Hechos reales** (memoria 2026-11-04): imagen Docker portable ARM64/x86_64 sin cambios;
render de 6s tardó 27-29s en el servidor de oficina (SEIS, Linux x86_64); verificado con
`ffprobe` dentro del contenedor; `veridiscorp.service` corre bajo `systemd`,
`Restart=on-failure`, puerto `127.0.0.1:7777`; `veridis_runtime_v1.media_library` migrada sin
afectar datos existentes.

**Guion** (~75s, ~18-20 cortes en 3 capítulos cortos): Cap. 1 "Se mudó" (Mac → Linux real) ·
Cap. 2 "No se cae" (systemd, restart automático) · Cap. 3 "Se puede probar" (ffprobe real, no
confianza ciega) · claim + endcard.

---

## Video 5 — "¿Y si tu empresa corriera así?"

**Qué prueba:** gancho de pregunta con input real tecleado en pantalla — device nunca probado
aquí, muy usado en contenido que sí funciona en redes.

**Hechos reales:** reusa el ciclo de vida real ya verificado (detección → red de agentes →
flujo → aprobación humana) de los videos anteriores, sin inventar nada nuevo.

**Guion** (~35s): 0-4s pregunta + cursor tecleando una tarea real; 4-26s el mismo flujo ya
probado, resumido en 4 cortes rápidos; 26-31s claim; 31-35s endcard.

---

## Orden sugerido

1 → 2 → 4 → 5 → 3 (dejo el de avatar al final porque es el único que necesita luz verde para
gastar créditos; los otros 4 no tienen fricción adicional).
