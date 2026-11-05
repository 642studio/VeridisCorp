-- Rol de solo lectura para que los agentes de VeridisCorp (allowedTools "core.read",
-- src/office/core-tools.ts) consulten el CRM de 642CORE sin poder escribir nada.
--
-- Correr esto en el SQL Editor del proyecto Supabase real (hoy: wigrajolyuqiuzdixfqo), nunca
-- con el service_role key en CORE_DATABASE_URL. Reemplazar 'CAMBIA_ESTA_CLAVE' por una
-- contraseña generada (openssl rand -base64 24) antes de ejecutar, y pegar la cadena de
-- conexión resultante solo en el .env del servidor de oficina, nunca en el código ni en un chat.
--
-- Si el día de mañana el CRM se migra a un Postgres local (self-hosted o el propio de la
-- oficina), este mismo script se vuelve a correr ahí tal cual: lo único que cambia en
-- CORE_DATABASE_URL es el host.

create role core_readonly with login password 'CAMBIA_ESTA_CLAVE';

grant usage on schema public to core_readonly;

grant select on table
  public.clients,
  public.client_contacts,
  public.client_brands,
  public.client_memberships,
  public.client_packages,
  public.client_vmi_states
to core_readonly;

-- Nada de INSERT/UPDATE/DELETE, nada de otras tablas y nada de esquemas (auth, storage, etc.) —
-- si en el futuro core.read necesita otra tabla del CRM, se agrega aquí explícitamente, nunca
-- dando GRANT SELECT ON ALL TABLES IN SCHEMA.

-- Verificación rápida tras correrlo:
-- select table_name from information_schema.table_privileges
-- where grantee = 'core_readonly' and privilege_type = 'SELECT';
