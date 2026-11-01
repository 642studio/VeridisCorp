import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import type { CorporateMemoryRecord } from '../api/types';
import { KINDS } from './memoryMap/engine';

type Row = { section: string; text: string; state: 'pending' | 'running' | 'done' | 'error'; memories: CorporateMemoryRecord[]; error?: string };

// Pegar un documento (contexto de la empresa, notas, un brief) para que la memoria lo aprenda. El
// servidor lo parte en secciones y cada sección se importa por separado: así se ve el avance y una
// sección que falle no tira las demás.
export function MemoryImport({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const client = useQueryClient();
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    setError(null); setRunning(true);
    try {
      const plan = await api.planMemoryImport(title.trim(), text);
      let current: Row[] = plan.sections.map((s) => ({ ...s, state: 'pending', memories: [] }));
      setRows(current);
      for (let i = 0; i < current.length; i++) {
        current = current.map((r, j) => (j === i ? { ...r, state: 'running' } : r)); setRows(current);
        try {
          const result = await api.importMemorySection(plan.title, current[i]!.section, current[i]!.text, confirm);
          current = current.map((r, j) => (j === i ? { ...r, state: 'done', memories: result.memories } : r));
        } catch (e) {
          current = current.map((r, j) => (j === i ? { ...r, state: 'error', error: e instanceof Error ? e.message : 'Error' } : r));
        }
        setRows(current);
        void client.invalidateQueries({ queryKey: ['memory'] });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo importar');
    } finally {
      setRunning(false);
    }
  };

  const saved = rows?.reduce((n, r) => n + r.memories.length, 0) ?? 0;
  const finished = rows !== null && !running;

  return (
    <div className="memory-import">
      <div className="memory-import__head">
        <p className="panel-title">IMPORTAR TEXTO A LA MEMORIA</p>
        {!running && <button type="button" className="memory-map__close" aria-label="Cerrar" onClick={onClose}>×</button>}
      </div>
      {rows === null ? (
        <>
          <p className="muted">
            Pega un documento (contexto de la empresa, notas de un cliente, un brief). Se parte por secciones y cada una se
            convierte en memorias cortas, conservando si algo es histórico, propuesto o por confirmar. Se usa de inmediato;
            si no lo escribiste tú, queda sin confirmar hasta que lo revises.
          </p>
          <label className="memory-import__field">
            Título del documento
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="p. ej. Contexto maestro de Grupo 642" maxLength={200} />
          </label>
          <label className="memory-import__field">
            Texto <span className="muted">{text.length.toLocaleString('es-MX')} caracteres</span>
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={12} />
          </label>
          <label className="memory-import__check">
            <input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} />
            Lo escribí yo: guardar como confirmado <span className="muted">(los agentes lo tratarán como dato firme, no como algo por verificar)</span>
          </label>
          {error && <p className="error">{error}</p>}
          <div className="memory-map__buttons">
            <button type="button" className="button button--primary" disabled={running || !title.trim() || !text.trim()} onClick={() => void start()}>
              {running ? 'Preparando…' : 'Importar'}
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="memory-import__summary">
            {running ? `Importando ${rows.findIndex((r) => r.state === 'running') + 1} de ${rows.length} secciones…` : `Listo: ${saved} memorias nuevas de ${rows.length} secciones, ${confirm ? 'ya confirmadas' : 'todas sin confirmar'}.`}
          </p>
          <ol className="memory-import__rows">
            {rows.map((row, i) => (
              <li key={i} className={`memory-import__row memory-import__row--${row.state}`}>
                <span className="memory-import__state">
                  {row.state === 'pending' ? '·' : row.state === 'running' ? '…' : row.state === 'done' ? `${row.memories.length}` : '!'}
                </span>
                <span className="memory-import__section">{row.section}</span>
                {row.state === 'error' && <span className="error"> {row.error}</span>}
                {row.state === 'done' && row.memories.length > 0 && (
                  <ul className="memory-import__memories">
                    {row.memories.map((m) => (
                      <li key={m.id}><span className="memory-map__dot" style={{ background: KINDS[m.kind ?? 'fact'].color }} />{m.content}</li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ol>
          {finished && (
            <div className="memory-map__buttons">
              <button type="button" className="button button--primary" onClick={onDone}>Ver en el mapa</button>
              <button type="button" className="button" onClick={() => { setRows(null); setText(''); setTitle(''); setConfirm(false); }}>Importar otro</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
