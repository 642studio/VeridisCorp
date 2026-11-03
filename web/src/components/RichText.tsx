import type { ReactNode } from 'react';

// Markdown mínimo de las respuestas de los modelos (negritas, listas, encabezados), armado con
// elementos de React: nunca se inserta HTML del modelo, así que no hay forma de inyectar nada.
function inline(text: string, key: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) return <strong key={`${key}-${i}`}>{part.slice(2, -2)}</strong>;
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) return <code key={`${key}-${i}`}>{part.slice(1, -1)}</code>;
    return part;
  });
}

export function RichText({ text, className }: { text: string; className?: string }) {
  const blocks: ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  const flush = () => {
    if (!list) return;
    const items = list.items.map((item, i) => <li key={i}>{inline(item, `li${blocks.length}-${i}`)}</li>);
    blocks.push(list.ordered ? <ol key={blocks.length}>{items}</ol> : <ul key={blocks.length}>{items}</ul>);
    list = null;
  };
  let table: string[][] | null = null;
  const flushTable = () => {
    if (!table) return;
    const [head, ...rows] = table;
    const key = blocks.length;
    blocks.push(
      <table key={key} className="rich-text__table">
        <thead><tr>{head!.map((cell, i) => <th key={i}>{inline(cell, `t${key}-h${i}`)}</th>)}</tr></thead>
        <tbody>{rows.map((row, r) => <tr key={r}>{row.map((cell, i) => <td key={i}>{inline(cell, `t${key}-${r}-${i}`)}</td>)}</tr>)}</tbody>
      </table>,
    );
    table = null;
  };
  for (const raw of text.split('\n')) {
    const line = raw.trimEnd();
    // Tabla markdown: filas que empiezan y terminan con "|"; la fila separadora (|---|) se omite.
    if (/^\s*\|.*\|\s*$/.test(line)) {
      flush();
      const cells = line.trim().slice(1, -1).split('|').map((cell) => cell.trim());
      if (cells.every((cell) => /^:?-{2,}:?$/.test(cell))) continue;
      (table ??= []).push(cells);
      continue;
    }
    flushTable();
    const bullet = /^\s*[-*•]\s+(.*)$/.exec(line);
    const numbered = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (bullet || numbered) {
      const ordered = !bullet;
      if (list && list.ordered !== ordered) flush();
      list ??= { ordered, items: [] };
      list.items.push((bullet ?? numbered)![1]!);
      continue;
    }
    flush();
    if (!line.trim()) continue;
    const heading = /^#{1,4}\s+(.*)$/.exec(line);
    blocks.push(heading
      ? <p key={blocks.length} className="rich-text__heading">{inline(heading[1]!, `h${blocks.length}`)}</p>
      : <p key={blocks.length}>{inline(line, `p${blocks.length}`)}</p>);
  }
  flush();
  flushTable();
  return <div className={`rich-text ${className ?? ''}`}>{blocks}</div>;
}
