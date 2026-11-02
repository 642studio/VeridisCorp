> Adaptado de headcount (cbrock84, MIT): data-engineering, data-modeling.

# Pipelines y modelado de datos

Los pipelines fallan en silencio. Un servicio caído avisa; un pipeline roto produce números plausibles con los que la gente decide durante una semana. En el stack de 642 Studio un "pipeline" suele ser un flujo de n8n o Make, un script de Node o una consulta programada que mueve datos hacia PostgreSQL.

## Antes de empezar
Busca primero en la memoria corporativa y en el repo; pide lo que falte y márcalo FALTANTE:
- Fuente de cada dato (ERP 642APP, hojas de cálculo, plataformas de anuncios, redes, punto de venta, CFDI) y quién es su dueño.
- Frecuencia de llegada, retraso típico y si la fuente corrige datos hacia atrás.
- Qué decisión o reporte consume el resultado y con qué frescura lo necesita.
- Qué datos personales o fiscales viajan y si hace falta tenerlos.

## Tres capas
1. **Crudo:** copia inmutable de lo recibido, solo se agrega. Permite reprocesar cuando la lógica resulte equivocada, sin volver a pedir a una fuente que quizá ya no lo tiene.
2. **Preparado (staging):** tipos consistentes, nombres estandarizados, sin duplicados, fechas con zona horaria. Sin lógica de negocio todavía.
3. **Marts:** tablas o vistas para las preguntas del negocio (ventas por sucursal y día, rentabilidad por proyecto).
La lógica de negocio vive en la capa 3, visible y con pruebas. La excepción es la privacidad: lo que no se debe guardar (contraseñas, tokens, datos personales innecesarios) se quita al ingerir, porque la obligación aplica desde el crudo. Retención y borrado aplican desde la ingesta; plazos según la LFPDPPP y las obligaciones fiscales vigentes: verificar con el abogado y el contador.

## Idempotencia
Todo pipeline se vuelve a correr: tras una falla, una corrección o un dato tardío. Un re-proceso que duplica es peor que una falla, porque da una cifra equivocada sin avisar.
- Llaves deterministas (folio, UUID del CFDI, id de la plataforma) y `INSERT ... ON CONFLICT` en lugar de agregar a ciegas.
- Sobrescritura por partición (por día o por mes) en lugar de acumular.
- En n8n, el reintento de un nodo debe ser seguro: misma llave, mismo resultado.

## Datos tardíos, duplicados y desordenados
Decide por pipeline, por escrito: hasta cuándo se acepta un evento tardío, qué pasa con uno que llega después, cómo se identifican duplicados. Distingue **hora del evento** de **hora de proceso** y agrega por la primera: si no, un retraso de entrega mueve las ventas de ayer a hoy. Guarda timestamps con zona (`timestamptz`) y define la zona de negocio (Sonora: America/Hermosillo).

## Grano
Cada tabla declara su grano en una frase: "una fila por línea de venta por día". "Datos de ventas" no es grano. La mayoría de los errores de modelado son de grano y aparecen como multiplicación de filas en un join que infla las sumas. Si un número sale demasiado alto, revisa el grano antes que la lógica. Nunca mezcles granos en una tabla.

## Estructura dimensional
- Hechos (eventos y medidas) angostos y largos; dimensiones (cliente, producto, sucursal, campaña) anchas y cortas.
- Dimensiones conformadas: una sola de clientes para todo. Tablas de clientes por área cuentan distinto al mismo cliente.
- Historia deliberada: si sobrescribes el segmento de un cliente, reasignas el pasado. Decide por atributo si la historia importa y, si sí, guarda versiones con vigente-desde y vigente-hasta.

## Capa de métricas
Define cada métrica una vez, encima de los marts (vista o tabla documentada), y que todos los reportes lean de ahí. Si cada tablero calcula "venta neta" por su cuenta, terminan distintos por un filtro. El diccionario de métricas lo gobierna data-lead.

## Rendimiento en PostgreSQL
Modela para las consultas reales. Pre-agrega lo que se consulta todo el tiempo (vistas materializadas con refresco programado); índices en lo que se filtra (fecha, luego sucursal o cliente); particiona por fecha solo cuando el tamaño lo justifique. Desnormaliza a propósito y escribe por qué.

## Qué entregas
Diagrama o lista de fuentes → crudo → preparado → marts, con grano por tabla, llaves, regla de tardíos y duplicados, frecuencia, dueño y pruebas de datos (ver `calidad-de-datos.md`). SQL o flujo propuesto; lo aplica un humano. Coordina con backend cuando cambie el esquema del ERP y con data-lead en definiciones.

## Errores comunes
- Transformar al ingerir por razones de negocio y tirar el crudo.
- Construir un mart directo sobre el crudo.
- Agregar por hora de proceso.
- Lógica de negocio escondida en un tablero o en un nodo de n8n sin versionar.
