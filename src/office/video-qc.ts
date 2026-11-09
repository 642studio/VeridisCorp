// Revisión automática de calidad (QC) del MP4 que produce video.render (src/office/tools.ts).
// Mide con FFmpeg, dentro de la misma imagen docker/video-renderer/ (Debian bookworm, FFmpeg 5.1),
// lo que hasta ahora se revisaba a mano (silencedetect, frames sueltos — ver
// docs/memoria-video-production-2026-11-04.md): arranque con movimiento, congelados, negros,
// silencios, ritmo de cortes y loudness. Nunca hace fallar el render: devuelve mediciones y
// hallazgos legibles para que video-production y su revisor decidan.
//
// Ideas adaptadas (no copiadas) de cinecode — scripts/qc.py y scripts/master_audio.py, de Sarp
// Yıldız (@sarpstar), MIT; ver docs/third-party-notices.md: la medida de movimiento del arranque
// (diferencia de luma entre cuadros consecutivos en gris a 160 px) y la normalización lineal en
// dos pasadas con loudnorm.
//
// Este módulo no lanza procesos por su cuenta: recibe un ShellRunner que ejecuta `sh -c <script>`
// (en producción, `docker run --entrypoint sh` sobre la imagen del renderizador; en pruebas,
// el sh local). Así el script y el parseo son exactamente los mismos en ambos lados.

// Umbrales de REFERENCIA, no calibrados todavía con un lote real de entregas — calibrar contra los
// videos aprobados por Adrián antes de convertir cualquiera en regla dura. Primera calibración
// (2026-11-08) contra `veridiscorp-antes-despues` (aprobado, 57.5 s/15 escenas, estilo HUD verde sobre
// casi-negro): con los valores de abajo da 0 congelados/negros reportables y una escena de ~4.8 s.
// De dónde sale cada uno:
// - Arranque: regla "gancho de 1-3s" y "el cuadro 0 es la miniatura" (knowledge/recetas-de-video.md).
//   Movimiento = diferencia media de luma (0-255, gris a 160 px) entre cuadros consecutivos; un
//   render de HyperFrames no tiene grano, así que un cuadro quieto mide 0.00.
// - Cortes: regla permanente de ritmo dopamínico (memoria 2026-11-04): cortes cada 2.5-4.5 s. El
//   puntaje `scene` de FFmpeg NO sirve para el estilo de la casa (fondo casi negro, poco contenido en
//   pantalla: el video aprobado mide 4 "cortes" en 57 s). En su lugar se compara el mapa de bordes
//   (edgedetect) entre muestras a 5 fps: un "cambio fuerte" es cuando cambia al menos la mitad de los
//   bordes visibles, sea corte seco, barrido o cambio de texto — independiente del brillo del fondo.
// - Congelados/negros: freezedetect a resolución completa (reducido a 320 px se pierden los cambios
//   pequeños y marca congelado lo que no lo es) y blackdetect con pic_th=0.999 (con 0.98, una pantalla
//   oscura con texto verde chico cuenta como "negro"). Se mide desde 2 s y se reporta desde 3 s: el
//   video aprobado sostiene cuadros ~2.3 s mientras habla la voz. El cierre (end card) tiene su propio
//   margen.
// - Silencio: la voz entra en el primer 1-2 s y cada escena dura su voz + 0.2-0.5 s de respiro;
//   1 s de silencio ya es un hueco audible.
// - Loudness: −14 LUFS integrados y pico real ≤ −1 dBTP, el objetivo habitual de redes.
export const VIDEO_QC_THRESHOLDS = {
  hookWindowS: 2,            // ventana del arranque que se mide
  hookMotionStep: 0.05,      // un paso entre cuadros por encima de esto cuenta como "se mueve"
  hookMaxStillStartS: 0.5,   // el primer movimiento debe llegar antes de esto
  hookMinMovingShare: 0.5,   // al menos la mitad de los pasos de la ventana deben moverse
  freezeNoiseDb: -60,        // freezedetect n=
  freezeDetectS: 2,          // freezedetect d= (lo que entra a la métrica freezeS)
  freezeFindingMinS: 3,      // congelado reportable a mitad del video
  endHoldMaxS: 4,            // congelado reportable si es el cierre (end card / CTA)
  blackMinS: 0.1,            // blackdetect d=
  blackPixelTh: 0.10,        // blackdetect pix_th=
  blackPictureTh: 0.999,     // blackdetect pic_th=
  blackFindingMinS: 0.5,     // negro reportable (cualquiera en el cuadro 0 se reporta siempre)
  silenceNoiseDb: -50,       // silencedetect n=
  silenceDetectMinS: 0.5,    // silencedetect d=
  silenceFindingMinS: 1.0,   // silencio reportable
  beatSampleFps: 5,          // muestras por segundo para medir cambios de imagen
  beatEdgeChange: 0.5,       // fracción de bordes que debe cambiar entre dos muestras para contar como corte
  beatMinContent: 0.05,      // promedio mínimo del mapa de bordes (0-255) para comparar; debajo, ambas
                             // muestras están vacías y no hay nada que pueda "cambiar"
  maxSceneS: 4.5,            // escena más larga aceptable sin corte ni cambio fuerte
  maxMeanSceneS: 4.5,        // duración media aceptable de escena
  targetLufs: -14,
  lufsToleranceLu: 2,
  maxTruePeakDb: -1,
} as const;

