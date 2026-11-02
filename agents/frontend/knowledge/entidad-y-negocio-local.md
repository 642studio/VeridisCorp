> Adaptado de goose-skills (gooseworks-ai, MIT): improve-search-visibility (entity-and-local, prioritising).

# Entidad de marca y negocio local

Buscadores y asistentes de IA describen una marca con lo que encuentran repetido en su sitio y sus perfiles. La causa más común de una descripción equivocada es un dato viejo olvidado en un perfil. La corrección son valores exactos por campo, no consejos.

## Antes de empezar
Busca primero en la memoria corporativa y en la ficha de marca (`docs/ficha-de-marca.md` explica cómo se llena); pide lo que falte y márcalo FALTANTE. Los datos canónicos los confirma un humano antes de usarlos:
- Nombre comercial y razón social; frase canónica de una línea; categoría principal.
- Año de fundación, ciudad, dominio canónico, logo vigente, modelo de precios (o ninguno).
- Por sucursal: nombre como aparece en el letrero, dirección, teléfono y horario (NAP + horario), incluidos días festivos.
- Lista de perfiles existentes y quién tiene acceso a cada uno.

## Datos canónicos en el sitio
- Página "Quiénes somos" con los datos canónicos en texto visible.
- JSON-LD `Organization` en inicio, con `name`, `url`, `logo`, `sameAs` (perfiles oficiales) y `alternateName` con las variantes con que la gente escribe el nombre (por cómo suena, sin acentos, junto o separado).
- Por sucursal, `LocalBusiness` o el subtipo del giro (`Restaurant`, `HairSalon`, etc.) con dirección, teléfono, horario y geolocalización, idénticos a lo visible.
- Si el nombre se confunde con otra marca, una línea clara de "quiénes somos" que la distinga.

## Perfiles que importan
| Tipo de negocio | Indispensables | Deseables |
|---|---|---|
| Todos | Sitio con datos canónicos, Facebook, Instagram, LinkedIn de la empresa | YouTube, TikTok |
| Local con atención presencial | Google Business Profile, Apple Business Connect, Bing Places, WhatsApp Business con catálogo y horario | Directorio del giro (p. ej. Tripadvisor para restaurantes, Doctoralia para salud), cámara de comercio |
| Servicios (agencia, software) | LinkedIn de empresa y fundador, directorio de agencias del nicho, Google Business Profile si los clientes visitan la oficina | Casos publicados, entrevistas o podcasts |
| Tienda en línea | Página de producto con precio y existencia, perfil en el marketplace donde se vende | Reseñas en una plataforma verificable |

Revisa los cinco más relevantes para la marca. Muchas plataformas prohíben extracción automatizada: pide captura o vista del panel, o marca "no revisado".

## Calificar cada perfil
Completo / inconsistente / faltante / sin reclamar, contra: mismo nombre, misma frase canónica (palabra por palabra o como prefijo claro), misma categoría en la taxonomía de esa plataforma, mismos datos de fundación, mismo dominio, mismo logo, mismo modelo de precio (o ninguno, antes que uno viejo) y mismo NAP. Para perfiles sin reclamar, entrega los pasos para reclamarlos; los hace un humano.

## Google Business Profile, por sucursal
Solo para negocios que atienden en persona o en el domicilio del cliente. Nombre exacto del letrero sin palabras clave añadidas; la categoría principal más específica y unas pocas secundarias; horario con excepciones de festivos; dirección o zona de servicio; teléfono; sitio con UTM; servicios o productos; descripción con datos primero, dentro del límite de caracteres vigente de Google; fotos reales; número, promedio, recencia de reseñas y tasa de respuesta. NAP idéntico en el perfil, el sitio, Apple, Bing, Facebook y el directorio del giro.

Reseñas: propone un flujo para pedirlas a todos los clientes con el enlace directo, después de la visita. Nunca reseñas falsas, ni incentivos atados a calificación positiva, ni pedirlas solo a clientes contentos. Las reglas de publicidad y protección al consumidor aplicables: verificar con el abogado o la fuente oficial vigente.

## Priorizar
Puntaje = (impacto × confianza) ÷ esfuerzo, de 1 a 5 cada uno. Primero datos falsos o contradictorios en perfiles con mucho tráfico (horario o teléfono equivocado cuesta clientes hoy), luego perfiles faltantes indispensables, luego mejoras. Los perfiles pasan por moderación antes de reflejarse; las respuestas de IA basadas en memoria de entrenamiento cambian en plazos inciertos.

## Qué entregas
Tabla perfil → estado → campo → valor actual → valor correcto → cómo editarlo (panel, reclamar, sugerir cambio) → responsable. JSON-LD propuesto listo para revisión. Nada se publica ni se edita sin aprobación humana; coordina el texto con content.

## Errores comunes
- Agregar palabras clave al nombre del perfil.
- Usar datos que no confirmó un humano.
- Dejar el horario de temporada pasada en un perfil.
- Marcar como consistente un perfil que no se pudo ver.
