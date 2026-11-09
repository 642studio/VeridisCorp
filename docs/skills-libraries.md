# Bibliotecas de skills revisadas (2026-11-01)

Estado (2026-11-08): extraído. 125 documentos en 56 de 57 puestos (ver `docs/competitive-strategy.md`). Falta investment-research.
La ronda del 2026-11-08 sumó 16 documentos de 11 fuentes nuevas (tabla de licencias y `docs/repos-candidatos-2026-11-08.md`).

Qué sirve de cada biblioteca para el knowledge de los puestos (`agents/<id>/knowledge/`). Regla: se
resume y adapta al español y a México (SAT/CFDI, LFT, IMSS, LFPDPPP, MXN); nunca se copia una skill
entera. El texto solo se adapta si la licencia lo permite, y la atribución va en la primera línea del
documento y en `docs/third-party-notices.md`.

## Licencias

| Fuente | Licencia | Uso |
|---|---|---|
| coreyhaines31/marketingskills | MIT | Adaptado: 16 documentos de marketing (ya hecho) |
| cbrock84/headcount | MIT | Adaptar. Es una "empresa de agentes" de 16 departamentos con constructores y revisores separados; la mejor fuente fuera de marketing. Contenido de EE. UU.: reescribir lo fiscal y lo laboral. Sus `references/sources.md` citan normas externas: no copiar ese texto |
| czlonkowski/n8n-skills | MIT (partes Apache-2.0 de n8n-io) | Adaptar, conservando su NOTICE |
| alirezarezvani/claude-skills | MIT | Adaptar. Muy SaaS de EE. UU.; muchas skills dependen de scripts: destilar solo las reglas |
| gooseworks-ai/goose-skills | MIT | Adaptar los métodos transversales, sin sus herramientas `gooseworks:*` |
| sickn33/agentic-awesome-skills | Código MIT, texto CC BY 4.0 | Adaptar citando al autor original. Excluir ~17 skills AGPL/GPL/FSL/"Unknown", las "official" de vendors y las "taste" sin licencia |
| BagelHole/DevOps-Security-Agent-Skills, addyosmani/agent-skills, phuryn/pm-skills, garrytan/gstack | MIT | Adaptar lo puntual |
| trailofbits/skills | CC BY-SA 4.0 | Solo ideas (un derivado tendría que ser CC BY-SA) |
| deanpeters/Product-Manager-Skills | CC BY-NC-SA | Solo ideas |
| VoltAgent/awesome-agent-skills, zhuyansen/awesome-claude-code-skills-collections | MIT / CC0 (solo listas) | Índices de enlaces; cada repo enlazado tiene su licencia |
| heygen-com/hyperframes | Apache-2.0 | Adaptado: contrato de render y oficio de medios para `video-production` (2026-11-03). No es una skill de puesto administrativo: es el motor HTML→video que usa esta plaza; ver `docs/third-party-notices.md` |
| pbakaus/impeccable | Apache-2.0 (con NOTICE) | Adaptado (2026-11-08): diseño de interfaz para `frontend`, crítica y auditoría de UI para `software-qa`. Su detector `npx impeccable detect` solo dentro del sandbox; nunca su instalador ni el modo `live` |
| heydamir/unslop | CC BY 4.0 | Adaptado con crédito a Damir Sokolovsky: señales de UI hecha por IA (`frontend`) |
| plugin87/ux-ui-agent-skills | MIT | Adaptado: accesibilidad WCAG 2.2, ARIA y estados (`frontend`). Se descartó su regla de nunca usar `<select>` nativo |
| anthropics/skills | Apache-2.0 | Adaptado selectivo: frontend-design, skill-creator, mcp-builder, xlsx, pptx, discernment-nudge |
| obra/superpowers | MIT | Adaptado: writing-skills (`knowledge-curator`), receiving-code-review (`development`) |
| affaan-m/ECC | MIT | Adaptado: santa-method (doble revisión, `marketing-review`). Ideas para el motor: operator-approval-loop |
| Shubhamsaboo/awesome-llm-apps | Apache-2.0 | Adaptado: first-reader (`content`), thinking-out-loud (`human-task-coordinator`). Ideas: corrective_rag, advisor-orchestrator-worker |
| kaankiziltug/logo-design-skill | MIT | Adaptado: proceso de logotipo e identidad (`creative-strategy`); no su colección de logotipos |
| bangtutorial/bang-motion | MIT | Adaptado (traducido del indonesio): motion que no parece presentación (`video-production`) |
| sarpstar/cinecode | MIT | Solo ideas para el QC automático de `video.render` (`src/office/video-qc.ts`); no se instaló la skill |
| edenfunf/reelmimic, cporter202/google-maps-scraping-apis | MIT | Solo ideas, texto propio (`video-production`, `market-research`) |
| OpenMontageInc/OpenMontage | AGPL-3.0 | Solo ideas, redactadas desde cero; nunca copiar su texto ni código |