export type VideoQcThresholds = typeof VIDEO_QC_THRESHOLDS;

export type ShellRunner = (script: string, args: string[]) => Promise<{ exitCode: number; stdout: string; stderr: string }>;

export interface Interval { start: number; end: number; duration: number }

export interface VideoQcReport {
  clean: boolean;                 // true si no hubo ningún hallazgo
  durationS: number | null;
  metrics: {
    hookMovingShare: number | null; // fracción de pasos con movimiento en los primeros hookWindowS
    hookFirstMotionS: number | null;
    cuts: number;                 // cortes o cambios fuertes de imagen
    meanSceneS: number | null;
    longestSceneS: number | null;
    longestSceneAtS: number | null;
    freezeS: number;              // total congelado (tramos ≥ freezeDetectS)
    blackS: number;               // total en negro (tramos ≥ blackMinS)
    hasAudio: boolean;
    silenceS: number | null;      // total en silencio (tramos ≥ silenceDetectMinS)
    loudnessLufs: number | null;
    truePeakDb: number | null;
    loudnessRangeLu: number | null;
  };
  findings: string[];
}

const MAX_FINDINGS = 10;

export function buildVideoQcScript(t: VideoQcThresholds = VIDEO_QC_THRESHOLDS): string {
  // Un solo `sh -c` por análisis (un solo arranque de contenedor). Cada bloque se marca con @@<nombre>
  // y manda stdout+stderr juntos: freezedetect/blackdetect/silencedetect/ebur128 escriben en el log.
  // El video se decodifica una sola vez (split): rama [a] a resolución completa para congelados y
  // negros; rama [b] a 5 fps y 320 px para el mapa de bordes. Sus dos metadata=print van a archivos
  // separados (dos impresoras a la misma stdout se mezclarían sin orden) y se vuelcan después.
  const videoGraph = '[0:v]split[a][b];'
    + `[a]freezedetect=n=${t.freezeNoiseDb}dB:d=${t.freezeDetectS},`
    + `blackdetect=d=${t.blackMinS}:pic_th=${t.blackPictureTh}:pix_th=${t.blackPixelTh}[o1];`
    + `[b]fps=${t.beatSampleFps},scale=320:-2,format=gray,edgedetect=low=0.1:high=0.3,`
    + 'signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=$t/edges.txt,'
    + 'tblend=all_mode=difference,signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=$t/diff.txt[o2]';
  const hookFilter = 'scale=160:-2,format=gray,tblend=all_mode=difference,signalstats,'
    + 'metadata=print:key=lavfi.signalstats.YAVG:file=-';
  // framelog=verbose: la línea por cada 100 ms de ebur128 solo sale en -v verbose; el resumen sí sale.
  const audioFilter = `silencedetect=n=${t.silenceNoiseDb}dB:d=${t.silenceDetectMinS},ebur128=peak=true:framelog=verbose`;
  return [
    'f="$1"',
    't=$(mktemp -d)',
    'echo @@probe',
    'ffprobe -v error -show_entries format=duration:stream=codec_type -of json "$f" 2>&1',
    'echo @@hook',
    `ffmpeg -hide_banner -nostdin -nostats -v error -t ${t.hookWindowS} -i "$f" -an -vf "${hookFilter}" -f null - 2>&1`,
    'echo @@video',
    `ffmpeg -hide_banner -nostdin -nostats -i "$f" -filter_complex "${videoGraph}" -map "[o1]" -f null - -map "[o2]" -f null - 2>&1`,
    'echo @@edges',
    'cat "$t/edges.txt" 2>/dev/null',
    'echo @@diff',
    'cat "$t/diff.txt" 2>/dev/null',
    'rm -rf "$t"',
    'if ffprobe -v error -select_streams a -show_entries stream=index -of csv=p=0 "$f" | grep -q .; then',
    '  echo @@audio',
    `  ffmpeg -hide_banner -nostdin -nostats -i "$f" -vn -af "${audioFilter}" -f null - 2>&1`,
    'fi',
    'echo @@end',
  ].join('\n');
}

