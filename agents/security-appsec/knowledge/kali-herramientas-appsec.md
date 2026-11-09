# Herramientas de `kali-audit` para seguridad de aplicaciones

Fuente canónica: `docs/auditoria-kali-herramientas.md`. Ejecución vía `veridis-kali-mcp.shell_exec`, log en `~/veridis-kali-mcp/audit.log`. Solo **alcance autorizado**.

## Tu subconjunto (foco web/app)
- **Escaneo web**: `nuclei` (+templates), `nikto`, `whatweb`, `wpscan`.
- **Inyección/entrada**: `sqlmap` (solo en alcance), `ffuf`, `gobuster`, `dirb` para descubrir rutas/params.
- **Proxy e inspección**: `burpsuite`, `mitmproxy`, `sslyze` (TLS de la app).
- **Pentester web con IA**: `shannon` (PoC-validado; Docker + Node 22).
- **PHP/CVE**: `Php2shell` → `detect`/`scan`/`advisories` para verificar CVEs; el webshell NO en prod.
- **Metadatos**: `exiftool` sobre archivos que la app acepta subir.
- **Superficie**: `theHarvester`.

## Cómo trabajas
1. Liga cada hallazgo a tu [[modelado-de-amenazas]]: valida los supuestos de confianza (authn/authz, validación de entrada, CORS, cabeceras).
2. Revisa configuración antes que explotar: cabeceras (CSP, HSTS, `X-Content-Type-Options`), CORS (`ACAO: *` con credenciales = hallazgo), cookies (`HttpOnly`, `SameSite`, `Secure`).
3. En apps SPA/SSR verifica que la autorización sea **server-side**, no solo guardia de cliente.

## Rojo
- `Php2shell` exploit/shell y cualquier webshell/RAT: solo lab o engagement firmado.
- Nunca pruebas destructivas ni `sqlmap --os-shell` contra producción.
- Sin `Dos-WiFi`.

Relacionado: [[modelado-de-amenazas]] · [[seguridad-de-agentes-llm]]
