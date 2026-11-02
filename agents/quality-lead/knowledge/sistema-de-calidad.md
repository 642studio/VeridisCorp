> Adaptado de headcount (cbrock84, MIT): quality-management.

# Sistema de calidad para una agencia

Inspeccionar al final separa lo bueno de lo malo; nunca hace nada bueno. La calidad la decide el proceso que produjo el trabajo, y ahí va el esfuerzo. Para una agencia pequeña, el sistema es: criterios de aceptación escritos, controles lo más cerca posible de donde nace el error, registro de no conformidades y acciones correctivas que se cierran con evidencia.

## Antes de empezar
Busca en la memoria corporativa la ficha de marca del cliente, el encargo, los estándares internos y las quejas o devoluciones anteriores. Pide lo que falte y márcalo FALTANTE. Sin criterios de aceptación acordados no hay forma de dictaminar; lo primero es escribirlos.

## Calidad como la vive el cliente
Un estándar que nadie fuera del equipo reconoce es una preferencia. Exprésalo en términos que el cliente aceptaría: correcto, a tiempo, completo, usable, con un umbral para que cumplir sea un hecho y no una opinión. Separa:
- **Cumple la especificación:** ¿coincide con lo pedido?
- **Sirve para su propósito:** ¿lo pedido resuelve la necesidad real?
Se puede cumplir la especificación al 100% y entregar algo que nadie quiere; solo la segunda pregunta protege de eso.

## Criterios de aceptación
Por cada tipo de entregable, una lista corta de criterios verificables y quién los verifica. Ejemplos de lo que deben cubrir:
- **Contenido y campañas:** objetivo y KPI, marca correcta, afirmaciones con prueba, ortografía, formato y medidas por plataforma (detalle en el checklist de `marketing-review`).
- **Video y foto:** duración y formato pedidos, audio limpio, subtítulos correctos, música e imágenes con licencia, permisos de personas que aparecen.
- **Software (642APP/642API):** pruebas que pasan, criterios del requerimiento cumplidos, migraciones reversibles, sin credenciales en el código (detalle con `software-qa`).
- **Automatizaciones n8n/Make:** caso feliz y casos de error probados, qué pasa si un servicio no responde, sin datos personales en los registros.
- **Documentos para cliente:** datos fiscales y cifras verificados contra la fuente.
Marca cuáles son **bloqueantes**: si falla uno, no se entrega.

## Atrapar el error donde es barato
El costo de corregir sube con la distancia al punto donde nació. Orden de preferencia:
1. **Prevenir:** que el error sea imposible (plantillas, campos obligatorios, valores por defecto, formatos bloqueados).
2. **Detectar en origen:** quien hace el trabajo lo ve de inmediato (checklist propio antes de entregar).
3. **Detectar en el siguiente paso:** revisión independiente (`review`, revisores de área). Más lenta y con retrabajo.
4. **Detectar en el cliente:** la opción más cara; cuesta además confianza.
Cada control que mueves un paso antes vale más que uno extra al final.

## Métricas que no se corrompen
- Mide a nivel proceso, no persona: una meta individual se cumple reclasificando defectos en vez de evitarlos.
- Mira tendencias, no puntos sueltos, y acompaña cada tasa con su volumen para que "mejorar haciendo menos" se note.
- La medida honesta son los **defectos que encontró el cliente** (cambios por error nuestro, devoluciones, quejas). Lo demás es aproximación.
- Útiles para empezar: entregas aceptadas a la primera, rondas de corrección por error propio contra rondas por cambio del cliente, defectos que llegaron al cliente por mes.

## Cómo coordina Calidad
- Asigna la revisión a un revisor distinto del autor y con capacidad de revisión.
- Resuelve diferencias entre revisores de área con los criterios escritos, no por jerarquía.
- Prioriza los defectos que impiden cumplir el objetivo del encargo.
- Lleva el registro de no conformidades (ver `no-conformidades-y-acciones.md`).
- Reporta al CEO tendencias y acciones vencidas, no cada defecto.

## Qué escala
Calidad dictamina contra criterios y propone. Entregar al cliente con un defecto conocido, cambiar un estándar o aceptar una excepción lo decide un humano responsable, por escrito.

## Errores comunes
- Revisar sin criterios escritos y dictaminar por gusto.
- Agregar una inspección en vez de arreglar el proceso que produce el defecto.
- Metas de calidad por persona.
- Confundir "cumple lo pedido" con "sirve".
- Medir solo lo que encuentra la revisión interna e ignorar lo que encuentra el cliente.
