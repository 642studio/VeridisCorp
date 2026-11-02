import { useCallback, useRef, useState } from 'react';
import { splitSentences, synthesize, type SpeakProvider } from './speak';

function playBlob(blob: Blob, audioRef: { current: HTMLAudioElement | null }, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) { resolve(); return; }
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audioRef.current = audio;
    const done = () => { URL.revokeObjectURL(url); resolve(); };
    audio.onended = done;
    audio.onerror = done;
    audio.play().catch(done);
  });
}

// Habla un texto frase por frase: mientras una frase suena, ya se está sintetizando la
// siguiente (prefetch de una frase), para que no quede silencio entre una y otra. No es
// streaming de audio dentro de una frase, pero evita esperar el texto completo antes de
// empezar a sonar — eso es lo que hacía sentir "por pasos" a la versión anterior.
export function useSpeakQueue(provider: SpeakProvider) {
  const [speaking, setSpeaking] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = ''; audioRef.current = null; }
    setSpeaking(false);
    setActiveIndex(-1);
  }, []);

  const speak = useCallback((fullText: string) => {
    stop();
    const sentences = splitSentences(fullText);
    if (!sentences.length) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setError(null);
    setSpeaking(true);
    void (async () => {
      let next: Promise<Blob> | null = synthesize(provider, sentences[0]!, controller.signal);
      for (let i = 0; i < sentences.length; i++) {
        if (controller.signal.aborted) return;
        setActiveIndex(i);
        let blob: Blob;
        try {
          blob = await next!;
        } catch (caught) {
          if (controller.signal.aborted || (caught as Error).name === 'AbortError') return;
          setError(caught instanceof Error ? caught.message : 'Fallo al sintetizar la voz');
          next = i + 1 < sentences.length ? synthesize(provider, sentences[i + 1]!, controller.signal) : null;
          continue;
        }
        next = i + 1 < sentences.length ? synthesize(provider, sentences[i + 1]!, controller.signal) : null;
        if (controller.signal.aborted) return;
        await playBlob(blob, audioRef, controller.signal);
      }
      if (!controller.signal.aborted) { setSpeaking(false); setActiveIndex(-1); }
    })();
  }, [provider, stop]);

  return { speak, stop, speaking, activeIndex, error };
}
