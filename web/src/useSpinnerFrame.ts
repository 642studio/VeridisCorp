import { useEffect, useState } from 'react';

const FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

// Spinner braille de terminal (el mismo tipo que usan npm/yarn) para mostrar que sigue
// trabajando mientras esperamos una respuesta real que puede tardar uno o dos minutos.
export function useSpinnerFrame(active: boolean): string {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (!active) { setIndex(0); return; }
    const id = setInterval(() => setIndex((i) => (i + 1) % FRAMES.length), 90);
    return () => clearInterval(id);
  }, [active]);
  return FRAMES[index]!;
}
