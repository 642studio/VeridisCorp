# Herramientas de auditoría en `kali-audit` y cómo usarlas

Referencia operativa completa: `docs/auditoria-kali-herramientas.md`.

## Antes de empezar
Confirma que la petición está **dentro de alcance autorizado** (sistema propio o con rules of engagement firmadas). Fuera de alcance no se ejecuta nada. Toda ejecución pasa por `veridis-kali-mcp.shell_exec` y queda en `~/veridis-kali-mcp/audit.log`.

## Qué hay y cómo se alcanza
`kali-audit` (host Kali aislado, usuario `ab`) tiene la toolset de Kali (nmap, nuclei, sqlmap, Metasploit con `msfdb` listo, netexec, impacket, aircrack-ng, etc.) y herramientas OSINT/web añadidas en `~/tools/` (maigret, holehe, phoneinfoga, WebEye, OsintHunter, SearchPhone, shannon, Php2shell, hackingtool, Dos-WiFi). Los agentes las corren como CLI vía `shell_exec`.

## Decisión: cómo usar una herramienta MCP de kali
VeridisCorp solo registra conexiones MCP por **http/https**; los servidores **stdio quedan fuera por diseño** (`src/office/mcp-client.ts`). `mcp-maigret` y `stealth-browser-mcp` son stdio, así que:

1. **Por defecto (Opción B)**: úsalas por `shell_exec` (`maigret <user> --json`, etc.). Funciona ya, sin infraestructura, menor superficie.
2. **Puente HTTP (Opción A)** — envolver en endpoint HTTP+bearer como `veridis-kali-mcp` y darlo de alta en Conexiones — **solo** cuando una auditoría recurrente necesite llamadas **estructuradas, repetibles y auditadas** de esa herramienta.
3. **Un agente no levanta servicios HTTP por iniciativa**: A lo aprueba un humano (`infrastructure-lead`/`devops`). Para `stealth-browser-mcp` (evasión anti-bot), A exige justificación explícita y objetivo autorizado; no dejarlo siempre encendido.

Regla corta: **B salvo que necesites gobernanza por herramienta** (hints read/write, activar/desactivar, auditoría en DB) → entonces propón A a un humano.

## Rojo: no cruzar
- **Dos-WiFi** = DoS (deauth 802.11). Solo **estudio/defensa**: validar contramedidas (802.11w/PMF, WPA3, WIDS). Nunca operar contra redes fuera de lab RF aislado.
- Webshells/RAT/`exploit` de Php2shell: solo lab o engagement firmado. `detect`/`scan` sí son evaluación legítima.
- Artefactos ofensivos de lab fuera del PATH del MCP, en carpetas de evidencia etiquetadas.
