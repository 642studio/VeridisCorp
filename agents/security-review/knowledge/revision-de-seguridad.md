> Adaptado de headcount (cbrock84, MIT), agent-skills (addyosmani, MIT, vía agentic-awesome-skills) y agentic-awesome-skills (sickn33, CC BY 4.0): security-architecture-review, code-review-and-quality, security-and-hardening, api-security-best-practices.

# Revisión de seguridad: qué revisar y cuándo rechazar

El puesto revisa diseños, cambios y hallazgos de los demás puestos de ciberseguridad. Acepta o devuelve con observaciones; no corrige el trabajo ajeno ni aprueba lo que no pudo comprobar.

## Antes de empezar

Busca en la memoria corporativa y en el expediente y pide lo que falte, marcándolo FALTANTE:
- Qué se revisa exactamente: el cambio real (diff, commit, configuración), no solo el diagrama.
- Alcance autorizado y quién lo autorizó.
- Evidencia entregada: salidas de herramientas, comandos, registros, pruebas. Sin evidencia no hay aceptación.

## Orden de revisión

Revisar en este orden encuentra primero lo más grave:
1. **Autenticación.** Cómo se establece la identidad, cómo se representa y expira la sesión, qué pasa al restablecer contraseña y recuperar cuenta (la ruta más débil y menos revisada). Tokens con algoritmo fijo, emisor y audiencia exactos, expiración corta; nunca leer permisos de un token antes de verificar su firma.
2. **Autorización.** La que más importa y menos se revisa. Para cada endpoint y cada objeto: quién puede y dónde se comprueba. Falla típica: se valida al entrar pero no sobre el objeto, y cualquier usuario autenticado llega a cualquier registro cambiando un id. La condición de dueño debe ir en la propia consulta o mutación. Todo id de la petición lo controla el atacante.
3. **Datos.** Qué se recoge, a dónde va, dónde reposa, quién lo lee. Datos sensibles en registros, errores, analítica, bundle del cliente o prompts: hallazgos de rutina.
4. **Entrada y salida.** Entrada no confiable (incluida la salida de un LLM) que llega a una consulta, plantilla, comando, deserializador, ruta o URL que el servidor descarga. Parametrizar en vez de escapar; validar con lista permitida y esquema; rechazar campos inesperados y tamaños excesivos. Un ORM como Drizzle no autoriza ni vuelve seguro el SQL crudo.
5. **Secretos.** Nunca en código, bundles, registros de compilación ni prompts; con alcance mínimo y ruta de rotación probada.
6. **Dependencias.** Qué entra, cómo se fija la versión, lockfile versionado, revisión de paquetes nuevos.

En un cambio pequeño, enfócate en: endpoints nuevos sin autorización, entradas externas nuevas, cambios de sesión, dependencias nuevas, criptografía, y cualquier cosa que amplíe lo que puede hacer un rol o un agente (`allowedTools`, conexiones MCP, herramientas con efecto real). Lo demás suele rendir poco.

Desconfía de cualquier diff que implemente a mano una comparación, un token o una firma: nunca criptografía propia.

## Revisar un hallazgo de otro puesto

- ¿Tiene ruta de ataque concreta? Un hallazgo sin ataque descrito es una preferencia.
- ¿La severidad sigue la explotación real (alcance, exposición, impacto) y no solo una puntuación?
- ¿La evidencia es de una herramienta o prueba real, o es simulada? Declarar como ejecutado lo simulado es motivo de rechazo.
- ¿El cierre tiene criterio verificable ("se cierra cuando la credencial sale del repo, se rota y el endpoint exige sesión")?
- Silencio de un escáner es cobertura limitada, no prueba de ausencia.

## Cuándo rechazar

Bloquea (Crítico) si hay:
- Endpoint u objeto accesible sin autorización, o acceso entre cuentas o clientes.
- Secreto en código, historial, registros o prompt.
- Entrada no confiable o salida del LLM que llega a SQL, shell, HTML o `eval`.
- Herramienta con efecto real sin aprobación humana fuera del modelo.
- Control prometido sin dueño ni fecha.
- Integración de terceros sin saber qué datos salen ni bajo qué condiciones.
- Evidencia ausente, inventada o que no corresponde al cambio.

No bloquees por estilo ni por "no es como yo lo haría". Si mejora la seguridad y no introduce un riesgo bloqueante, se acepta con observaciones.

## Formato de observaciones

Cada observación con su etiqueta: **Crítico** (bloquea), sin etiqueta (requerido antes de aceptar), **Considerar** (opcional), **Nota** (informativo). Ordena primero seguridad y corrección. Cada hallazgo: ataque concreto, qué gana el atacante, si bloquea, corrección específica y cómo verificarla. Al final, declara cómo revisaste (qué leíste, qué pudiste comprobar y qué no).

## Errores comunes

- Revisar el diagrama en vez del cambio.
- Aceptar "es interno" como frontera de autorización.
- Aceptar "lo arreglo después" sin que quede como riesgo aceptado por el CISO.
- Dar por buena una prueba porque el autor dice que pasó.
- Enterrar un problema real bajo observaciones menores.
