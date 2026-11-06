# Publicación real en redes sociales: investigación y propuesta

Fecha original: 2026-11-03. Actualizado: 2026-11-05. Fase: Arranque. Este documento responde una
pregunta concreta — **qué hace falta para que VeridisCorp publique de verdad en Facebook,
Instagram, Threads, X, YouTube y TikTok** — y propone cómo encajarlo en la arquitectura ya
existente, en el mismo formato de decisión-pendiente que
[assistant-v1-roadmap.md](assistant-v1-roadmap.md).

**Facebook e Instagram ya están implementados, incluido video** (`social.publish_facebook`,
`social.publish_instagram` — ver la sección propia más abajo). Threads, X, YouTube y TikTok
siguen siendo solo investigación y propuesta, sin código todavía.

## Punto de partida: qué existe hoy

El agente `cm` (CommunityManager, `agents/cm/config.json`) solo tiene las capacidades
`community.plan` y `department.plan`, con `allowedTools: []` — planifica calendario y estrategia,
pero **nunca afirma haber publicado** (`agents/cm/instructions.md`: "Coordina contenido y
analítica sin afirmar que ya se publicó"). Es una restricción deliberada, no un olvido: hoy no hay
ninguna herramienta real de publicación en redes que el agente pudiera invocar.

El piloto de contenido (`src/runtime/`) ya tiene la pieza de gobernanza que un publicador real
necesitaría: la operación `content.publish` (`src/governance/contracts.ts:18`), con aprobación
humana explícita antes de que algo salga (`src/runtime/service.ts:217` y `:361`, probado en
`test/governance.test.ts`). Pero el único conector de salida es `httpDeliveryConnector`
(`src/runtime/providers.ts:46`): un PUT/GET genérico a un `VERIDIS_DELIVERY_URL` que el operador
debe implementar aparte — **sin integración real con ninguna red social**. El `DeliveryConnector`
de hoy solo manda `{ text, contentHash }`; no tiene concepto de imagen, video, ni de "a qué
plataforma/cuenta". Ese es exactamente el hueco que cierra esta propuesta.

El patrón ya probado para una integración real con efecto secundario (quince herramientas en
`src/office/tools.ts`, documentado en [office-architecture.md](office-architecture.md)) es:
credenciales por variable de entorno o OAuth2 con refresh token cifrado
(`VERIDIS_TOKEN_ENCRYPTION_KEY`, `src/runtime/secrets.ts`, mismo patrón que
`gmail_accounts`), un `tool()` con schema estricto de Zod, registro en `SIDE_EFFECTING_TOOLS`
(`src/office/intelligence.ts`) para que `review()` nunca la reejecute, y `allowedTools` explícito
por agente en su `config.json`. Publicar en redes sociales es, en esencia, más instancias de ese
mismo patrón — pero con una complejidad nueva que ninguna herramienta actual tiene: **cada
plataforma exige su propio proceso externo de revisión/auditoría antes de poder publicar en una
cuenta real**, no solo una credencial que se genera y ya funciona.

## Comparación rápida

| Plataforma | Auth que sobrevive al servidor | Revisión/auditoría obligatoria para producción | Costo directo | Complejidad de publicar |
| --- | --- | --- | --- | --- |
| Facebook Pages | Token de sistema (BISU) sin expiración, o Page token ~60 días | No, si solo gestiona páginas propias | Gratis | Baja (texto/foto); media para video/Reels |
| Instagram | Igual que Facebook (BISU) | No, si es cuenta propia — **pero** exige cuenta Business/Creator vinculada a una Página y "Page Publishing Authorization" | Gratis | Media-alta (contenedor + poll + publish, siempre) |
| Threads | Token de sistema, mismo árbol de Meta | **Sí, siempre** — sin Advanced Access solo se puede publicar en la cuenta propia y testers registrados | Gratis | Media (contenedor + espera ~30s + publish) |
| YouTube | OAuth2 + refresh token del dueño del canal (nunca service account) | **Sí** — mientras el proyecto de Google Cloud no esté verificado, todo video sube forzado a privado | Gratis (cuota, no dinero) | Baja (un solo `videos.insert` resumable) |
| X | OAuth 1.0a (token fijo, sin expirar) o OAuth2 PKCE (2h + refresh) | No hay cola de revisión manual — es self-service desde Feb 2026 | **Pago por uso** desde Feb 2026 (ver abajo) | Baja (un POST, media con init/append/finalize) |
| TikTok | OAuth2, refresh token de 180 días que **rota en cada uso** | **Sí, siempre** — sin auditoría solo publica en privado y máx. 5 usuarios/24h | Gratis | Media (creator_info obligatorio antes de cada post + init + poll) |

La conclusión operativa: **Meta (FB/IG) para la cuenta propia de la empresa es lo único que no
tiene una cola de revisión por delante** si VeridisCorp administra sus propias páginas (no las de
terceros) — es el candidato lógico para implementar primero. Threads, YouTube (para público) y
TikTok necesitan pasar por un proceso de verificación externo, con plazos no garantizados por el
proveedor (de días a varias semanas), antes de que cualquier publicación salga de modo
privado/prueba. X cambió de régimen de precios en 2026 y ahora se paga por llamada en vez de por
plan mensual — hay que decidir presupuesto, no solo credenciales.

## Facebook e Instagram — implementado (2026-11-03; video agregado 2026-11-05)

Dos herramientas reales nuevas en `src/office/tools.ts`, registradas en `SIDE_EFFECTING_TOOLS`
(`src/office/intelligence.ts`) y en `allowedTools` de `content` (`agents/content/config.json`) —
mismo agente ejecutor que ya tenía Drive/Calendar/Sheets/Meet/Slides, consistente con el punto 5
de la propuesta original de este documento:

- **`social.publish_facebook`** (tool `publish_facebook_post`): texto con enlace opcional
  (`POST /{page_id}/feed`), una foto única desde una URL pública ya alojada con leyenda opcional
  (`POST /{page_id}/photos`), o un video real de la Página a partir de un `videoFileId` — el
  `fileId` que devolvió `render_video`, ya persistido en `office_files`
  (`POST /{page_id}/videos` con `file_url` apuntando al enlace firmado temporal, ver abajo). Es
  un video normal de feed, **no específicamente un Reel**: el endpoint de Reels
  (`/{page-id}/video_reels`) usa un flujo de subida reanudable en tres fases documentado de forma
  menos completa por Meta — se dejó fuera hasta poder verificarlo en vivo contra una cuenta real,
  mismo criterio que ya se aplicaba antes a todo el bloque de video. Sin carrusel todavía.
- **`social.publish_instagram`** (tool `publish_instagram_post`): una imagen desde una URL
  pública, o un Reel a partir de un `videoFileId` (`media_type: "REELS"`, `video_url` = el mismo
  enlace firmado temporal), con el flujo real de contenedor que exige el Content Publishing API —
  `POST /{ig_user_id}/media` → poll de `status_code` hasta `FINISHED` (máx. 60s para imagen, hasta
  10 min para video — procesar un video tarda minutos, no segundos) →
  `POST /{ig_user_id}/media_publish` → intento de leer el `permalink` real (si falla, se
  devuelve igual el id de la publicación, nunca tumba la herramienta por ese detalle). Falla con
  un mensaje claro si la Página conectada no tiene una cuenta de Instagram Business vinculada.
  Sin Stories ni carrusel todavía.
- **Enlaces firmados temporales para video** (`VERIDIS_PUBLIC_BASE_URL`, `signFileAccess`/
  `verifyFileAccessSignature` en `src/runtime/secrets.ts`, ruta pública nueva
  `GET /office/files/:id/signed` en `src/runtime/http.ts`): esto es justo "la pieza que faltaba"
  que esta misma sección señalaba antes de 2026-11-05 — Meta necesita hacer su propio `GET` del
  video para `file_url`/`video_url`, y no puede presentar el Bearer de sesión que exige
  `GET /office/files/{id}` normal. La autorización de esa ruta nueva es la firma HMAC en la URL
  (`exp` + `sig`, misma `VERIDIS_TOKEN_ENCRYPTION_KEY` que ya cifra `gmail_accounts`/
  `meta_accounts`, no un secreto nuevo): solo el propio servidor pudo haberla producido (al
  construir la URL dentro de `publish_facebook_post`/`publish_instagram_post`), vence sola a los
  15 minutos, y la ruta solo sirve contenido cuyo `content_type` sea `video/*` o `image/*` — nunca
  un PDF u otro documento de `office_files`, aunque alguien reusara la firma de otro archivo (no
  podría: la firma está atada al `fileId` exacto). Imagen (`imageUrl`) sigue sin subida de bytes
  propia: sigue exigiendo una URL pública ya alojada en otro lado, igual que antes.

**Credenciales**: tabla nueva `veridis_runtime_v1.meta_accounts` (migración en
`src/runtime/database.ts`) — una fila con el `page_id`, el token de Página cifrado
(`VERIDIS_TOKEN_ENCRYPTION_KEY`, mismo mecanismo que `gmail_accounts`) y el `ig_user_id` vinculado
(`NULL` si la Página todavía no tiene Instagram Business conectado). A diferencia de Gmail, Graph
API no tiene refresh token: `npm run runtime:meta-authorize` (`src/runtime/cli.ts`) hace el
intercambio completo una sola vez — código → token de usuario de corta duración → token de usuario
de larga duración (`fb_exchange_token`) → `GET /me/accounts` para obtener el token de Página (que,
derivado de un token de usuario de larga duración, no expira bajo condiciones normales) — y guarda
ese token de Página, nunca el de usuario. Variables nuevas en `.env.example`: `META_APP_ID`,
`META_APP_SECRET`, `VERIDIS_META_OAUTH_CALLBACK_PORT` (default 8732), `META_PAGE_ID` (opcional,
solo si la cuenta administra más de una Página), y `VERIDIS_PUBLIC_BASE_URL` (2026-11-05, la URL
pública real del servidor — sin ella, `videoFileId` en `publish_facebook_post`/
`publish_instagram_post` falla con un mensaje claro; el resto de cada herramienta sigue
funcionando igual). `configureMeta()` inyecta la cuenta cargada al
arrancar el servidor (`loadMetaClient()` en `cli.ts`), mismo patrón que `configureGmail()`: sin
autorizar todavía, las herramientas fallan con un mensaje claro en vez de tumbar `execute()`.

Sin App Review de Meta todavía necesario para este alcance: la cuenta que autoriza administra su
propia Página, no páginas de terceros — ver la fila de la tabla de comparación. Pruebas reales en
`test/office-tools.test.ts` simulan la Graph API con `fetch` mockeado (sin red ni credenciales:
rechazo claro sin cuenta configurada, ramas texto/foto/video, error real de Graph API propagado
con su código, el flujo completo de contenedor de Instagram incluyendo video/Reels y el caso
`status_code: ERROR`); `test/secrets.test.ts` prueba la firma/verificación de enlaces temporales
por separado (firma válida, firma de otro `fileId`, firma vencida).

**No verificado en vivo todavía** (ver nota al pie de esta sección): tanto el video de Facebook
(`POST /{page_id}/videos` con `file_url`) como el Reel de Instagram (`media_type: "REELS"` +
`video_url`) están implementados contra la documentación oficial de Meta y probados con la Graph
API simulada, pero ninguno corrió aún contra una Página/cuenta real — sigue pendiente la primera
publicación real de prueba antes de confiar en esto para contenido de producción sin supervisión.

## Detalle por plataforma

### Facebook Pages (Meta Graph API, hoy v26.0)

- Texto/enlace: `POST /{page_id}/feed`. Foto: `POST /{page_id}/photos` con `url` pública. **Video
  de feed normal** (implementado 2026-11-05): `POST /{page_id}/videos` con `file_url` apuntando
  al enlace firmado temporal de `office_files` (ver la sección de arriba) — documentado de forma
  estable y sencilla por Meta, a diferencia de Reels. **Reels específicamente sigue sin
  construirse**: van por un flujo de tres fases distinto (`POST /{page-id}/video_reels`:
  `upload_phase=start` → subir bytes a `rupload.facebook.com` con poll de `status` → `finish`),
  documentado de forma menos completa — verificar en vivo antes de construirlo.
- Permisos: `pages_manage_metadata`, `pages_manage_posts`, `pages_manage_read_engagement`,
  `pages_show_list`, `publish_video` para video.
- App Review **no** es obligatorio si la app solo administra páginas propias (Standard Access);
  sí lo es para publicar en páginas de terceros.
- Límite conocido: 30 Reels publicados por 24h vía API. El resto de publicaciones en feed sigue
  la fórmula general de Meta ligada a impresiones de la página, no un tope fijo diario.
- Programar: `published=false` + `scheduled_publish_time` (10 min a 30 días en el futuro).

### Instagram (Instagram Platform — Content Publishing API)

- **Todo** pasa por el modelo de contenedor, sin excepción: `POST /{ig-user-id}/media` crea el
  contenedor (imagen/video/reel/story/hijo de carrusel) → si es video, hacer poll de
  `GET /{container-id}?fields=status_code` hasta `FINISHED` (expira a las 24h si no se publica) →
  `POST /{ig-user-id}/media_publish` con `creation_id`. **Reel implementado** (2026-11-05):
  `media_type: "REELS"` + `video_url` apuntando al enlace firmado temporal de `office_files`,
  mismo mecanismo que el video de Facebook. Carrusel sigue sin construirse: crear cada hijo con
  `is_carousel_item=true`, luego un contenedor padre `media_type=CAROUSEL` con `children` (hasta
  20 según la documentación oficial, aunque hay fuentes de terceros que dicen 10 — probar).
  Stories tampoco está construido.
- Requiere cuenta Business o Creator de Instagram **vinculada a una Página de Facebook** — punto
  de falla frecuente en integraciones — y haber completado "Page Publishing Authorization" (PPA),
  un gate adicional separado de App Review que puede bloquear la publicación en silencio aunque
  los permisos estén bien otorgados.
- Permisos: `instagram_basic` + `instagram_content_publish` (o las variantes
  `instagram_business_*` si se usa Instagram Login en vez de Facebook Login).
- Límite oficial actual: 100 publicaciones por cuenta cada 24h vía API (un carrusel cuenta como
  una sola). Verificable en vivo con `GET /{ig-id}/content_publishing_limit` — no conviene
  hardcodear el número, la propia documentación de Meta se ha contradicho entre secciones.
- Los medios deben estar en una URL públicamente accesible en el momento de la llamada (Meta hace
  el fetch), salvo que se use el flujo de subida resumible alternativo.

### Threads (Threads API — app aparte en el dashboard de Meta)

- Mismo patrón de contenedor que Instagram: `POST /{threads-user-id}/threads` (texto ≤500
  caracteres, imagen, video, o hijos de carrusel) → esperar ~30s (recomendación oficial, no hay
  endpoint de estado detallado para esto en la documentación revisada) → `POST
  /{threads-user-id}/threads_publish` con `creation_id`.
- Permisos: `threads_basic` (obligatorio para cualquier llamada) + `threads_content_publish`.
- **Sin Advanced Access, solo se puede publicar en la cuenta propia y en testers registrados** —
  a diferencia de Facebook/Instagram, aquí la revisión de Meta es obligatoria desde el día uno
  para cualquier cuenta real de cliente, incluso si fuera la propia empresa pero gestionada desde
  una app separada.
- Límite: 250 publicaciones por perfil cada 24h (verificable con
  `GET /{threads-user-id}/threads_publishing_limit`).
- Nota propia de la plataforma: lo publicado por API también se federa al fediverse para usuarios
  que lo activaron — relevante si el flujo de edición/borrado asume que solo existe en Threads.

### YouTube Data API v3

- Un solo flujo: `videos.insert` (subida resumible), con metadata (`snippet.title`,
  `description`, `tags`, `categoryId`, `status.privacyStatus`, `status.publishAt` para programar,
  `status.selfDeclaredMadeForKids` obligatorio por COPPA, `status.containsSyntheticMedia` si el
  video es IA generativa/sintética realista). Miniatura aparte: `thumbnails.set`. No hay endpoint
  separado para "Shorts": YouTube lo clasifica solo por relación de aspecto y duración del archivo
  subido (vertical/cuadrado, duración corta — el tope exacto cambió de 60s a un valor mayor
  reportado por terceros como 3 minutos, sin confirmar en una página oficial vigente).
- **Las cuentas de servicio no sirven** para publicar en un canal normal/de marca — hace falta
  OAuth2 delegado del dueño (o gestor) del canal, con `access_type=offline` para obtener un
  refresh token una sola vez de forma interactiva y usarlo luego sin atención humana. Igual patrón
  que ya funciona para Gmail/Drive (`npm run runtime:gmail-authorize`): un flujo de autorización
  único por CLI, token cifrado en Postgres.
- Scope mínimo: `youtube.upload`. Es un *scope sensible* de Google: mientras el proyecto de Google
  Cloud no pase la verificación de Google (que pide una demo del flujo OAuth real), **todo video
  subido por un proyecto no verificado creado después del 28 de julio de 2020 queda forzado a
  `privacyStatus=private`** sin importar lo que se pida — el fallo más fácil de no detectar hasta
  que algo "publicado" nunca se ve públicamente.
- Cuota: 10,000 unidades/día en el pool general, pero `videos.insert` vive en un cupo aparte de
  **100 llamadas/día** — ese es el techo práctico de subidas diarias por proyecto. Ampliarlo exige
  una auditoría de cumplimiento (formulario dedicado), no un simple botón en la consola.
- Verificación adicional, a nivel del canal (no de la API): videos de más de 15 minutos, miniaturas
  personalizadas o streaming en vivo requieren verificación telefónica del canal en YouTube
  Studio — la hace el dueño del canal una sola vez, fuera de cualquier llamada de API.

### X (API v2)

- Cambio importante desde el 6 de febrero de 2026: X pasó de planes mensuales fijos (Free/Basic/
  Pro) a **pago por uso** para cuentas de desarrollador nuevas — sin cola de revisión manual, el
  acceso de escritura es un simple toggle "Read and Write" en la consola (con un detalle: los
  tokens generados mientras la app estaba en solo-lectura siguen siendo de solo lectura aunque se
  cambie el permiso después — hay que regenerarlos).
- Precio por publicación: **US$0.015** por post (texto o media), pero **US$0.20** si el post
  incluye una URL — 13 veces más caro, algo a tener en cuenta si el calendario de `cm` suele
  enlazar al sitio de la marca.
- Publicar: `POST /2/tweets` con `media.media_ids` si hay imagen/video (hasta 4 fotos, o 1 GIF, o
  1 video — no se pueden mezclar). Subida de media ahora es v2 (`/2/media/upload/initialize` →
  `/append` → `/finalize`, con poll de estado si hace falta procesar).
- Auth: para una sola cuenta de negocio administrada por el propio backend, **OAuth 1.0a es más
  simple que OAuth2** — el par de tokens no expira y no necesita refresco en producción. OAuth2
  con PKCE exige refrescar el access token cada 2 horas (con `offline.access` para obtener
  refresh token) — más piezas en movimiento sin ganar nada para este caso de un solo tenant.
- Gotcha propio: no se puede responder en frío a cualquier tweet — solo si el autor original
  mencionó a la cuenta o citó una publicación suya.

### TikTok (Content Posting API)

- Antes de **cada** publicación hay que llamar `POST /v2/post/publish/creator_info/query/` — no
  es un paso de setup único, cambia por creador con el tiempo (privacidad permitida, duración
  máxima de video). Luego `POST /v2/post/publish/video/init/` (Direct Post, scope `video.publish`)
  con `source_info.source` = `PULL_FROM_URL` (media en una URL de dominio verificado en el portal)
  o `FILE_UPLOAD` (subida de bytes en chunks, URL de subida válida solo 1 hora). Fotos: **solo
  `PULL_FROM_URL`**, no hay subida directa de bytes para fotos, máximo 35 por post.
- Auth: OAuth2, access token de 2h, refresh token de **180 días que rota en cada uso** — hay que
  sobreescribir el refresh token guardado cada vez o el siguiente refresco falla. Scopes:
  `video.publish`, `video.upload` (modo borrador/bandeja, el creador termina y publica a mano
  desde la app), `user.info.basic`.
- **Mientras la app no pase la auditoría de TikTok, cualquier publicación queda forzada a
  privada/solo-yo**, y el cliente sin auditar está limitado a 5 usuarios distintos publicando por
  cada 24h. Para una cuenta de negocio que quiere publicar en público, la auditoría no es
  opcional. No hay sandbox documentado: las pruebas se hacen contra producción con cuentas propias.
- Límite reportado (no una constante fija, se consulta por creador): alrededor de 15
  publicaciones por cuenta creadora cada 24h, compartido entre todos los clientes de API que usen
  Direct Post sobre esa cuenta.
- Nota regulatoria: la divestitura de TikTok US cerró reportadamente el 22 de enero de 2026 (nueva
  entidad de mayoría estadounidense); no se encontró evidencia de que esto haya cambiado el acceso
  al Content Posting API, pero es un frente a revisar más cerca de la fecha real de implementación.

## Propuesta de arquitectura para VeridisCorp

1. **Extender `DeliveryConnector` (o crear uno nuevo, `SocialDeliveryConnector`) en lugar de
   forzar todo por `httpDeliveryConnector`.** El contrato actual (`{ text, contentHash }`) no
   alcanza: hace falta al menos `platform`, `accountId`, media (imagen/video, probablemente
   referenciado desde `office_files` igual que ya hace `pdf.generate`) y el resultado de
   publicación real (`postId`/URL permanente) en vez de una `reference` genérica.
2. **Una tabla nueva de credenciales por cuenta social**, análoga a `gmail_accounts`: por fila,
   `platform`, `account_id` externo, token de acceso/refresco cifrado
   (`VERIDIS_TOKEN_ENCRYPTION_KEY`), expiración conocida y, para TikTok, el refresh token más
   reciente (dado que rota). Un job propio de refresco para los que caducan en horas (X OAuth2) o
   meses (TikTok) — todavía no existe ninguna pieza de "renovar credenciales en segundo plano" en
   el proyecto; hoy todo lo que usa OAuth2 (Gmail/Drive/Calendar/Sheets/Meet/Slides) usa tokens de
   Google que se refrescan en caliente con la librería de Google, sin necesidad de un cron.
3. **Una herramienta real por plataforma** en `src/office/tools.ts` (`social_publish_facebook`,
   `social_publish_instagram`, `social_publish_threads`, `social_publish_x`,
   `social_publish_youtube`, `social_publish_tiktok`), no una sola `social.publish` genérica: cada
   una tiene su propio schema de Zod (lo que puede variar: texto, imagen, video, carrusel) y su
   propio flujo de contenedor/polling — mezclarlas detrás de una interfaz común perdería
   justamente los detalles que distinguen a cada API. Todas entran a `SIDE_EFFECTING_TOOLS`
   (`src/office/intelligence.ts`): publicar dos veces en una red social por una reverificación de
   `review()` sería un incidente real, el mismo tipo de error ya documentado y corregido para
   `email.draft`.
4. **Gobernanza: reusar `content.publish`, no crear una operación nueva.** Ya existe el patrón de
   "un agente propone, un humano aprueba, la decisión referencia la huella exacta de la acción"
   (`src/runtime/service.ts`) — publicar en redes es la implementación real de esa operación que
   hoy solo llega a un PUT genérico. No hace falta un verbo nuevo en `src/governance/contracts.ts`.
5. **`cm` sigue siendo quien planifica**, pero la ejecución real debería vivir en un agente
   ejecutor separado (como ya pasa con `content` para PDFs/Drive/Calendar) con `allowedTools`
   explícito por plataforma — así una cuenta de Instagram no queda disponible para quien solo
   necesitaba X, y se puede auditar qué perfil tiene qué cuenta conectada.
6. **Orden de implementación sugerido**, por fricción externa real (no por preferencia técnica):
   1. **Facebook Pages + Instagram** (páginas propias de la empresa) — implementado, ver la
      sección dedicada arriba. Usó un token de Página de larga duración en vez de BISU: más
      simple de autorizar para una sola Página propia, con el mismo resultado práctico (no expira
      bajo condiciones normales); migrar a BISU más adelante es un cambio acotado a
      `metaAuthorize()`, no a las herramientas de publicación.
   2. **X** — sin revisión manual, solo hay que decidir presupuesto de pago por uso y elegir
      OAuth 1.0a para evitar el refresco cada 2 horas.
   3. **YouTube** — reusa el mismo cliente OAuth2 y la misma cuenta de Google ya autorizada para
      Gmail/Drive; lo nuevo es la verificación de scope sensible ante Google (días a semanas) y el
      cupo de 100 subidas/día.
   4. **Threads y TikTok al final** — ambas exigen pasar una auditoría externa antes de poder
      publicar en una cuenta real en público, con plazos no garantizados por el proveedor
      (reportes de comunidad: de días a más de un mes). Conviene iniciar esos trámites en paralelo
      con el trabajo de las primeras tres, no esperar a terminarlas para arrancar la auditoría.

## Qué necesita decidir o conseguir el operador (humano) antes de escribir código

- Cuentas de desarrollador en los cuatro ecosistemas (Meta for Developers, X Developer Portal,
  Google Cloud Console, TikTok for Developers) y las cuentas de negocio reales vinculadas (Página
  de Facebook, cuenta de Instagram Business/Creator vinculada a esa Página, canal de YouTube,
  cuenta de TikTok Business).
- Para Meta: decidir si el modelo de token es BISU (Business Integration System User, pensado
  para automatización sin usuario presente) o un token de Página de larga duración con rotación
  manual cada ~60 días — verificar en el propio App Dashboard si la cuenta de VeridisCorp
  califica para BISU, la documentación de Meta lo enmarca para "Tech Providers".
- Para X: decidir presupuesto mensual real bajo el nuevo modelo de pago por uso (US$0.015 por
  publicación, US$0.20 si lleva URL) y si procede evitar URLs en los posts automatizados por
  costo.
- Para TikTok y Threads: iniciar el trámite de auditoría/Advanced Access lo antes posible — es la
  parte del cronograma que VeridisCorp no controla.
- Presupuesto de ingeniería para una tabla nueva de credenciales por cuenta social y, al menos
  para TikTok, un job de refresco programado (el refresh token rota y expira a los 180 días).

## Fuera de alcance de este documento

No se investigó WhatsApp Business API (mencionado en el conocimiento de `cm` como canal, pero fue
excluido explícitamente del pedido original) ni Pinterest/LinkedIn. No se escribió código ni
esquema de base de datos todavía — es la decisión de diseño previa, en el mismo espíritu que
"Comandos reales en el VPS" en [assistant-v1-roadmap.md](assistant-v1-roadmap.md): el diseño
queda documentado antes de implementar, no como sustituto de la implementación.
