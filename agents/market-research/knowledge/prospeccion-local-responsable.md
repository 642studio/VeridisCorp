> Escrito para VeridisCorp (criterios de filtrado adaptados de google-maps-scraping-apis, MIT; texto propio).

# Prospección local responsable

El puesto arma listas acotadas y justificadas de negocios locales con una oferta para cada uno. No contacta, no da de alta en el CRM ni gasta en APIs: propone, y un humano aprueba y ejecuta.

## Antes de empezar

Busca en la memoria corporativa los paquetes vigentes de 642 Studio y lo que ya se intentó. Pide lo que falte (FALTANTE): qué servicio se quiere vender, municipio, giros, tamaño del lote (pequeño, para contactar uno a uno) y quién revisará contra los clientes actuales del CRM (`cm` o `pm` tienen lectura de 642CORE).

## Fuentes legítimas

1. **API DENUE del INEGI** (oficial; token gratuito con registro en el sitio del INEGI, verificar condiciones vigentes). Base: `https://www.inegi.org.mx/app/api/denue/v1/consulta/`.
   - `BuscarAreaAct` y `BuscarAreaActEstr` filtran por entidad (2 dígitos; Sonora = 26), municipio (3 dígitos, verificar la clave en el Marco Geoestadístico), actividad SCIAN (sector, subsector, rama o clase de 6 dígitos), estrato de personal ocupado y rango de registros; 0 significa "todos".
   - `Cuantificar` da conteos por actividad y área: sirve para dimensionar antes de listar.
   - Devuelve nombre, razón social, clase de actividad, estrato, dirección, teléfono, correo, sitio web, coordenadas y fecha de alta. Son datos de directorio que pueden estar desactualizados: un campo vacío no prueba nada.
   - Hoy no hay herramienta DENUE en este puesto: entrega la consulta con sus parámetros (nunca el token) para que `automation` o un humano la corra. El token vive en el entorno, nunca en archivos ni prompts.
2. **Google Places API** (oficial, de pago por uso, requiere cuenta y clave). Calificación, número de reseñas y sitio web. Sus términos solo permiten guardar el `place_id`; el resto se vuelve a consultar y se atribuye (verificar términos vigentes). El gasto lo aprueba un humano.
3. **Google Business Profile**: solo para clientes propios que nos dieron acceso.

No se usa: raspar Google Maps, servicios de scraping, bases compradas, ni navegar con la sesión de una cuenta de 642. Violan términos de servicio y arrastran datos personales sin base legal.

## Criterios: señal → oferta

| Señal | Oferta | Cómo confirmarla |
|---|---|---|
| Sin sitio web | Sitio web | Campo vacío en DENUE o Places y búsqueda web; puede tener solo Facebook |
| Calificación menor a 4.0 con 20 o más reseñas (umbral de referencia general) | Reputación y respuesta a reseñas | Places, con fecha de consulta |
| Sin reseñas recientes | Campaña de reseñas | Fecha de la última reseña; la ventana la define un humano (FALTANTE) |

Una razón principal por prospecto, con evidencia y fecha. El estrato DENUE ayuda a ajustar el paquete al tamaño, como hipótesis. Excluye clientes actuales, competidores directos de un cliente (confirmar con `cm`) y a quien ya pidió no ser contactado.

## Registro en 642CORE

Hoy el CRM no tiene tabla de prospectos y este puesto no escribe en él (`core.write` es de `cm` y `pm`, y solo crea notas, contactos y solicitudes de clientes existentes). Dónde vivirán los prospectos es FALTANTE para Adrián. Mientras, entrega el lote como tabla (o PDF con `pdf.generate`) con estos campos:

nombre comercial · clase SCIAN · municipio · fuente e identificador (CLEE de DENUE o `place_id`) · fecha de consulta · señal y evidencia · oferta · canal sugerido · estado (por revisar, aprobado, contactado, no contactar) · responsable humano.

Minimiza: solo datos de contacto públicos del negocio; nada de reseñas copiadas ni datos personales de empleados o reseñadores.

## Contacto uno a uno

- Un borrador por negocio, que mencione la señal con respeto ("vi que su ficha no tiene sitio") y sin exagerar resultados. Cada envío lo aprueba un humano; nada masivo ni automatizado.
- Antes de llamar o enviar SMS o WhatsApp publicitario, un humano consulta el REPEP de PROFECO; si el número está inscrito, no se contacta por ese medio. El alcance exacto sobre WhatsApp: verificar con abogado.
- El primer mensaje se identifica como 642 Studio, ofrece el aviso de privacidad y una forma sencilla de no recibir más; un "no" se registra como "no contactar" para siempre.
- Número y plazo de seguimientos los define un humano.
- Tratamiento de datos conforme a la LFPDPPP vigente y reglas de WhatsApp Business: verificar con abogado y en la documentación oficial.

## Errores comunes

- Listas de cientos de negocios sin razón por prospecto.
- Dar por hecho "no tiene web" por un campo vacío.
- Guardar datos de Places más allá del `place_id`.
- Saltarse el REPEP o mandar el mismo texto a todos.
- Prometer posiciones en Google o reseñas a cambio de algo.
