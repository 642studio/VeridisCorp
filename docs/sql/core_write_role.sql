-- Rol de escritura acotada para que los agentes de VeridisCorp (allowedTools "core.write",
-- src/office/core-tools.ts) creen notas, solicitudes de contenido y contactos en el CRM de
-- 642CORE — nunca editar ni borrar nada, y nunca tocar clients/client_packages/client_brands.
--
-- Correr esto en el SQL Editor del proyecto Supabase real (hoy: wigrajolyuqiuzdixfqo), nunca
-- con el service_role key en CORE_WRITE_DATABASE_URL. Reemplazar 'CAMBIA_ESTA_CLAVE' por una
-- contraseña generada (openssl rand -base64 24) antes de ejecutar, y pegar la cadena de
-- conexión resultante solo en el .env del servidor de oficina, nunca en el código ni en un chat.
--
-- Rol separado de core_readonly a propósito: si core_write se revoca o rota, core.read sigue
-- funcionando sin tocarlo, y viceversa.

create role core_write with login password 'CAMBIA_ESTA_CLAVE';

grant usage on schema public to core_write;

-- Solo INSERT, nunca UPDATE/DELETE — un agente no puede corregir ni borrar lo que ya escribió.
grant insert on table
  public.client_activity_log,
  public.content_requests,
  public.client_contacts
to core_write;

-- Necesita leer clients (y las tablas de core_readonly) para validar que el cliente existe
-- antes de escribir — src/office/core-tools.ts usa el pool de lectura para eso, no este rol,
-- así que core_write en sí no necesita SELECT en ninguna tabla.

-- BYPASSRLS por la misma razón que core_readonly: una conexión directa sin JWT nunca puede
-- resolver políticas que dependen de auth.uid(); sigue sin poder hacer nada fuera de los tres
-- INSERT de arriba.
alter role core_write bypassrls;

-- Verificación rápida tras correrlo:
-- select table_name, privilege_type from information_schema.table_privileges
-- where grantee = 'core_write';
