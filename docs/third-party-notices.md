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

## hyperframes — HeyGen, Inc. (Apache License 2.0)

- Origen: https://github.com/heygen-com/hyperframes (commit `e46ecd8`, revisado el 2026-11-03).
- Qué se tomó: el contrato de render HTML→video, el flujo de trabajo de la CLI y el oficio de
  resolución de medios de las skills `hyperframes`, `hyperframes-cli`, `hyperframes-registry` y
  `media-use`, resumido, traducido y adaptado a la infraestructura propia (voz vía el proxy de
  ElevenLabs ya existente en lugar de la voz nativa del proveedor). No se copió ningún archivo completo.
- Dónde está: `agents/video-production/knowledge/`.
- Nota: esto no es una skill administrativa adaptada al español/México como el resto de este
  documento; es el motor de render (software, no solo texto de referencia) que esta plaza usaría. El
  motor en sí todavía no está instalado ni invocado por el código de este repositorio.

Licencia original:

```text
                                 Apache License
                           Version 2.0, January 2004
                        http://www.apache.org/licenses/

   TERMS AND CONDITIONS FOR USE, REPRODUCTION, AND DISTRIBUTION

   1. Definitions.

      "License" shall mean the terms and conditions for use, reproduction,
      and distribution as defined by Sections 1 through 9 of this document.

      "Licensor" shall mean the copyright owner or entity authorized by
      the copyright owner that is granting the License.

      "Legal Entity" shall mean the union of the acting entity and all
      other entities that control, are controlled by, or are under common
      control with that entity. For the purposes of this definition,
      "control" means (i) the power, direct or indirect, to cause the
      direction or management of such entity, whether by contract or
      otherwise, or (ii) ownership of fifty percent (50%) or more of the
      outstanding shares, or (iii) beneficial ownership of such entity.

      "You" (or "Your") shall mean an individual or Legal Entity
      exercising permissions granted by this License.

      "Source" form shall mean the preferred form for making modifications,
      including but not limited to software source code, documentation
      source, and configuration files.

      "Object" form shall mean any form resulting from mechanical
      transformation or translation of a Source form, including but
      not limited to compiled object code, generated documentation,
      and conversions to other media types.

      "Work" shall mean the work of authorship, whether in Source or
      Object form, made available under the License, as indicated by a
      copyright notice that is included in or attached to the work
      (an example is provided in the Appendix below).

      "Derivative Works" shall mean any work, whether in Source or Object
      form, that is based on (or derived from) the Work and for which the
      editorial revisions, annotations, elaborations, or other modifications
      represent, as a whole, an original work of authorship. For the
      purposes of this License, Derivative Works shall not include works
      that remain separable from, or merely link (or bind by name) to the
      interfaces of, the Work and Derivative Works thereof.

      "Contribution" shall mean any work of authorship, including the
      original version of the Work and any modifications or additions
      to that Work or Derivative Works thereof, that is intentionally
      submitted to Licensor for inclusion in the Work by the copyright owner
      or by an individual or Legal Entity authorized to submit on behalf of
      the copyright owner. For the purposes of this definition, "submitted"
      means any form of electronic, verbal, or written communication sent
      to the Licensor or its representatives, including but not limited to
      communication on electronic mailing lists, source code control systems,
      and issue tracking systems that are managed by, or on behalf of, the
      Licensor for the purpose of discussing and improving the Work, but
      excluding communication that is conspicuously marked or otherwise
      designated in writing by the copyright owner as "Not a Contribution."

      "Contributor" shall mean Licensor and any individual or Legal Entity
      on behalf of whom a Contribution has been received by Licensor and
      subsequently incorporated within the Work.

   2. Grant of Copyright License. Subject to the terms and conditions of
      this License, each Contributor hereby grants to You a perpetual,
      worldwide, non-exclusive, no-charge, royalty-free, irrevocable
      copyright license to reproduce, prepare Derivative Works of,
      publicly display, publicly perform, sublicense, and distribute the
      Work and such Derivative Works in Source or Object form.

   3. Grant of Patent License. Subject to the terms and conditions of
      this License, each Contributor hereby grants to You a perpetual,
      worldwide, non-exclusive, no-charge, royalty-free, irrevocable
      (except as stated in this section) patent license to make, have made,
      use, offer to sell, sell, import, and otherwise transfer the Work,
      where such license applies only to those patent claims licensable
      by such Contributor that are necessarily infringed by their
      Contribution(s) alone or by combination of their Contribution(s)
      with the Work to which such Contribution(s) was submitted. If You
      institute patent litigation against any entity (including a
      cross-claim or counterclaim in a lawsuit) alleging that the Work
      or a Contribution incorporated within the Work constitutes direct
      or contributory patent infringement, then any patent licenses
      granted to You under this License for that Work shall terminate
      as of the date such litigation is filed.

   4. Redistribution. You may reproduce and distribute copies of the
      Work or Derivative Works thereof in any medium, with or without
      modifications, and in Source or Object form, provided that You
      meet the following conditions:

      (a) You must give any other recipients of the Work or
          Derivative Works a copy of this License; and

      (b) You must cause any modified files to carry prominent notices
          stating that You changed the files; and

      (c) You must retain, in the Source form of any Derivative Works
          that You distribute, all copyright, patent, trademark, and
          attribution notices from the Source form of the Work,
          excluding those notices that do not pertain to any part of
          the Derivative Works; and

      (d) If the Work includes a "NOTICE" text file as part of its
          distribution, then any Derivative Works that You distribute must
          include a readable copy of the attribution notices contained
          within such NOTICE file, excluding those notices that do not
          pertain to any part of the Derivative Works, in at least one
          of the following places: within a NOTICE text file distributed
          as part of the Derivative Works; within the Source form or
          documentation, if provided along with the Derivative Works; or,
          within a display generated by the Derivative Works, if and
          wherever such third-party notices normally appear. The contents
          of the NOTICE file are for informational purposes only and
          do not modify the License. You may add Your own attribution
          notices within Derivative Works that You distribute, alongside
          or as an addendum to the NOTICE text from the Work, provided
          that such additional attribution notices cannot be construed
          as modifying the License.

      You may add Your own copyright statement to Your modifications and
      may provide additional or different license terms and conditions
      for use, reproduction, or distribution of Your modifications, or
      for any such Derivative Works as a whole, provided Your use,
      reproduction, and distribution of the Work otherwise complies with
      the conditions stated in this License.

   5. Submission of Contributions. Unless You explicitly state otherwise,
      any Contribution intentionally submitted for inclusion in the Work
      by You to the Licensor shall be under the terms and conditions of
      this License, without any additional terms or conditions.
      Notwithstanding the above, nothing herein shall supersede or modify
      the terms of any separate license agreement you may have executed
      with Licensor regarding such Contributions.

   6. Trademarks. This License does not grant permission to use the trade
      names, trademarks, service marks, or product names of the Licensor,
      except as required for reasonable and customary use in describing the
      origin of the Work and reproducing the content of the NOTICE file.

   7. Disclaimer of Warranty. Unless required by applicable law or
      agreed to in writing, Licensor provides the Work on an "AS IS" BASIS,
      WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or
      implied, including, without limitation, any warranties or conditions
      of TITLE, NON-INFRINGEMENT, MERCHANTABILITY, or FITNESS FOR A
      PARTICULAR PURPOSE. You are solely responsible for determining the
      appropriateness of using or reproducing the Work and and assume any
      risks associated with Your exercise of permissions under this License.

   8. Limitation of Liability. In no event and under no legal theory,
      whether in tort (including negligence), contract, or otherwise,
      unless required by applicable law (such as deliberate and grossly
      negligent acts) or agreed to in writing, shall any Contributor be
      liable to You for damages, including any direct, indirect, special,
      incidental, or consequential damages of any character arising as a
      result of this License or out of the use or inability to use the
      Work (including but not limited to damages for loss of goodwill,
      work stoppage, computer failure or malfunction, or any and all
      other commercial damages or losses), even if such Contributor
      has been advised of the possibility of such damages.

   9. Accepting Warranty or Additional Support. While redistributing
      the Work or Derivative Works thereof, You may distribute a
      copy of this License, and provided that You, and provided that such
      additional work or support, on behalf of any other Contributor, and
      only if You agree to indemnify, defend, and hold each Contributor
      harmless for any liability incurred by, or claims asserted against,
      such Contributor by reason of your accepting any such warranty or
      additional liability.

   END OF TERMS AND CONDITIONS

   Copyright 2026 HeyGen, Inc.

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
```

