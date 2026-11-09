# `kali-audit` y servicios MCP: decisión de infraestructura

Fuente canónica: `docs/auditoria-kali-herramientas.md`. Tu rol dirige el **ciclo de vida del host y de los servicios MCP**, no la ejecución de pentests.

## Lo que decides y mantienes
- **Aislamiento de `kali-audit`**: host Kali en `192.168.1.68`, alcanzable **solo desde `veridis-oficina`** (`192.168.1.158`); sin ruta a SEIS/642CORE ni Vaultwarden. Mantener ese aislamiento es requisito, no opción.
- **`veridis-kali-mcp`**: servicio systemd de usuario, HTTP + bearer en `:8765`, única tool `shell_exec` (cap 20 000 chars, timeout 300 s, log en `~/veridis-kali-mcp/audit.log`). Tú velas por su salud, su token (en entorno) y su superficie.
- **Política B-vs-A**: **B** (shell_exec) por defecto. Levantar un **puente HTTP (A)** para una herramienta concreta lo **apruebas tú** (con `devops`), solo cuando una auditoría recurrente necesite llamadas estructuradas/auditadas; evalúa costo/capacidad de cada servicio nuevo. No dejar servicios de evasión siempre encendidos.
- **Higiene**: artefactos ofensivos de lab fuera del PATH del MCP; secretos en entorno.

## Criterio rápido
Un agente **no** levanta servicios HTTP por iniciativa. Si piden A, valida: ¿objetivo autorizado? ¿justifica el costo frente a B? ¿quién audita las llamadas? Si no, se queda en B.

Relacionado: [[gobierno-de-infraestructura]] · [[capacidad-y-costos]]
