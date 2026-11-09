# Entorno de auditoría `kali-audit` y herramientas de seguridad

Referencia para agentes y humanos de VeridisCorp sobre el host de auditoría, las herramientas instaladas y **cómo decidir** la forma de usarlas. Concierne sobre todo a los agentes `devops`, `infrastructure-lead` y la familia `security-*`.

## Qué es `kali-audit`

- Host Kali GNU/Linux Rolling en la LAN de oficina (`192.168.1.68`), usuario sin privilegios `ab`.
- **Aislado**: solo `veridis-oficina` (`192.168.1.158`) puede alcanzarlo; no tiene ruta hacia SEIS/642CORE ni Vaultwarden.
- Expone un servidor MCP propio, `veridis-kali-mcp` (servicio systemd de usuario, HTTP + bearer token en el puerto 8765). Su única herramienta es `shell_exec`: ejecuta un comando con `bash -lc`, recorta salida a 20 000 caracteres y timeout a 300 s, y registra cada comando en `~/veridis-kali-mcp/audit.log`.
- Es la vía por la que el ecosistema llega a la caja: compilar/probar código y correr herramientas de auditoría.

## Herramientas disponibles

**Base de Kali (verificadas):** nmap, masscan, nuclei (+templates en `~/.local/nuclei-templates`), nikto, whatweb, dirb, gobuster, ffuf, sqlmap, wpscan, hydra, john, hashcat, Metasploit (`msfconsole`, con `msfdb` inicializado), burpsuite, wireshark/tshark, aircrack-ng, responder, netexec, impacket, evil-winrm, enum4linux, smbclient, amass, theHarvester, searchsploit, mitmproxy, exiftool, sslyze.

**Añadidas en `~/tools/` (usuario `ab`):**

| Herramienta | Categoría | Cómo se invoca |
|---|---|---|
| maigret | OSINT username (3000+ sitios) | `maigret <user>` (pipx, en PATH) |
| holehe | OSINT email (cuentas por servicio) | `holehe <email>` (pipx) |
| phoneinfoga | OSINT teléfono | `~/tools/bin/phoneinfoga scan -n <num>` |
| metagoofil | Metadatos de documentos públicos | `~/tools/metagoofil` (legacy Py2; preferir exiftool+theHarvester) |
| WebEye | Recon web (DNS/TLS/headers) | `~/tools/WebEye/.venv/bin/python webeye.py` |
| OsintHunter | Suite OSINT con grafo, UI `127.0.0.1:8787` | `~/tools/OsintHunter/.venv/bin/python -m app` |
| SearchPhone | OSINT teléfono vía APIs | `~/tools/SearchPhone/.venv/bin/python search_phone.py` (requiere `.env`) |
| shannon | Pentester web autónomo con IA (PoC-validado) | `npx @keygraph/shannon@latest …` (Docker + Node 22) |
| Php2shell | Verificador CVE PHP + webshell de lab | `~/tools/Php2shell/.venv/bin/python …` |
| hackingtool | Agregador/lanzador de 219 tools | `~/tools/hackingtool` |
| Dos-WiFi | **Estudio/defensa** de deauth 802.11 | `~/tools/Dos-WiFi` (no operar fuera de lab RF) |
| stealth-browser-mcp | Navegador sigiloso (MCP stdio) | `pipx` → `browserstealthmcp` |
| mcp-maigret | maigret como MCP (stdio) | clone en `~/tools/mcp-maigret` |

## Política MCP: cómo decide un agente usar estas herramientas

VeridisCorp conecta servidores MCP **solo por http/https** (transporte StreamableHTTP/SSE), como *conexiones de empresa* dadas de alta en tiempo de ejecución (`mcp.connect` o la UI de Conexiones, persistidas en PostgreSQL). **Los servidores MCP de tipo stdio (comando local) quedan fuera por diseño** — ver `src/office/mcp-client.ts` y `office-architecture.md`.

Por eso `mcp-maigret` y `stealth-browser-mcp`, que son **stdio**, no se registran como conexión MCP tal cual. Hay dos formas de usarlos:

### Opción B — por el shell existente (predeterminada)
Los agentes alcanzan las herramientas corriendo el CLI a través de `veridis-kali-mcp.shell_exec`. Ejemplo: un agente llama `shell_exec("maigret objetivo --json")` y parsea la salida.
- **Ventaja**: funciona hoy, sin infraestructura nueva, menor superficie (sin servicios HTTP extra siempre encendidos).
- **Límite**: salida "cruda" (texto a parsear), sin esquema de tool ni gobernanza por herramienta.

### Opción A — puente HTTP (registro formal)
Envolver el servidor stdio detrás de un endpoint HTTP MCP con bearer (igual que `veridis-kali-mcp`), levantarlo como servicio systemd y darlo de alta en Conexiones con URL+credencial.
- **Ventaja**: tools estructuradas con hints read/write, activar/desactivar por herramienta, y auditoría de cada llamada en la DB.
- **Costo**: escribir el wrapper + servicio, y requiere runtime + PostgreSQL arriba para registrar la conexión.

### Regla de decisión
1. **Por defecto, usa B** (shell_exec) para cualquier herramienta de `kali-audit`.
2. **Monta A solo cuando** una auditoría recurrente necesite llamadas **estructuradas, repetibles y auditadas** de una herramienta concreta (p. ej. maigret como tool de empresa gobernada), o cuando un flujo no-humano deba encadenar muchas llamadas con control de acceso por tool.
3. **No montes A "por si acaso"**: un agente no decide levantar servicios HTTP; eso lo aprueba un humano (`infrastructure-lead`/`devops`). Para `stealth-browser-mcp` (evasión anti-bot) A exige justificación explícita y objetivo propio/autorizado; no dejarlo como servicio siempre encendido.

## Límites legales y de alcance (aplican a todos los agentes)

- Toda herramienta es de **uso autorizado**: sistemas propios o con **autorización escrita** (rules of engagement). Fuera de alcance no se ejecuta nada.
- **Dos-WiFi** es un ataque de **denegación de servicio** (deauth 802.11). En VeridisCorp es material de **estudio y defensa**: entender la mecánica y validar contramedidas (**802.11w/PMF requerido, WPA3-SAE, WIDS/WIPS**). No se opera contra redes fuera de un laboratorio RF aislado y autorizado.
- **Php2shell** (`exploit`/`shell`) y cualquier webshell/RAT: solo laboratorio o engagement con alcance firmado. Las funciones `detect`/`scan`/`advisories` son evaluación de vulnerabilidades legítima.
- **stealth-browser-mcp**: la evasión anti-detección solo contra objetivos propios/autorizados.
- Artefactos ofensivos de laboratorio (p. ej. `~/Projects/rdp/`) deben vivir en carpetas de evidencia etiquetadas y **fuera del PATH** del servidor MCP.

## Estructura de trabajo

`~/audits/<cliente>/<fecha>/{recon,scans,loot,report}`. Cada comando queda en `~/veridis-kali-mcp/audit.log`. Reportes de maigret/OsintHunter/shannon se adjuntan al informe del engagement.

---

*Documentación interna VeridisCorp. Entorno de auditoría autorizada.*
