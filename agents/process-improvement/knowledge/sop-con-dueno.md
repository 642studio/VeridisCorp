> Adaptado de claude-skills (alirezarezvani, MIT) y headcount (cbrock84, MIT): knowledge-ops, process-design.

# SOP con dueño y señal de éxito por paso

Un procedimiento estándar (SOP) vale si alguien nuevo puede seguirlo sin preguntar y si alguien responde cuando deja de servir. Se escribe solo para trabajo que ya se repitió varias veces de forma parecida; documentarlo antes congela la versión equivocada.

## Antes de empezar
Busca en la memoria corporativa el mapa del proceso (`mapeo-y-cuello-de-botella.md`), SOP anteriores y glosario. Pide lo que falte y márcalo FALTANTE:
- Dueño humano con nombre que **aceptó** serlo. Sin dueño no se entrega el SOP; queda como borrador.
- Qué dispara el proceso y con qué frecuencia.
- Sistemas y cuentas que usa (sin credenciales).
- Las 2 o 3 fallas más comunes y cómo se resuelven hoy.
- Si toca datos personales (LFPDPPP), dinero o facturación (CFDI): eso define revisiones extra con el área responsable.

## Estructura 5W2H
- **Quién:** dueño del SOP; quién ejecuta, quién aprueba, a quién se informa en cada paso.
- **Qué:** resultado del proceso y qué queda fuera.
- **Cuándo:** disparador y frecuencia.
- **Dónde:** sistemas y herramientas (ClickUp, 642APP, n8n, Drive, WhatsApp de la empresa).
- **Por qué:** para qué existe y qué falla previene. Un paso sin razón es candidato a eliminarse.
- **Cómo:** los pasos (formato abajo).
- **Cuánto:** tiempo esperado por ejecución y costo (horas, herramientas en MXN).

## Cada paso lleva seis cosas
1. **Responsable con nombre o puesto concreto**, no "el equipo" ni "operaciones".
2. **Duración esperada** con número y unidad.
3. **Señal de éxito observable:** "la factura aparece timbrada en el portal y el PDF y XML están en la carpeta del cliente", no "verificar que quedó".
4. **Señal de falla observable:** qué se ve cuando salió mal.
5. **Cómo deshacerlo**, o explícito: "no se puede deshacer; antes de hacerlo, confirma con <persona>".
6. **A quién escalar** si falla: persona o puesto concreto.
Si un paso no tiene las seis, márcalo como pendiente. Pasos que cambian algo de forma irreversible (enviar, pagar, publicar, borrar, cancelar un CFDI) siempre llevan confirmación humana previa.

## Casos no felices
Documenta las 2 o 3 fallas más comunes con su propio sub-procedimiento: el cliente no responde, falta un dato fiscal, el archivo llega en formato equivocado, la automatización falla a medias. Un SOP que solo cubre cuando todo sale bien abandona a la persona justo cuando más lo necesita.

## Control del documento
Encabezado con: dueño, versión, fecha de última revisión, próxima revisión (como referencia general, al menos una vez al año, y siempre que cambie una herramienta o una regla), y documentos relacionados. Sin fecha de revisión, el SOP envejece sin que nadie lo note. Cuando uses un término propio (anticipo, entrega, ronda), que signifique lo mismo en todos los SOP; si no, va al glosario.

## Formato del paso
```
### Paso N — <acción>
Responsable: <nombre o puesto> · Duración: <n min/h>
Hacer: <instrucción concreta>
Éxito: <qué se ve>   Falla: <qué se ve>
Deshacer: <cómo | no reversible: confirmar con …>
Escalar a: <persona o puesto>
```

## Señal de éxito del SOP completo
Además de la de cada paso, define la del proceso: una medida con línea base y meta (tiempo total, casos con retrabajo, errores que llegan al cliente) y quién la revisa. Si no se mueve después de implantarlo, el SOP no resolvió el problema.

## Qué decide y qué escala
Mejora de procesos redacta y valida estructura. El dueño del proceso aprueba el contenido; el COO lo da de alta como proceso oficial. Lo laboral o fiscal se confirma con RH, el contador o el abogado.

## Errores comunes
- SOP en lote sin dueño para cada uno.
- Señales vagas: "revisar que funcione".
- Solo el camino feliz.
- Confundir validar estructura con validar contenido: un SOP completo puede decir algo equivocado.
- Arreglar una falla repetida agregando "recordar…" en vez de cambiar el sistema.