## GSAP 3.15.0 — GreenSock/Webflow (GSAP Standard License)

- Origen: build minificado oficial servido por jsDelivr (`cdn.jsdelivr.net/npm/gsap@3.15.0/dist/gsap.min.js`),
  descargado sin modificar el 2026-11-04.
- Qué se tomó y por qué: el archivo completo, sin modificar, vendorizado en
  `docker/video-renderer/vendor/gsap.min.js`. La herramienta `video.render` renderiza sin red
  (`--network none`), y el contrato de HyperFrames pide GSAP desde un CDN — sin una copia local, la
  composición no podría cargarlo. El contenedor la coloca en `assets/vendor/gsap.min.js` de cada
  proyecto (`docker/video-renderer/docker-entrypoint.sh`) si el proyecto no trae la suya.
- Dónde está: `docker/video-renderer/vendor/gsap.min.js` (el archivo), copiado en tiempo de ejecución
  dentro de cada proyecto por `docker-entrypoint.sh`.
- Licencia: GSAP Standard License (https://gsap.com/standard-license), no MIT/Apache. El uso comercial
  y la implementación en cualquier sitio o aplicación web están cubiertos sin pago; prohíbe quitar o
  alterar los avisos de copyright del archivo (no se tocó el header `/*! GSAP 3.15.0 ... @license
  Copyright 2026, GreenSock...`) y usarlo para construir una herramienta de animación visual sin código
  que compita con Webflow — ninguna de esas restricciones aplica a este uso.
