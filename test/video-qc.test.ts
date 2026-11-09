import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  analyzeRenderedVideo, buildVideoQcReport, formatTimestamp, normalizeRenderedAudio, parseBlacks, parseFreezes,
  parseHookMotion, parseLoudness, parseLoudnormJson, parseChangeRuns, parseSilences, sceneStats, buildLoudnormApplyScript,
  type ShellRunner,
} from '../src/office/video-qc.js';

// Textos de ejemplo con la forma real del log de FFmpeg (la imagen del renderizador trae el 5.1 de
// Debian bookworm; el formato de estas líneas es el mismo en 5.x-9.x).
const PROBE = `{
    "streams": [ { "codec_type": "video" }, { "codec_type": "audio" } ],
    "format": { "duration": "11.500000" }
}`;
const HOOK_STILL_THEN_MOVE = [
  ...Array.from({ length: 44 }, (_, i) => `frame:${i}    pts:${(i + 1) * 512}  pts_time:${((i + 1) / 30).toFixed(6)}\nlavfi.signalstats.YAVG=0`),
  'frame:44   pts:23040   pts_time:1.5\nlavfi.signalstats.YAVG=98.4',
  ...Array.from({ length: 14 }, (_, i) => `frame:${45 + i}   pts:0   pts_time:${(1.533 + i / 30).toFixed(6)}\nlavfi.signalstats.YAVG=2.6`),
].join('\n');
const VIDEO_LOG = `Input #0, mov,mp4,m4a,3gp,3g2,mj2, from 'render.mp4':
[Parsed_freezedetect_2 @ 0x55d0] lavfi.freezedetect.freeze_start: 0
[Parsed_freezedetect_2 @ 0x55d0] lavfi.freezedetect.freeze_duration: 1.5
[Parsed_freezedetect_2 @ 0x55d0] lavfi.freezedetect.freeze_end: 1.5
[Parsed_blackdetect_3 @ 0x55d1] black_start:0 black_end:1.5 black_duration:1.5
[Parsed_freezedetect_2 @ 0x55d0] lavfi.freezedetect.freeze_start: 3.5
[Parsed_freezedetect_2 @ 0x55d0] lavfi.freezedetect.freeze_duration: 6
[Parsed_freezedetect_2 @ 0x55d0] lavfi.freezedetect.freeze_end: 9.5
`;
// Series a 5 fps del mapa de bordes (contenido) y de su diferencia con la muestra anterior, como las
// deja metadata=print en edges.txt/diff.txt: negro hasta 1.5 s, algo que se mueve sin parar hasta
// 3.5 s, un fondo plano sin bordes hasta 9.5 s y luego una imagen quieta.
const SAMPLES = Array.from({ length: 58 }, (_, i) => Math.round(i * 2) / 10);
const contentAt = (t: number): number => (t < 1.6 ? 0 : t < 3.6 ? 3 : t < 9.6 ? 0 : 2);
const diffAt = (t: number): number => (t === 1.6 ? 3 : t > 1.6 && t < 3.6 ? 2 : t === 3.6 ? 3 : t === 9.6 ? 2 : t > 9.6 ? 0.01 : 0);
const metadataLines = (times: number[], value: (t: number) => number): string =>
  times.map((t, i) => `frame:${i}    pts:${Math.round(t * 5)}       pts_time:${t}\nlavfi.signalstats.YAVG=${value(t)}`).join('\n');
const EDGES = metadataLines(SAMPLES, contentAt);
const DIFF = metadataLines(SAMPLES.slice(1), diffAt);
const AUDIO_LOG = `[silencedetect @ 0x6000] silence_start: 3
[silencedetect @ 0x6000] silence_end: 6.000021 | silence_duration: 3.000021
[silencedetect @ 0x6000] silence_start: 10.9
[Parsed_ebur128_1 @ 0x6001] Summary:

  Integrated loudness:
    I:         -21.8 LUFS
    Threshold: -31.9 LUFS

  Loudness range:
    LRA:         7.9 LU
    Threshold: -43.5 LUFS

  True peak:
    Peak:      -0.4 dBFS
`;

