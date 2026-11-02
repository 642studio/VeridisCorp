> Adaptado de claude-skills (alirezarezvani, MIT), headcount (cbrock84, MIT) y agent-skills (addyosmani, MIT, vía agentic-awesome-skills): dependency-auditor, vulnerability-management, security-and-hardening.

# Auditoría de dependencias y licencias

La mayoría de los hallazgos estarán en código de terceros: paquetes npm de las apps en TypeScript, imágenes de contenedor, nodos comunitarios de n8n, servidores MCP, skills y knowledge adaptados. El puesto audita y propone; las actualizaciones las aprueba y aplica un humano.

## Antes de empezar

Busca en la memoria corporativa y en los repos (con `repo.read` si está declarado) y pide lo que falte, marcándolo FALTANTE:
- Repos y ramas en alcance; `package.json` y lockfile de cada uno.
- Salida reciente de `npm audit` (u otra herramienta) y su fecha.
- Política de licencias de la empresa; si no existe, propón una al CISO.

## Inventario primero

Si no se puede producir la lista de lo que se usa, no se puede contestar "¿estamos afectados?" cuando salga la próxima falla masiva en una librería, y esa pregunta llega con reloj. Por repo: dependencias directas y transitivas (del lockfile), versión, si es de ejecución o solo de desarrollo, y origen. Un repo sin lockfile es un hallazgo por sí mismo.

## Vulnerabilidades en dependencias

- Cruza las versiones con avisos reales (`npm audit`, `cve.lookup` sobre el NVD). Un conjunto de patrones offline es una capa de humo, no reemplaza avisos vigentes.
- Prioriza como cualquier vulnerabilidad: ¿se llama la función vulnerable?, ¿es de ejecución o de desarrollo?, ¿es explotable en este despliegue?, ¿hay explotación activa?
- Si se pospone una corrección, documenta la razón y una fecha de revisión.
- Tras actualizar, vuelve a correr la auditoría y confirma que no quedan altas o críticas antes de cerrar.

## Riesgo de cada actualización

| Riesgo | Tipo de cambio | Manejo propuesto |
|---|---|---|
| Bajo | Parche, corrección de seguridad | Aplicar pronto |
| Medio | Versión menor con funciones nuevas | Agrupar en la actualización programada |
| Alto | Versión mayor, cambios de API | Tarea propia con pruebas |
| Crítico | Cambios incompatibles conocidos | Migración planeada con reversa |

Mantener al día de forma continua: una actualización pequeña y frecuente es rutina; un salto de dos años es un proyecto, y el proyecto se pospone.

## Cadena de suministro

`npm audit` no detecta paquetes maliciosos ni con nombre parecido. Revisa además:
- Lockfile versionado e instalación reproducible (`npm ci` en lugar de `npm install` en compilación).
- Paquetes nuevos: mantenimiento, autor, si de verdad hacen falta. Cada dependencia es superficie de ataque.
- Scripts `postinstall` en paquetes desconocidos: ejecutan código al instalar.
- Nombres parecidos a paquetes conocidos.
- Qué pasaría si se compromete la cuenta de un mantenedor.
- Skills, knowledge y servidores MCP de terceros: versión fijada, origen registrado, licencia revisada, sin scripts ejecutados sin revisión.

## Licencias

- **Permisivas** (MIT, Apache 2.0, BSD, ISC): uso normal, conservando el aviso y la atribución.
- **Copyleft débil** (LGPL, MPL): revisar cómo se enlaza o modifica.
- **Copyleft fuerte** (GPL, AGPL): riesgo de obligar a liberar código propio; AGPL también al ofrecerse como servicio en red. Escalar.
- **No comerciales, BSL, FSL, "Unknown" o sin licencia**: no usar sin decisión explícita; para documentos, solo ideas.
- **CC BY / CC BY-SA**: atribución obligatoria; BY-SA obliga a compartir igual.

Esto es orientación técnica, no opinión legal: los casos dudosos van al CISO y a un abogado. Una licencia no detectada se reporta como desconocida, nunca como permisiva.

## Ritmo sugerido (como referencia general)

Revisión de vulnerabilidades en cada cambio de dependencias; licencias mensual; auditoría completa trimestral. El CISO fija la cadencia real.

## Qué entregar

Por repo: cobertura (qué se leyó y qué no), tabla paquete | versión | uso | aviso | alcanzable | prioridad | actualización propuesta | riesgo, y lista de conflictos de licencia para decisión humana.

## Errores comunes

- Dar por limpio un repo porque la herramienta no devolvió nada o falló.
- Saltar varias versiones mayores de golpe sin pruebas.
- Ignorar dependencias transitivas.
- Silenciar un falso positivo sin dejar la razón documentada.
