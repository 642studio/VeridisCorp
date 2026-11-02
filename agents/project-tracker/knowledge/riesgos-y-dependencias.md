> Adaptado de headcount (cbrock84, MIT): dependency-and-risk-management.

# Registro vivo de riesgos y dependencias

Esto es riesgo de entrega: lo que podría impedir que el trabajo llegue. El riesgo de la empresa (legal, fiscal, financiero) es de otras áreas y no se mezcla aquí.

## Antes de empezar
Busca en la memoria corporativa el plan vigente, el registro anterior, el pre-mortem de `project-planner` y la última minuta. Pide lo que falte y márcalo FALTANTE: quién es dueño de cada entrega externa, qué fechas están confirmadas por escrito y qué está solo "platicado".

## Dependencias: compromiso o deseo
Una dependencia que el equipo o proveedor dueño no ha aceptado con fecha es un deseo. Para cada una registra:
- Qué se necesita exactamente, de quién (por nombre), para cuándo y qué pasa si llega tarde.
- Evidencia del compromiso: tarea en su lista, correo o mensaje con fecha. Una mención en junta no cuenta.
- Dirección: lo que nos deben **y** lo que debemos. Todos recuerdan lo primero y olvidan lo segundo.
- Un salto más: la dependencia de tu dependencia (el cliente que espera a su diseñador, el proveedor que espera material). Sobre todo donde aparece varias veces la misma persona o equipo.

## Riesgos que sirven
Cada riesgo:
- **Específico:** no "retraso del cliente", sino "el cliente aprueba guiones solo los viernes; el rodaje es el martes siguiente y no hay margen".
- **Medido en dos ejes:** probabilidad e impacto (alto/medio/bajo basta). La respuesta cambia entre una molestia probable y una catástrofe improbable.
- **Con dueño que puede actuar**, no el PM que solo reporta.
- **Con fecha de decisión:** el último día en que mitigar todavía es posible. Es el campo que más se omite y el que vuelve operativo el registro.

## Respuestas
Evitar (cambiar el plan), reducir probabilidad o impacto, transferir a quien lo cargue mejor (proveedor, seguro, cláusula; verificar con el abogado) o aceptar. **Aceptar es válido solo si es explícito y con nombre de quien aceptó.** Distingue mitigación (baja la probabilidad) de contingencia (qué hacemos si pasa); los riesgos serios necesitan ambas, preparadas antes.

## Señales de retraso
Revísalas cada semana; cualquiera merece una línea en el reporte:
- Lo que falta no baja al ritmo necesario.
- Tareas "casi listas" o "al 90%" por más de una semana.
- La ruta crítica cambió y nadie lo dijo.
- Una dependencia sin evidencia de compromiso a menos de una semana de su fecha.
- Un riesgo cerca de su fecha de decisión sin mitigación iniciada.
- Respuestas del cliente o proveedor que tardan más que antes.
- Acciones de la minuta que se repiten sin cerrarse.
No inventes actividad: si no hay dato nuevo, el estado es "sin información desde <fecha>".

## Escalar temprano y concreto
Escala cuando la decisión supera tu autoridad o se acerca la fecha de decisión, no cuando el riesgo ya ocurrió (eso ya es reporte de estado). Una escalada útil dice: decisión requerida, opciones con su consecuencia, quién decide y para cuándo. "Me preocupa X" se agradece y no pasa nada.

## Formato
```
| id | riesgo o dependencia | tipo | prob. | impacto | dueño | fecha de decisión | respuesta | evidencia | estado | cambió desde <fecha> |
```
Revisión por excepción: qué cambió y qué se acerca a su fecha. Leer todo el registro en voz alta es la forma de que deje de leerse.

## Qué decide y qué escala
Seguimiento detecta, mide y propone respuestas. Aceptar un riesgo, cambiar el plan o pedir algo a un cliente o proveedor lo decide el PM con el humano responsable.

## Errores comunes
- Cargar una dependencia que el dueño no aceptó.
- Riesgos sin dueño o sin fecha de decisión.
- Aceptar un riesgo sin decir quién lo aceptó.
- Escalar una preocupación sin nombrar la decisión.
- Registrar riesgos una vez para la junta de arranque y no volver a abrir el registro.
