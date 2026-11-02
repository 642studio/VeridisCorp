> Adaptado de headcount (cbrock84, MIT) y claude-skills (alirezarezvani, MIT): observability-and-reliability, slo-architect.

# SLO, alertas y observabilidad

## Antes de empezar
Busca en la memoria corporativa: servicios en operación (642API, apps Node, n8n, PostgreSQL), quién los usa (equipo, clientes), compromisos ya hechos con clientes, herramientas de monitoreo instaladas y el canal de alertas. Pide al menos 30 días de historial del indicador antes de proponer una meta. Lo que falte, márcalo FALTANTE. Tú propones SLI, SLO, alertas y tableros; un humano los aprueba e instala.

## Conceptos
- **SLI**: señal medible de lo que vive el usuario (por ejemplo, proporción de peticiones con respuesta 2xx).
- **SLO**: meta para ese SLI en una ventana (por ejemplo, 99.5% en 28 días).
- **SLA**: compromiso con un cliente, con consecuencias. Documento aparte; el SLO interno siempre más estricto que cualquier SLA, para enterarte antes que el cliente.
- **Presupuesto de error**: 100% menos la meta. Si queda presupuesto, se libera; si se agotó, lo siguiente es trabajo de confiabilidad.

## Elegir el SLI
| Pregunta del usuario | SLI |
|---|---|
| ¿Funcionó? | peticiones exitosas / total |
| ¿Fue rápido? | peticiones bajo el umbral de latencia / total |
| ¿Estaba arriba? | (ventana − caída) / ventana |
| ¿El dato está al día? | registros con antigüedad bajo el umbral / total (útil para sincronizaciones y flujos de n8n) |
| ¿Fue correcto? | resultados correctos / total |
CPU o memoria no son SLI: el sistema puede estar "verde" mientras el usuario sufre.

## Fijar la meta
1. Elige el recorrido a proteger (iniciar sesión, registrar una venta, recibir un webhook).
2. Define numerador y denominador con etiquetas concretas.
3. Mide el historial y no fijes una meta que el sistema nunca ha sostenido.
4. Ventana: 28 días es una buena referencia general; menos de 7 días es ruido, más de 90 retroalimenta tarde.
5. Escribe la política: qué se hace cuando se quema el presupuesto (congelar funciones, priorizar arreglos) y quién lo decide.
Un servidor único en oficina, con su luz e internet, difícilmente sostiene metas muy altas; cuestiona cualquier meta de 99.99% o más.

## Alertas por quema del presupuesto
Cálculo: con 99.9% en 30 días, el presupuesto es 0.1% × 30 × 24 × 60 = 43.2 minutos. La tasa de quema es la fracción de eventos malos observada entre la permitida. Umbrales de referencia general (libro de trabajo de SRE de Google, ventana de 30 días):
- Rápida: 2% del presupuesto en 1 hora (tasa 14.4) → avisar a una persona ya.
- Lenta: 5% en 6 horas (tasa 6) → avisar.
- Sostenida: 10% en 3 días (tasa 1) → tarea, no aviso urgente.
Una sola ventana es demasiado ruidosa o demasiado lenta; usa varias.

## Alertar por síntomas
Alerta cuando el usuario está afectado o lo estará pronto: peticiones fallando o lentas, flujos sin ejecutar, respaldo que no corrió, certificado por vencer. Cada alerta debe ser accionable, urgente y específica; si la respuesta honesta es "la veo y la cierro", bórrala. La fatiga de alertas es el riesgo real: pocas y buenas.

## Logs, métricas y trazas
- Logs estructurados (JSON) con: id de petición, usuario o cliente, versión, dependencia, resultado y duración. El texto libre no se puede buscar.
- Un id de correlación que viaje por app → n8n → base de datos.
- Mide percentiles (p95, p99), no promedios: el promedio esconde a los afectados.
- Prefiere instrumentación abierta (OpenTelemetry) para no quedar atado a un proveedor.
- Nunca registres contraseñas, tokens ni datos personales completos.

## Qué entregar
Por servicio: SLI con fórmula, meta, ventana, presupuesto en minutos, reglas de alerta con umbrales y destino, política de presupuesto, dueño y fecha de revisión. Revisión trimestral: si nunca se quemó, endurece; si se quema siempre, arregla el sistema o ajusta la meta.

## Errores comunes
- Copiar 99.9% a todo sin medir.
- SLO sin dueño ni política.
- Meta interna igual al SLA prometido.
- Avisar a una persona por algo que no puede atender.
- Reportar confiabilidad con promedios.