test('parseo de freezedetect/blackdetect/silencedetect, con un intervalo abierto hasta el final', () => {
  assert.deepEqual(parseFreezes(VIDEO_LOG, 11.5).map((f) => [f.start, f.end]), [[0, 1.5], [3.5, 9.5]]);
  assert.deepEqual(parseFreezes('lavfi.freezedetect.freeze_start: 8.2', 11.5).map((f) => [f.start, f.end]), [[8.2, 11.5]]);
  assert.deepEqual(parseBlacks(VIDEO_LOG), [{ start: 0, end: 1.5, duration: 1.5 }]);
  const silences = parseSilences(AUDIO_LOG, 11.5);
  assert.equal(silences.length, 2);
  assert.equal(silences[0]!.start, 3);
  assert.ok(Math.abs(silences[0]!.duration - 3) < 0.01);
  assert.ok(Math.abs(silences[1]!.duration - 0.6) < 0.01, 'el silencio sin silence_end se cierra en la duración');
});

test('cortes: muestras seguidas con cambio fuerte son un solo tramo; la escena es el tramo quieto entre ellos', () => {
  const runs = parseChangeRuns(EDGES, DIFF);
  assert.deepEqual(runs, [{ start: 1.6, end: 3.6 }, { start: 9.6, end: 9.6 }],
    'el movimiento continuo 1.6-3.4 y el corte a 3.6 forman un tramo; el fondo plano (sin bordes) no cuenta como cambio');
  const stats = sceneStats(runs, 11.5);
  assert.ok(Math.abs(stats.longest! - 6) < 1e-9);
  assert.equal(stats.longestAt, 3.6);
  assert.ok(Math.abs(stats.mean! - 11.5 / 3) < 1e-9);
  assert.deepEqual(sceneStats([], null), { mean: null, longest: null, longestAt: null });
  assert.deepEqual(sceneStats([], 6).longest, 6, 'sin ningún cambio, todo el video es una sola escena');
  // Un cambio chico respecto al contenido (un contador que avanza) no es corte.
  assert.deepEqual(parseChangeRuns(metadataLines([0, 0.2], () => 3), metadataLines([0.2], () => 0.9)), []);
});

test('arranque: fracción de cuadros con movimiento y primer cuadro que se mueve', () => {
  const hook = parseHookMotion(HOOK_STILL_THEN_MOVE);
  assert.ok(Math.abs(hook.movingShare! - 15 / 59) < 1e-9);
  assert.equal(hook.firstMotionS, 1.5);
  assert.deepEqual(parseHookMotion(''), { movingShare: null, firstMotionS: null });
});

test('loudness: resumen de ebur128, incluido -inf de una pista muda', () => {
  assert.deepEqual(parseLoudness(AUDIO_LOG), { integrated: -21.8, truePeak: -0.4, range: 7.9 });
  const mute = parseLoudness('Summary:\n  I:         -70.0 LUFS\n  LRA: 0.0 LU\n  Peak:       -inf dBFS');
  assert.equal(mute.truePeak, -Infinity);
  assert.deepEqual(parseLoudness('sin resumen'), { integrated: null, truePeak: null, range: null });
});

test('reporte completo: mediciones compactas y hallazgos legibles con su minuto', () => {
  const raw = `@@probe\n${PROBE}\n@@hook\n${HOOK_STILL_THEN_MOVE}\n@@video\n${VIDEO_LOG}\n@@edges\n${EDGES}\n@@diff\n${DIFF}\n`
    + `@@audio\n${AUDIO_LOG}\n@@end\n`;
  const report = buildVideoQcReport(raw);
  assert.equal(report.clean, false);
  assert.equal(report.durationS, 11.5);
  assert.equal(report.metrics.cuts, 2);
  assert.equal(report.metrics.longestSceneS, 6);
  assert.equal(report.metrics.loudnessLufs, -21.8);
  assert.equal(report.metrics.freezeS, 7.5);
  assert.deepEqual(report.findings, [
    'arranque quieto: el primer movimiento llega en 00:01.5 (ref. ≤ 0.5 s)',
    'negro de 1.5 s al inicio (el cuadro 0 es la miniatura)',
    'imagen congelada 6.0 s en 00:03.5 (ref. < 3 s)',
    'escena de 6.0 s sin corte ni cambio fuerte en 00:03.6 (ref. ≤ 4.5 s)',
    'silencio de 3.0 s en 00:03.0',
    'loudness -21.8 LUFS (ref. -14 ±2; "normalizeAudio": true lo corrige)',
    'pico real -0.4 dBTP (ref. ≤ -1; riesgo de saturar al recodificar)',
  ], 'el congelado de 0-1.5 s ya es el negro inicial: no se repite; el silencio final de 0.6 s no llega al umbral');
  assert.ok(JSON.stringify(report).length < 1500, 'el reporte cabe en poco contexto');
});

