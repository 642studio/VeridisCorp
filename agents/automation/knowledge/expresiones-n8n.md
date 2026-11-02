> Adaptado de n8n-skills (czlonkowski, MIT): n8n-expression-syntax.

# Expresiones de n8n y sus errores comunes

## Antes de empezar
Necesitas una muestra real de la salida del nodo anterior (estructura y nombres exactos de campos y nodos). Búscala en la memoria corporativa o pídela; sin muestra, marca las expresiones como FALTANTE de verificar. Una expresión escrita contra una estructura supuesta es la falla silenciosa más común.

## Formato
Todo valor dinámico va entre dobles llaves: `{{ $json.correo }}`. Sin llaves es texto literal; con una sola llave o con triple llave es inválido. El prefijo `=` solo aplica dentro del JSON del nodo, no al escribir en el campo.

## Variables base
- `$json` — el elemento actual: `{{ $json.cliente.nombre }}`, `{{ $json.items[0].id }}`.
- Campos con espacios, acentos o símbolos van con corchetes: `{{ $json['Fecha de pago'] }}`.
- Otro nodo, por nombre exacto (respeta mayúsculas): `{{ $('Buscar cliente').item.json.id }}`. La forma antigua `$node["Nombre"].json` también funciona; no olvides `.json`.
- `$now` — fecha actual (Luxon): `{{ $now.toFormat('yyyy-MM-dd') }}`, `{{ $now.plus({ days: 7 }) }}`. Revisa la zona horaria de la instancia antes de comparar fechas.
- `$env` — variables de entorno; en instancias endurecidas está bloqueado a propósito. Los secretos van en credenciales, nunca en expresiones.

## Webhook: los datos están en `body`
El nodo Webhook entrega `headers`, `params`, `query` y `body`. Lo que mandó el formulario o el sistema está en `{{ $json.body.campo }}`, no en `{{ $json.campo }}`.

## Dónde no van expresiones
- **Nodos Code:** JavaScript directo (`$json.body.nombre`, `$input.all()`), sin llaves.
- **Ruta del webhook:** fija, nunca dinámica.
- **Credenciales:** usa el sistema de credenciales.

## Orden para transformar datos
Detente en el primer paso que resuelva:
1. Los campos del propio nodo del servicio.
2. Un nodo nativo: Filter, IF/Switch, Summarize, Aggregate, Split Out, Merge, Remove Duplicates, Sort, Date & Time.
3. Una expresión corta en el campo que la usa (acceso, `.map().filter().join()`, ternario, fechas).
4. Un nodo Code, solo para bucles o recursión que ningún nodo expresa, estado entre ejecuciones o mucho volumen; con nota "Por qué Code".
Si la expresión necesita `const`, `if` o varias instrucciones, ya es código: pásala a un nodo o a Code.

## Funciones útiles
- `{{ $ifEmpty($json.nombre, 'cliente') }}` — valor por defecto.
- `{{ $json.items.pluck('precio').map(Number).sum() }}` — `sum()` falla con textos numéricos; convierte antes.
- `{{ $json.correos.unique() }}`, `{{ $json.ids.chunk(100) }}`, `{{ $json.texto.extractEmail() }}`.
- `{{ $json.fecha.toDateTime().format('yyyy-MM-dd') }}`.
- Llamar una función sobre `null` truena: protege con `?.` o `$ifEmpty`.
- `$jmespath(objeto, "consulta")`: primero el objeto; textos con comilla simple, números entre acentos graves. Un error de sintaxis devuelve `null` o `[]` sin avisar.

## Ramas que se juntan
Después de IF, Switch o Merge, `$json` es "lo que llegó al último" y puede cambiar entre ejecuciones. Pon un nodo NoOp con nombre claro en la unión y referencia ese nodo por nombre. En flujos con ramas, prefiere `$('Nodo').item.json.x` sobre `$json.x`. Borra los Set que solo renombran campos para el siguiente nodo; consérvalos cuando crean algo (constante, carga útil, respuesta de error, salida de subflujo).

## Cómo depurar
Un error de JavaScript dentro de `{{ }}` suele convertirse en `null` y el nodo marca éxito. Por eso:
- Revisa la vista previa del editor de expresiones con datos reales: ahí sí aparece el error.
- Tras una prueba, revisa los valores: `null` donde esperabas dato es el síntoma.
- "No se puede leer la propiedad X de undefined": la ruta padre no existe; revisa la estructura.

## Qué entregar
Para cada campo con expresión: nodo, campo, expresión, ejemplo de entrada y salida esperada, y caso vacío. El revisor debe poder comprobarlo con la muestra.

## Errores comunes
- Olvidar `body` en datos de webhook.
- Nombre de nodo con mayúsculas o espacios distintos.
- Punto en vez de corchetes: `$json.items.0` en lugar de `$json.items[0]`.
- Concatenar texto fuera de las llaves esperando que se evalúe.
- Escribir `{{ }}` dentro de un nodo Code: ahí se usa JavaScript directo.
