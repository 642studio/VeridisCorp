// Importar un documento a la memoria corporativa: primero se parte en secciones (aquí, sin IA y de
// forma determinista), luego cada sección se manda por separado al modelo (OfficeRuntime
// .ingestMemorySection). Partirlo permite que la interfaz muestre avance y que ninguna llamada
// reciba un documento entero que el modelo resumiría de más.

export interface DocumentSection { section: string; text: string }

// Un encabezado "fuerte" abre sección: markdown (#), numeración con subnivel (4.1.) o un título
// numerado en mayúsculas ("4. ESTRUCTURA DEL ECOSISTEMA"). Una lista numerada normal ("1. Automatizar
// procesos.") NO cuenta: partiría el documento en trozos sin sentido.
function headingOf(line: string): string | null {
  const trimmed = line.trim();
  if (/^#{1,6}\s+\S/.test(trimmed)) return trimmed.replace(/^#{1,6}\s+/, '');
  if (/^\d+\.\d+\.\s+\S/.test(trimmed) && trimmed.length <= 80) return trimmed;
  if (/^\d+\.\s+\S/.test(trimmed) && trimmed.length <= 80 && trimmed === trimmed.toUpperCase() && /[A-ZÁÉÍÓÚÑ]{3}/.test(trimmed)) return trimmed;
  return null;
}

const TARGET = 1800; // tamaño a partir del cual se corta en el siguiente encabezado
const HARD_MAX = 3500; // a partir de aquí se corta en la siguiente línea en blanco, haya encabezado o no
export const SECTION_MAX = 6000; // lo que acepta una sola llamada de importación

export function splitDocument(text: string): DocumentSection[] {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const sections: DocumentSection[] = [];
  let current: string[] = [];
  let size = 0;
  // La etiqueta de una sección son los encabezados que contiene (máx. 3), o el último encabezado
  // anterior si empieza a media sección: le da al modelo el contexto de dónde está leyendo.
  let inherited = 'Introducción';
  let headings: string[] = [];
  const flush = () => {
    const body = current.join('\n').trim();
    if (body) sections.push({ section: headings.length ? headings.slice(0, 3).join(' · ') : inherited, text: body });
    current = []; size = 0; headings = [];
  };
  for (const line of lines) {
    const heading = headingOf(line);
    if (heading) {
      if (size >= TARGET) flush();
      headings.push(heading);
      inherited = heading;
    } else if (size >= HARD_MAX && line.trim() === '') {
      flush();
      continue;
    }
    current.push(line);
    size += line.length + 1;
  }
  flush();
  // Nada debe superar lo que acepta una llamada: si un bloque sin líneas en blanco quedó gigante, se
  // corta por tamaño (pierde algo de contexto en el borde, pero nunca se descarta texto).
  return sections.flatMap((s) => {
    if (s.text.length <= SECTION_MAX) return [s];
    const parts: DocumentSection[] = [];
    for (let i = 0; i < s.text.length; i += SECTION_MAX) parts.push({ section: `${s.section} (parte ${parts.length + 1})`, text: s.text.slice(i, i + SECTION_MAX) });
    return parts;
  });
}
