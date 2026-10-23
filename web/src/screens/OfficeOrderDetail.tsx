import { useState } from 'react';
import { useOfficeOrder, useAdvanceOfficeOrder, useAnswerOfficeOrder } from '../api/hooks';
import { ApiError } from '../api/client';
import type { OfficeOrderStatus, OfficeTaskStatus } from '../api/types';

const ORDER_STATUS_TONE: Record<OfficeOrderStatus, string> = { active: 'progress', paused: 'attention', completed: 'done' };
const TASK_STATUS_TONE: Record<OfficeTaskStatus, string> = {
  pending: 'neutral', running: 'progress', blocked: 'attention', in_review: 'progress', completed: 'done', failed: 'attention',
};

export function OfficeOrderDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const query = useOfficeOrder(id);
  const advance = useAdvanceOfficeOrder();
  const answer = useAnswerOfficeOrder();
  const [answerText, setAnswerText] = useState('');
  const [lastError, setLastError] = useState<string | null>(null);

  if (query.isLoading) return <p className="muted">Cargando expediente…</p>;
  if (query.error instanceof ApiError && query.error.status === 404) return <p className="error">Este expediente no existe o no está en tu ámbito.</p>;
  if (query.error) return <p className="error">No se pudo cargar: {(query.error as Error).message}</p>;
  if (!query.data) return null;

  const { order, turns, rejectedDecisions, interrupted, pendingQuestion, modelCalls } = query.data;
  const distinctAgents = [...new Set(modelCalls.map((c) => c.agentId))].sort();
  const canAdvance = order.status === 'active' && !interrupted;

  const report = (promise: Promise<unknown>) => promise.catch((error: unknown) => setLastError(error instanceof Error ? error.message : 'Error inesperado'));

  return (
    <div className="run-detail">
      <button type="button" className="button button--link" onClick={onBack}>← Volver a expedientes</button>

      <header className="run-detail__header">
        <h2>{order.objective}</h2>
        <div className="run-detail__meta">
          <span title={order.id}>Expediente {order.id.slice(0, 8)}</span>
          <span className={`status-pill status-pill--${ORDER_STATUS_TONE[order.status]}`}>{order.status}</span>
          <span className="muted">Turnos: {turns}</span>
          <span className="muted">Decisiones rechazadas: {rejectedDecisions}</span>
          <span className="muted">Llamadas reales: {modelCalls.length}</span>
        </div>
        {order.pauseReason && <p className="task-panel__alert">[ ! ] Pausado: {order.pauseReason}</p>}
      </header>

      {lastError && <p className="error">{lastError}</p>}

      <div className="office-agents-involved">
        <p className="panel-title">AGENTES REALES INVOLUCRADOS</p>
        {distinctAgents.length === 0 && <p className="muted">Todavía ninguno.</p>}
        <div className="tag-row">
          {distinctAgents.map((agentId) => <span key={agentId} className="tag tag--real">{agentId}</span>)}
        </div>
      </div>

      {interrupted && pendingQuestion && (
        <div className="approval-panel approval-panel--decided">
          <h3>El coordinador pregunta</h3>
          <p>{pendingQuestion}</p>
          <label className="approval-panel__reason">
            Respuesta
            <textarea value={answerText} onChange={(event) => setAnswerText(event.target.value)} rows={2} />
          </label>
          <button type="button" className="button button--primary" disabled={answer.isPending || answerText.trim().length === 0}
            onClick={() => report(answer.mutateAsync({ id, args: [answerText.trim()] })).then(() => setAnswerText(''))}>
            Responder (dispara IA real)
          </button>
        </div>
      )}

      <div className="run-detail__columns">
        <div className="run-detail__main">
          <div>
            <p className="panel-title">TAREAS</p>
            {order.tasks.length === 0 && <p className="muted">Sin tareas todavía.</p>}
            <ul className="org-agents">
              {order.tasks.map((task) => (
                <li key={task.id} className="org-agent" style={{ cursor: 'default' }}>
                  <span className="org-agent__id">{task.assignedAgentId}</span>
                  <span>{task.title}</span>
                  <span className={`status-pill status-pill--${TASK_STATUS_TONE[task.status]}`}>{task.status}</span>
                  {task.departmentId && <span className="muted">{task.departmentId}</span>}
                  {task.blocker && <span className="org-agent__caps error">Bloqueo: {task.blocker}</span>}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="run-detail__side">
          <p className="panel-title">EVENTOS</p>
          <ul className="audit-timeline__list">
            {[...order.events].reverse().map((event) => (
              <li key={event.sequence} className="audit-timeline__item">
                <span className="audit-timeline__event">{event.command.type}</span>
                <span className="audit-timeline__who">{event.actor.role === 'agent' ? event.actor.agentId : 'coordinador'}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="action-bar">
        <div className="action-bar__buttons">
          <button type="button" className="button" disabled={!canAdvance || advance.isPending}
            title={canAdvance ? '' : 'No hay nada que avanzar en este estado'}
            onClick={() => report(advance.mutateAsync({ id, args: [] }))}>
            {advance.isPending ? 'Avanzando…' : 'Avanzar (IA real)'}
          </button>
        </div>
      </div>
    </div>
  );
}
