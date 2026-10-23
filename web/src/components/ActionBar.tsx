import { useState } from 'react';
import type { ArtifactRow, Run } from '../api/types';

const ADVANCE_STATUSES: Run['status'][] = ['queued', 'generating', 'awaiting_review', 'reviewing', 'failed'];
const BLOCKS_REVISE: Run['status'][] = ['generating', 'reviewing', 'dispatching', 'outcome_unknown', 'completed'];

export function ActionBar({
  run, latestArtifact, onAdvance, onRevise, onExecute, onReconcile, pending,
}: {
  run: Run;
  latestArtifact: ArtifactRow | undefined;
  onAdvance: () => void;
  onRevise: (text: string) => void;
  onExecute: () => void;
  onReconcile: () => void;
  pending: { advancing: boolean; revising: boolean; executing: boolean; reconciling: boolean };
}) {
  const [revising, setRevising] = useState(false);
  const [text, setText] = useState('');

  const canAdvance = ADVANCE_STATUSES.includes(run.status);
  const canRevise = !BLOCKS_REVISE.includes(run.status);
  const canExecute = run.status === 'approved';
  const canReconcile = run.status === 'outcome_unknown'
    || (run.status === 'dispatching' && Boolean(run.leaseUntil) && new Date(run.leaseUntil!).getTime() <= Date.now());

  return (
    <div className="action-bar">
      <div className="action-bar__buttons">
        <button type="button" className="button" disabled={!canAdvance || pending.advancing} title={canAdvance ? '' : 'No hay nada que avanzar en esta etapa'} onClick={onAdvance}>
          Avanzar
        </button>
        <button type="button" className="button" disabled={!canRevise} title={canRevise ? '' : 'No se puede revisar mientras hay una etapa en curso'}
          onClick={() => { setText(latestArtifact?.content ?? ''); setRevising((v) => !v); }}>
          Revisar contenido
        </button>
        <button type="button" className="button" disabled={!canExecute || pending.executing} title={canExecute ? '' : 'Requiere una versión aprobada'} onClick={onExecute}>
          Ejecutar
        </button>
        <button type="button" className="button" disabled={!canReconcile || pending.reconciling} title={canReconcile ? '' : 'No hay un resultado incierto que conciliar'} onClick={onReconcile}>
          Conciliar
        </button>
      </div>
      {revising && (
        <div className="action-bar__revise">
          <textarea value={text} onChange={(event) => setText(event.target.value)} rows={4} />
          <button type="button" className="button button--primary" disabled={pending.revising || text.trim().length === 0}
            onClick={() => { onRevise(text.trim()); setRevising(false); }}>
            Enviar nueva versión
          </button>
        </div>
      )}
    </div>
  );
}
