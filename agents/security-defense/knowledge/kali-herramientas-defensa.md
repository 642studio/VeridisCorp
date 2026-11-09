# Herramientas de `kali-audit` para defensa e incidentes

Fuente canónica: `docs/auditoria-kali-herramientas.md`. Ejecución vía `veridis-kali-mcp.shell_exec`, log en `~/veridis-kali-mcp/audit.log`. Solo **activos propios/autorizados**.

## Tu subconjunto (usas las herramientas para VALIDAR defensas, no para atacar)
- **Inventario y exposición propia**: `nmap`, `nuclei`, `sslyze` contra tus propios activos para ver qué está expuesto y mal configurado.
- **Tráfico y forense**: `wireshark`/`tshark`, `mitmproxy` para inspección; `responder` en modo análisis para detectar envenenamiento LLMNR/NBT-NS y validar su mitigación.
- **Wi-Fi (solo estudio/defensa)**: `aircrack-ng` y `Dos-WiFi` **únicamente** para reproducir deauth 802.11 en un **lab RF aislado** y validar contramedidas: **802.11w/PMF**, WPA3-SAE, WIDS/WIPS.
- **Exposición de marca/empleados**: `maigret`, `holehe` para monitorear filtraciones de cuentas propias.

## Cómo trabajas
1. Cada ejecución busca **confirmar un control o detectar una brecha**, no comprometer. Documenta qué defensa validaste.
2. Convierte hallazgos en reglas de detección y endurecimiento ([[deteccion-y-monitoreo]]).
3. En incidente, usa captura de tráfico y análisis de artefactos; correlaciona con `audit.log`.

## Rojo
- Nada ofensivo fuera del lab. `Dos-WiFi` **jamás** contra redes reales; es material de estudio para defender.
- No operes herramientas de evasión (`stealth-browser-mcp`) salvo objetivo propio y justificado.

Relacionado: [[respuesta-a-incidentes]] · [[deteccion-y-monitoreo]]
