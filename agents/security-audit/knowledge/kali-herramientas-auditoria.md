# Herramientas de `kali-audit` para auditoría de vulnerabilidades

Fuente canónica (inventario completo, política MCP y líneas rojas): `docs/auditoria-kali-herramientas.md`.
Toda ejecución pasa por `veridis-kali-mcp.shell_exec` y queda en `~/veridis-kali-mcp/audit.log`. Nada fuera de **alcance autorizado** (sistema propio o Rules of Engagement firmadas).

## Tu subconjunto (eres quien ejecuta el pentest)
- **Descubrimiento y VA**: `nmap`, `masscan`, `nuclei` (+templates), `nikto`, `whatweb`, `sslyze`, `wpscan`, `searchsploit`.
- **Explotación autorizada**: `msfconsole` (Metasploit, con `msfdb` listo), `sqlmap`, `hydra` (controlado, solo en alcance).
- **Contenido/fuzzing web**: `gobuster`, `ffuf`, `dirb`.
- **Cracking offline** sobre loot ya obtenido: `john`, `hashcat`.
- **Windows/AD en engagement**: `netexec`, `impacket`, `evil-winrm`, `enum4linux`, `smbclient`, `responder`.
- **Superficie/OSINT de apoyo**: `theHarvester`, `amass`, `maigret`, `holehe`, `phoneinfoga`.

## Cómo trabajas
1. **Escala la intrusividad**: primero recon pasivo (whois, dig, CT, whatweb), luego escaneo activo. Si el objetivo está en infra gestionada (Vercel/Cloudflare/Google), un escaneo agresivo golpea a terceros: confírmalo antes.
2. Estructura: `~/audits/<cliente>/<fecha>/{recon,scans,loot,report}`.
3. Prefiere salida parseable (`nuclei -json`, `nmap -oX`) y adjunta evidencia reproducible (PoC) con severidad justificada.

## Rojo (tu responsabilidad)
- Solo alcance firmado. Fuera de rango, nada.
- `Php2shell`: solo `detect`/`scan`/`advisories`; webshell/exploit únicamente en lab.
- **Nunca `Dos-WiFi`** (DoS) contra redes reales.
- Sin exfiltración ni DoS como parte de una VA.

Relacionado: [[gestion-de-vulnerabilidades]] · [[dependencias-y-licencias]]
