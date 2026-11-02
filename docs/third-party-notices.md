# Avisos de terceros

Material de terceros adaptado dentro de VeridisCorp. Cada archivo adaptado lo indica en su primera línea.

## marketingskills — Corey Haines (MIT)

- Origen: https://github.com/coreyhaines31/marketingskills (commit `88c79f6`, revisado el 2026-11-01).
- Qué se tomó: el oficio de sus skills de marketing, resumido y adaptado al español y a campañas de marca.
  No se copió ningún archivo completo.
- Dónde está: los documentos de `agents/*/knowledge/` de los puestos de marketing (cmo, campaigns,
  creative-strategy, cm, content, social-analyst, market-research, marketing-review) y `docs/ficha-de-marca.md`.

Licencia original:

```text
MIT License

Copyright (c) 2025 Corey Haines

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## headcount — Chris Brock (MIT)

- Origen: https://github.com/cbrock84/headcount (commit `7d3ddf1`, revisado el 2026-11-01).
- Fuente principal del knowledge de finanzas, personas, proyectos, operaciones, seguridad, tecnología y datos. No se copió el texto de las normas externas que cita en sus `references/sources.md`.
- Dónde está: documentos de `agents/*/knowledge/` cuya primera línea lo nombra.

Licencia original:

```text
MIT License

Copyright (c) 2026 Chris Brock

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## n8n-skills — Romuald Członkowski (MIT; partes Apache-2.0 de n8n-io)

- Origen: https://github.com/czlonkowski/n8n-skills (commit `e037563`, revisado el 2026-11-01).
- Knowledge de automation y network sobre n8n. Su NOTICES indica que parte del contenido se adaptó de n8n-io/skills bajo Apache-2.0; se conserva abajo.
- Dónde está: documentos de `agents/*/knowledge/` cuya primera línea lo nombra.

Licencia original:

```text
MIT License

Copyright (c) 2025 Romuald Członkowski

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

NOTICES:

```text
NOTICES

n8n-mcp-skills
Copyright (c) Romuald Członkowski (AiAdvisors)
Licensed under the MIT License (see LICENSE).

------------------------------------------------------------------------
This product includes software and documentation adapted from:

  n8n-io/skills
  https://github.com/n8n-io/skills
  Copyright n8n GmbH and contributors
  Licensed under the Apache License, Version 2.0
  https://www.apache.org/licenses/LICENSE-2.0

A copy of the Apache License 2.0 is included at NOTICES-APACHE-2.0.txt.
------------------------------------------------------------------------

The following files are adapted from n8n-io/skills, retargeted for the
community n8n-mcp MCP server (different tool names, parameter paths, and
node-type forms), with reminder text rewritten to reference this pack's
skills and the marker/cache directories changed to a distinct namespace:

  hooks/hooks.json
  hooks/session-start.sh
  hooks/pre-tool-use/_emit.sh
  hooks/pre-tool-use/get-node.sh
  hooks/pre-tool-use/create-workflow.sh
  hooks/pre-tool-use/update-workflow.sh
  hooks/pre-tool-use/validate-workflow.sh
  hooks/pre-tool-use/test-workflow.sh
  hooks/pre-tool-use/instances.sh
  hooks/pre-tool-use/manage-credentials.sh
  hooks/post-tool-use/validate-workflow.sh

Notable changes from upstream:
  - Hooks match the n8n-mcp tool names (get_node, validate_workflow,
    n8n_create_workflow, n8n_update_partial_workflow, n8n_validate_workflow,
    n8n_test_workflow) instead of the first-party MCP names.
  - The PreToolUse get_node hook reads a single SHORT-form nodeType; the
    PostToolUse validate hook parses workflow JSON node types (LONG form)
    rather than grepping SDK source code.
  - The upstream execute_workflow hook was dropped (no such tool on this
    server) and its error-handling reminder folded into the test_workflow hook.
  - PreToolUse hooks for n8n_instances and n8n_manage_credentials were added
    (original to this pack, reusing the adapted _emit.sh one-shot pattern) to
    surface the multi-instance and credential-discipline guidance.

The skills/using-n8n-mcp-skills router borrows the document *structure* of
the upstream using-n8n-skills meta-skill; its prose is original to this
repository.

This repository as a whole is licensed under the MIT License (see LICENSE).
The adapted content above is included in compliance with Apache License 2.0,
Section 4. No attribution notices are placed inside agent-facing skill content
(SKILL.md or reference files); attribution lives here, in README.md, and in the
header comments of the adapted hook scripts.
```

