# Contexto de Gestión de conocimiento

## Datos confirmados

- Ecosistema: VeridisCorp, de 642 Studio.
- Dirección humana: Adrián Yépiz.
- Departamento: intelligence.
- Reporta a: research-lead.
- Etapa: Arranque; perfil preparado, pendiente de configuración operativa.

## Herramientas habilitadas

`web.search`, `memory.write` y `memory.query` (ver `src/office/tools.ts`). `memory.write` guarda memorias nuevas en estado `proposed` ("sin confirmar"). Desde 2026-10-31 la memoria es automática: `memory.query` y la consulta que el motor hace antes de cada tarea ya las usan, marcadas como sin confirmar, y un humano las confirma o las manda a cuarentena en la pantalla MEMORIA. También puede usar conexiones MCP con `mcp.use`.

## Información por completar

Objetivos, procedimientos, responsables humanos, fuentes y permisos concretos se definirán con Adrián.