test('reporte sin pista de audio y con análisis cortado', () => {
  const report = buildVideoQcReport(`@@probe\n{"streams":[{"codec_type":"video"}],"format":{"duration":"3.0"}}\n@@hook\n@@video\n`);
  assert.equal(report.metrics.hasAudio, false);
  assert.equal(report.metrics.silenceS, null);
  assert.ok(report.findings.includes('sin pista de audio (regla: sonido siempre, salvo que pidan silencio)'));
  assert.ok(report.findings.some((f) => f.startsWith('el análisis no terminó completo')));
});

test('congelados: el cierre sostenido tiene su propio margen', () => {
  const probe = '@@probe\n{"streams":[{"codec_type":"video"},{"codec_type":"audio"}],"format":{"duration":"20"}}\n';
  const at = (start: number, end: number): string => `${probe}@@video\nlavfi.freezedetect.freeze_start: ${start}\nlavfi.freezedetect.freeze_end: ${end}\n@@audio\n@@end\n`;
  assert.deepEqual(buildVideoQcReport(at(16.5, 20)).findings, [], 'un end card de 3.5 s es normal');
  assert.deepEqual(buildVideoQcReport(at(15, 20)).findings, ['cierre congelado 5.0 s desde 00:15.0 (ref. ≤ 4 s)']);
  assert.deepEqual(buildVideoQcReport(at(5, 7.5)).findings, [], 'un cuadro sostenido 2.5 s mientras habla la voz no se reporta');
  assert.deepEqual(buildVideoQcReport(at(5, 8.5)).findings, ['imagen congelada 3.5 s en 00:05.0 (ref. < 3 s)']);
});

test('los hallazgos se acotan para no inflar el contexto del modelo', () => {
  const freezes = Array.from({ length: 30 }, (_, i) => `lavfi.freezedetect.freeze_start: ${i * 4}\nlavfi.freezedetect.freeze_end: ${i * 4 + 3.5}`).join('\n');
  const report = buildVideoQcReport(`@@probe\n{"streams":[{"codec_type":"video"},{"codec_type":"audio"}],"format":{"duration":"200"}}\n@@video\n${freezes}\n@@audio\n@@end\n`);
  assert.equal(report.findings.length, 10);
  assert.match(report.findings[9]!, /^… y \d+ hallazgos más$/);
});

test('formato de minuto y validación de las mediciones de loudnorm antes de interpolarlas en el script', () => {
  assert.equal(formatTimestamp(7.25), '00:07.3');
  assert.equal(formatTimestamp(65), '01:05.0');
  const m = parseLoudnormJson('[Parsed_loudnorm_0 @ 0x1]\n{\n\t"input_i" : "-21.83",\n\t"input_tp" : "-16.08",\n\t"input_lra" : "7.90",\n\t"input_thresh" : "-31.95",\n\t"target_offset" : "0.12"\n}\n');
  assert.equal(m?.input_i, '-21.83');
  assert.match(buildLoudnormApplyScript(m!), /measured_I=-21\.83:measured_TP=-16\.08/);
  assert.throws(() => buildLoudnormApplyScript({ ...m!, input_i: '1"; rm -rf /' }), /medición de loudnorm inválida/);
  assert.equal(parseLoudnormJson('sin json'), null);
});

// --- Pruebas con FFmpeg real -----------------------------------------------------------------------
// Video de prueba con lavfi: 1.5 s negro, 2 s testsrc2 (se mueve), 6 s azul quieto (escena larga y
// congelada), 2 s testsrc; audio: 3 s tono, 3 s silencio, 5.5 s tono.
const MAKE_SAMPLE = 'ffmpeg -hide_banner -nostdin -v error -y '
  + '-f lavfi -i "color=c=black:s=320x240:r=30:d=1.5" -f lavfi -i "testsrc2=s=320x240:r=30:d=2" '
  + '-f lavfi -i "color=c=blue:s=320x240:r=30:d=6" -f lavfi -i "testsrc=s=320x240:r=30:d=2" '
  + '-f lavfi -i "sine=f=440:d=3:sample_rate=48000" -f lavfi -i "anullsrc=r=48000:cl=mono:d=3" '
  + '-f lavfi -i "sine=f=660:d=5.5:sample_rate=48000" '
  + '-filter_complex "[0:v][1:v][2:v][3:v]concat=n=4:v=1:a=0[v];[4:a][5:a][6:a]concat=n=3:v=0:a=1[a]" '
  + '-map "[v]" -map "[a]" -c:v libx264 -pix_fmt yuv420p -c:a aac "$1"';

