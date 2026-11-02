> Adaptado de claude-skills (alirezarezvani, MIT): agent-regression-evals, llm-cost-optimizer.

# Evaluar agentes antes de cambiar prompt o modelo, y costo por función

Los agentes no son deterministas: una sola corrida no distingue una regresión de una moneda al aire. Y un resultado final correcto puede esconder una llamada a una herramienta que nunca debió hacerse. Ningún cambio de instrucciones, knowledge, modelo o herramienta se aprueba sin comparar contra la versión actual.

## Antes de empezar
Busca primero en la memoria corporativa y en el repo (`docs/model-routing.md`, la política de modelos y el registro de llamadas del motor); pide lo que falte y márcalo FALTANTE:
- Qué cambia exactamente (archivo, perfil, modelo, herramienta) y por qué.
- Casos de evaluación existentes por agente y su último resultado.
- Registro de llamadas por agente, etapa y capacidad, con tokens y costo si el motor ya los guarda. Si no existe, ese es el primer entregable.
- Piso de calidad y presupuesto mensual en MXN que fije Adrián.

## Suite de casos
- Empieza con fallas reales (de la memoria corporativa y revisiones), no con casos inventados: como referencia general, 20 a 50 casos por agente crítico, balanceados entre "debe hacer" y "no debe hacer".
- Cada caso: entrada, criterio de aprobación, si es crítico, herramientas obligatorias y prohibidas.
- Casos críticos: seguridad, envíos, dinero, datos personales, aprobaciones humanas. Nunca se ponen en cuarentena.

## Método
1. Corre cada caso al menos 3 veces en la versión actual y en la candidata, desde un entorno limpio por corrida (sin memoria, archivos ni filas de corridas anteriores).
2. Califica la trayectoria donde importa: pasos obligatorios presentes, exploración inofensiva permitida; una herramienta prohibida bloquea siempre.
3. Separa casos inestables (pasan a veces) de estables antes de comparar.
4. Promedia dentro de cada caso y compara por pares caso contra caso; las corridas del mismo caso no son observaciones independientes.
5. Reporta dos números: pasa al menos una vez en k (sirve para una demo) y pasa las k veces (la confiabilidad que vive el usuario). La distancia entre ambos es la inestabilidad. Ejemplo de la fuente: 75 % por corrida da cerca de 42 % de pasar 3 de 3.

## Bloquea el cambio si
- Hay una caída clara en la comparación por pares.
- Un caso crítico que pasaba siempre falla en alguna corrida.
- Falta un caso de la versión actual en la corrida candidata: borrar un caso es la corrección falsa más barata.
- Hay cuarentena sin responsable o sin fecha de vencimiento, o que cubre un caso crítico.
- Aparece una llamada a herramienta prohibida.
Advierte, y decide un humano, si la caída es pequeña con pocos casos o si el costo sube más de lo tolerado. "Sin caída significativa" con 8 casos no es aprobación: dilo junto al veredicto.

## Costo por función
1. **Mide primero.** Por llamada: agente, etapa, capacidad, perfil, modelo, tokens de entrada y salida, latencia y costo calculado con la lista de precios vigente del proveedor (verificar en su sitio; los precios cambian).
2. **Encuentra lo que más gasta:** ordena por función × modelo × tokens; casi siempre son pocas funciones.
3. **Asigna perfil por complejidad**, no por defecto: clasificación, extracción y formato a un perfil económico; razonamiento de varios pasos, código y revisión a uno superior. La política de modelos ya permite regla por agente, etapa y capacidad.
4. **Controla la salida:** límite de tokens por perfil o función, no global; salidas estructuradas en lugar de texto libre.
5. **Contexto estable y cacheable:** instrucciones y knowledge que no cambian entre llamadas son candidatos a caché del proveedor; verifica que el proveedor y el adaptador lo soporten.
6. **Comprime con cuidado:** quita relleno, nunca instrucciones críticas; un prompt ambiguo provoca reintentos que borran el ahorro.
7. **Vigila:** gasto por función y por semana, alerta al acercarse al presupuesto.
Cada ahorro propuesto pasa por la misma evaluación: abaratar que baja calidad no es ahorro.

## Qué entregas
Comparación actual contra candidata (casos, corridas, ambos números de confiabilidad, casos críticos, trayectorias, costo por función), veredicto (pasa / advierte / bloquea) con su razón, y la propuesta de cambio de política o de prompt. Etiqueta cada cifra como medida, estimada o supuesta. Aplicar el cambio lo aprueba Adrián.

## Errores comunes
- Comparar una sola corrida por caso.
- Bajar temperatura para aparentar menos variación.
- Cambiar prompt y modelo a la vez: no se sabe cuál movió el resultado.
- Optimizar sin registro de tokens.
- Prometer porcentajes de ahorro sin medición propia.
