# Postiz autoalojado (programación de publicaciones)

Fecha: 2026-11-08. Fase: Arranque. Estado: **corriendo en `veridis-oficina`, sin cuenta de
administración, sin llave de API y sin redes conectadas.**

Postiz (gitroomhq/postiz-app, AGPL-3.0) programa publicaciones en TikTok, YouTube, LinkedIn,
Threads, carrusel de Instagram, Pinterest, X y otras. VeridisCorp lo usa **sin modificar y solo
por HTTP** (API pública `/api/public/v1`). Nunca importa su código ni `@postiz/node`; así la AGPL
no alcanza al código de VeridisCorp.

## Cómo encaja

- Herramienta `social.schedule_post` (`src/office/social-tools.ts`, puesto `content`), con dos
  funciones:
  - `list_social_channels`: lista los canales conectados.
  - `create_social_draft`: crea **solo borradores**, con texto, el video de `render_video` o imágenes públicas.
- Ninguna herramienta publica ni programa. Adrián revisa el borrador en Postiz y lo programa ahí.
  Cumple la regla de la casa: los agentes proponen y un humano aprueba lo que tiene efecto real.
- Para adjuntar un video, Postiz lo baja de un enlace firmado de 15 minutos
  (`src/office/signed-file-url.ts`). Hace falta `VERIDIS_PUBLIC_BASE_URL`: Postiz bloquea IPs
  privadas al descargar, así que `localhost` no sirve.
- Variables del runtime de VeridisCorp (`.env` del proyecto, nunca en el repo):
  `POSTIZ_URL=http://127.0.0.1:4007` y `POSTIZ_API_KEY`. Sin ellas la herramienta responde
  "Postiz no está configurado" y no llama a la red.

## Qué hay en este directorio

- `docker-compose.yml`: versión ligera del compose oficial, con proyecto `postiz` y 5 contenedores.

  | Contenedor | Imagen | Tope de memoria |
  |---|---|---|
  | `postiz` | `ghcr.io/gitroomhq/postiz-app:v2.25.3` | 1.5 GB |
  | `postiz-postgres` | `postgres:17-alpine` | 256 MB |
  | `postiz-redis` | `redis:7.2-alpine` | 128 MB |
  | `postiz-temporal` | `temporalio/auto-setup:1.28.1` | 512 MB |
  | `postiz-temporal-postgres` | `postgres:16-alpine` | 256 MB |

  - Se quitaron Elasticsearch, temporal-ui, admin-tools y spotlight. El servidor tiene 7.7 GB de
    RAM y el resto de servicios ya usa buena parte.
  - Solo escucha en `127.0.0.1:4007`.
- `.env.example`: plantilla. En el servidor vive como `~/postiz/.env` con `chmod 600`, con
  `JWT_SECRET` y las dos contraseñas de base de datos generadas al azar.
- `dynamicconfig/development-sql.yaml`: configuración mínima de Temporal.

## Operación en el servidor

```bash
ssh veridis-oficina
cd ~/postiz
docker compose up -d
docker compose ps
docker stats --no-stream $(docker compose ps -q)
docker compose logs --tail=50 postiz
```

Para actualizar, cambia la etiqueta de la imagen en este repo, cópiala al servidor y corre
`docker compose pull && docker compose up -d`. No uses `latest`.

Medido el 2026-11-08 tras arrancar:
- `postiz` usa unos 1.2–1.3 GB de 1.5 GB; los demás, menos de 200 MB cada uno.
- Quedaron unos 3.1 GB disponibles en el servidor.
- Sin reinicios ni OOM.
- Si `postiz` empieza a reiniciarse por memoria, subir su tope a 2 GB.

### Arreglo necesario: Temporal sin Elasticsearch

Sin Elasticsearch, Temporal guarda su visibilidad en Postgres y solo admite **3 atributos de
búsqueda de tipo texto**. La imagen `auto-setup` registra atributos de ejemplo que ocupan esos
lugares, y el backend de Postiz fallaba al registrar `organizationId` y `postId`. El síntoma era
`cannot have more than 3 search attribute of type Text`, y la API respondía 502.

La solución es `SKIP_ADD_CUSTOM_SEARCH_ATTRIBUTES=true` en el servicio `temporal`. Si la base de
Temporal ya se creó con los atributos de ejemplo, hay que borrar su volumen:

```bash
docker compose rm -sf temporal temporal-postgresql
docker volume rm postiz_temporal-postgres
docker compose up -d
```

Borrarlo solo pierde el historial de flujos de Temporal. Las publicaciones viven en `postiz-postgres`.

## Pasos pendientes (los hace Adrián)

1. **Crear la cuenta de administración.** Abre un túnel desde la Mac y entra a http://localhost:4007:

   ```bash
   ssh -L 4007:127.0.0.1:4007 veridis-oficina
   ```

   Después, en `~/postiz/.env`, pon `DISABLE_REGISTRATION=true` y corre `docker compose up -d`.
2. **Generar la llave de API** en Postiz (Settings → Public API). Ponla en el `.env` del runtime de
   VeridisCorp como `POSTIZ_API_KEY`, nunca en el repo, y reinicia el runtime.
3. **URL pública con HTTPS** (por ejemplo, un túnel de Cloudflare). Las redes exigen callbacks OAuth
   públicos. Al tenerla:
   - cambia `MAIN_URL`, `FRONTEND_URL` y `NEXT_PUBLIC_BACKEND_URL`;
   - quita `NOT_SECURED`.
4. **Apps de desarrollador por red.** Sus credenciales van en `~/postiz/.env`.
   - Meta/Threads, TikTok, YouTube y LinkedIn tienen revisiones que pueden tardar semanas.
   - TikTok publica en privado hasta pasar su auditoría. Ver `docs/social-publishing-roadmap.md`.
5. Probar de punta a punta: listar canales, crear un borrador con un video renderizado y
   programarlo a mano en Postiz.

## Límites conocidos

- **No resuelve los Reels de Facebook.** Facebook e Instagram siguen con sus herramientas
  propias (`social.publish_facebook` y `social.publish_instagram`).
- `API_LIMIT=30` peticiones por hora a la API pública.
- La API pública valida los ajustes de cada red aunque se cree un borrador. Algunas redes
  (por ejemplo, el título en YouTube) exigen `settings` por canal en `create_social_draft`.
- Verificado: el arranque, la salud de la API (responde 401 sin llave) y la memoria.
- Sin verificar: crear un borrador real, porque todavía no hay cuenta ni llave. Las pruebas de
  `test/social-tools.test.ts` simulan la API.
