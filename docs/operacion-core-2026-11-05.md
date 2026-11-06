# Operación, reparaciones e integración con Core

Fecha: 2026-11-05. Entorno: servidor 642, Ubuntu, Node 24, PostgreSQL local 16 y el Supabase
compartido de Core. Registro de cambios de esta intervención; no implica que todo conector
declarado por un perfil esté conectado o validado contra su proveedor.

## Rol de cada sistema

Core es la interfaz de operación de 642 Studio: clientes, contactos, solicitudes, proyectos,
marketing y los demás módulos del repositorio. VeridisCorp es la oficina de agentes que consulta,
coordina, revisa y realiza cambios concretos con herramientas permitidas. El título del agente
no concede privilegios. La base compartida evita mantener dos versiones de los clientes.

Se instaló el repositorio solicitado `642studio/642-Core-main` (base `923fdc2`) en
`/home/seis/642-Core-main`. La copia antigua `/home/seis/642-Core`, de otro repositorio, permanece.
El procedimiento completo de Core está en `/home/seis/642-Core-main/docs/SERVER-VERIDISCORP.md`.

## Reparaciones

1. **Login TOTP (`src/runtime/totp.ts`).** El contador y bloqueo se actualizaban dentro de una
   transacción que inmediatamente lanzaba una excepción: el rollback borraba el intento. Ahora
   la transacción confirma el rechazo y el error HTTP se lanza después. Prueba PostgreSQL:
   cinco intentos persistentes, bloqueo del código correcto durante la espera, recuperación
   después del plazo, reinicio de contador y rechazo de un código ya consumido.
2. **Respuesta del asistente (`office-runtime.ts`).** Devuelve `scene` conforme al contrato;
   el campo ya se validaba pero se perdía antes de la respuesta HTTP. Se mantiene el mecanismo
   de persistencia de conversaciones existente; esto no añade escenas históricas al esquema.
3. **Catálogo.** El test HTTP compara con el registro real en vez de exigir 56 agentes. Hoy hay 57.
4. **Knowledge.** Dos documentos propios de video reciben su atribución explícita. La aserción
   de tamaño se alinea con el contrato documentado de 64 KB; no se borró conocimiento para hacer
   pasar el test. El puesto de video carga aproximadamente 49 KB: costo de contexto a considerar.
5. **Secretos.** Backups de `.env` excluidos de git, tanto en Corp como en Core. Los existentes
   se conservan, privados. El cambio previo en `config/models.active.json` se preservó tal cual;
   no forma parte de estas reparaciones ni fue sobrescrito.
6. **Rol de PostgreSQL local.** El proceso usa `veridis_runtime`, no el dueño `veridis_office`.
   Sin superusuario, creación de roles/bases, BYPASSRLS ni CREATE en los esquemas de aplicación.
   Solo DML necesario, sin UPDATE/DELETE en sesiones/grants ni INSERT/DELETE en credenciales TOTP.
   SELECT/INSERT de sesiones y grants sigue siendo necesario para emitir sesiones desde perfiles
   TOTP enrolados; no se afirma que se eliminó toda escritura de autenticación.

`runtime:db` prepara ahora también las tablas de checkpoints con el rol dueño. En el servicio,
`VERIDIS_CHECKPOINT_SETUP_ON_START=false` verifica que existan sin intentar DDL. El aprovisionamiento
local está en `scripts/provision-runtime-role.mjs` y `docs/sql/runtime_service_role.sql`;
es deliberadamente de una sola ejecución y falla ante otra base o un respaldo ya existente.

Para futuras migraciones usar el rol dueño original mediante un archivo de entorno privado
de administración; no ampliar permisos del servicio para permitirle migrar. El respaldo de
configuración anterior es `.env.bak.runtime-role-20261105` (0600). Para revertir solo el rol,
restaurar el DATABASE_URL dueño desde ese respaldo, quitar el flag false y reiniciar; no
sobrescribir las otras variables de integración si se modificaron después.

## Herramientas y permisos de Core

| Permiso de perfil | Herramientas | Agentes actuales |
| --- | --- | --- |
| `core.read` | SQL: listar clientes, ficha, buscar contactos. API: consultar contactos/solicitudes/actividad con IDs y `updated_at` | ceo, cmo, cm, pm, data-analyst |
| `core.write` | SQL: crear nota, contacto o solicitud. API: corregir campos de contacto o solicitud | cm, pm |

`CORE_API_URL=http://127.0.0.1:3100` y `CORE_API_TOKEN` enlazan con el token privado de Core.
La identidad del agente/expediente se entrega como metadata del motor, no como argumentos libres
del modelo. El revisor pierde `core.write` y no repite efectos; los resultados de escritura
observados se conservan en la caché del motor igual que los de MCP/memoria, con el mismo límite
y pérdida tras reinicio. No se presentan como una auditoría durable de herramientas en Corp.
La API de Core registra las nuevas ediciones en el historial durable del cliente.

