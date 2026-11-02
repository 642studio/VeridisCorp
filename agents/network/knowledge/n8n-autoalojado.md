> Adaptado de n8n-skills (czlonkowski, MIT): n8n-self-hosting.

# n8n autoalojado con Docker Compose

## Antes de empezar
Busca en la memoria corporativa: versión actual de n8n, modo (simple o cola), base de datos que usa, ruta del proyecto en el servidor, dominio, proxy, zona horaria y dónde está respaldada la clave de cifrado (solo el lugar, nunca el valor). Lo que falte, márcalo FALTANTE. Tú propones configuración, revisiones y pasos; instalar, actualizar o reiniciar lo hace un humano. La documentación oficial manda sobre este resumen: si difieren, dilo.

## Elegir el modo
| | Simple | Cola |
|---|---|---|
| Procesos | un n8n | principal + trabajadores |
| Servicios extra | ninguno (SQLite) o PostgreSQL | Redis + PostgreSQL obligatorio |
| Conviene para | pocos usuarios, carga ligera o moderada | mucho volumen, ejecuciones largas, paralelo |
Si hay duda, simple. Pasar a cola después implica cambiar el Compose y migrar de SQLite a PostgreSQL; si ya se espera volumen real, empieza en cola. Cola nunca sobre SQLite. Revisa que el servidor tenga memoria suficiente para cada trabajador antes de proponerla.

## Secretos (no negociable)
- Secretos solo en `.env` con permisos 600, referenciados como `${VAR}`; nunca en `docker-compose.yml`, en el Caddyfile ni en git.
- Generar secretos nuevos en el propio servidor; nunca reutilizar los de otra instancia.
- `N8N_ENCRYPTION_KEY` cifra todas las credenciales guardadas. Se fija antes del primer arranque, se respalda fuera del servidor y nunca se cambia editando `.env`: cambiarla o perderla deja todas las credenciales inservibles. En modo cola debe ser idéntica en el principal y en todos los trabajadores.
- Un respaldo de base sin la clave correspondiente no sirve.

## Exposición
Solo el proxy (80/443) es público. n8n (5678), PostgreSQL (5432) y Redis (6379) se quedan en la red privada de Docker, sin mapear puertos al host. Si hoy están redirigidos en el router, es hallazgo alto: propón cerrarlos y escala a ciberseguridad.

## Ajustes de endurecimiento a revisar
- `N8N_PROTOCOL=https`, `N8N_SECURE_COOKIE=true`, `N8N_PROXY_HOPS=1`.
- `WEBHOOK_URL` y `N8N_EDITOR_BASE_URL` con la URL pública HTTPS; si no, los webhooks y los retornos OAuth salen como `localhost`.
- `GENERIC_TIMEZONE` con la zona correcta (Sonora: `America/Hermosillo`; verificar).
- `N8N_BLOCK_ENV_ACCESS_IN_NODE=true`, telemetría apagada, `N8N_PUBLIC_API_DISABLED=true` si no se usa la API.
- Depuración de ejecuciones (`EXECUTIONS_DATA_PRUNE` y edad máxima): limita el crecimiento de la base y el tiempo que se guardan datos personales.
- Modo de datos binarios explícito: `filesystem` en simple, `database` en cola.
- Execute Command bloqueado (por defecto); protección SSRF si varias personas editan flujos.
- Nodos Code en Python o varios editores: ejecutores de tareas en modo externo, con la misma versión que n8n.
- Cuenta propietaria creada de inmediato al exponer la instancia (quien llene el formulario primero se queda con ella) y 2FA activado.
- SMTP configurado si hay varios usuarios, para invitaciones y recuperación de contraseña.

## Verificación tras instalar o cambiar
1. `docker compose ps`: todos arriba y sanos.
2. Salud interna: `/healthz` responde ok; `/healthz/readiness` confirma base conectada.
3. Certificado emitido (logs del proxy) y `https://dominio/healthz` responde desde fuera.
4. Modo cola: comparar variables del principal y un trabajador; solo deben diferir las de URL pública.
No se declara terminado sin esta evidencia.

## Operación diaria
- **Cambiar una variable:** copia del Compose, `docker compose config -q`, y recrear solo ese servicio (`up -d --no-deps n8n`). Sin descargar imágenes en el mismo paso.
- **Actualizar:** versión fija en `.env`, leer notas de versión, respaldo antes, `pull` y `up -d`. Las migraciones solo van hacia adelante: revertir es imagen anterior más restaurar el respaldo previo. Principal, trabajadores y ejecutores en la misma versión. Actualizar con regularidad para no saltar muchas versiones.
- **Respaldar:** clave de cifrado + datos (volumen en simple, `pg_dump` en cola). Probar la restauración.

## Errores comunes
- Arrancar sin `N8N_ENCRYPTION_KEY` y fijar otra después.
- Usar la etiqueta `latest`.
- Variables de comportamiento solo en el principal en modo cola.
- Escalar trabajadores con ejecutores externos (cada trabajador necesita su propio ejecutor).
- DNS que no apunta o puerto 80 cerrado: sin certificado, n8n "parece roto".
