> Adaptado de headcount (cbrock84, MIT), claude-skills (alirezarezvani, MIT) y n8n-skills (czlonkowski, MIT): release-and-deployment, slo-architect, n8n-self-hosting.

# Despliegues seguros con plan de reversa

## Antes de empezar
Busca en la memoria corporativa: servicios del servidor de oficina (apps Node, 642API, n8n, PostgreSQL), cómo se despliega hoy cada uno, versiones en producción, último respaldo verificado y quién aprueba. Pide lo que falte y márcalo FALTANTE. Nunca pongas IPs, contraseñas ni contenido de `.env` en el plan: se citan por nombre de variable.

Tú preparas el plan, los comandos propuestos y los criterios; un humano aprueba y ejecuta. En tu entrega separa "propuesto" de "ejecutado y comprobado" (con evidencia: salida de comando, captura, registro).

## Principio: lotes chicos
El riesgo de un despliegue crece con el tamaño del lote. Muchos cambios juntos y poco frecuentes hacen imposible saber cuál rompió, y eso lleva a desplegar todavía menos. Propón cambios pequeños y frecuentes.

## Separar desplegar de liberar
Instalar el código y mostrar la función al usuario son actos distintos. Con una bandera (variable de entorno o tabla de configuración) se despliega apagado y se enciende a propósito; revertir es cambiar la bandera, no redesplegar. Cada bandera tiene dueño y fecha de retiro: las banderas olvidadas crean combinaciones que nadie probó.

## La cadena de despliegue es el filtro
- Automatiza lo que va del commit a producción; los pasos manuales se saltan bajo presión.
- Orden de rápido a lento: lint y pruebas unitarias, integración, y al final lo que requiere entorno desplegado.
- Construye una vez y promueve el mismo artefacto: imagen de Docker con etiqueta fija (versión o hash), nunca `latest`. Lo que se probó debe ser lo que se instala.
- Migraciones versionadas y ordenadas (Drizzle u otra), aplicadas por la cadena, no por una persona con un cliente de base de datos.

## Cambios de base de datos: el riesgo asimétrico
El código se revierte; los datos no. Toda migración debe ser compatible hacia atrás y en pasos: agregar lo nuevo, escribir en ambos, migrar datos, cambiar lecturas, y solo al final quitar lo viejo. La app debe tolerar ambas formas durante la transición. Prueba la migración con un volumen parecido al real: lo que es instantáneo en desarrollo puede bloquear una tabla grande. Nunca un cambio que obligue a desplegar app y base al mismo tiempo.

## Plantilla del plan de despliegue
1. **Qué cambia y por qué** — lista de cambios, servicio afectado, versión actual y nueva.
2. **Riesgo** — bajo, medio o alto; ¿hay migración? ¿afecta a clientes, facturación o datos personales?
3. **Prerrequisitos** — respaldo de PostgreSQL reciente y su prueba, copia de `docker-compose.yml` y de la configuración, ventana avisada.
4. **Pasos** — comandos exactos en orden, con quién los ejecuta.
5. **Verificación** — revisión de salud (`/health` o equivalente), prueba manual corta del flujo principal, errores en logs, indicadores del SLO.
6. **Condición de aborto** — umbral definido *antes* de empezar (por ejemplo, tasa de errores o quema del presupuesto de error por encima de lo acordado) y la persona que decide. Con el cambio fresco, el instinto siempre es esperar un poco más.
7. **Reversa** — pasos exactos para volver: etiqueta de imagen anterior, bandera apagada, y si hubo migración, cómo se revierte o por qué no se puede.
8. **Comunicación** — a quién se avisa antes y después.

## Caso n8n
Fija la versión de la imagen y actualiza a propósito, leyendo las notas de versión antes de cada salto. n8n corre migraciones de base al arrancar y solo van hacia adelante: volver a la imagen anterior es seguro solo si no hubo migración; si la hubo, la reversa es imagen anterior *más* restaurar el respaldo tomado antes. Por eso el respaldo va antes de actualizar. Para cambiar una variable de entorno no uses un script que también descarga imágenes: estarías aplicando dos cambios a la vez. La clave de cifrado de n8n nunca se cambia editando `.env`.

## Qué decide el puesto y qué escala
Decides: forma del plan, verificaciones y criterios de aborto propuestos. Escalas a infrastructure-lead: despliegues de riesgo alto, migraciones irreversibles, ventanas que afecten clientes y cualquier cambio en exposición de red (a ciberseguridad).

## Errores comunes
- Reconstruir la imagen por entorno: lo instalado no es lo probado.
- Desplegar sin condición de aborto ni reversa escrita.
- Dar por bueno un despliegue porque el contenedor "está arriba" sin revisar el flujo real.
- Migración destructiva en el mismo paso que el código que la necesita.
- Reportar como hecho algo que solo se propuso.
