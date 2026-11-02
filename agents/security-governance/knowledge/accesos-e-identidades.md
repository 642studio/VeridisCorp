> Adaptado de headcount (cbrock84, MIT) y claude-skills (alirezarezvani, MIT): access-and-identity, access-lifecycle.

# Accesos e identidades: mínimo privilegio, revisiones y bajas

Los accesos se acumulan: la gente cambia de puesto y conserva lo anterior, los servicios reciben credenciales amplias porque las estrechas eran incómodas, y las cuentas de externos sobreviven a su contrato. El puesto revisa y propone; no concede ni retira accesos. Altas, cambios y bajas se coordinan con RH sobre solicitudes confirmadas.

## Antes de empezar

Busca en la memoria corporativa y pide lo que falte, marcándolo FALTANTE:
- Lista vigente de personas (empleados, freelancers, clientes con acceso) con fecha de alta, puesto y, si aplica, fecha de baja. Fuente: RH.
- Exportación de cuentas por sistema: servidor Linux (usuarios, llaves SSH, sudo), PostgreSQL (roles), n8n, Google Workspace o cuentas de Google, ClickUp, repos, la app propia, cuentas de agentes y conexiones MCP. Guarda la consulta, la hora de extracción y el número de filas: la exportación también es evidencia.
- Dueño de cada sistema (quien responde por los datos).

## Principios

- **Mínimo privilegio, pero práctico.** Un modelo tan restrictivo que obliga a compartir cuentas es peor que uno más holgado que sí se cumple.
- **Por rol, no por persona.** Permisos asignados a individuos no se pueden gobernar.
- **Elevación temporal en vez de permanente.** Nadie necesita ser administrador todo el tiempo porque a veces lo requiere: se pide con razón y expira solo.
- **Separación de funciones** donde la consecuencia es grave: quien pide un pago no lo aprueba; quien escribe un despliegue no lo autoriza solo.
- **Nunca compartir credenciales.** Si dos personas usan la misma, ninguna bitácora dice quién fue.
- **Los agentes también son identidades.** Su catálogo de herramientas y sus conexiones se revisan como cualquier permiso.

## Autenticación

Inicio de sesión único donde se pueda: su valor es que la baja sea una acción y no cuarenta; cada sistema fuera de él es uno donde alguien seguirá entrando tras irse. Segundo factor en todo lo que lo permita, y factores resistentes a phishing (llaves físicas o passkeys) para administradores. El SMS es mejor que nada y es la opción más débil que vale la pena usar.

## Altas, cambios de puesto y bajas

- **Alta:** solo lo del rol, con solicitud confirmada y aprobada por el dueño del sistema.
- **Cambio de puesto:** el que todos hacen mal. Debe ser quitar y volver a otorgar, no sumar.
- **Baja:** el mismo día, en todo, incluidos los sistemas fuera del inicio de sesión único (llaves SSH, roles de base de datos, tokens personales, accesos a cuentas de clientes). Primero se corta, después se concilia. Se prueba con una nueva exportación: un ticket cerrado no demuestra que el acceso ya no existe.

Mantén la lista de todo lo que hay que revocar; la forma más rápida de encontrar sistemas en la sombra es intentar dar de baja a alguien a fondo.

## Revisión periódica de accesos

Por sistema, y la hace el dueño de los datos, no TI. Quien no sabe explicar por qué alguien necesita un acceso lo retira: la carga de la prueba está en conservarlo. La periodicidad y los días de inactividad son política: los propone el puesto y los aprueba el CISO; no se suponen.

La revisión falla si:
1. Una persona dada de baja tiene una cuenta activa, o entró después de su fecha de baja (más grave).
2. Una cuenta privilegiada no corresponde a nadie, o una cuenta de servicio privilegiada no tiene dueño.
3. Una cuenta activa no entró en la revisión.
4. Hay líneas sin decidir, alguien revisó su propio acceso o falta el nombre de quien decidió.
5. Un retiro decidido no se ejecutó en el plazo acordado.

Revisa las cuentas inactivas en una pasada aparte: una cuenta sin uso en meses sobra o es de alguien que ya se fue. Si alguien aprueba todo en segundos, es una señal para preguntar qué revisó, no prueba de mala fe.

## Diagnóstico de desorden de permisos

Busca: permisos a individuos, roles que nadie sabe definir, administración permanente, cuentas de gente que ya se fue, credenciales de servicio sin dueño, sistemas fuera del inicio de sesión único. Cada uno es un arreglo concreto.

## Qué entregar

Tabla por sistema: cuenta | persona o servicio | rol | privilegiada | último uso | hallazgo | acción propuesta | aprobador. Resumen de bloqueos (puntos 1 a 5). Ningún resultado se declara "cumple": el puesto reporta hallazgos y evidencia; la conclusión la da un humano.

## Errores comunes

- Dejar activa una cuenta mientras el trámite de baja avanza.
- Revisar con una exportación incompleta.
- Aprobar tu propia solicitud o revisar un grupo al que perteneces.
- Dar acceso permanente donde uno temporal bastaba.
