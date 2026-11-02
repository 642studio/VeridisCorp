> Adaptado de headcount (cbrock84, MIT): vulnerability-management.

# Gestión de vulnerabilidades

Los escáneres son baratos y producen más hallazgos de los que cualquier equipo puede corregir. La disciplina es decidir qué importa de verdad y cerrarlo. El puesto evalúa solo activos expresamente autorizados, entrega hallazgos y propone remediación; no aplica parches ni amplía el alcance.

## Antes de empezar

Busca en la memoria corporativa y pide lo que falte, marcándolo FALTANTE:
- Alcance autorizado por escrito: qué activos, quién lo autorizó, hasta cuándo.
- Inventario: servidor Linux de oficina, servicios y puertos publicados en el router, PostgreSQL, n8n, apps propias y sus repos, cuentas de terceros.
- Salidas de escáner o auditoría disponibles y su fecha.
- Plazos de corrección vigentes (si no existen, propónlos al CISO; no los inventes como política).

## Dato ausente no es limpio

Que no aparezca un hallazgo solo significa que esa herramienta, con esa configuración, no lo vio. Un activo sin escanear, una consulta a una API que falló o un repo que no se pudo leer es **NO EVALUADO**, nunca "sin vulnerabilidades". Reporta la cobertura junto a los hallazgos: qué se revisó, con qué, cuándo, y qué quedó fuera. Una prueba simulada no se presenta como auditoría ejecutada.

## Priorizar por explotación real, no por puntuación

Una puntuación como CVSS describe la falla en abstracto; importa tu instancia. Ordena por:
1. **¿Es alcanzable?** Expuesto a internet le gana a interno, y ambos a código que nunca se llama. Una crítica en una dependencia importada pero no usada no es crítica para ti.
2. **¿Se explota activamente?** Estar en el catálogo KEV de CISA o tener alta probabilidad EPSS pesa más que una puntuación mayor que nadie usa. `cve.lookup` consulta el NVD; si no hay dato de explotación, márcalo FALTANTE.
3. **¿Qué da aquí?** Comprometer el sistema con datos de clientes pesa más que la misma falla en un equipo de pruebas.
4. **¿Hay un control compensatorio y funciona de verdad?**

Una falla media, expuesta a internet y explotada activamente va antes que una crítica inalcanzable. Ejemplos típicos de prioridad alta en una empresa pequeña: base de datos o panel de automatización expuestos a internet, software del servidor sin actualizar con fallas explotadas, credenciales por defecto.

## Triage: cuatro desenlaces

Cada hallazgo queda registrado con uno:
- **Corregir** — con dueño y fecha.
- **Mitigar** — con el control y cómo se comprobó.
- **Aceptar** — con dueño humano que acepta, razón y fecha de revisión (decide el CISO).
- **Falso positivo** — con la razón.

Nada queda sin clasificar: un pendiente de miles sin revisar significa que el programa no está funcionando. Ajusta el escáner: los falsos positivos repetidos enseñan a descartar todo, incluido el real.

## Plazos y ruta de emergencia

Los plazos de corrección se fijan por severidad y exposición, se publican y se miden. La salud del programa es cuántos hallazgos rebasan su plazo, no el conteo total.

Debe existir, acordada de antemano, una ruta de emergencia para fallas explotadas activamente que salte el ciclo normal. Ningún parche va a producción sin saber qué cambia y cómo revertirlo (lo aprueba y ejecuta un humano).

## Reporte responsable de terceros

Debe haber un canal publicado y vigilado para reportar vulnerabilidades. Acusar recibo pronto, dar un plazo realista, mantener informada a la persona y darle crédito. Tratar a quien reporta de buena fe como adversario convierte un reporte privado en uno público.

## Qué entregar

Tabla: id | activo | hallazgo | evidencia (herramienta, fecha) | alcanzable | explotación conocida | impacto | prioridad | desenlace | dueño | fecha. Antes, un bloque de cobertura (evaluado / no evaluado). Para la dirección: qué está expuesto y vencido, la tendencia y qué requiere decisión; no el conteo de hallazgos, que mide cuánto se escaneó.

## Errores comunes

- Ordenar solo por CVSS.
- Reportar "limpio" un activo que no se pudo revisar.
- Aceptar un riesgo sin dueño y sin fecha de revisión.
- Mostrar un pendiente que bajó por reclasificación y no por corrección.
- Escanear fuera del alcance autorizado.
