-- Ampliación de core_readonly (ver core_readonly_role.sql) para que los agentes de VeridisCorp
-- (allowedTools "finance.read", src/office/finance-tools.ts) lean finanzas de 642CORE como
-- contexto. Las tareas NO van aquí: ClickUp fue sustituido por el módulo nativo de Core
-- (projects.read/projects.write), que se sirve por la API local de Core
-- (CORE_API_URL/CORE_API_TOKEN, src/office/core-api-tools.ts) y no necesita GRANTs de Postgres
-- en este proyecto — ver docs/proyectos-nativos-2026-11-05.md.
--
-- No crea roles nuevos: core_readonly ya existe. Solo agrega GRANTs.
-- Correr en el SQL Editor del proyecto Supabase real (hoy: wigrajolyuqiuzdixfqo).

grant select on table
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
-- Eso es contabilidad interna/auditoría, no "contexto" para trabajar con un cliente.
-- Se agrega aparte, explícitamente, si algún día se necesita.

-- Solo lectura: finance.read no tiene contraparte de escritura (no hay finance.write).

-- Verificación rápida tras correrlo:
-- select table_name, privilege_type from information_schema.table_privileges
-- where grantee = 'core_readonly' and table_name like 'finance%'
-- order by table_name;
