> Adaptado de headcount (cbrock84, MIT), DevOps-Security-Agent-Skills (BagelHole, MIT) y n8n-skills (czlonkowski, MIT): backup-and-recovery, backup-recovery, database-backups, n8n-self-hosting.

# Respaldos y pruebas de restauración

## Antes de empezar
Busca en la memoria corporativa: qué se respalda hoy, con qué herramienta, cada cuánto, dónde queda cada copia, cuánto se conserva, quién tiene las credenciales del destino (solo quién, nunca el valor) y la fecha de la última restauración probada. Si no hay prueba registrada, el estado es "recuperabilidad no acreditada". Lo que falte, márcalo FALTANTE. Tú diseñas y verificas con evidencia; ejecutar, borrar o cambiar destinos lo hace un humano.

## La cobertura falla primero
Los huecos suelen ser cosas que nadie incluyó. Revisa contra el inventario de infraestructura:
- Bases PostgreSQL, incluida cualquiera creada fuera del proceso normal.
- Archivos `.env` y secretos (en un gestor de contraseñas o bóveda, no junto al respaldo en claro), `docker-compose.yml`, configuración del proxy, firewall y systemd.
- n8n: la base de datos **y** `N8N_ENCRYPTION_KEY`; uno sin el otro no sirve. Exportar flujos antes de cambios riesgosos.
- Volúmenes de Docker con datos (archivos subidos, binarios).
- Servicios en la nube (Google Workspace, Drive, redes): el proveedor protege contra *sus* fallas, no contra tu borrado ni un acceso malicioso.
- Laptops con la única copia de algo (material audiovisual, proyectos).
La diferencia entre lo que existe y lo que se respalda es un hallazgo.

## Forma 3-2-1, con una copia inmutable
Tres copias, en dos medios o plataformas, una fuera de la oficina, y al menos una **inmutable o desconectada**. El ransomware busca los respaldos primero con las credenciales que encontró: un destino al que se llega con las mismas credenciales del servidor se cifra junto con él. Usa credenciales de solo escritura o con bloqueo de borrado en el destino, o un disco que se desconecta y se guarda fuera.

## PostgreSQL
- **Lógico (`pg_dump -Fc`)**: formato personalizado comprimido; permite restaurar tablas sueltas. Bueno para bases chicas y medianas. Respaldar también roles y permisos (`pg_dumpall --globals-only`).
- **Físico (`pg_basebackup` + WAL)**: permite recuperar a un punto en el tiempo; necesario si el RPO es menor que la frecuencia del volcado.
- Usuario de respaldo con permisos mínimos; credenciales en archivo protegido, no en el script.
- Cifrar antes de sacar de la oficina (restic u otra herramienta con cifrado); la contraseña del repositorio se guarda aparte. Perderla es perder los respaldos.
- Programar con temporizador de systemd o cron y alertar si el trabajo **no** corrió, no solo si falló.

## Retención
Es decisión de política, no de espacio. Debe cubrir la recuperación operativa, las obligaciones fiscales y legales (conservación de contabilidad y CFDI) y el deber de no guardar datos personales sin finalidad (LFPDPPP vigente). Esas exigencias se contraponen: los plazos los confirma el contador y el abogado. Define antes cómo atender una solicitud de cancelación de datos que toque respaldos. Esquema típico de rotación (diarios, semanales, mensuales) solo como referencia.

## Probar la restauración
Un trabajo "exitoso" solo prueba que se escribió un archivo.
1. Restaura en un entorno separado (contenedor temporal de PostgreSQL), nunca encima de producción.
2. Verifica que la app funcione con esos datos: conteos de tablas clave, últimos registros con fecha esperada, inicio de sesión, un flujo principal.
3. Cronometra: ese tiempo es la única base honesta del RTO, y suele ser mayor que lo supuesto.
4. Registra fecha, respaldo usado, tiempo, resultado y problemas.
Cadencia sugerida: verificación automática semanal del último respaldo y restauración completa del sistema al menos una vez al año (referencia de la fuente). Restaurar un archivo prueba el mecanismo; restaurar el sistema prueba el plan.

## Qué entregar
Matriz: activo, método, frecuencia, destinos (local, fuera, inmutable), cifrado, retención, RPO logrado, última restauración probada y su duración, brechas y dueño. Los estados se marcan "verificado con evidencia" o "supuesto".

## Errores comunes
- Reportar salud por el trabajo exitoso y no por la restauración.
- Respaldo alcanzable con las credenciales de producción.
- Respaldar la base de n8n sin su clave de cifrado.
- Copias solo dentro de la oficina.
- Citar un RTO que nunca se midió.