function collect(command: string, args: string[]): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = ''; let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', (code) => resolve({ exitCode: code ?? -1, stdout, stderr }));
  });
}

async function exerciseRealFfmpeg(run: ShellRunner, file: (name: string) => string): Promise<void> {
  const made = await run(MAKE_SAMPLE, [file('sample.mp4')]);
  assert.equal(made.exitCode, 0, made.stdout + made.stderr);
  const report = await analyzeRenderedVideo(run, file('sample.mp4'));
  assert.ok(Math.abs(report.durationS! - 11.5) < 0.1);
  assert.equal(report.metrics.hasAudio, true);
  assert.ok(report.metrics.cuts >= 2, `cortes ${report.metrics.cuts}`);
  assert.ok(Math.abs(report.metrics.longestSceneS! - 6) <= 0.3, `escena más larga ${report.metrics.longestSceneS}`);
  assert.ok(report.findings.some((f) => /^silencio de 3\.0 s en 00:03\.0$/.test(f)), report.findings.join('\n'));
  assert.ok(report.findings.some((f) => /^escena de 6\.\d s sin corte ni cambio fuerte en 00:03\.\d/.test(f)), report.findings.join('\n'));
  assert.ok(report.findings.some((f) => f.startsWith('arranque quieto')));
  assert.ok(report.findings.some((f) => f.startsWith('negro de 1.5 s al inicio')));

  const normalized = await normalizeRenderedAudio(run, file('sample.mp4'), file('norm.mp4'));
  assert.ok(normalized, 'había audio que normalizar');
  assert.equal(normalized.mode, 'linear');
  const after = await analyzeRenderedVideo(run, file('norm.mp4'));
  assert.ok(Math.abs(after.metrics.loudnessLufs! + 14) <= 1, `loudness tras normalizar ${after.metrics.loudnessLufs}`);
  assert.ok(!after.findings.some((f) => f.startsWith('loudness')));
}

const hasLocalFfmpeg = spawnSync('ffmpeg', ['-version']).status === 0 && spawnSync('ffprobe', ['-version']).status === 0;

test('QC con el FFmpeg local: detecta el silencio y la escena larga de un MP4 generado', { skip: hasLocalFfmpeg ? false : 'ffmpeg/ffprobe no están instalados localmente' }, async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'veridis-qc-test-'));
  try {
    await exerciseRealFfmpeg((script, args) => collect('sh', ['-c', script, 'qc', ...args]), (name) => path.join(dir, name));
  } finally { await rm(dir, { recursive: true, force: true }); }
});

const VIDEO_RENDERER_IMAGE = 'veridis-video-renderer:latest';
const dockerSkip = spawnSync('docker', ['info'], { stdio: 'ignore' }).status !== 0
  ? 'Docker no está disponible (docker info falló)'
  : spawnSync('docker', ['image', 'inspect', VIDEO_RENDERER_IMAGE], { stdio: 'ignore' }).status !== 0
    ? `la imagen ${VIDEO_RENDERER_IMAGE} no existe localmente (docker build -t ${VIDEO_RENDERER_IMAGE} docker/video-renderer)`
    : false;

test('QC dentro de la imagen del renderizador (FFmpeg de Debian, el mismo de producción)', { skip: dockerSkip, timeout: 180_000 }, async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'veridis-qc-docker-'));
  try {
    const run: ShellRunner = (script, args) => collect('docker', [
      'run', '--rm', '--network', 'none', '--memory', '2g', '--cpus', '2', '-v', `${dir}:/workspace`, '--workdir', '/workspace',
      '--entrypoint', 'sh', VIDEO_RENDERER_IMAGE, '-c', script, 'veridis-qc', ...args,
    ]);
    await exerciseRealFfmpeg(run, (name) => name);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
