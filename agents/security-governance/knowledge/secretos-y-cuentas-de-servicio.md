> Adaptado de claude-skills (alirezarezvani, MIT) y headcount (cbrock84, MIT): env-secrets-manager, access-and-identity.

# Secretos y cuentas de servicio

Las credenciales de máquina suelen ser más numerosas y menos gobernadas que las humanas: llaves de API de proveedores de modelos, tokens de Google, contraseñas de PostgreSQL, credenciales de n8n, llaves de cifrado y tokens de conexiones MCP. El puesto revisa y propone; no genera, rota ni revoca credenciales. Nunca escribas un valor de secreto en una entrega, memoria o registro: nómbralo por su variable.

## Antes de empezar

Busca en la memoria corporativa y pide lo que falte, marcándolo FALTANTE:
- Inventario de secretos por nombre (no por valor): sistema, para qué sirve, alcance, dueño humano, fecha de creación y de última rotación, quién o qué lo consume.
- Dónde viven: `.env` locales, variables del servidor, credenciales de n8n, base de datos cifrada.
- Si hay escaneo de secretos antes de commit o en la integración continua.

## Reglas para cada cuenta de servicio y secreto

- **Dueño humano con nombre.** Sin dueño, nadie lo rota ni lo da de baja.
- **Alcance mínimo** a su uso real; una llave por servicio y por entorno, nunca compartida entre sistemas.
- **Ruta de rotación** documentada y probada por alguien, y fecha de expiración o de revisión.
- **Preferir credenciales de vida corta** emitidas automáticamente sobre llaves eternas. Una llave que nunca expira terminará en un repo, un registro o un ticket.
- Cuentas de base de datos separadas por uso (aplicación, lectura para reportes o agentes, administración); la de la aplicación no es superusuario.

## Archivos `.env`

- `.env` reales fuera del control de versiones (en `.gitignore`); solo `.env.example` versionado, con nombres y valores falsos. Un valor real en `.env.example` es un hallazgo.
- Nunca imprimir secretos en consola, registros, mensajes de error, salidas de compilación ni prompts de agentes, ni siquiera para depurar o durante un incidente.
- Cuando la operación crezca, un gestor de secretos dedicado debe ser la fuente de verdad en producción; proponerlo cuando el número de secretos o personas ya no se controle a mano.
- Las credenciales de la integración continua se rotan igual que las de la aplicación y no se exponen a ramas o forks no confiables.

## Rotación programada

1. Generar la credencial nueva.
2. Desplegarla en todos los consumidores.
3. Verificar que cada consumidor se autentica con ella.
4. Revocar la anterior solo cuando todos funcionan.
5. Registrar fecha de rotación y la siguiente.

Un error típico es rotar en un sistema y olvidar otro que la usaba (un flujo de n8n, un cron, otra app). Por eso el inventario lleva consumidores.

## Secreto filtrado (rotación de emergencia)

Si un secreto llega a un remoto, se da por comprometido: borrar la línea o reescribir el historial no basta.
1. Revocar de inmediato en el proveedor (propuesta urgente a un humano autorizado).
2. Generar y desplegar la nueva a todos los consumidores.
3. Revisar el uso de la credencial durante la ventana de exposición.
4. Buscar el valor en el historial de git, registros de compilación y artefactos.
5. Abrir incidente con Defensa y respuesta a incidentes: alcance, línea de tiempo, remediación.
6. Endurecer la detección para que no se repita.

Una sospecha de fuga no se trata como baja prioridad mientras no se descarte.

## Escaneo y alertas

Escaneo de secretos antes de commit y en la integración continua: es la automatización de mayor valor por esfuerzo (p. ej. gitleaks). Las excepciones por falso positivo se versionan y se revisan en cada auditoría; prefiere afinar el patrón a ignorar archivos completos. Propón alertas por uso de una credencial desde origen desconocido, lecturas masivas de secretos y uso fuera de las ventanas esperadas.

## Qué entregar

Tabla: secreto (nombre) | sistema | alcance | dueño | consumidores | última rotación | expira | hallazgo | acción propuesta. Lista aparte de secretos sin dueño, sin rotación o expuestos.

## Errores comunes

- Copiar el valor de un secreto en el informe "para referencia".
- Revocar la credencial vieja antes de confirmar a todos los consumidores.
- Dar por resuelto un secreto filtrado con solo borrarlo del repo.
- Cuentas de servicio con privilegios de administrador por comodidad.
