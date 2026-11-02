> Adaptado de headcount (cbrock84, MIT): systematic-debugging, test-driven-development.

# Depuración por causa raíz

Regla: no hay corrección antes de probar la causa. Un cambio que hace desaparecer el síntoma sin explicación no arregló nada; movió la falla a donde nadie está mirando.

## Antes de empezar
Busca primero en la memoria corporativa (incidentes y decisiones previas) y en el historial de git; pide lo que falte y márcalo FALTANTE:
- Síntoma exacto: mensaje de error, traza, entrada que lo provoca, captura.
- Desde cuándo pasa y qué cambió cerca de esa fecha (commits, dependencias, configuración, datos, servidor).
- Dónde pasa: local, sandbox, servidor de la oficina; versión de Node y de PostgreSQL.
- Si alguien ya intentó corregirlo y qué hizo.

## Método
1. **Reproduce de forma determinista.** Si no ocurre a voluntad, no sabrás cuándo quedó corregido. "Intermitente" significa que aún no encuentras la variable: orden, tiempo, estado, entorno o datos.
2. **Reduce el área.** Divide a la mitad cada vez: qué commit (acota con `git log` y `git diff` sobre el historial), qué entrada, qué capa (frontend, API, consulta, flujo de n8n).
3. **Formula una hipótesis que pueda ser falsa.** "La consulta devuelve filas viejas después de escribir porque lee de la caché" es hipótesis; "algo anda mal con la caché" no.
4. **Pruébala directamente** con un log, una consulta o una prueba en el sandbox. Pruébala; no la deduzcas.
5. **Explica el síntoma completo.** Si tu causa explica el error pero no por qué empezó el martes, encontraste un error, no el error.
6. **Corrige y verifica revirtiendo.** Escribe primero una prueba que falle por el error; aplica la corrección y mírala pasar; quita la corrección y confirma que vuelve a fallar. Ese paso prueba causalidad y es el que más se omite.

## Lugares típicos en el stack
- **Zonas horarias:** fechas sin zona, servidor en UTC contra usuarios en Sonora (America/Hermosillo, sin horario de verano). Un reporte "del día" que pierde o duplica registros suele ser esto.
- **Montos:** flotantes para dinero, redondeo de IVA por línea contra por total.
- **Asincronía:** promesas sin `await`, carreras entre dos peticiones, transacciones que no envuelven todo lo dependiente.
- **Consultas:** joins que multiplican filas, filtros que excluyen nulos sin querer, N+1.
- **Contratos:** un campo que cambió de nombre y un flujo de n8n que lo sigue esperando.
- **Entorno:** variable de entorno faltante, versión distinta entre la Mac y el servidor Linux.

## Antipatrones
- **Cambios en ráfaga:** tocar varias cosas a la vez; luego no sabes cuál corrigió.
- **"Seguro es una falla aleatoria":** no es diagnóstico. Una prueba intermitente reporta una carrera, una dependencia de orden o estado compartido real.
- **Corregir el síntoma:** atrapar la excepción, agregar reintento o subir el timeout sin saber qué la lanzó.
- **Confiar en la ubicación del error:** donde aparece rara vez es donde se origina.
- **Cambiar entorno y código en el mismo paso.**
- **Probar en producción para ver si funciona.** Reproduce primero donde puedas observar.

## Cuándo parar y escalar
- Tres hipótesis descartadas sin acercarte: entrega lo que descartaste y cómo, y pide datos o acceso.
- La reproducción exige datos reales de clientes: pide una copia anonimizada; no pidas credenciales ni datos personales en el chat.
- La causa está en infraestructura, seguridad o datos: coordina con su área vía software-lead.

## Qué entregas
Reproducción (pasos o prueba), causa probada con su evidencia, corrección propuesta como diff, prueba de regresión, y la verificación: comando corrido en el sandbox con su salida, antes y después, incluida la reversión. Nombra lo que descartaste y cómo. Si no pudiste reproducir, dilo y no propongas corrección; propone qué observar.

## Errores comunes
- Cerrar un error sin una prueba que fallaba antes y pasa después.
- Dejar como "corrección" una ayuda de depuración: timeout ampliado, validación desactivada, excepción tragada.
- Reportar "ya funciona" desde una ejecución vieja.
- Debilitar o saltar una prueba para que quede en verde.