export function splitQcSections(raw: string): Record<string, string> {
  const sections: Record<string, string> = {};
  let current: string | null = null;
  for (const line of raw.replace(/\r/g, '\n').split('\n')) {
    const marker = /^@@(\w+)\s*$/.exec(line);
    if (marker) { current = marker[1]!; sections[current] = ''; continue; }
    if (current) sections[current] += line + '\n';
  }
  return sections;
}

export function parseProbe(text: string): { durationS: number | null; hasVideo: boolean; hasAudio: boolean } {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  try {
    const json = JSON.parse(text.slice(start, end + 1)) as { format?: { duration?: string }; streams?: { codec_type?: string }[] };
    const duration = Number(json.format?.duration);
    const types = (json.streams ?? []).map((s) => s.codec_type);
    return { durationS: Number.isFinite(duration) ? duration : null, hasVideo: types.includes('video'), hasAudio: types.includes('audio') };
  } catch {
    return { durationS: null, hasVideo: false, hasAudio: false };
  }
}

// Salida de metadata=print: "frame:N pts:P pts_time:T" seguida de "lavfi.<clave>=<valor>".
export function parseMetadataPrint(text: string, key: string): { time: number; value: number }[] {
  const out: { time: number; value: number }[] = [];
  let time: number | null = null;
  for (const line of text.split('\n')) {
    const frame = /pts_time:(-?[\d.]+)/.exec(line);
    if (frame) { time = Number(frame[1]); continue; }
    const kv = new RegExp(`${key.replace(/\./g, '\\.')}=(-?[\\d.]+)`).exec(line);
    if (kv && time !== null) out.push({ time, value: Number(kv[1]) });
  }
  return out;
}

export function parseHookMotion(text: string, t: VideoQcThresholds = VIDEO_QC_THRESHOLDS): { movingShare: number | null; firstMotionS: number | null } {
  const steps = parseMetadataPrint(text, 'lavfi.signalstats.YAVG');
  if (!steps.length) return { movingShare: null, firstMotionS: null };
  const moving = steps.filter((s) => s.value >= t.hookMotionStep);
  // pts_time del cuadro de diferencia = el cuadro donde la imagen ya cambió respecto al anterior.
  return { movingShare: moving.length / steps.length, firstMotionS: moving[0]?.time ?? null };
}

// Intervalos de freezedetect/blackdetect/silencedetect. Un inicio sin fin (el congelado o el
// silencio llega hasta el final del archivo; FFmpeg 5.1 no siempre imprime el cierre) se cierra
// en la duración total.
export function parseFreezes(text: string, durationS: number | null): Interval[] {
  return pairIntervals(
    [...text.matchAll(/freezedetect\.freeze_start:\s*(-?[\d.]+)/g)].map((m) => Number(m[1])),
    [...text.matchAll(/freezedetect\.freeze_end:\s*(-?[\d.]+)/g)].map((m) => Number(m[1])),
    durationS,
  );
}

