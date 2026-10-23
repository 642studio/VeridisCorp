import { useEffect, useState } from 'react';

// Para dar señal de vida mientras una mutación que dispara IA real está en vuelo (puede tardar
// uno o dos minutos: varias llamadas reales encadenadas). No sabemos en qué paso va — el
// servidor responde una sola vez al terminar todo — pero al menos mostramos que sigue viva.
export function useElapsedSeconds(pending: boolean): number {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!pending) { setSeconds(0); return; }
    const start = Date.now();
    const id = setInterval(() => setSeconds(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(id);
  }, [pending]);
  return seconds;
}
