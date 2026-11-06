-- Ampliación de core_readonly/core_write (ver core_readonly_role.sql y core_write_role.sql)
-- para que los agentes de VeridisCorp (allowedTools "tasks.read"/"tasks.write"/"finance.read",
-- src/office/task-tools.ts y src/office/finance-tools.ts) lean tareas y datos de finanzas
-- para contexto, y puedan crear tareas y asignarlas a alguien del equipo.
--
-- No crea roles nuevos: core_readonly y core_write ya existen. Solo agrega GRANTs.
-- Correr en el SQL Editor del proyecto Supabase real (hoy: wigrajolyuqiuzdixfqo).

-- --- Lectura (core_readonly): tareas + perfiles + finanzas, solo estas tablas ---
grant select on table
  public.tasks,
  public.task_assignees,
  public.task_templates,
  public.task_template_items,
  public.task_activity,
  public.profiles,
  public.finance_accounts,
  public.finance_contacts,
  public.finance_categories,
  public.finance_subcategories,
  public.finance_transactions,
  public.finance_invoices
to core_readonly;

-- A propósito NO se incluyen: finance_journal_entries, finance_journal_lines,
-- finance_fiscal_overrides, finance_bank_statement_imports,
-- finance_transaction_audit_logs, finance_fixed_assets, finance_plan_*,
-- finance_chart_of_accounts, finance_accounting_periods, finance_copilot_*.
-- Eso es contabilidad interna/auditoría, no "contexto" para trabajar con un cliente o sus
-- tareas. Se agrega aparte, explícitamente, si algún día se necesita.

-- --- Escritura (core_write): crear tareas y asignarlas a alguien ---
grant insert on table
  public.tasks,
  public.task_assignees
to core_write;

-- Insertar en tasks/task_assignees dispara los triggers reales de 642CORE
-- (tasks_activity, task_assignees_activity -> record_task_activity()) que registran el
-- historial en task_activity. Esa función es "security invoker": corre con los permisos de
-- quien hizo el INSERT (core_write), no con los del dueño de la función — por eso hace falta
-- además, aunque core_write nunca lea/escriba estas tablas por su cuenta:
grant select on table public.profiles to core_write;
grant insert on table public.task_activity to core_write;
grant usage, select on sequence public.task_activity_id_seq to core_write;
grant execute on function public.record_task_activity() to core_write;

-- Sin RETURNING en los INSERT de src/office/task-tools.ts, mismo motivo que en
-- core-tools.ts: core_write no tiene (ni necesita) SELECT en tasks/task_assignees, y
-- RETURNING lo exigiría. El id de cada tarea se genera en el código, no en la base.

-- Verificación rápida tras correrlo:
-- select table_name, privilege_type from information_schema.table_privileges
-- where grantee in ('core_readonly', 'core_write')
--   and (table_name like 'task%' or table_name like 'finance%' or table_name = 'profiles')
-- order by grantee, table_name;
