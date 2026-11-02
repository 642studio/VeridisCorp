> Adaptado de marketingskills (Corey Haines, licencia MIT): analytics, attribution, ab-testing.

# Medición y pruebas

## Antes de empezar
Busca primero en la memoria corporativa y la ficha de marca; pide solo lo que falte:
- Qué decisión se tomará con los datos. Si nada cambia según el resultado, no lo midas.
- Dónde ocurre la conversión: local, WhatsApp, sitio, llamada, formulario.
- Herramientas disponibles (administradores de anuncios, GA4, WhatsApp Business, punto de venta, hoja de registro) y quién implementa.
- Línea base: volumen y conversiones actuales.

## KPIs por objetivo
| Objetivo | KPI principal | Secundarios |
|---|---|---|
| Reconocimiento | Alcance en la zona | Frecuencia, CPM, retención de video |
| Consideración | Clics o visitas al perfil | CTR, CPC, guardados |
| Conversión | Pedidos, reservas o ventas | Mensajes iniciados, costo por resultado, ROAS |
| Fidelización | Compra repetida | Reseñas, respuestas a la lista |

Define un KPI principal, secundarios que lo expliquen y un guardarraíl que no debe empeorar (p. ej., ticket promedio).

## Plan de medición
| Evento | Dónde ocurre | Cómo se registra | Responsable |
|---|---|---|---|
| Clic a WhatsApp | Botón del sitio o anuncio | `whatsapp_click` + mensaje prellenado | Quien implementa el sitio |
| Venta por WhatsApp | Chat | Etiqueta "vendido" + hoja de registro | Quien atiende |

- Nombres en minúsculas tipo objeto_acción (`whatsapp_click`, `reserva_enviada`). Si GA4 tiene un evento recomendado, usa su nombre.
- Prueba cada evento con una conversión real antes de lanzar.
- Calcula tasas con numerador y denominador del mismo periodo cerrado. Saca totales con hoja o script, no a ojo.

## UTMs
`utm_source` (quién manda: instagram, tiktok, google), `utm_medium` (tipo: paid-social, social, creator, email, whatsapp, qr), `utm_campaign`, `utm_content` (pieza).
- Minúsculas y guiones; una sola ortografía por fuente, guardada en una hoja compartida.
- Ejemplo: `utm_source=instagram&utm_medium=paid-social&utm_campaign=apertura-centro-2026-11&utm_content=reel-precio`.
- Nunca datos personales en un UTM.
- Abre el enlace final: acortadores y redirecciones pueden perder parámetros.
- Mediums propios pueden caer en "sin asignar" en GA4; configura un grupo de canales.

## Lo que no es un clic
- Cupón o código distinto por canal o creador para video, impresos, radio o ventas en el local.
- QR con UTM en material impreso.
- Pregunta "¿cómo nos conociste?" al vender, con lista corta más "otro".

## WhatsApp como canal de conversión
- Enlace `wa.me` con mensaje prellenado distinto por canal o campaña para identificar el origen.
- Etiquetas en WhatsApp Business por origen y estado (nuevo, cotizado, vendido).
- Registra fecha, origen, estado y monto en una hoja o CRM. Conversación no es venta: mide ambas y la tasa entre ellas.

## Pruebas A/B
- Hipótesis: "Porque [dato], creemos que [cambio] logrará [resultado] en [público]; lo sabremos por [métrica]".
- Una variable a la vez. Métrica principal, tamaño y duración se fijan antes.
- Tamaño como referencia general (95 % de confianza, 80 % de potencia): con conversión base de 5 % y mejora relativa de 20 %, unas 8,200 personas por variante. Usa una calculadora con tus datos.
- Duración: semanas completas para cubrir todos los días; no mires para detener antes ni cambies variantes a medio camino.
- En anuncios usa la herramienta de prueba A/B de la plataforma; variantes sueltas en un conjunto son exploratorias porque el algoritmo las reparte desigual.
- No pruebes si no hay volumen, si el cambio corrige un error obvio o si la temporada es atípica: aplica la mejor versión y compárala como lectura direccional.
- Reporta efecto e incertidumbre; sin diferencia clara no hay ganador.

## Atribución en sencillo
- Todo modelo es una opinión: primer contacto premia lo que dio a conocer; último, lo que cerró. Para ciclos largos muéstralos lado a lado.
- Cada plataforma se adjudica la misma venta. No sumes: elige una fuente de verdad (ventas o registro de WhatsApp) y explica el resto contra ella.
- Lee tendencias: si todas las fuentes suben, la dirección es confiable aunque no cuadren.
- Zonas ciegas: tráfico directo, búsqueda de marca, compartidos por mensaje, boca a boca, visitas al local. La encuesta y los cupones ayudan a verlas.
- Para saber si un canal causa ventas, apágalo en una zona o periodo comparable cuando la inversión lo justifique.

## Errores comunes
- Medir lo fácil y no lo que decide.
- UTMs inconsistentes que parten un canal en tres.
- Declarar ganador con poca muestra o tras mirar antes.
- Prometer un número exacto de atribución.
- Olvidar las ventas fuera de línea.