## claude-skills — Alireza Rezvani (MIT)

- Origen: https://github.com/alirezarezvani/claude-skills (commit `e4a1dc3`, revisado el 2026-11-01).
- Reglas destiladas de varias skills (cierre mensual, revisión humana, seguridad de IA, migraciones, SLO, procesos, proveedores, capacidad). No se usaron sus scripts.
- Dónde está: documentos de `agents/*/knowledge/` cuya primera línea lo nombra.

Licencia original:

```text
MIT License

Copyright (c) 2025 Alireza Rezvani

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## goose-skills — GooseWorks (MIT)

- Origen: https://github.com/gooseworks-ai/goose-skills (commit `1add09b`, revisado el 2026-11-01).
- Métodos transversales: informes, diagnóstico de resultados, economía unitaria, SEO técnico, afirmaciones publicitarias, aprendizajes.
- Dónde está: documentos de `agents/*/knowledge/` cuya primera línea lo nombra.

Licencia original:

```text
MIT License

Copyright (c) 2026 GooseWorks

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## agentic-awesome-skills — sickn33 (código MIT, texto CC BY 4.0)

- Origen: https://github.com/sickn33/agentic-awesome-skills (commit `6f819e3`, revisado el 2026-11-01).
- Solo skills con licencia MIT/Apache o sin licencia propia; cada documento nombra las skills usadas. El texto se adaptó (resumido, traducido y localizado), conforme a CC BY 4.0: https://creativecommons.org/licenses/by/4.0/
- Dónde está: documentos de `agents/*/knowledge/` cuya primera línea lo nombra.

Licencia original:

```text
MIT License

Copyright (c) 2026 Antigravity User

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## DevOps-Security-Agent-Skills — Toby Miller / BagelHole (MIT)

- Origen: https://github.com/BagelHole/DevOps-Security-Agent-Skills (commit `0365f57`, revisado el 2026-11-01).
- Seguridad de agentes y MCP, hardening de servidores y proxy inverso.
- Dónde está: documentos de `agents/*/knowledge/` cuya primera línea lo nombra.

Licencia original:

```text
MIT License

Copyright (c) 2026 Toby Miller

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## pm-skills — Pawel Huryn (MIT)

- Origen: https://github.com/phuryn/pm-skills (commit `2a12295`, revisado el 2026-11-01).
- Pre-mortem para planificación de proyectos.
- Dónde está: documentos de `agents/*/knowledge/` cuya primera línea lo nombra.

Licencia original:

```text
MIT License

Copyright (c) 2026 Pawel Huryn

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## agent-skills — Addy Osmani (MIT)

- Origen: https://github.com/addyosmani/agent-skills, usado a través de agentic-awesome-skills (revisado el 2026-11-01).
- Skills: spec-driven-development, planning-and-task-breakdown, code-review-and-quality, security-and-hardening.
- Dónde está: documentos de `agents/*/knowledge/` de development, software-lead, security-appsec, security-review y security-audit.

Otras skills de agentic-awesome-skills citadas con su autor en la primera línea del documento: deep-research-framework
y meeting-notes (alapha888, MIT), multi-source-search (sandbaseai, Apache-2.0), hr-pro, drizzle-orm-expert,
architecture-decision-records y api-security-best-practices (sin licencia propia: CC BY 4.0 del repo).

Licencia original:

```text
MIT License

Copyright (c) 2025 Addy Osmani

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
