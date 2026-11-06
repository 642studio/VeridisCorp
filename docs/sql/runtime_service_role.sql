-- Ejecutar como administrador LOCAL en veridis_office, después de runtime:db.
-- El password se establece fuera de este archivo. No ejecutar sobre el Supabase de Core.
CREATE ROLE veridis_runtime NOLOGIN;
GRANT CONNECT ON DATABASE veridis_office TO veridis_runtime;
GRANT USAGE ON SCHEMA public, veridis_runtime_v1 TO veridis_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA veridis_runtime_v1 TO veridis_runtime;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA veridis_runtime_v1 TO veridis_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.checkpoints, public.checkpoint_blobs, public.checkpoint_writes TO veridis_runtime;
GRANT SELECT ON public.checkpoint_migrations TO veridis_runtime;
-- Login TOTP debe emitir sesiones/permisos desde el perfil enrolado. No puede editar ni
-- eliminar los existentes ni enrolar nuevas credenciales desde el rol de servicio.
REVOKE UPDATE, DELETE ON veridis_runtime_v1.sessions, veridis_runtime_v1.grants FROM veridis_runtime;
REVOKE INSERT, DELETE ON veridis_runtime_v1.totp_credentials FROM veridis_runtime;
-- Sin CREATE en la base ni en los esquemas. La propiedad sigue siendo de veridis_office.
-- Mantener las migraciones/aprovisionamiento fuera del proceso always-on.