export function parseSilences(text: string, durationS: number | null): Interval[] {
  return pairIntervals(
    [...text.matchAll(/silence_start:\s*(-?[\d.]+)/g)].map((m) => Number(m[1])),
    [...text.matchAll(/silence_end:\s*(-?[\d.]+)/g)].map((m) => Number(m[1])),
    durationS,
  );
}

export function parseBlacks(text: string): Interval[] {
  return [...text.matchAll(/black_start:\s*(-?[\d.]+)\s+black_end:\s*(-?[\d.]+)/g)]
    .map((m) => ({ start: Math.max(0, Number(m[1])), end: Number(m[2]), duration: Number(m[2]) - Math.max(0, Number(m[1])) }));
}

function pairIntervals(starts: number[], ends: number[], durationS: number | null): Interval[] {
  const out: Interval[] = [];
  starts.forEach((rawStart, i) => {
    const start = Math.max(0, rawStart);
    const end = ends[i] ?? durationS;
    if (end === null || end === undefined || end <= start) return;
    out.push({ start, end, duration: end - start });
  });
  return out;
}

// Cortes o cambios fuertes de imagen a partir de dos series a beatSampleFps: el promedio del mapa
// de bordes de cada muestra (cuánto "contenido" hay) y el promedio de la diferencia entre el mapa
// de una muestra y el de la anterior (cuánto de ese contenido cambió). Cambio relativo = diferencia /
// contenido. Muestras seguidas con cambio fuerte (una transición, o algo que se mueve sin parar)
// forman un solo tramo de cambio; lo que se mide como "escena" es el tramo quieto entre dos de ellos.
export function parseChangeRuns(edgesText: string, diffText: string, t: VideoQcThresholds = VIDEO_QC_THRESHOLDS): { start: number; end: number }[] {
  const edges = parseMetadataPrint(edgesText, 'lavfi.signalstats.YAVG');
  const contentAt = new Map(edges.map((e) => [e.time.toFixed(3), e.value]));
  const step = 1 / t.beatSampleFps;
  const runs: { start: number; end: number }[] = [];
  for (const d of parseMetadataPrint(diffText, 'lavfi.signalstats.YAVG')) {
    const content = Math.max(contentAt.get(d.time.toFixed(3)) ?? 0, contentAt.get((d.time - step).toFixed(3)) ?? 0);
    if (content < t.beatMinContent || d.value / content < t.beatEdgeChange) continue;
    const last = runs[runs.length - 1];
    if (last && d.time - last.end <= step * 1.5) last.end = d.time;
    else runs.push({ start: d.time, end: d.time });
  }
  return runs;
}

export function sceneStats(runs: { start: number; end: number }[], durationS: number | null): { mean: number | null; longest: number | null; longestAt: number | null } {
  if (durationS === null || durationS <= 0) return { mean: null, longest: null, longestAt: null };
  let longest = 0; let longestAt = 0; let quietFrom = 0;
  for (const run of [...runs.filter((r) => r.start < durationS), { start: durationS, end: durationS }]) {
    if (run.start - quietFrom > longest) { longest = run.start - quietFrom; longestAt = quietFrom; }
    quietFrom = Math.max(quietFrom, run.end);
  }
  return { mean: durationS / (runs.length + 1), longest, longestAt };
}

export function parseLoudness(text: string): { integrated: number | null; truePeak: number | null; range: number | null } {
  const summary = text.slice(Math.max(0, text.lastIndexOf('Summary:')));
  if (!text.includes('Summary:')) return { integrated: null, truePeak: null, range: null };
  const num = (re: RegExp): number | null => {
    const m = re.exec(summary);
    if (!m) return null;
    return m[1] === '-inf' ? -Infinity : Number(m[1]);
  };
  return {
    integrated: num(/\bI:\s+(-?[\d.]+|-inf)\s+LUFS/),
    truePeak: num(/\bPeak:\s+(-?[\d.]+|-inf)\s+dBFS/),
    range: num(/\bLRA:\s+(-?[\d.]+)\s+LU\b/),
  };
}

