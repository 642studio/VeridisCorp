# Incidente de seguridad: Build Command malicioso en Vercel (642studio)

Severidad: alta (compromiso de credencial) · Exposición de datos confirmada: ninguna hasta ahora · Estado: contenido (tokens revocados), con acciones pendientes.

## Contexto
El 8 de noviembre de 2026 se detectó que el *Build Command* de un proyecto Vercel de la cuenta `642studio` fue cambiado para **volcar todas las variables de entorno** del build:

```
echo @@PVT-BEGIN@@; env -0 | base64; echo @@PVT-END@@; false
```

`env -0 | base64` serializa todo el entorno y lo imprime al log; `false` falla el build a propósito para que quede visible en el log de error. Es un patrón de **exfiltración de variables de entorno**.

## Línea de tiempo (audit log de Vercel, UTC)
- **11:34:02** — cambian Build Command de `Default` al comando de volcado (proyecto `signage`).
- **11:34:16** — lo restauran a `Default` (14 s después).
- **13:29:09** — vuelven a poner el comando de volcado.
- **13:29:10** — crean un **Deploy Hook**; ~7 s después se crea el deployment afectado.
- También cambian la versión de **Node.js** y añaden **`NODE_OPTIONS`**.
- Todas las operaciones comparten el **mismo identificador de token**, bajo la cuenta `642studio`.
- Notificación: llega un correo de build fallido con el volcado en base64 (deployment de `signage-flax.vercel.app`, `dpl_4c6c9Pk471Q7nFdsFDCBbNnUhHSA`).

## Análisis — lo confirmado
- El comando se introdujo mediante un **cambio de configuración vía API/token de Vercel**, no por un commit de GitHub. El audit log lo atribuye a un token de la cuenta `642studio`.
- El volcado capturado (de `signage`) contenía **solo variables internas de Vercel/Next — cero secretos** (`signage` es un proyecto abandonado sin env propio).
- El código de **642 Core está limpio**: el comando **no** está en el repo (`vercel.json`, `package.json`, scripts). Vivía como **override de Build Command en el dashboard**, no en git.
- La consola de build de `642-core-main` revisada por el usuario **no** mostró el marcador `@@PVT-BEGIN@@` → sin evidencia (hasta ahora) de que el entorno de 642 Core se haya volcado.
- La secuencia (poner → auto-revertir 14 s → re-poner 2 h después → Deploy Hook → deploy) es **adversarial y automatizada**: sortea una reversión y monta persistencia.

## Qué NO fue (descartado)
- **No fue el commit `992cd67`**: es una feature normal ("dashboard personal y notificaciones reales"), no tocó build commands.
- **No fue el asistente de esta sesión (Claude Code)**: su actividad fue únicamente peticiones HTTP GET de lectura a URLs públicas de `642studio.com` y SSH a `kali-audit` para recon. No posee ni usó token de Vercel, ni hizo llamadas a la API de Vercel. Cambiar Build Command / crear Deploy Hook / `NODE_OPTIONS` requiere token, inexistente de su lado.
- Que el audit log muestre la cuenta `642studio` **no** implica acción manual del titular: un token suyo fue usado por un tercero o automatización.

## Impacto / blast radius
- **Confirmado filtrado:** nada (el único volcado observado, `signage`, no tenía secretos).
- **Riesgo real:** el actor posee un **token funcional** con acceso a la cuenta y creó un **Deploy Hook** (persistencia). Podría apuntar a proyectos con secretos reales, en especial **`642-core-main`**, que maneja: Supabase (service role), Google service account, GoHighLevel, Meta, ClickUp, Gemini, `APP_ENCRYPTION_KEY`, `VERIDISCORP_API_TOKEN`, `CRON_SECRET`, entre otros.

## Respuesta — contención (hecho)
- **8-nov-2026:** el usuario **revocó todos los tokens de Vercel** de la cuenta.

## Pendiente (recomendado)
1. **Borrar el Deploy Hook** creado el 13:29:10 en `signage` (backdoor de persistencia).
2. En `signage`: revertir Build Command / `NODE_OPTIONS` / versión de Node a default y **borrar el proyecto** (abandonado).
3. **Barrer el audit log** por ese identificador de token en TODOS los proyectos; si tocó `642-core-main` (build, `NODE_OPTIONS`, env o deploy hook) → **rotar los secretos de 642 Core**.
4. **Endurecer la cuenta:** 2FA, revisar miembros del team e integraciones/apps de GitHub, quitar lo no reconocido; reexpedir solo los tokens necesarios.
5. **Causa raíz:** localizar de dónde salió el `VERCEL_TOKEN` — Vercel CLI logueada (Mac / Linux de oficina), GitHub Actions (`VERCEL_TOKEN`), **n8n** (`:5678`), Make, o un script/agente con acceso.
6. **Higiene aparte:** mover `NEXT_PUBLIC_GEMINI_API_KEY` a server-side (hoy se envía al navegador), y limpiar proyectos Vercel abandonados (`signage`, `marreros`, `menu-booye`, `veridis` en 502).

## Causa raíz — hipótesis (no confirmada)
Una automatización/script/agente con un token de Vercel de la cuenta hizo los cambios; alternativa: token comprometido/filtrado. El patrón rápido y repetido favorece automatización, pero no identifica la herramienta ni al operador. No distinguible aún con la evidencia disponible.

## Datos (sin secretos)
- Proyecto afectado observado: `signage` (`signage-flax.vercel.app`), deployment `dpl_[redactado]`.
- Enlace del correo: `vercel.com/<team>/642-core-main/<deployment-hash-redactado>` (abría vacío).
- Identificador del token malicioso: registrado en el audit log de Vercel (no incluido aquí).
- Commit no relacionado: `992cd67` (feature de 642 Core, 2026-11-06).
- **No se registran** aquí tokens, llaves ni contraseñas.

## Lecciones / endurecimiento
- Nunca dejar `env | base64` como Build Command persistente: los logs de build persisten y son visibles al team.
- Tokens de Vercel con **mínimo alcance y expiración**; inventariar dónde viven (CLI, CI, automatizaciones).
- Activar **2FA/SSO** y alertas del audit log de Vercel.
- Reducir superficie: borrar proyectos abandonados; un Deploy Hook es una URL de disparo sin login — tratar como secreto.

[[infraestructura_veridis]] [[642-core]] [[vercel]] [[seguridad]] [[tokens]]
#veridis #seguridad #incidente #vercel #642core #tokens #postmortem
2026-11-09