Las correcciones permitidas son nombre/email/teléfono/rol/notas de un contacto, y título/
descripción/prioridad/fecha de una solicitud. Exigen ID, cliente y `updated_at` de una consulta.
Core rechaza campos desconocidos, agentes no autorizados y versiones obsoletas (409). No se
ampliaron los roles SQL `core_readonly` ni `core_write`. No hay SQL libre, borrados, reasignación
de cliente, cambios de estado de solicitudes, asignados, pagos o publicación por esta API.
Cambiar estados de solicitudes sigue siendo una integración distinta. La continuación del
usuario prioriza vincularlas con las tareas nativas de Core, sustituyendo la dependencia de
ClickUp: ver `proyectos-nativos-2026-11-05.md`.

Los roles SQL existentes tienen BYPASSRLS y grants acotados: representan acceso corporativo a
los clientes de 642; no aislamiento por sesión humana/cliente. No deben reutilizarse para un
portal de clientes o varias empresas externas. La API de servicio tiene el mismo alcance
corporativo y un secreto independiente. Ninguno de estos secretos se incluye en el prompt.

## Despliegue y estado

- Corp: `veridiscorp.service`, `127.0.0.1:7777`; panel `veridis.642.com.mx` protegido por
  Cloudflare Access; API sin Bearer responde 401. Telegram volvió a conectar tras el reinicio.
- Core: `core642.service`, `127.0.0.1:3100`, Caddy `192.168.1.158:8082` con permiso UFW solo LAN.
  HTTPS privado Tailscale `https://642.tailfa0aab.ts.net:8443`. Vaultwarden conserva el 443.
- El Supabase sigue siendo el proyecto compartido existente; no hubo migración de clientes
  ni de sus tablas. Se comprobaron 17 clientes y compatibilidad de los campos de las herramientas.
- Los repositorios `core` y `corp` quedaron declarados en `VERIDIS_REPOS`; los agentes que ya
  tenían `repo.read` pueden revisar código versionado. No se habilitó escritura, shell o deploy
  autónomo de repositorios: son capacidades distintas a editar datos del CRM.
- Los cambios de perfiles y knowledge cambian su fingerprint: expedientes anteriores pueden
  rechazar una reanudación si su checkpoint fue creado con otra configuración. No se alteraron
  ni eliminaron checkpoints para saltar ese control.

## Verificación realizada

- TypeScript de Corp y su panel: aprobado.
- Suite completa Corp en PostgreSQL temporal: **232 aprobadas, cero fallidas/omitidas**.
  Incluye la nueva regresión TOTP, herramientas Core y controles existentes de autorización,
  concurrencia, recuperación y generación PDF real. Un render falló en una ejecución concurrente
  previa; la prueba focal y la suite final pasaron sin cambiar el renderizador. No se atribuyó
  una causa sin evidencia ni se deshabilitó esa prueba.
- Core: build de producción con comprobación TypeScript aprobado; **352 pruebas aprobadas y
  tres omitidas** que requieren fixtures explícitos de Supabase de pruebas. Seis casos nuevos
  cubren token, permisos/campos, versión, carrera y auditoría de la API.
- Verificación real de las herramientas SQL de lectura y del puente HTTP desde Corp a Core.
- INSERT real de una nota en el Supabase compartido dentro de BEGIN/ROLLBACK: una fila aceptada,
  sin nota persistente. Las pruebas de edición de contactos/solicitudes son controladas; no se
  alteró un dato de cliente para probar.
- Core `/signin`: 200 por loopback, LAN y HTTPS Tailscale. Puente sin token: 401. Corp sin sesión: 401.
- Servicio Corp reiniciado con el nuevo rol; permisos CREATE comprobados como falsos y servicios activos.

## Respaldo y límites operativos pendientes

Snapshot previo: `/home/seis/backups/veridiscorp/pre-core-integration-20261105.dump`, formato
custom PostgreSQL, permisos 0600, aproximadamente 26 MB; índice de pg_restore legible.
Es un respaldo inicial local, no una prueba de restauración ni un respaldo externo recurrente.
El job restic existente cubre `/etc` y volúmenes de ops-stack: no se debe suponer que ya cubre
la base local de Corp o estos repositorios. Incorporar dumps coherentes y verificar restauración
es un siguiente trabajo de continuidad.

Gmail/Drive/Calendar de Corp no tienen una cuenta OAuth autorizada en esta base; no hay MCP
registrados. Los flags/credenciales no prueban que cada proveedor esté operativo. Ollama sí
tiene los modelos locales instalados. No se hicieron llamadas pagadas ni se enviaron mensajes
de prueba a terceros.

Los límites de costo siguen siendo estimados: el tope nuevo de oficina es US$1.50 por expediente,
pero no concilia facturación, no garantiza un tope total y la ronda de herramientas/archivista
tiene las limitaciones descritas en `office-architecture.md`. No se anuncian como resueltas.

El chat antiguo de Core todavía usa OpenClaw; este puente conecta datos y herramientas, no
fusiona sesiones o historiales de chat. Sus crons Vercel tampoco se ejecutan automáticamente
en Node. Antes de activarlos aquí hay que definir un ejecutor único, los orígenes públicos de
OAuth/webhooks y los proveedores de cada instalación para evitar duplicar efectos reales.
