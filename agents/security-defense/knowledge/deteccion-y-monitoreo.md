> Adaptado de headcount (cbrock84, MIT): detection-and-monitoring.

# Detección y monitoreo

La respuesta a incidentes supone que alguien se dio cuenta. El daño se acumula entre el compromiso y el descubrimiento; este documento sirve para acortar ese hueco. El puesto diseña y evalúa la cobertura y propone cambios; un humano los configura.

## Antes de empezar

Busca en la memoria corporativa y pide lo que falte, marcándolo FALTANTE:
- Qué registros existen hoy, dónde viven y cuánto tiempo se guardan.
- Quién recibe las alertas, por qué canal y en qué horario.
- Qué servicios están expuestos a internet (puertos publicados en el router, dominios, webhooks de n8n).
- Si los registros salen del equipo que los produce.

## Qué registrar: piensa en la investigación

Trabaja hacia atrás desde las preguntas de una investigación: quién se autenticó, desde dónde y qué hizo después.
- **Identidad:** inicios de sesión correctos y fallidos (SSH, app, PostgreSQL, n8n, Google), cambios de 2FA, permisos otorgados, llaves y tokens nuevos, consentimientos OAuth a aplicaciones.
- **Procesos en el servidor:** qué corrió, quién lo lanzó, a dónde se conectó; usuarios, cron y llaves SSH nuevas.
- **Acciones administrativas** donde viven los datos: cambios de permisos y de compartición (Drive, base de datos, n8n).
- **Agentes:** cada llamada a herramienta con el agente, el expediente y el contexto que la disparó; conexiones MCP nuevas o herramientas activadas; memorias escritas sin confirmar.
- **Red:** salidas hacia fuera y DNS donde se pueda; es barato e informativo.

**La retención decide si se puede investigar.** Las intrusiones suelen descubrirse meses después; treinta días no contestan nada útil. Separa una ventana corta de búsqueda rápida y un archivo largo que todavía se pueda consultar. Los plazos concretos los aprueba el CISO.

Nunca registres secretos, tokens ni contraseñas; tapa datos personales que no se necesiten.

## Centralizar y hacerlo difícil de borrar

Un registro que solo vive en el equipo que describe lo controla el atacante. Envíalo fuera conforme se escribe, a un destino con credenciales distintas a las del sistema que lo produce; si no, una sola cuenta de administrador comprometida borra la intrusión y su evidencia.

## Detectar comportamientos, no eventos

Un evento aislado casi nunca es incidente; un atacante deja una secuencia (inicio de sesión desde un lugar nuevo, luego una regla de reenvío de correo, luego descarga masiva).
- Parte de las técnicas que aplican a esta empresa, no del número de reglas de un producto.
- Detecta los pasos que el atacante no puede saltarse: persistencia, escalada de privilegios, acceso a credenciales y extracción.
- Detecciones de alta señal y bajo costo: reglas de correo que reenvían o borran hacia fuera, registros o monitoreo desactivados, acceso administrativo desde ubicación imposible, acceso masivo a archivos por una sola identidad, intentos de fuerza bruta contra SSH o PostgreSQL expuestos, un agente que pide herramientas fuera de su catálogo o repite llamadas rechazadas.

Cada detección necesita una respuesta documentada: qué revisar, a quién avisar, qué contención proponer. Una alerta sin siguiente paso se vuelve ruido a la segunda vez.

## Afinar sin piedad

Una alerta que casi siempre es falsa entrena a la gente a cerrarla sin leer, y la verdadera se cierra igual. Mide qué proporción de alertas lleva a una acción; si está consistentemente por debajo de la mitad (como referencia general), se reduce o suprime la regla, no se agrega gente. Pocas detecciones confiables valen más que mucha cobertura que nadie cree.

## Quién vigila y cuándo

El horario de cobertura es una decisión explícita. Si solo se vigila en horario de oficina, una intrusión del viernes en la noche corre todo el fin de semana. Si no hay cobertura continua, dilo y elige unas pocas detecciones que sí avisen a una persona a cualquier hora. Un proveedor externo puede escalar, pero alguien interno tiene que estar localizable y autorizado para desconectar.

## Probar que de verdad dispara

La cobertura se supone más de lo que se comprueba. Con autorización y en un entorno controlado, reproduce una versión inofensiva del comportamiento y confirma que la alerta llega, a una persona, con contexto suficiente para actuar. Cobertura leída en una pantalla de configuración no es cobertura.

## Qué entregar

Matriz de cobertura: comportamiento | fuente de registro | detección | probada (sí/no, fecha) | respuesta | dueño. Lista de huecos priorizada y propuestas de ajuste con su razón.

## Errores comunes

- Retener registros menos tiempo del que tarda en descubrirse una intrusión.
- Guardar la única copia en el sistema que describe.
- Publicar una detección sin respuesta definida.
- Declarar cobertura de algo que nadie probó de punta a punta.
- Tratar el silencio de las alertas como prueba de que no pasa nada.
