import { useState } from 'react';
import type { ApprovalRow, ArtifactRow, Run } from '../api/types';

export function ApprovalPanel({
  run, artifacts, approvals, onDecide, pending, onRegenerate, regenerating,
}: {
  run: Run;
  artifacts: ArtifactRow[];
  approvals: ApprovalRow[];
  onDecide: (decision: 'approved' | 'rejected', reason: string | undefined) => void;
  pending: boolean;
  onRegenerate: () => void;
  regenerating: boolean;
}) {
  const [reason, setReason] = useState('');
  const current = artifacts.find((a) => a.version === run.version);
  if (run.status !== 'awaiting_approval' || !current) return null;

  // Rechazar no cambia run.status (el expediente sigue awaiting_approval a propósito,
  // a la espera de una revisión de contenido) — por eso hay que mirar la aprobación
  // misma, no solo el estado del expediente, para saber si ya se decidió esta versión.
  const decided = approvals.find((a) => a.version === run.version);
  if (decided && decided.data.status !== 'pending') {
    const rejected = decided.data.status === 'rejected';
    return (
      <div className="approval-panel approval-panel--decided">
        <h3>Versión {run.version} {rejected ? 'rechazada' : decided.data.status}</h3>
        {decided.data.reason && <p className="muted">Razón: {decided.data.reason}</p>}
        {rejected && (
          <>
            <p>Puedes escribir la corrección tú mismo con «Revisar contenido», o pedirle al modelo que regenere usando exactamente este motivo.</p>
            <button type="button" className="button button--primary" disabled={regenerating} onClick={onRegenerate}>
              Regenerar con este motivo
            </button>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="approval-panel">
      <h3>Aprobación pendiente — versión {run.version}</h3>
      <p className="muted">
        Contenido exacto que se autoriza. Hash: {current.content_hash}
        {run.action && <> · acción {run.action.id}</>}
      </p>
      <pre className="artifact-text artifact-text--approval">{current.content}</pre>
      <label className="approval-panel__reason">
        Razón (obligatoria solo para rechazar)
        <textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={2} />
      </label>
      <div className="approval-panel__actions">
        <button type="button" className="button button--primary" disabled={pending}
          onClick={() => onDecide('approved', reason.trim() || undefined)}>
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
