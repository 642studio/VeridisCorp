import { useState } from 'react';
import { useAdvance, useApprove, useExecute, useReconcile, useRevise, useRun } from '../api/hooks';
import { ApiError } from '../api/client';
import { StatusPill } from '../components/StatusPill';
import { Stepper } from '../components/Stepper';
import { BudgetGauge } from '../components/BudgetGauge';
import { TaskPanel } from '../components/TaskPanel';
import { ArtifactVersions } from '../components/ArtifactVersions';
import { ApprovalPanel } from '../components/ApprovalPanel';
import { AuditTimeline } from '../components/AuditTimeline';
import { ActionBar } from '../components/ActionBar';

export function RunDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const query = useRun(id);
  const advance = useAdvance();
  const revise = useRevise();
  const approve = useApprove();
  const execute = useExecute();
  const reconcile = useReconcile();
  // Solo para mostrar el mensaje exacto del servidor ante un 409/403; el servidor
  // sigue siendo la única fuente de verdad sobre si la acción era válida.
  const [lastError, setLastError] = useState<string | null>(null);

  if (query.isLoading) return <p className="muted">Cargando expediente…</p>;
  if (query.error instanceof ApiError && query.error.status === 404) {
    return <p className="error">Este expediente no existe o no está en tu ámbito.</p>;
  }
  if (query.error) return <p className="error">No se pudo cargar: {(query.error as Error).message}</p>;
  if (!query.data) return null;

  const { run, artifacts, audit } = query.data;
  const latestArtifact = artifacts.at(-1);
  const report = (promise: Promise<unknown>) =>
    promise.catch((error: unknown) => setLastError(error instanceof Error ? error.message : 'Error inesperado'));

  return (
    <div className="run-detail">
      <button type="button" className="button button--link" onClick={onBack}>← Volver a expedientes</button>

      <header className="run-detail__header">
        <h2>{run.brief}</h2>
        <div className="run-detail__meta">
          <span title={run.id}>Expediente {run.id.slice(0, 8)}</span>
          <StatusPill status={run.status} />
          <span className="muted">Creado {new Date(run.createdAt).toLocaleString()}</span>
          <span className="muted">Plazo {new Date(run.deadline).toLocaleString()}</span>
        </div>
        <BudgetGauge reservedCostMicros={run.reservedCostMicros} modelCalls={run.modelCalls} toolCalls={run.toolCalls} budget={run.budget} />
      </header>

      <Stepper status={run.status} />

      {lastError && <p className="error">{lastError}</p>}

      <div className="run-detail__columns">
        <div className="run-detail__main">
          <TaskPanel run={run} />
          <ApprovalPanel
            run={run}
            artifacts={artifacts}
            pending={approve.isPending}
            onDecide={(decision, reason) => report(approve.mutateAsync({ id, args: [run.version, decision, reason] }))}
          />
          <ArtifactVersions artifacts={artifacts} />
        </div>
        <div className="run-detail__side">
          <AuditTimeline audit={audit} />
        </div>
      </div>

      <ActionBar
        run={run}
        latestArtifact={latestArtifact}
        pending={{ advancing: advance.isPending, revising: revise.isPending, executing: execute.isPending, reconciling: reconcile.isPending }}
        onAdvance={() => report(advance.mutateAsync({ id, args: [] }))}
        onRevise={(text) => report(revise.mutateAsync({ id, args: [text] }))}
        onExecute={() => report(execute.mutateAsync({ id, args: [] }))}
        onReconcile={() => report(reconcile.mutateAsync({ id, args: [] }))}
      />
    </div>
  );
}
