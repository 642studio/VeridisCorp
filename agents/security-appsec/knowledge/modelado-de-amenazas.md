> Adaptado de headcount (cbrock84, MIT) y agent-skills (addyosmani, MIT, vía agentic-awesome-skills): threat-modeling, security-and-hardening.

# Modelado de amenazas en revisiones de diseño

Hecho en diseño es barato y cambia el diseño; hecho después del lanzamiento produce una lista de arreglos caros. El momento es casi todo el valor. Úsalo cuando un cambio toca autenticación, permisos, datos personales, pagos, entradas externas, herramientas de agentes o conexiones MCP.

## Antes de empezar

Busca en la memoria corporativa y en el repositorio (con `repo.read` si está declarado) y pide lo que falte, marcándolo FALTANTE:
- Qué se va a construir o cambiar, y qué se entregó realmente (no solo lo diseñado).
- Componentes, datos que se mueven entre ellos y dónde se guardan.
- Quiénes lo usan, con qué roles, y qué terceros intervienen (Google, proveedores de modelos, servidores MCP, n8n).

## Las cuatro preguntas, en orden

**1. ¿Qué estamos construyendo?** Un diagrama del flujo real de datos: componentes, datos y almacenes. Si nadie puede dibujarlo, ese es el primer hallazgo.

Marca las **fronteras de confianza**: cada punto donde un dato pasa de algo que controlamos a algo que no, o de un nivel de privilegio a otro. En VeridisCorp son típicas: petición HTTP → API Express; API → PostgreSQL; webhook público → n8n; agente → herramienta; servidor MCP externo → contexto del agente; página web o correo leído → prompt; **salida del modelo → código que actúa**. Casi toda vulnerabilidad real vive en una frontera.

**2. ¿Qué puede salir mal?** Recorre cada frontera y cada activo con STRIDE:

| Letra | Pregunta | Control típico |
|---|---|---|
| Suplantación | ¿Alguien puede hacerse pasar por otro usuario, servicio o agente? | Autenticación fuerte, sesión del servidor, nunca la identidad que escriba un LLM |
| Manipulación | ¿Se pueden alterar datos en tránsito, en reposo o en el cliente? | TLS, validación en el servidor, integridad |
| Repudio | ¿Alguien puede negar una acción y no podríamos demostrarla? | Bitácora de eventos de seguridad con actor y hora |
| Divulgación | ¿Qué se filtra a otros usuarios, registros, mensajes de error, el bundle del cliente o el prompt? | Listas de campos permitidos, errores genéricos |
| Denegación de servicio | ¿Qué no tiene límite? Subidas, consultas, reintentos, bucles de agente, tokens | Topes de tamaño, tasa, tiempo y presupuesto |
| Elevación de privilegios | ¿Un usuario o agente llega a datos o acciones de otro rol o cuenta? | Autorización por objeto, mínimo privilegio |

Dos preguntas que encuentran más fallas reales que la lista clásica: **¿qué valida el cliente que el servidor no valida?** y **¿qué pasa en el segundo intento?** (repetición, carrera, doble envío, reanudar un expediente).

Junto a cada caso de uso escribe su caso de abuso: "¿cómo usaría mal esto?". Ese es el primer caso de verificación.

**3. ¿Qué vamos a hacer?** Para cada amenaza realista: mitigar, transferir, evitar o aceptar. Aceptar es legítimo; aceptar en silencio no. Toda aceptación va al CISO con dueño y fecha de revisión.

Prioriza por esfuerzo del atacante contra impacto, no por lo alarmante que suene: una falla trivial de aislamiento entre clientes le gana siempre a un ataque teórico de tiempos.

**4. ¿Lo hicimos bien?** Vuelve a revisar el modelo cuando cambie el diseño. Un modelo que describe la arquitectura del trimestre pasado es peor que ninguno: da falsa confianza.

## Alcance

Modela por funcionalidad o por frontera, no el sistema completo: uno total es demasiado grande para terminarlo y demasiado vago para actuar. Ponle tiempo límite; una hora sobre una funcionalidad concreta vale más que una semana de documento que nadie lee.

## Qué entregar

1. Diagrama o lista de componentes y fronteras de confianza.
2. Tabla de amenazas: frontera | STRIDE | escenario concreto | impacto | esfuerzo | decisión | control propuesto.
3. Casos de abuso convertidos en casos de verificación.
4. Riesgos que se proponen aceptar, para decisión del CISO.
5. Supuestos y FALTANTES.

## Errores comunes

- Modelar el sistema como se diseñó y no como se construyó.
- Suponer que el tráfico interno es confiable; eso convierte un servicio comprometido en un incidente.
- Aceptar "el framework (o Drizzle) se encarga" sin comprobar que está configurado para hacerlo.
- Tratar la salida del modelo como texto inofensivo: puede ser SQL, HTML o un comando.
- No poder nombrar las fronteras y aun así proponer controles: son adivinanzas.