const round = (n: number | null, digits = 1): number | null =>
  n === null || !Number.isFinite(n) ? n : Math.round(n * 10 ** digits) / 10 ** digits;

export function formatTimestamp(seconds: number): string {
  const s = Math.max(0, seconds);
  const minutes = Math.floor(s / 60);
  const rest = (s - minutes * 60).toFixed(1).padStart(4, '0');
  return `${String(minutes).padStart(2, '0')}:${rest}`;
}

export function buildVideoQcReport(raw: string, t: VideoQcThresholds = VIDEO_QC_THRESHOLDS): VideoQcReport {
  const sections = splitQcSections(raw);
  const probe = parseProbe(sections.probe ?? '');
  const durationS = probe.durationS;
  const hook = parseHookMotion(sections.hook ?? '', t);
  const videoText = sections.video ?? '';
  const freezes = parseFreezes(videoText, durationS);
  const blacks = parseBlacks(videoText);
  const cuts = parseChangeRuns(sections.edges ?? '', sections.diff ?? '', t);
  // Sin muestras de bordes (el análisis se cortó, o un video de un solo cuadro) no hay ritmo que medir.
  const hasBeatData = parseMetadataPrint(sections.diff ?? '', 'lavfi.signalstats.YAVG').length > 0;
  const scenes = hasBeatData ? sceneStats(cuts, durationS) : { mean: null, longest: null, longestAt: null };
  const hasAudio = sections.audio !== undefined;
  const audioText = sections.audio ?? '';
  const silences = hasAudio ? parseSilences(audioText, durationS) : [];
  const loud = hasAudio ? parseLoudness(audioText) : { integrated: null, truePeak: null, range: null };

  const findings: string[] = [];
  const s = (n: number): string => n.toFixed(1);
  if (sections.end === undefined) findings.push('el análisis no terminó completo: algunas mediciones pueden faltar');
  if (!probe.hasVideo) findings.push('no se encontró pista de video en el MP4');

  // Arranque
  if (hook.movingShare !== null) {
    if (hook.firstMotionS === null) findings.push(`arranque quieto: nada se mueve en los primeros ${t.hookWindowS} s (el cuadro 0 debe abrir en movimiento)`);
    else if (hook.firstMotionS > t.hookMaxStillStartS) findings.push(`arranque quieto: el primer movimiento llega en ${formatTimestamp(hook.firstMotionS)} (ref. ≤ ${t.hookMaxStillStartS} s)`);
    else if (hook.movingShare < t.hookMinMovingShare) findings.push(`arranque con poco movimiento: solo ${Math.round(hook.movingShare * 100)}% de los primeros ${t.hookWindowS} s se mueve (ref. ≥ ${Math.round(t.hookMinMovingShare * 100)}%)`);
  }
  // Negros: el cuadro 0 negro es una miniatura negra, se reporta siempre.
  for (const b of blacks) {
    if (b.start < 0.05) findings.push(`negro de ${s(b.duration)} s al inicio (el cuadro 0 es la miniatura)`);
    else if (b.duration >= t.blackFindingMinS) findings.push(`negro de ${s(b.duration)} s en ${formatTimestamp(b.start)}`);
  }
  // Congelados. Un tramo negro también es un congelado: no se reporta dos veces. El cierre (end
  // card / CTA sostenido hasta el último cuadro) tiene su propio margen.
  const overlap = (x: Interval, y: Interval): number => Math.max(0, Math.min(x.end, y.end) - Math.max(x.start, y.start));
  for (const f of freezes) {
    if (blacks.reduce((sum, b) => sum + overlap(f, b), 0) >= 0.8 * f.duration) continue;
    const isEndHold = durationS !== null && f.end >= durationS - 0.1;
    if (isEndHold && f.duration > t.endHoldMaxS) findings.push(`cierre congelado ${s(f.duration)} s desde ${formatTimestamp(f.start)} (ref. ≤ ${t.endHoldMaxS} s)`);
    else if (!isEndHold && f.duration >= t.freezeFindingMinS) findings.push(`imagen congelada ${s(f.duration)} s en ${formatTimestamp(f.start)} (ref. < ${t.freezeFindingMinS} s)`);
  }
  // Ritmo de cortes
  if (scenes.longest !== null && scenes.longest > t.maxSceneS) {
    findings.push(`escena de ${s(scenes.longest)} s sin corte ni cambio fuerte en ${formatTimestamp(scenes.longestAt ?? 0)} (ref. ≤ ${t.maxSceneS} s)`);
  }
  if (scenes.mean !== null && scenes.mean > t.maxMeanSceneS && cuts.length > 1) {
    findings.push(`escena media de ${s(scenes.mean)} s con ${cuts.length} cortes (ref. ≤ ${t.maxMeanSceneS} s; cortes cada 2.5-4.5 s)`);
  }
  // Audio
  if (!hasAudio) findings.push('sin pista de audio (regla: sonido siempre, salvo que pidan silencio)');
  else {
    for (const sil of silences) {
      if (sil.duration < t.silenceFindingMinS) continue;
      if (sil.start < 0.05) findings.push(`silencio inicial de ${s(sil.duration)} s (la voz entra en el primer 1-2 s)`);
      else if (durationS !== null && sil.end >= durationS - 0.05 && sil.start >= durationS - 1.5) findings.push(`silencio final de ${s(sil.duration)} s en ${formatTimestamp(sil.start)}`);
      else findings.push(`silencio de ${s(sil.duration)} s en ${formatTimestamp(sil.start)}`);
    }
    if (loud.integrated !== null) {
      if (!Number.isFinite(loud.integrated)) findings.push('la pista de audio está muda (−inf LUFS)');
      else if (Math.abs(loud.integrated - t.targetLufs) > t.lufsToleranceLu) {
        findings.push(`loudness ${s(loud.integrated)} LUFS (ref. ${t.targetLufs} ±${t.lufsToleranceLu}; "normalizeAudio": true lo corrige)`);
      }
    }
    if (loud.truePeak !== null && Number.isFinite(loud.truePeak) && loud.truePeak > t.maxTruePeakDb) {
      findings.push(`pico real ${s(loud.truePeak)} dBTP (ref. ≤ ${t.maxTruePeakDb}; riesgo de saturar al recodificar)`);
    }
  }

  const shown = findings.length > MAX_FINDINGS
    ? [...findings.slice(0, MAX_FINDINGS - 1), `… y ${findings.length - (MAX_FINDINGS - 1)} hallazgos más`]
    : findings;
  const total = (list: Interval[]): number => round(list.reduce((sum, i) => sum + i.duration, 0)) ?? 0;
  return {
    clean: findings.length === 0,
    durationS: round(durationS, 2),
    metrics: {
      hookMovingShare: round(hook.movingShare, 2),
      hookFirstMotionS: round(hook.firstMotionS, 2),
      cuts: cuts.length,
      meanSceneS: round(scenes.mean),
      longestSceneS: round(scenes.longest),
      longestSceneAtS: round(scenes.longestAt),
      freezeS: total(freezes),
      blackS: total(blacks),
      hasAudio,
      silenceS: hasAudio ? total(silences) : null,
      loudnessLufs: loud.integrated !== null && Number.isFinite(loud.integrated) ? round(loud.integrated) : null,
      truePeakDb: loud.truePeak !== null && Number.isFinite(loud.truePeak) ? round(loud.truePeak) : null,
      loudnessRangeLu: round(loud.range),
    },
    findings: shown,
  };
}

