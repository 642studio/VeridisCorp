> Adaptado de goose-skills (gooseworks-ai, MIT): improve-search-visibility (foundation-check, prioritising).

# SEO técnico y visibilidad en respuestas de IA

Antes de pulir textos, el sitio tiene que poder rastrearse, indexarse y leerse sin JavaScript. Un bloqueo técnico pesa más que cualquier mejora de copy en la página afectada. El copy es de content; aquí se diagnostica y se entrega el cambio técnico.

## Antes de empezar
Busca primero en la memoria corporativa y en la ficha de marca; pide lo que falte y márcalo FALTANTE:
- Dominio canónico, páginas que generan negocio (servicios, menú, reservas, contacto) y cómo se construye el sitio (React con o sin render en servidor, plantilla, CMS).
- Acceso o capturas de Google Search Console y Bing Webmaster Tools, si existen.
- Herramienta de analítica instalada (GA4, Tag Manager, otra) y píxeles de anuncios.
Cada punto se reporta como **pasa / falla / no revisado** con la evidencia observada. Una muestra que pasa solo vale para esa muestra. Lo que no pudiste ver va como "no revisado — motivo", nunca como pasa.

## Revisión del sitio (una vez)
| Punto | Cómo | Clase |
|---|---|---|
| robots.txt | Busca `Disallow` en rutas clave y bots de búsqueda: Googlebot, Bingbot, OAI-SearchBot, ChatGPT-User, PerplexityBot, Claude-SearchBot, Claude-User. Los de entrenamiento (GPTBot, Google-Extended, CCBot, ClaudeBot) son decisión de política, no de visibilidad | Bloqueo si se bloquea un bot de búsqueda |
| Bloqueo por CDN o firewall | Petición con agente de bot contra agente de navegador (`curl -A "OAI-SearchBot" -sI`); un 403 o reto significa bloqueado | Bloqueo |
| Indexación | Search Console; búsqueda de la marca como pista. Bing también, porque varios asistentes se apoyan en su índice (no confirmado por todos) | Bloqueo si no aparece |
| Host duplicado | El dominio de la plataforma (`*.vercel.app`, `*.netlify.app`, subdominio de pruebas) redirige o canonicaliza al real | Bloqueo si se indexa el duplicado |
| Sitemap | `/sitemap.xml` o la línea `Sitemap:` responde 200 y lista las páginas de negocio | Mejora |
| Páginas en serie | Grupos generados por plantilla (`/sucursal/<x>`, `/servicio/<x>`): muestrea 3-5; si son casi iguales, propone mejorar, consolidar o `noindex`, con riesgo y reversa | Riesgo alto si son delgadas |
| Medición | Qué analítica y píxeles corren en inicio y una página de negocio | Bloqueo para medir, no para posicionar |

## Revisión por página
| Punto | Cómo | Clase |
|---|---|---|
| `noindex` | Meta robots y encabezado `X-Robots-Tag` | Bloqueo |
| Estado y redirecciones | `curl -sIL`: final 200, máximo un salto, 301 para movimientos permanentes, nunca redirigir todo al inicio | Bloqueo (4xx/5xx, bucles) |
| Canónica | Absoluta, responde 200, apunta a sí misma en páginas únicas | Bloqueo si contradice la página que debe indexarse |
| Contenido sin JavaScript | `curl` de la página y busca el párrafo clave y el precio. La mayoría de rastreadores de IA no ejecuta JavaScript | Bloqueo para respuestas de IA |
| Título, H1, descripción | Únicos, alineados a la búsqueda; como referencia general, título de unos 60 caracteres con el término principal al inicio y la marca al final | Mejora rápida |
| Respuesta primero | Las primeras 40-60 palabras bajo el H1 responden la pregunta con la entidad nombrada y datos concretos | Mejora |
| Datos estructurados | Lee primero el JSON-LD existente. Tipos válidos y que coincidan con el texto visible: Organization, LocalBusiness (o el subtipo del giro), Product/Offer, Article, BreadcrumbList. Sin reseñas en Organization. Valida con la prueba de resultados enriquecidos o validator.schema.org | Mejora |
| Velocidad | PageSpeed Insights móvil, con datos de campo si hay. Umbrales de Google vigentes como referencia general: LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1 | Mejora, salvo que sea malo en una página de negocio |
| Enlaces internos | Las páginas clave se alcanzan desde navegación con anclas útiles; sin enlaces rotos | Problema si cuesta llegar |

## Sitios en React
Si el contenido solo existe tras ejecutar JavaScript, es invisible para casi todos los rastreadores de IA. Propone render en servidor, generación estática o prerender de las páginas de negocio; las vistas privadas (panel, ERP) deben quedar fuera del índice con `noindex` y autenticación, no solo con robots.txt.

## Priorizar
Puntaje = (impacto × confianza) ÷ esfuerzo, cada uno de 1 a 5, con una razón corta. Orden: bloqueos técnicos → datos de marca falsos o en conflicto → páginas casi ganadoras → huecos de contenido. Nunca un detalle cosmético arriba de un bloqueo de indexación.

## Qué entregas
Por acción: página o plantilla, defecto observado con fuente y fecha, por qué importa, cambio exacto o entrega técnica precisa, responsable, esfuerzo, cómo verificar y, si es estructural, riesgo y reversa. El cambio lo aplica un humano. Ventanas de observación: el acceso de bots se comprueba al momento; títulos y páginas cambiadas, de días a semanas tras el rastreo; posiciones, meses. Son ventanas, no promesas.

## Errores comunes
- Reportar como pasa lo que no se pudo revisar.
- Bloquear bots de búsqueda creyendo que solo se bloquea el entrenamiento.
- Datos estructurados que no coinciden con lo visible.
- Prometer posiciones o menciones en IA.
