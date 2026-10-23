# VeridisCorp

Esta carpeta contiene el ecosistema empresarial de agentes de 642 Studio. El nombre del ecosistema es **VeridisCorp**; Veridis identifica su motor de coordinación.

- Trabajar desde este directorio para los cambios, instalaciones, comandos y verificaciones del proyecto. La carpeta anterior `veridis-agents/` fue trasladada aquí; no crear otra copia.
- Respetar las instrucciones heredadas del proyecto CODE. Los archivos de `../sources/` son referencias sincronizadas de solo lectura y no forman parte de este repositorio de trabajo.
- Código y contratos en `src/`; configuración en `config/`; documentación de arquitectura en `docs/`; pruebas en `test/`.
- Los perfiles editables viven en `agents/<id>/`: `instructions.md`, `context.md`, `config.json` y `knowledge/`. El índice explícito es `agents/index.json`; no duplicar reglas de puesto dentro del catálogo TypeScript. La lista actual es una base provisional para revisar y completar con Adrián.
- Mantener el organigrama empresarial, las capacidades, las reglas de delegación, la revisión independiente y las políticas de modelos por agente y tarea.
- No cambiar identidades, esquemas persistidos o prefijos de checkpoints solo por el cambio de nombre comercial. Las migraciones deben ser explícitas.
- Guardar las credenciales en el entorno, nunca en archivos de configuración públicos ni checkpoints.
- Documentar con claridad qué funciona en simulación y qué está verificado con herramientas, PostgreSQL o proveedores reales.

Referencias principales: `README.md`, `docs/company-organization.md`, `docs/office-architecture.md` y `docs/model-routing.md`.