## Qué sacar, por puesto (huecos: hoy solo marketing tiene knowledge)

Fuente principal: headcount (`plugins/<depto>/skills/<skill>/SKILL.md`); otras entre paréntesis.

| Puesto(s) | Temas | Fuentes |
|---|---|---|
| finance-accounting, finance-review | Cierre mensual con conciliación a cero y quien prepara no revisa; controles internos | headcount finance/financial-reporting-and-close, internal-controls-and-audit; claude-skills finance/month-end-close |
| finance-treasury, cfo | Flujo de caja a 13 semanas, escenarios, doble aprobación de pagos | headcount finance/treasury-and-liquidity |
| finance-budget, cfo | Presupuesto contra real, forecast rodante, variaciones | headcount finance/budgeting-and-forecasting; claude-skills finance/financial-analyst |
| cfo, finance-billing, data-analyst | Rentabilidad por cliente y proyecto, reconocimiento de ingreso | headcount finance/unit-economics, cost-accounting, revenue-recognition; goose plan-campaign/references/unit-economics.md |
| finance-billing | CFDI y facturación mexicana | Ninguna fuente buena: escribir desde cero con fuentes del SAT |
| recruiting | Perfil del puesto, entrevista estructurada, decidir con evidencia | headcount people/hiring-and-interviewing |
| onboarding, hr | Altas y bajas (incluido retirar accesos) | headcount people/onboarding-and-offboarding |
| people-development, people-review | Formación y evaluación del desempeño | headcount people/learning-and-development, performance-management |
| workforce | Capacidad contra demanda | headcount people/workforce-planning, operations/capacity-and-demand-planning |
| hr | Marco de RH, cambio organizacional; cumplimiento laboral reescrito para la LFT | headcount people/chief-human-resources-officer; claude-skills change-management |
| pm, project-planner, project-tracker | Entrega, cronograma, estimación con contingencia, riesgos, pre-mortem, minutas | headcount pmo/*; pm-skills pre-mortem; agentic meeting-notes |
| process-improvement, quality-lead | Diseño de procesos, cuello de botella, gestión de calidad, SOP con dueño y señal de éxito | headcount operations/process-design, quality-management; claude-skills knowledge-ops, process-mapper |
| procurement | Especificar la necesidad, cotización competitiva, scorecard de proveedores | headcount operations/procurement-and-sourcing, vendor-management |
| coo, operations | Ritmo operativo semanal y mensual | headcount operations/chief-operating-officer, operating-cadence |
| continuity | Análisis de impacto, RTO/RPO, respaldos inmutables, probar la restauración, simulacros | headcount business-continuity-and-resilience, it-operations/backup-and-recovery; agentic backup-recovery, database-backups |
| security-defense, devops | Respuesta a incidentes, severidades, postmortem sin culpables | headcount security/incident-response; claude-skills incident-commander; agentic postmortem-writing |
| security-appsec, security-review, ciso | Modelado de amenazas, revisión de diseño, seguridad de agentes LLM y MCP | headcount security/threat-modeling, security-architecture-review; claude-skills ai-security; BagelHole prompt-injection-defense, mcp-server-security |
| security-audit, security-governance | Vulnerabilidades priorizadas por explotación real, accesos y mínimo privilegio, secretos | headcount security/vulnerability-management, access-and-identity; claude-skills env-secrets-manager |
| network, devops | Hardening del servidor Linux, firewall, TLS, n8n autoalojado | agentic linux-hardening, firewall-config, ssl-tls-management; n8n-skills n8n-self-hosting |
| automation | Patrones de n8n, manejo de errores, expresiones, subflujos | n8n-skills n8n-workflow-patterns, n8n-error-handling, n8n-expression-syntax |
| backend, data-engineer | Diseño de API, migraciones sin caída, Drizzle y PostgreSQL | headcount technology/api-design, data-migration; agentic drizzle-orm-expert; claude-skills migration-architect |
| devops, software-lead, cto | Despliegues, observabilidad, SLO | headcount technology/release-and-deployment, observability-and-reliability |
| software-qa, review, development | Exigir evidencia antes de dar algo por hecho, revisión de código, pruebas | headcount technology/completion-verification, code-review, test-driven-development |
| review, human-task-coordinator | Revisión humana con severidades; declarar cómo se revisó | claude-skills human-gate; goose honest-review |
| data-analyst, data-lead, data-engineer | Pipelines, modelado, BI, gobierno de datos, diagnóstico de resultados con evidencia | headcount data-analytics/*; goose analyze-performance/references/diagnosis.md |
| research, research-lead, research-review | Niveles de fuentes, verificación cruzada, informe con nivel de certeza | agentic deep-research-framework; goose write-report, research-pattern |
| knowledge-curator, cto | Registro de decisiones (ADR), memoria cruda contra decisiones aprobadas | agentic architecture-decision-records; claude-skills decision-logger |
| ceo, coo, cto | Constructores contra revisores, niveles de autoridad (ideas de diseño) | headcount executive/agent-hierarchy |
| marketing-review, content | Tipos de afirmación y la prueba que exige cada una (adaptar a PROFECO/COFEPRIS) | goose claims-gate |
| video-production (nuevo, validado con un render real el 2026-11-04 fuera del motor) | Contrato de render HTML→video, flujo spec→build→check→preview→render, catálogo de bloques, resolución de medios (voz vía el proxy propio de ElevenLabs en vez de la voz nativa del proveedor), defaults prohibidos, y las dos rutas de conexión (local autoalojada vs. MCP alojado de HeyGen) | heygen-com/hyperframes, skills `hyperframes`/`hyperframes-cli`/`hyperframes-registry`/`media-use` |
| frontend, content | SEO técnico y visibilidad en respuestas de IA, negocio local | goose improve-search-visibility/references |

Descartado en todas: herramientas de vendors que no usamos (AWS, Azure, GCP, Stripe, Jira, Snowflake…),
flujos solo para Claude Code como IDE, cumplimiento ajeno (FDA, ISO 13485, HIPAA, FedRAMP, SOC 2),
seguridad ofensiva, contenido generado en serie y lo que duplica marketingskills.

## Ronda 2026-11-08: repos candidatos

Veredictos completos de los 36 repos en `docs/repos-candidatos-2026-11-08.md`. Documentos que salieron:

| Puesto | Documento | Fuentes |
|---|---|---|
| frontend | diseno-de-interfaz.md, accesibilidad-y-estados.md | impeccable, unslop, anthropics frontend-design; ux-ui-agent-skills |
| software-qa | critica-y-auditoria-de-ui.md | impeccable critique, audit |
| knowledge-curator | probar-documentos-de-knowledge.md | superpowers writing-skills; anthropics skill-creator |
| development | recibir-revision-de-codigo.md | superpowers receiving-code-review |
| backend | disenar-herramientas-mcp.md | anthropics mcp-builder |
| finance-budget | hojas-de-calculo-financieras.md | anthropics xlsx |
| cmo | presentaciones.md | anthropics pptx |
| review | preguntas-de-verificacion.md | anthropics discernment-nudge |
| content | lectura-previa.md | awesome-llm-apps first-reader |
| human-task-coordinator | notas-de-voz-y-mensajes.md | awesome-llm-apps thinking-out-loud |
| marketing-review | doble-revision-de-lo-publico.md | ECC santa-method |
| creative-strategy | logotipos-e-identidad.md | logo-design-skill |
| video-production | motion-sin-presentacion.md, analisis-de-referencia-y-plataformas.md | bang-motion; ideas de reelmimic y OpenMontage |
| market-research | prospeccion-local-responsable.md | ideas de google-maps-scraping-apis; DENUE del INEGI y REPEP |

Quedaron sin asignar puestos que el triage proponía y aún no tienen documento: cfo, data-analyst,
pm, research-review, cm, campaigns y automation.
