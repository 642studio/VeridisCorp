import { useEffect, useRef, useState } from 'react';

// Revela un texto ya recibido progresivamente, como si se estuviera escribiendo. Es solo un
// efecto de interfaz: el texto completo ya llegó en una única respuesta HTTP — esto no es
// streaming real del backend, solo una repetición cosmética de algo que ya tenemos completo.
// `messageKey` identifica el mensaje (expediente + índice de turno) para no repetir la
// animación si el componente se vuelve a montar mostrando el mismo texto de antes.
const revealedKeys = new Set<string>();

export function useTypewriter(text: string, messageKey: string, charsPerTick = 3): string {
  const [revealed, setRevealed] = useState(() => (revealedKeys.has(messageKey) ? text.length : 0));
  const keyRef = useRef(messageKey);

  useEffect(() => {
    if (keyRef.current !== messageKey) {
      keyRef.current = messageKey;
      setRevealed(revealedKeys.has(messageKey) ? text.length : 0);
    }
  }, [messageKey]);

  useEffect(() => {
    if (revealed >= text.length) { revealedKeys.add(messageKey); return; }
    const id = setInterval(() => setRevealed((r) => Math.min(text.length, r + charsPerTick)), 12);
    return () => clearInterval(id);
  }, [messageKey, revealed, text.length]);

  return text.slice(0, revealed);
}
