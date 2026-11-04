import { useEffect, useRef, useState } from 'react';
import { useSpeechToText } from '../useVoice';
import { useSpeakQueue } from '../useSpeakQueue';
import type { SpeakProvider } from '../speak';
import { detectResponseFlavor, resolveAvatarState, type ResponseFlavor } from '../ascii/responseFlavor';
import type { AvatarState } from '../ascii/states';
import { Scene } from '../ascii/scene';
import { useActiveSession } from '../context/ActiveSessionContext';

// Voicebox llama directo a 127.0.0.1:17493 desde el navegador (ver speak.ts): solo existe en la
// Mac donde corre el daemon, nunca en el panel servido remoto. Ahí ElevenLabs (proxy del backend)
// es la única opción que de verdad suena; evita que alguien en el celular tenga que descubrirlo
// a mano después de un "voz: load failed".
const DEFAULT_PROVIDER: SpeakProvider = ['localhost', '127.0.0.1'].includes(window.location.hostname) ? 'voicebox' : 'elevenlabs';

// Extraído de la antigua pantalla VoiceChat.tsx: la misma lógica de voz (dictado, cola de TTS,
// escena, estado del avatar), pero ahora enchufada a lo que sea que el llamador use para mandar
// la pregunta (askQuestion/send de OfficeChat.tsx) en vez de tener su propia mutación ask().
// `thinking` lo decide el llamador (su propio pendingQuestions), ya que aquí no hay mutación propia.
export function useVoiceDock(send: (text: string) => void, thinking: boolean) {
  const [provider, setProvider] = useState<SpeakProvider>(DEFAULT_PROVIDER);
  const [autoListen, setAutoListen] = useState(true);
  const [hasStarted, setHasStarted] = useState(false);
  const [speakFlavor, setSpeakFlavor] = useState<ResponseFlavor>('plain');
  const [activeScene, setActiveScene] = useState<Scene | null>(null);
  const [lastAnswer, setLastAnswer] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  const stt = useSpeechToText();
  const speak = useSpeakQueue(provider);
  const { setVoiceAvatar } = useActiveSession();

  const autoListenRef = useRef(autoListen);
  useEffect(() => { autoListenRef.current = autoListen; }, [autoListen]);
  const thinkingRef = useRef(thinking);
  useEffect(() => { thinkingRef.current = thinking; }, [thinking]);
  const sendRef = useRef(send);
  useEffect(() => { sendRef.current = send; }, [send]);

  const submit = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setLastError(null);
    setHasStarted(true);
    sendRef.current(trimmed);
  };
  const submitRef = useRef(submit);
  useEffect(() => { submitRef.current = submit; });

  // El micrófono nunca debe estar escuchando mientras Dora suena por los parlantes: sin esto,
  // se transcribe a sí misma y la siguiente pregunta llega con la respuesta anterior metida. Por
  // eso el reinicio automático espera a que speak.speaking vuelva a false (toda la cola de frases
  // terminó de sonar), nunca un timeout fijo justo cuando llega el texto de la respuesta.
  const wasSpeakingRef = useRef(false);
  useEffect(() => {
    if (wasSpeakingRef.current && !speak.speaking) {
      // La escena vive mientras se habla la respuesta de ese turno — mismo gatillo que el
      // reinicio automático del micrófono, en vez de un temporizador propio.
      setActiveScene(null);
      if (autoListenRef.current && !stt.listening && !thinkingRef.current) {
        stt.start((text) => submitRef.current(text));
      }
    }
    wasSpeakingRef.current = speak.speaking;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speak.speaking]);

  const toggleListening = () => {
    if (stt.listening) stt.stop();
    else { speak.stop(); stt.start((text) => submitRef.current(text)); }
  };

  // Llamado por el dueño del dock (OfficeChat.tsx) cuando llega la respuesta de askQuestion, para
  // que el dock la hable y, si trae escena, la muestre — igual que hacía VoiceChat.tsx.
  const receiveReply = (answer: string, scene?: Scene | null) => {
    setLastAnswer(answer);
    setSpeakFlavor(detectResponseFlavor(answer));
    // Validada de nuevo en el cliente: si el esquema del backend y el de scene.ts llegaran a
    // desalinearse, esto degrada a "sin escena" en vez de romper el render.
    const parsedScene = scene ? Scene.safeParse(scene) : null;
    setActiveScene(parsedScene?.success ? parsedScene.data : null);
    speak.speak(answer);
  };

  const avatarState: AvatarState = resolveAvatarState({
    hasStarted, listening: stt.listening, thinking, speaking: speak.speaking,
    speakingFlavor: speakFlavor, errored: Boolean(lastError || speak.error),
  });

  let caption: string | null = null;
  if (stt.listening) caption = stt.interimText ? `${stt.interimText}…` : 'Escuchando…';
  else if (thinking) caption = 'Pensando…';
  else if (speak.speaking && lastAnswer) caption = lastAnswer;
  else if (!hasStarted) caption = 'Toca el micrófono y habla con VERIDIS.';
  else if (lastAnswer) caption = lastAnswer;

  // El mini-avatar del sidebar (MiniAvatar.tsx) toma el relevo mientras este dock está vivo —
  // se limpia al desmontar para no dejar un brillo de "escuchando" pegado tras cerrar la sesión.
  useEffect(() => {
    setVoiceAvatar(avatarState, activeScene);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [avatarState, activeScene]);
  useEffect(() => () => setVoiceAvatar(null, null), [setVoiceAvatar]);

  return {
    stt, speak, provider, setProvider, autoListen, setAutoListen,
    avatarState, activeScene, caption, lastError, toggleListening, submit, receiveReply,
  };
}

export type VoiceDock = ReturnType<typeof useVoiceDock>;
