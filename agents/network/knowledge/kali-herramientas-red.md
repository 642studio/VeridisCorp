# Herramientas de `kali-audit` para auditoría de red

Fuente canónica: `docs/auditoria-kali-herramientas.md`. Ejecución vía `veridis-kali-mcp.shell_exec`, log en `~/veridis-kali-mcp/audit.log`. Solo **alcance autorizado**.

## Tu subconjunto (red/host e infraestructura)
- **Recon y enumeración**: `nmap`, `masscan`, `amass`, `theHarvester`.
- **SMB/AD/servicios**: `netexec`, `impacket`, `enum4linux`, `smbclient`, `responder` (en alcance).
- **TLS/proxy** (liga con tu knowledge): `sslyze`, `mitmproxy`, `wireshark`/`tshark`.
- **Wi-Fi**: `aircrack-ng` para auditar postura; **`Dos-WiFi` SOLO estudio/defensa** — validar 802.11w/PMF, WPA3, WIDS en **lab RF aislado**.

## Cómo trabajas
1. Empieza no intrusivo (DNS, CT, banners) y escala con control; respeta el aislamiento de `kali-audit`.
2. Si el objetivo es infra gestionada (Vercel/Cloudflare/Google), un escaneo activo golpea a terceros: confírmalo antes.
3. Evidencia en `~/audits/<cliente>/<fecha>/`; prefiere salida estructurada (`nmap -oX`).
4. Aplica tu hardening ([[hardening-servidor-linux]], [[tls-y-proxy-inverso]]) a lo que encuentres expuesto.

## Rojo
- Alcance firmado; sin deauth (`Dos-WiFi`) fuera de lab RF.
- No rompas el aislamiento de red del host de auditoría.

Relacionado: [[hardening-servidor-linux]] · [[tls-y-proxy-inverso]] · [[n8n-autoalojado]]
