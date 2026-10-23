import { useState } from 'react';
import type { ArtifactRow, Run } from '../api/types';

export function ApprovalPanel({
  run, artifacts, onDecide, pending,
}: {
  run: Run;
  artifacts: ArtifactRow[];
  onDecide: (decision: 'approved' | 'rejected', reason: string) => void;
  pending: boolean;
}) {
  const [reason, setReason] = useState('');
  const current = artifacts.find((a) => a.version === run.version);
  if (run.status !== 'awaiting_approval' || !current) return null;

  return (
    <div className="approval-panel">
      <h3>Aprobación pendiente — versión {run.version}</h3>
      <p className="muted">
        Contenido exacto que se autoriza. Hash: {current.content_hash}
        {run.action && <> · acción {run.action.id}</>}
      </p>
      <pre className="artifact-text artifact-text--approval">{current.content}</pre>
      <label className="approval-panel__reason">
        Razón de la decisión (obligatoria)
        <textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={2} />
      </label>
      <div className="approval-panel__actions">
        <button type="button" className="button button--primary" disabled={pending || reason.trim().length === 0}
          onClick={() => onDecide('approved', reason.trim())}>
          Aprobar
        </button>
        <button type="button" className="button button--danger" disabled={pending || reason.trim().length === 0}
          onClick={() => onDecide('rejected', reason.trim())}>
          Rechazar
        </button>
      </div>
    </div>
  );
}
