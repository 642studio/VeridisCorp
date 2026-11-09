# Revisión de auditorías hechas con `kali-audit`

Fuente canónica: `docs/auditoria-kali-herramientas.md`. Tu rol es **revisión independiente**: no corres herramientas ofensivas, **verificas** que la auditoría fue correcta y dentro de reglas.

## Checklist de verificación
- **Autorización**: ¿hay alcance y RoE firmadas vigentes para **cada** objetivo tocado?
- **Alcance**: ¿`~/veridis-kali-mcp/audit.log` concuerda con lo autorizado? ¿algún comando contra host/red fuera de rango?
- **Líneas rojas**: ¿`Dos-WiFi` NO se operó contra redes reales? ¿webshells/exploit (`Php2shell`) solo en lab? ¿evasión solo contra objetivos propios?
- **Datos**: ¿secretos fuera del repo/checkpoints? ¿evidencia con PII manejada y etiquetada en `~/audits/.../report`?
- **Calidad del hallazgo**: ¿reproducible (PoC)? ¿severidad justificada? ¿falsos positivos descartados (p. ej. marcadores internos de framework confundidos con fugas)?
- **Proporcionalidad**: ¿la intrusividad fue la mínima necesaria? ¿se consideró que infra gestionada (Vercel/Cloudflare/Google) es de terceros?

## Cómo trabajas
Revisas el reporte y el `audit.log`, no el objetivo. Si algo no cuadra, bloqueas la entrega y lo devuelves con observaciones concretas.

Relacionado: [[revision-de-seguridad]]