export async function analyzeRenderedVideo(run: ShellRunner, file: string, t: VideoQcThresholds = VIDEO_QC_THRESHOLDS): Promise<VideoQcReport> {
  const result = await run(buildVideoQcScript(t), [file]);
  if (!result.stdout.includes('@@probe')) {
    throw new Error(`el análisis de QC no arrancó: ${(result.stderr || result.stdout).slice(0, 300) || 'sin detalle'}`);
  }
  return buildVideoQcReport(result.stdout, t);
}

// --- Normalización de loudness (opcional, "normalizeAudio" en video.render) -----------------------
// Dos pasadas de loudnorm: la primera mide, la segunda aplica UNA ganancia fija (linear=true) con
// esas mediciones, para no comprimir la mezcla. LRA=20 evita que loudnorm cambie solo a modo
// dinámico por un rango amplio; TP=-2 deja ~1 dB de margen porque el AAC sube los picos al
// codificar (el QC sigue exigiendo ≤ −1 dBTP sobre el archivo final). Si aun así loudnorm decide
// modo dinámico (la ganancia lineal pasaría el techo), se reporta en "mode".
export const LOUDNORM_TARGET = { I: -14, TP: -2, LRA: 20 } as const;

export interface LoudnormMeasure { input_i: string; input_tp: string; input_lra: string; input_thresh: string; target_offset: string; normalization_type?: string; output_i?: string; output_tp?: string }

