> Adaptado de agentic-awesome-skills (sickn33, CC BY 4.0): architecture-decision-records.

# Registro de decisiones de arquitectura (ADR)

Un ADR guarda por qué se decidió algo, no solo qué. Sin él, en seis meses nadie sabe si una restricción es deliberada o un accidente, y la discusión se repite.

## Antes de empezar
Busca primero en la memoria corporativa (decisiones aprobadas y ADR previos) y en `docs/` del repo; pide lo que falte y márcalo FALTANTE:
- El problema o la presión que obliga a decidir, y para cuándo.
- Restricciones reales: presupuesto en MXN, servidor Linux de la oficina, equipo disponible, stack actual, clientes afectados.
- Opciones que ya se consideraron y quién las propuso.
- Quién decide (Adrián u otro responsable humano) y dónde se guarda el registro aprobado (repo, memoria corporativa o ambos).

## Cuándo escribir uno
| Sí | No |
|---|---|
| Adoptar o cambiar framework, base de datos, proveedor de modelos o de hospedaje | Actualizar una versión menor |
| Patrón de API, de autenticación o de integración (n8n, MCP, OAuth) | Corregir un error |
| Arquitectura de seguridad, de datos personales o de respaldos | Detalles de implementación |
| Política de modelos por agente, memoria corporativa, permisos de agentes | Cambios de configuración rutinarios |
| Exponer un servicio del servidor a internet | Mantenimiento |

## Ciclo de vida
Propuesto → Aceptado → Obsoleto o Reemplazado (por ADR-NNNN); o Propuesto → Rechazado. El agente solo redacta en estado **Propuesto**; lo acepta un humano con autoridad para decidir. Un ADR aceptado no se edita: si cambia la decisión, se escribe uno nuevo que lo reemplaza y se enlazan ambos. Los rechazados se conservan: explican por qué no se tomó un camino.

## Plantilla
```
# ADR-NNNN: <decisión en una frase>
Estado: Propuesto   Fecha: AAAA-MM-DD   Decide: <persona>
## Contexto
Qué problema, qué restricciones, qué pasa si no se decide.
## Criterios de decisión
- Debe: <requisitos no negociables>
- Debería: <deseables>
## Opciones consideradas
### Opción A
Ventajas / desventajas (honestas, con evidencia o marcadas como supuesto)
### Opción B ...
### No hacer nada
## Decisión
Elegimos <opción> porque <razón ligada a los criterios>.
## Consecuencias
Positivas / negativas / riesgos y su mitigación.
## Costo y reversibilidad
Costo estimado (MXN, horas), qué tan caro es revertir y cómo.
## Implementación
Tareas, responsables, cómo se verifica. Migración si aplica.
## Relacionados
ADR que complementa, reemplaza o del que depende.
```
Formato corto para decisiones menores: "En el contexto de <situación>, ante <necesidad>, decidimos <opción> y no <alternativas>, para lograr <objetivo>, aceptando <costo>."

## Lista de revisión antes de presentarlo
- [ ] El contexto se entiende sin haber estado en la conversación.
- [ ] Hay al menos dos opciones reales más "no hacer nada".
- [ ] Las desventajas de la opción elegida están escritas, no escondidas.
- [ ] Capacidades de proveedores verificadas en su documentación vigente, no de memoria; lo no verificado dice "supuesto".
- [ ] Implicaciones de seguridad y de datos personales revisadas con ciberseguridad; las de privacidad (LFPDPPP), verificar con el abogado.
- [ ] Costo y reversibilidad documentados.
- [ ] Si hay escritura doble o migración, existe diseño de conciliación y reversa (ver backend).
- [ ] Áreas afectadas consultadas: software, infraestructura, datos, ciberseguridad.

## Índice
Mantén una tabla: número, título, estado, fecha, reemplaza a. Numeración consecutiva de cuatro dígitos; nombres de archivo `NNNN-titulo-con-guiones.md`. Una decisión aceptada que no aparece en el índice se olvida.

## Qué entregas
El ADR en estado Propuesto, la entrada de índice sugerida y las tareas de implementación con responsable. Escalas a Adrián toda decisión que comprometa dinero, datos de clientes, exposición a internet o permisos de agentes. Las cifras de los ejemplos de cualquier plantilla son ficticias: nunca las cites como evidencia.

## Errores comunes
- Escribir el ADR después de implementar: eso es documentación, no decisión.
- Opciones de paja para que gane la preferida.
- Editar un ADR aceptado en lugar de reemplazarlo.
- ADR sin tareas: decisión que nadie ejecuta.
- Más de dos páginas: si no cabe, son varias decisiones.
