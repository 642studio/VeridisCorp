> Escrito para VeridisCorp (ideas de reelmimic, MIT, y OpenMontage, AGPL-3.0; texto propio).

# Análisis de referencia y especificaciones por plataforma

## Antes de empezar

Pide el video de referencia (archivo o enlace), qué se quiere tomar de él (ritmo, energía, tipo de cámara) y en qué plataforma se publicará el nuestro. Busca en la memoria corporativa videos previos de la marca. Lo que falte, FALTANTE. La referencia se estudia; nunca se reutilizan sus tomas, audio ni textos.

## Medir la referencia

Si es grabación de pantalla, primero recorta la interfaz del teléfono: medir con barras incluidas falsea todo. Luego arma la tabla de planos:

| # | Inicio | Fin | Duración | Tamaño (general, medio, primer plano) | Cámara (quieta, acerca, aleja, paneo, inclina, gira) | Qué cambia | ¿Corta en beat? |

Con la tabla calcula:
- Número de planos, duración media, mínima y máxima; cortes por minuto.
- BPM de la música y duración media del plano en beats (duración media ÷ 60/BPM). Ejemplo: 0.9 s a 120 BPM ≈ 2 beats por plano.
- Porcentaje de cortes que caen en beat y de planos con cámara en movimiento.
- Momento pico: dónde la música sube y golpea (suele marcarse con un destello o un corte más denso).
- Tono visual: oscuro o claro, contraste, cuántos colores dominan.
- Apertura (qué hay en el cuadro 0) y cierre.

Quien tenga FFmpeg puede apoyarse en la detección de cambios de escena y en el filtro `ebur128`; la tabla final se revisa viendo el video, no solo con números.

## Copiar el ritmo, no el contenido

Se traslada: duración media de plano, relación con el beat, curva de energía (dónde está el pico), proporción de movimiento de cámara y tipo de apertura. No se traslada: guion, frases, música, personas, personajes, logos, paleta ni tipografía; esos salen de la marca (ver `motion-sin-presentacion.md`). Música propia o con licencia de BPM parecido. El pico va cerca del final, antes del CTA. Entrega la tabla de la referencia junto al plan del nuestro, plano por plano, para que el revisor compare.

## Ritmo en video corto

- Un cambio visual cada 1 a 3 s (corte, cambio de tamaño de plano, objeto que entra, cambio de fondo); ningún cuadro congelado.
- Voz o golpe sonoro en el primer segundo; el cuadro 0 ya tiene algo que mirar y algo moviéndose.
- Cada bloque de texto en pantalla de 2 a 4 s y con tiempo de lectura suficiente (lint `line_unread`).
- Subtítulos siempre: mucha gente ve sin sonido.
- La duración sale de lo que hay que decir, no de un número objetivo.

## Plataformas (verificar vigentes antes de cada entrega)

| Plataforma | Formato | Duración | Qué tapa la interfaz |
|---|---|---|---|
| Reels de Instagram | 9:16, 1080×1920 | Hasta unos 3 min | Arriba, abajo (texto y audio) y columna derecha de botones |
| TikTok | 9:16, 1080×1920 | Varios minutos | Abajo (descripción) y columna derecha |
| YouTube Shorts | 9:16, 1080×1920 | Hasta unos 3 min | Abajo y columna derecha |
| Reels de Facebook | 9:16, 1080×1920 | Verificar límite actual | Abajo y columna derecha |

Las cuatro cambian sus límites seguido: confirma en la ayuda oficial de cada una. Zona segura: usa la regla de la casa de `hyperframes-estandar-de-calidad.md` (nada importante en los primeros 168 px ni debajo de 1330 px) y deja además libre un margen derecho para los botones. Un solo master vertical sirve para las cuatro si respeta esa zona.

## Volumen

- Referencia general: −14 LUFS integrados y pico real no mayor a −1 dBTP. Cada plataforma normaliza a su manera: verificar.
- La voz siempre por encima de la música; efectos cortos en las acciones visibles.
- Mide el MP4 renderizado, no las pistas por separado.

## Errores comunes

- Medir sin recortar la interfaz de una grabación de pantalla.
- Copiar la música o la estética de la referencia en vez de su ritmo.
- Promediar duraciones sin ver dónde está el pico.
- Dar por buenas las especificaciones de plataforma de memoria.
- Revisar volumen en las pistas y no en el render final.
