> Adaptado de headcount (cbrock84, MIT) y DevOps-Security-Agent-Skills (BagelHole, MIT): business-continuity-and-resilience, disaster-recovery.

# Análisis de impacto, RTO/RPO, plan y simulacros

## Antes de empezar
Busca en la memoria corporativa: procesos del negocio (ventas, facturación CFDI, nómina, atención a clientes, producción y entrega de proyectos, publicación de contenido), sistemas que usa cada uno (642API/642APP, PostgreSQL, n8n, Google Workspace, WhatsApp, servidor de oficina), dueños de proceso, proveedores críticos y resultados de simulacros previos. Lo que falte, márcalo FALTANTE. Tú propones el análisis y el plan; las metas las firma el dueño de cada proceso y las aprueba Adrián.

## Empieza por el impacto, no por los sistemas
Por cada proceso pregunta: qué se rompe después, qué tan rápido y quién lo nota. Trabaja desde la falla que ve el cliente hacia adentro. Un inventario de servidores dice qué tienes, no qué importa.

Para cada proceso crítico define:
- **Interrupción máxima tolerable**: el punto en que el daño ya no se recupera trabajando más después (cliente perdido, factura fuera de plazo, nómina sin pagar). Lo decide el dueño del proceso, no sistemas.
- **RTO**: en cuánto tiempo debe volver.
- **RPO**: cuántos datos, medidos en tiempo, se pueden perder. Un RPO de cero es una decisión de gasto, no de intención.
Un RTO o RPO que no firmó el responsable del proceso es una aspiración.

## Niveles de servicio (orientativos; las cifras las fija el negocio)
| Nivel | Ejemplos posibles | Estrategia típica |
|---|---|---|
| 1 Crítico | Facturación, base de datos del ERP, cobro | Respaldo frecuente + copia lista para levantar en otro equipo |
| 2 Esencial | Flujos de n8n de clientes, API para apps | Respaldo y restauración probada, configuración versionada |
| 3 Estándar | Reportes internos, analítica | Respaldo diario |
| 4 No esencial | Pruebas, documentación | Respaldo y reconstrucción |
Para un servidor único en oficina, la estrategia realista es "respaldar y restaurar" a otro equipo o a la nube; las réplicas activas cuestan más de lo que suele justificarse. Indica el costo (MXN) y el RTO medido de cada opción.

## Riesgo de concentración
La resiliencia falla donde las dependencias se juntan sin que se vea: base de datos, n8n y apps en el mismo equipo; luz e internet de una sola acometida; respaldos en el mismo disco o la misma oficina; una sola persona que sabe restaurar; la cuenta de correo que recibe las alertas en el mismo dominio que falló. Mapea dependencias hasta donde dejan de ser tuyas (proveedor de internet, DNS, PAC de timbrado, proveedor de nube) y verifica si la redundancia es real o solo de contrato.

## Un plan que se pueda seguir mal
Lo leerá alguien estresado a media noche que no lo escribió:
- Roles, no nombres, y quién tiene autoridad para declarar contingencia.
- Las tres primeras acciones en la primera página.
- Qué hacer si fallan los supuestos: el equipo alterno también cayó, la persona clave no contesta, el proveedor no responde.
- Copia fuera de línea del plan y de los contactos (impresa o en otro servicio). El primer paso nunca puede requerir el sistema que se cayó.

## Runbook por sistema
Detección (qué alerta o síntoma), clasificación, pasos de restauración con comandos, verificación de que la app funciona con los datos restaurados, comunicación (a quién y cuándo) y regreso a la operación normal.

## Simulacros: subir el rigor
1. **Recorrido**: leer el plan juntos y encontrar pasos que nadie puede ejecutar.
2. **Mesa**: inyectar un escenario (disco dañado, ransomware, oficina sin luz dos días) y decidir con tiempo limitado.
3. **Real**: restaurar de verdad en otro equipo, con quien lo haría, cronometrado.
Cada simulacro produce hallazgos con dueño y fecha o fue teatro. Repite el escenario que falló, no uno nuevo, para demostrar mejora.

## Qué entregar
Tabla por proceso: dueño, sistemas, dependencias, interrupción máxima, RTO y RPO propuestos (marcados "por firmar"), estrategia, costo estimado, RTO medido en la última prueba y brechas. Además, el runbook y el calendario de simulacros.

## Errores comunes
- Fijar RTO sin que el dueño acepte lo que cuesta.
- Contar un plan como probado porque se revisó.
- Tratar un respaldo como continuidad: un respaldo sin restaurar es una suposición.
- Plan guardado solo dentro del sistema que falla.
- Ignorar procesos fuera de sistemas (quién cobra, quién avisa al cliente).
