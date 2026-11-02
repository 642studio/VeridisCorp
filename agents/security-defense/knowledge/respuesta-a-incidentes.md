> Adaptado de headcount (cbrock84, MIT) y claude-skills (alirezarezvani, MIT): incident-response.

# Respuesta a incidentes de seguridad

El puesto analiza, documenta y propone. No aísla equipos, no revoca credenciales ni apaga servicios: entrega la propuesta de contención y un humano autorizado la ejecuta.

## Antes de empezar

Busca en la memoria corporativa y pide lo que falte, marcándolo FALTANTE:
- Quién es el comandante del incidente y quién puede autorizar acciones disruptivas fuera de horario.
- Inventario de activos afectados (servidor Linux de oficina, PostgreSQL, n8n, apps propias, cuentas de Google, conexiones MCP, agentes con herramientas).
- Señal de origen: alerta, registro, reporte de una persona o de un cliente. Hora de detección.
- Si hay datos personales de por medio (clientes, empleados, prospectos).

## Declarar pronto

Debatir una hora si "de verdad es incidente" es el retraso más caro. Declarar y luego bajar la severidad cuesta poco; descubrir tarde que era real cuesta mucho. Ante la duda, declara y clasifica como sospecha.

Un solo comandante: coordina, no hace el trabajo técnico. Quien lleva lo técnico no lleva la comunicación externa.

## Severidades (referencia general; ajustar con el CISO)

| Nivel | Criterio | Respuesta |
|---|---|---|
| SEV1 | Ransomware, extracción de datos confirmada, registros o monitoreo desactivados por alguien, segundo sistema comprometido, agente ejecutando acciones no autorizadas | Avisar de inmediato al CISO y a Adrián |
| SEV2 | Credencial privilegiada comprometida, movimiento lateral, inyección de prompt que llegó a una herramienta, datos personales en una salida | Mismo día, con el CISO |
| SEV3 | Acceso no autorizado sin confirmar, malware contenido, una cuenta sin privilegios | Seguimiento en horas |
| SEV4 | Alerta sin impacto, violación de política sin riesgo para datos | Cola normal |

Para declarar SEV1 busca al menos dos señales independientes. La severidad sube sola si aparece un disparador de un nivel mayor.

## Orden de operaciones

1. **Contener antes de investigar.** Propón cortar el daño: revocar la credencial, deshabilitar la cuenta, desactivar la conexión MCP o la herramienta del agente, bloquear el puerto. Observar al atacante solo por decisión explícita.
2. **Preservar evidencia mientras se contiene.** Antes de reiniciar o apagar: procesos, conexiones abiertas, sesiones, usuarios conectados, hora del sistema. Copiar registros fuera del equipo. Cada evidencia con hash SHA-256, hora, herramienta usada, quién la tomó y quién la ha tenido.
3. **Delimitar alcance.** Qué se accedió, qué salió, desde cuándo y si sigue. El alcance inicial casi siempre está subestimado; busca persistencia (usuarios nuevos, cron, llaves SSH, flujos de n8n nuevos, memorias inyectadas) antes de dar por contenido.
4. **Erradicar y recuperar.** Reconstruir desde una base conocida y limpia; un equipo "limpiado" no se puede probar limpio. Rotar toda credencial que el atacante pudo alcanzar, no solo las que usó.
5. **Vigilar después.** El reingreso es común: monitorea la ruta usada y sus vecinas.

Ninguna acción que cambie el sistema se ejecuta sin aprobación humana registrada.

## Una sola línea de tiempo

Es la fuente única de verdad. Cada entrada: hora con zona (hora de Sonora, UTC−7, o UTC), hecho, fuente, quién lo registró. Separa hecho confirmado, hipótesis y decisión; registra también las decisiones tomadas con incertidumbre y su razón.

Cada actualización dice qué se sabe, qué no se sabe y cuándo llega la siguiente. Nunca especular hacia fuera sobre causa o autor.

## Datos personales y avisos

Si pudo haber datos personales, avisa al CISO de inmediato: el reloj de cualquier obligación corre desde que se descubre, no desde que termina la investigación. La LFPDPPP prevé informar a los titulares cuando una vulneración afecta de forma significativa sus derechos; forma, plazo y autoridad: verificar con abogado. Denunciar ante autoridades lo decide un humano con asesoría legal.

## Cierre y post-mortem sin culpables

No se cierra hasta poder decir cómo entró y que esa ruta está cerrada. El cierre operativo puede llegar antes que el informe final.

Post-mortem centrado en el sistema, no en la persona: cómo pudo detectarse antes, qué hizo lenta la contención, qué faltó, qué lo hizo posible. Cada acción con dueño y fecha; un post-mortem sin cambios comprometidos es teatro.

Entrega: resumen en una línea, severidad, línea de tiempo, evidencia (con hashes), alcance, acciones propuestas con dueño y fecha, y qué falta confirmar.

## Preparación

Simulacro de mesa al menos una vez al año con un escenario realista (p. ej. llave de API filtrada en un repo, o un agente que obedeció texto de una página). Encuentra gratis los huecos: quién autoriza de noche, dónde están las credenciales, a quién se llama.

## Errores comunes

- Reiniciar o reconstruir antes de capturar evidencia.
- Escalar sin descartar falsos positivos (respaldos, cron, escáneres propios); filtrar lo mismo una y otra vez en vez de ajustar la detección.
- Clasificar con una sola alerta.
- Rotar una credencial y olvidar a los demás sistemas que la usan.
- Cerrar por cansancio sin ruta de entrada identificada.
