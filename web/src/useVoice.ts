import { useCallback, useEffect, useRef, useState } from 'react';

// La Web Speech API no tiene tipos oficiales en lib.dom.d.ts (sigue sin estandarizarse del
// todo); se declara aquí solo el subconjunto que se usa, en vez de tirar todo a "any".
interface SpeechRecognitionResultLike { 0: { transcript: string }; isFinal: boolean }
interface SpeechRecognitionEventLike extends Event { results: ArrayLike<SpeechRecognitionResultLike> }
interface SpeechRecognitionLike extends EventTarget {
  lang: string; continuous: boolean; interimResults: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: Event) => void) | null;
  onend: (() => void) | null;
  start(): void; stop(): void;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  const w = window as unknown as { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

// Dictado por voz para el borrador del chat: nativo del navegador (Chrome/Edge lo soportan
// hoy; en los demás `supported` queda en false y el botón de micrófono simplemente no
// aparece, en vez de fallar). El audio se procesa en los servidores de reconocimiento del
// navegador (Google, en Chrome) — igual que cualquier dictado del sistema operativo, no es
// local ni pasa por VeridisCorp.
export function useSpeechToText(lang = 'es-MX') {
  const [supported] = useState(() => getSpeechRecognitionCtor() !== null);
  const [listening, setListening] = useState(false);
  const [interimText, setInterimText] = useState('');
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const onResultRef = useRef<((text: string) => void) | null>(null);

  const start = useCallback((onResult: (text: string) => void) => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor || recognitionRef.current) return;
    onResultRef.current = onResult;
    const recognition = new Ctor();
    recognition.lang = lang;
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      let finalText = '';
      let interim = '';
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i]!;
        if (result.isFinal) finalText += result[0].transcript;
        else interim += result[0].transcript;
      }
      setInterimText(interim);
      if (finalText.trim()) onResultRef.current?.(finalText.trim());
    };
    recognition.onerror = () => { setListening(false); setInterimText(''); recognitionRef.current = null; };
    recognition.onend = () => { setListening(false); setInterimText(''); recognitionRef.current = null; };
    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  }, [lang]);

  const stop = useCallback(() => { recognitionRef.current?.stop(); }, []);

  useEffect(() => () => { recognitionRef.current?.stop(); }, []);

  return { supported, listening, interimText, start, stop };
}

// Lectura en voz alta de las respuestas — síntesis nativa del navegador (speechSynthesis),
// sin red ni claves propias: corre en el sistema operativo del usuario.
export function useTextToSpeech(lang = 'es-MX') {
  const [supported] = useState(() => typeof window !== 'undefined' && 'speechSynthesis' in window);
  const [speaking, setSpeaking] = useState(false);

  const speak = useCallback((text: string) => {
    if (!supported || !text.trim()) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);
  }, [supported, lang]);

  const stop = useCallback(() => { if (supported) window.speechSynthesis.cancel(); setSpeaking(false); }, [supported]);

  useEffect(() => () => { if (supported) window.speechSynthesis.cancel(); }, [supported]);

  return { supported, speaking, speak, stop };
}