export function parseLoudnormJson(text: string): LoudnormMeasure | null {
  const blocks = text.match(/\{[^{}]*\}/g);
  if (!blocks?.length) return null;
  try {
    const parsed = JSON.parse(blocks[blocks.length - 1]!) as LoudnormMeasure;
    return typeof parsed.input_i === 'string' ? parsed : null;
  } catch { return null; }
}

export function buildLoudnormMeasureScript(): string {
  const { I, TP, LRA } = LOUDNORM_TARGET;
  return 'ffprobe -v error -select_streams a -show_entries stream=index -of csv=p=0 "$1" | grep -q . || { echo @@noaudio; exit 0; }\n'
    + `ffmpeg -hide_banner -nostdin -nostats -i "$1" -vn -af "loudnorm=I=${I}:TP=${TP}:LRA=${LRA}:print_format=json" -f null - 2>&1`;
}

export function buildLoudnormApplyScript(m: LoudnormMeasure): string {
  const { I, TP, LRA } = LOUDNORM_TARGET;
  const safe = (v: string): string => { if (!/^-?(\d+(\.\d+)?|inf)$/.test(v.trim())) throw new Error(`medición de loudnorm inválida: "${v}"`); return v.trim(); };
  const filter = `loudnorm=I=${I}:TP=${TP}:LRA=${LRA}:measured_I=${safe(m.input_i)}:measured_TP=${safe(m.input_tp)}`
    + `:measured_LRA=${safe(m.input_lra)}:measured_thresh=${safe(m.input_thresh)}:offset=${safe(m.target_offset)}`
    + ':linear=true:print_format=json';
  // -c:v copy: la imagen no se recodifica; solo el audio pasa por loudnorm (que remuestrea a
  // 192 kHz por dentro, de ahí el -ar 48000 explícito).
  return `ffmpeg -hide_banner -nostdin -nostats -y -i "$1" -map 0:v:0 -map 0:a:0 -c:v copy -af "${filter}" `
    + `-c:a aac -b:a 192k -ar 48000 -movflags +faststart "$2" 2>&1`;
}

export interface AudioNormalization { fromLufs: number | null; toLufs: number | null; mode: string }

// Devuelve null si no hay nada que normalizar (sin pista de audio o audio mudo); lanza si FFmpeg falla.
export async function normalizeRenderedAudio(run: ShellRunner, input: string, output: string): Promise<AudioNormalization | null> {
  const measure = await run(buildLoudnormMeasureScript(), [input]);
  if (measure.stdout.includes('@@noaudio')) return null;
  const m = parseLoudnormJson(measure.stdout);
  if (measure.exitCode !== 0 || !m) throw new Error(`no se pudo medir el loudness: ${measure.stdout.slice(-300)}`);
  const inputI = Number(m.input_i);
  if (!Number.isFinite(inputI) || inputI < -70) return null;
  const apply = await run(buildLoudnormApplyScript(m), [input, output]);
  const r = parseLoudnormJson(apply.stdout);
  if (apply.exitCode !== 0) throw new Error(`no se pudo normalizar el audio: ${apply.stdout.slice(-300)}`);
  return { fromLufs: round(inputI), toLufs: r?.output_i ? round(Number(r.output_i)) : null, mode: r?.normalization_type ?? 'desconocido' };
}
