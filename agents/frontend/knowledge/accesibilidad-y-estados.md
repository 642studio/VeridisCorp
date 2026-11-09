> Adaptado de ux-ui-agent-skills (plugin87, MIT): accessibility/wcag-checklist, aria-patterns, cognitive; components/feedback, forms-advanced; workflows/design-qa.

# Accesibilidad WCAG 2.2 y estados de componentes

Piso propuesto: WCAG 2.2 AA; Adrián confirma por proyecto. Si un contrato o una norma mexicana exige más (p. ej. sitio de gobierno), verificar con el abogado o la fuente oficial vigente.

## Antes de empezar
Busca primero en la memoria corporativa y en el repo; pide lo que falte y márcalo FALTANTE: flujo o componente, contrato de API con sus errores, diseño aprobado, idiomas y si hay video.

## Criterios por prioridad
**P0, bloquea a alguien:**
- 1.1.1 texto alternativo (`alt=""` si es decorativo); 1.2.2 subtítulos en video.
- 1.3.1 estructura en marcado (`h1`–`h6`, listas, `th`, `label`); 1.3.2 orden de lectura = orden visual.
- 1.4.1 nunca solo color (error = ícono + texto); 1.4.3 contraste 4.5:1, grande 3:1; 1.4.11 bordes de campo, íconos y foco 3:1.
- 1.4.4 zoom 200 % sin pérdida; 1.4.10 reflujo a 320 px sin scroll horizontal.
- 2.1.1 todo por teclado; 2.1.2 sin trampas de foco; 2.4.3 orden de foco lógico; 2.4.7 foco visible.
- 2.4.11 el foco no queda tapado por una cabecera fija (nuevo en 2.2).
- 2.5.8 objetivos de al menos 24×24 px o con espacio suficiente (nuevo en 2.2).
- 2.2.1 tiempos ajustables; 2.2.2 pausar lo que se mueve; 2.3.1 nada destella más de 3 veces por segundo.
- 2.4.1 saltar al contenido; 2.4.2 título único; 2.4.4 enlaces con propósito, no "clic aquí"; 2.5.3 el nombre accesible contiene la etiqueta visible.
- 3.1.1 `lang="es"`; 3.2.1 y 3.2.2 enfocar o cambiar un campo no navega ni envía.
- 3.3.1 errores descritos en texto; 3.3.2 cada campo con etiqueta; 3.3.8 inicio de sesión sin acertijos y permitiendo pegar y gestores de contraseñas (nuevo en 2.2).
- 4.1.2 nombre, rol y valor en todo componente; 4.1.3 mensajes de estado anunciados sin mover el foco.

**P1, dificulta:** 1.3.5 `autocomplete` en datos personales; 1.4.12 resiste espaciado de texto ampliado; 1.4.13 lo que aparece al pasar el mouse se cierra con Esc; 2.5.7 alternativa a arrastrar (nuevo); 3.2.6 ayuda siempre en el mismo lugar (nuevo); 3.3.3 sugerir la corrección; 3.3.4 revisar, confirmar o deshacer en dinero, datos y trámites; 3.3.7 no pedir dos veces lo mismo (nuevo); 3.2.3 y 3.2.4 navegación y nombres consistentes.

## Cómo probar
1. Solo teclado, el flujo completo.
2. Lector de pantalla en el flujo principal: VoiceOver (Mac), NVDA (Windows), Orca (Linux).
3. Zoom 200 %, ancho de 320 px, escala de grises o simulación de daltonismo.
4. `prefers-reduced-motion` activo.
5. axe, Lighthouse o WAVE: cero violaciones serias o críticas es el piso, no la prueba; solo detectan una parte de los problemas.
6. Cubre los estados que cambian la semántica (error, cargando, deshabilitado, expandido, seleccionado), no solo el inicial.
Reporta cada punto como pasa, falla o no revisado, con el nivel de evidencia (ejecutada o inspeccionada).

## Patrones ARIA esenciales
- HTML nativo primero (`button`, `a`, `input`, `dialog`). `role="button"` en un `div` exige `tabindex="0"`, Enter y Espacio.
- **Diálogo modal:** `aria-modal`, `aria-labelledby`; al abrir, foco al primer elemento; Tab cicla dentro; Esc cierra; al cerrar, el foco vuelve al disparador; fondo `inert`.
- **Pestañas y grupos compuestos:** tabindex itinerante (solo el activo tiene `0`), flechas, Inicio y Fin; Tab sale del grupo.
- **Combobox:** `aria-expanded`, `aria-controls`, `aria-activedescendant`; ↑↓, Enter, Esc; anunciar cuántos resultados hay.
- **Regiones vivas:** `assertive` solo para errores críticos; `polite` para éxito; `role="status"` para conteos y carga. No muevas el foco a una alerta salvo que exija acción.
- **Foco:** contorno de 2 px con 3:1 y `outline-offset: 2px`. Nunca se quita.

## Estados de componente
Todo control: inicial, hover, foco, presionado, deshabilitado, cargando, error; más abierto o seleccionado si aplica.
- **Aviso emergente:** éxito e información se cierran solos; los errores persisten; nunca cierres solo algo que exige acción.
- **Skeleton:** misma geometría que el contenido final; `aria-busy` en la región y `aria-hidden` en el esqueleto; sin brillo animado con movimiento reducido.
- **Progreso:** `role="progressbar"` con `aria-valuenow/min/max` (sin `valuenow` si es indeterminado); anuncia hitos, no cada tic.
- **Vacío:** primer uso, sin resultados (limpiar filtros), vaciado, error o permiso. Título como encabezado real y la acción principal como siguiente foco.

## Formularios
- Etiqueta visible y asociada; formato y requisitos antes de enviar.
- Error junto al campo con `aria-invalid` y `aria-describedby`, anunciado; conserva lo capturado.
- Fechas: se pueden escribir, no solo elegir en calendario; formato local (dd/mm/aaaa).
- Archivos: `input type="file"` real por teclado; arrastrar es extra. El error dice tipo y límite.
- Deslizador: `aria-valuetext` legible ("$500 MXN").
- Carga cognitiva: una acción primaria por vista, "Paso 2 de 4", lenguaje llano, sin tiempo límite o con aviso y prórroga, texto sin justificar.

## Qué entregas
Tabla criterio | estado | evidencia | prioridad, y estados cubiertos por componente. software-qa verifica; aceptar una excepción a AA lo decide un humano y queda registrada.

## Errores comunes
- Tomar el escáner automático como prueba.
- Quitar el anillo de foco por estética.
- ARIA sobre un `div` habiendo elemento nativo.
