> Adaptado de headcount (cbrock84, MIT): operating-cadence, chief-operating-officer, process-design.

# Tablero operativo y preparación de la revisión semanal

El COO diseña el ritmo operativo; Operaciones lo alimenta. Este documento cubre qué prepara Operaciones cada semana y cada mes, cómo arma el tablero y cómo descompone un proceso en pasos con entradas y salidas verificables.

## Antes de empezar
Busca en la memoria corporativa las métricas definidas por el COO (definición, fuente, dueño), el tablero anterior y las acciones abiertas de la revisión pasada. Pide lo que falte y márcalo FALTANTE. Si una métrica no tiene definición escrita, no la inventes: repórtala como "sin definir" y propón una.

## Tablero
Pocas líneas, cada una con definición, fuente, dueño y fecha del dato:
```
| métrica | definición | fuente | dueño | semana actual | semana anterior | meta o umbral | semáforo | nota |
```
Áreas típicas para una agencia (ajusta a lo que defina el COO):
- **Entregas:** comprometidas contra entregadas a tiempo en la semana; entregas en riesgo.
- **Carga:** trabajo abierto por persona o equipo contra su capacidad (con `workforce`).
- **Calidad:** entregas aceptadas a la primera; defectos que encontró el cliente.
- **Clientes:** solicitudes sin responder fuera del tiempo acordado.
- **Dinero (dato de Finanzas):** facturado y cobrado contra lo esperado; cobranza vencida.
- **Infraestructura:** caídas del servidor de oficina, n8n o servicios nivel 1; respaldos verificados.
Reglas:
- Cada número con su ventana y fuente. Dato que no pudiste obtener: "sin dato", nunca un estimado presentado como real.
- Semáforo por umbral escrito, no por impresión.
- Una métrica que nadie usa para decidir en tres meses se propone para quitarse.

## Paquete de la revisión semanal
Se entrega antes de la junta para que se lea, no se presente:
1. **Fuera de ruta:** qué, desde cuándo, qué lo bloquea, quién puede desbloquearlo, decisión que se necesita.
2. **Acciones de la semana pasada:** hechas con evidencia, abiertas, vencidas.
3. **Cambios del tablero:** solo lo que cruzó un umbral o cambió de tendencia, con la causa si se conoce.
4. **Lo que no se pudo verificar** y por qué.
Nada de estrategia aquí; lo que necesite discusión larga se agenda para la mensual o la trimestral.

## Disparadores de escalamiento inmediato
Si ocurre alguno, no esperes a la junta: avisa al COO con qué pasó, evidencia, impacto y decisión requerida. Los umbrales concretos los fija el COO; mientras no existan, trata como inmediatos:
- Entrega a cliente con fecha comprometida que ya no se sostiene.
- Incidente con datos personales, dinero o cuentas de la empresa.
- Caída de un servicio nivel 1 o falla de respaldos.
- Cliente que manifiesta querer cancelar o reclama formalmente.

## Descomponer un proceso en pasos verificables
Para cada paso:
```
| # | paso | responsable (persona o agente) | entrada (qué recibe y de quién) | salida (qué entrega y a quién) | criterio de "listo para pasar" | evidencia | tiempo esperado |
```
- La salida de un paso es la entrada del siguiente; si no coinciden, ahí se pierde el trabajo.
- "Listo para pasar" es lo que más falta: sin él, el trabajo avanza incompleto y el siguiente lo completa mal o no lo completa, y nadie lo registra.
- La evidencia es algo que se puede revisar (archivo, tarea cerrada, CFDI timbrado, mensaje con aprobación), no "ya quedó".
- Si encuentras esperas largas o retrabajo, pásalo a `process-improvement`; Operaciones documenta y opera, Mejora de procesos rediseña.

## Revisión mensual
Arma la tendencia de cada métrica (no solo el último punto), las variaciones explicadas por su causa con el dueño del número y la lista de acciones vencidas por más de un mes.

## Qué escala
Operaciones prepara, mide y propone. Cambiar responsables, prioridades, umbrales o procesos lo decide el COO o el humano dueño del área.

## Errores comunes
- Métricas sin definición ni fuente.
- Semáforos por ánimo.
- Llenar la semanal de estrategia o la mensual de apagafuegos.
- Pasos con salida que el siguiente no reconoce como su entrada.
- Reportar "sin novedad" cuando en realidad no hubo dato.
