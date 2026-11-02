> Adaptado de headcount (cbrock84, MIT) y agentic-awesome-skills (sickn33, CC BY 4.0): onboarding-and-offboarding, hr-pro.

# Altas y bajas: accesos, equipo y conocimiento

Ambos extremos son procesos entre áreas que fallan en las entregas de una a otra. Las fallas son predecibles; se previenen con una lista y un solo dueño.

## Antes de empezar
Busca en la memoria corporativa y pide lo que falte (FALTANTE):
- Persona, puesto, fecha de ingreso o de salida y tipo de salida (renuncia, término de contrato, otra).
- Inventario de accesos por rol, si existe; si no, propón uno con la lista de abajo y márcalo como propuesta.
- Equipo asignado (laptop, cámara, discos, tarjetas de memoria, llaves).
- Quién recibe sus pendientes.

## Inventario de accesos por revisar
Propón por rol y confirma con security-governance (dueño de la política de mínimo privilegio) e infrastructure-lead:
- **Cuenta y correo**: Google Workspace (Gmail, Drive, Calendar, unidades compartidas).
- **Gestión**: ClickUp, Obsidian o bóvedas compartidas, VeridisCorp.
- **Código y servidor**: GitHub u otro repositorio, llaves SSH en el servidor Linux, Tailscale, roles de PostgreSQL, variables de entorno o secretos que conozca.
- **Automatización**: n8n, Make, credenciales guardadas en flujos.
- **Clientes y marcas**: Meta Business Suite, TikTok, cuentas de anuncios, administradores de redes, accesos que el cliente dio a la persona y no a 642.
- **Diseño y producción**: Adobe, Canva, bancos de imágenes y música, licencias por usuario.
- **Comunicación**: grupos de WhatsApp de clientes y del equipo, número de empresa.
- **Contraseñas**: gestor de contraseñas y contraseñas compartidas que conozca (se cambian en la baja).
- **Físico**: llaves, tarjetas, alarma.

## Alta (antes del día 1)
1. Rol definido y lista de accesos del rol aprobada por su jefe.
2. Solicitud a quien da accesos, con mínimo privilegio: lo que el puesto necesita, no "lo mismo que tiene X".
3. Equipo listo y registrado como asignado.
4. Accesos probados por la persona en su primer día; lo que no funcione se anota y se resuelve ese día.
5. Registro: qué se dio, quién lo aprobó, fecha.

Los trámites laborales del alta (contrato firmado, alta en IMSS, datos para nómina, aviso de privacidad para el expediente) los ejecuta el contador o RH con sus plazos; verificar con el contador.

## Baja: conocimiento antes que accesos
Empieza el día en que se avisa la salida, no el día anterior.
1. **Captura de conocimiento** sobre lo que solo está en su cabeza: sistemas que solo esa persona mantiene, relaciones con clientes, decisiones cuyo porqué no está escrito, flujos de n8n que creó. Pregunta directo: "¿Qué se va a romper y quién no va a saber por qué?".
2. **Entrega de pendientes**: lista de tareas, archivos y contactos; la confirma quien recibe, no quien se va.
3. **Reasignar** aprobaciones, propiedad de archivos en Drive, flujos y cuentas a su nombre.
4. **Retiro de accesos** el día de salida, en todos los sistemas, incluidos los que no pasan por Google: redes de clientes, llaves SSH, Tailscale, PostgreSQL, n8n, Make, WhatsApp. Cambiar contraseñas compartidas que conocía.
5. **Devolución de equipo** contra el registro de asignación.
6. **Cierre laboral**: finiquito o el pago que corresponda según el tipo de salida, constancias y baja ante IMSS. Montos, plazos y documentos los calcula y valida el contador; el caso lo revisa el abogado laboral si la salida no es voluntaria.
7. **Entrevista de salida** con preguntas fijas; los temas se agregan por área y jefe. Una salida es anécdota; un patrón en varias es hallazgo para hr.

## Qué entregas
Lista de verificación por persona: tarea | sistema | responsable | fecha | estado | evidencia (captura, confirmación). Un solo dueño humano la ejecuta de punta a punta. Tú preparas y das seguimiento; no das ni quitas accesos.

## Errores comunes
- Cortar accesos antes de capturar el conocimiento.
- Olvidar accesos fuera de Google: llaves SSH, cuentas de clientes, credenciales dentro de n8n.
- Responsabilidad partida entre varias personas: así se quedan cuentas activas.
- Que el cliente siga viendo a la persona como administradora de su página.
- Recopilar entrevistas de salida que nadie lee en conjunto.
