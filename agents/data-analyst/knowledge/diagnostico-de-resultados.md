> Adaptado de goose-skills (gooseworks-ai, MIT): analyze-performance (diagnosis).

# Diagnóstico de resultados con evidencia

Una variación no es una explicación. Para cada métrica que se movió de forma relevante (contra la semana anterior y contra el promedio de 4 semanas, con la misma madurez), nombra las causas que encajan con una evidencia y un nivel de certeza cada una, y di qué causas descartaste y cómo.

## Antes de empezar
Busca primero en la memoria corporativa; pide lo que falte y márcalo FALTANTE:
- Métrica, definición (diccionario de data-lead), fuente, periodo, zona horaria y fecha de corte.
- Línea base: semanas previas y, si existe, el mismo periodo del año anterior.
- Bitácora de cambios: presupuesto, campañas, precios, menú o catálogo, horarios, cambios del sitio o del ERP, personal.
- Datos por segmento (canal, sucursal, producto, campaña) y no solo el total.
Analiza solo datos aportados. Sin datos, no hay diagnóstico: entrega qué falta.

## Antes de culpar a algo
- **Compara igual con igual:** mismos días de la semana, misma madurez, quincena contra quincena, temporada contra temporada, misma zona horaria, misma ventana de atribución.
- **Madurez de conversiones:** los últimos días del periodo aún no acumulan todas sus conversiones (las plataformas atribuyen con retraso; las ventas a crédito o los proyectos cierran después). Como referencia general, excluye los últimos ~3 días de conversiones de plataforma o márcalos inmaduros.
- **Ruido:** los conteos se comportan aproximadamente como Poisson, con desviación ≈ √n. 25 contra 36 ventas están a ~1.4 desviaciones: no es un resultado. Como referencia general, con menos de ~30 conversiones por grupo solo se leen diferencias de alrededor del doble.
- **Cambio de mezcla (Simpson):** el promedio total empeora porque el volumen se movió a un canal, sucursal o producto con otro nivel, no porque algo empeorara. Lee dentro de cada segmento antes de concluir.
- **Denominador:** producto nuevo, cambio de precio, agotado del producto estrella o cambio del sitio mueven la conversión sin importar la publicidad.

## Causas, en este orden
| Causa | La confirma | La descarta |
|---|---|---|
| **Medición rota** | Días en cero con gasto o con operación normal; salto o desplome en la proporción plataforma ÷ ventas reales; UTM que desaparecen; cambio de definición o de fuente | Proporción estable (di los números) |
| Gasto o mezcla | La inversión o el volumen se movió entre campañas, canales o productos | Mezcla estable |
| Temporada o calendario | Mismo periodo del año anterior se movió igual; quincena, puente, festivo, regreso a clases, clima | Año anterior estable |
| Desgaste creativo | CTR bajando 2-3 semanas con gasto estable y frecuencia subiendo | CTR estable |
| Oferta, precio o existencias | Terminó o empezó una promoción; cambio de precio; agotado | Nada en el periodo |
| Sitio o atención | Más clics pero menos compras o reservas; página lenta o rota; WhatsApp sin respuesta | Embudo estable |
| Competencia | Lanzamiento o promoción documentada en el periodo | Nada documentado |
| Orgánico o prensa | Publicación viral, nota, búsqueda de marca al alza | Nada |

**Revisa la medición primero.** Una falla de medición contamina todas las cifras posteriores: va arriba del reporte, marca cada cifra afectada como sospechosa y bloquea decisiones de escala hasta corregirla. Si la medición no existe por diseño (leads sin campo de origen, sin UTM), es también un hallazgo, con qué activar, quién lo hace y qué decisión desbloquea.

Sin datos de frecuencia, CPM o embudo, esas causas quedan como **candidatas sin confirmar**: dilo y pide la exportación si la decisión depende de ello.

## Cómo escribir cada causa
*Causa (certeza: confirmada / probable / primera lectura): evidencia con números y fuente.* Ejemplo ficticio de formato:
> 1. Cambio de mezcla (probable): 60 % de los pedidos pasó de sucursal Centro a Norte, cuyo ticket es menor; dentro de cada sucursal el ticket no cambió.
> Descartada — medición rota: pedidos del ERP ÷ pedidos en tablero se mantuvo en la misma proporción.
Correlación no es causalidad: si no hay mecanismo y evidencia, es hipótesis y se presenta como tal.

## Qué entregas
Arriba, alertas de medición. Luego cada métrica movida: variación con periodo, base y madurez; causas con certeza y evidencia; descartadas; candidatas sin confirmar con el dato que falta; y la siguiente acción propuesta con responsable. Las decisiones (pausar, escalar, cambiar precio) las toma un humano. Las métricas propias de redes las define social-analyst; aquí se usan sus cifras, no se redefinen.

## Errores comunes
- Explicar ruido.
- Comparar un periodo inmaduro contra uno maduro.
- Culpar al creativo sin revisar mezcla ni medición.
- Una sola causa para todo cuando la evidencia apoya dos.
