import { useState } from 'react';
import { useOfficeOrder, useAdvanceOfficeOrder, useAnswerOfficeOrder } from '../api/hooks';
import { ApiError, api } from '../api/client';
import { SessionExpired } from '../components/SessionExpired';
import { InvolvedAgents } from '../components/InvolvedAgents';
import { useElapsedSeconds } from '../useElapsedSeconds';
import { ORDER_STATUS, TASK_STATUS } from '../officeStatus';
import type { OfficeAssessment, OfficeBudget, OfficeEventRow, OfficeEvidence } from '../api/types';

const OFFICE_FILE_PREFIX = 'office-file://';
const EVENT_LABELS: Record<string, string> = {
  add_task: 'Nueva tarea', start_task: 'Inicia tarea', request_support: 'Pide apoyo',
  submit_result: 'Entrega resultado', review_task: 'Revisión', resolve_block: 'Desbloquea',
  cancel_task: 'Cancela tarea', pause_order: 'Pausa', close_order: 'Cierra expediente',
};

function truncate(text: string, max = 280): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

// El tipo de evento a solas ("submit_result", "pause_order"...) no dice nada de lo que realmente
// pasó; esta función saca el texto real (pregunta, motivo, resumen) para cada tipo de comando.
function eventDetail(event: OfficeEventRow): string | null {
  const command = event.command as Record<string, unknown>;
  switch (command.type) {
    case 'add_task': {
      const task = command.task as { title?: string; assignedAgentId?: string } | undefined;
      return task?.title ? `${task.title}${task.assignedAgentId ? ` → ${task.assignedAgentId}` : ''}` : null;
    }
    case 'request_support': return typeof command.question === 'string' ? truncate(command.question) : null;
    case 'submit_result': {
      const submission = command.submission as { summary?: string } | undefined;
      return submission?.summary ? truncate(submission.summary) : null;
    }
    case 'review_task': {
      const assessments = command.assessments as { accepted?: boolean }[] | undefined;
      if (!assessments) return null;
      const accepted = assessments.filter((a) => a.accepted).length;
      return `${accepted}/${assessments.length} criterios aceptados`;
    }
    case 'resolve_block': return typeof command.resolution === 'string' ? truncate(command.resolution) : null;
    case 'cancel_task':
    case 'pause_order': return typeof command.reason === 'string' ? truncate(command.reason) : null;
    default: return null;
  }
}

function EvidenceFileDownload({ fileId }: { fileId: string }) {
  const [state, setState] = useState<'idle' | 'pending' | 'error'>('idle');
  return (
    <>
      <button
        type="button" className="button button--link"
        disabled={state === 'pending'}
        onClick={() => {
          setState('pending');
          api.downloadOfficeFile(fileId, 'documento.pdf')
            .then(() => setState('idle'))
            .catch(() => setState('error'));
        }}
      >
        {state === 'pending' ? 'Descargando…' : '[ DESCARGAR PDF ]'}
      </button>
      {state === 'error' && <span className="error">No se pudo descargar.</span>}
    </>
  );
}

function EvidenceList({ evidence }: { evidence: OfficeEvidence[] }) {
  if (evidence.length === 0) return null;
  return (
    <ul className="task-evidence">
      {evidence.map((item) => {
        const fileId = item.reference.startsWith(OFFICE_FILE_PREFIX) ? item.reference.slice(OFFICE_FILE_PREFIX.length) : null;
        return (
          <li key={item.id} className="task-evidence__item">
            <span className="tag">{item.kind}</span>
            <span className="task-evidence__reference" title={item.reference}>{item.reference}</span>
            <p className="muted">{item.summary}</p>
            {fileId && <EvidenceFileDownload fileId={fileId} />}
          </li>
        );
      })}
    </ul>
  );
}

function AssessmentList({ assessments }: { assessments: OfficeAssessment[] }) {
  if (assessments.length === 0) return null;
  return (
    <ul className="task-assessment">
      {assessments.map((a) => (
        <li key={a.criterionId} className="task-assessment__item">
          <span className={`status-pill status-pill--${a.accepted ? 'done' : 'attention'}`}>
            {a.criterionId}: {a.accepted ? 'aceptado' : 'rechazado'}
          </span>
          <p className="muted">{a.explanation}</p>
        </li>
      ))}
    </ul>
  );
}

function LimitsGauge({ turns, maxTurns, rejectedDecisions, maxRejectedDecisions }: {
  turns: number; maxTurns: number; rejectedDecisions: number; maxRejectedDecisions: number;
}) {
  const turnsRatio = maxTurns > 0 ? Math.min(1, turns / maxTurns) : 0;
  const rejectedRatio = maxRejectedDecisions > 0 ? Math.min(1, rejectedDecisions / maxRejectedDecisions) : 0;
  return (
    <div className="budget-gauge">
      <div className="budget-gauge__row">
        <span>Turnos usados</span>
        <span>{turns} / {maxTurns}</span>
      </div>
      <div className="budget-gauge__bar"><div className="budget-gauge__fill" style={{ width: `${turnsRatio * 100}%` }} /></div>
      <div className="budget-gauge__row budget-gauge__row--small">
        <span>Decisiones rechazadas: {rejectedDecisions} / {maxRejectedDecisions}</span>
        <span className="muted" title="Al llegar al máximo, el expediente se pausa solo">
          {rejectedDecisions >= maxRejectedDecisions ? '[ ! ] límite alcanzado' : ''}
        </span>
      </div>
      {rejectedRatio >= 1 ? null : rejectedRatio > 0.5 && (
        <p className="muted" style={{ marginTop: 4 }}>Se acerca al límite de decisiones rechazadas — puede pausarse pronto.</p>
      )}
    </div>
  );
}

const money = (micros: number) => `$${(micros / 1_000_000).toFixed(4)}`;
const BUDGET_NOTE: Record<OfficeBudget['level'], string> = {
  none: '', ok: '', warning: '80% del presupuesto usado', critical: '90% del presupuesto usado — puede pausarse pronto', exceeded: '[ ! ] presupuesto agotado',
};

// Mismo molde visual que LimitsGauge. Sin presupuesto configurado solo informa lo gastado; nunca
// presenta como total un gasto que excluye llamadas sin precio sin decirlo.
function BudgetLine({ budget }: { budget: OfficeBudget }) {
  const unpriced = budget.unpricedCalls > 0
    ? ` · ${budget.unpricedCalls} llamada${budget.unpricedCalls === 1 ? '' : 's'} sin precio, no incluida${budget.unpricedCalls === 1 ? '' : 's'}`
    : '';
  if (budget.maxCostMicros === null) {
    return <p className="muted">Gasto estimado: {money(budget.spentMicros)} (sin presupuesto configurado){unpriced}</p>;
  }
  const ratio = Math.min(1, budget.spentMicros / budget.maxCostMicros);
  return (
    <div className="budget-gauge">
      <div className="budget-gauge__row">
        <span>Presupuesto usado</span>
        <span>{money(budget.spentMicros)} / {money(budget.maxCostMicros)}</span>
      </div>
      <div className="budget-gauge__bar"><div className="budget-gauge__fill" style={{ width: `${ratio * 100}%` }} /></div>
      <div className="budget-gauge__row budget-gauge__row--small">
        <span>
          Próxima llamada estimada: {budget.projectedNextMicros === null ? 'sin historial todavía' : money(budget.projectedNextMicros)}{unpriced}
        </span>
        <span className="muted" title="Se pausa antes de una llamada que rebasaría el presupuesto">{BUDGET_NOTE[budget.level]}</span>
      </div>
    </div>
  );
}

export function OfficeOrderDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const query = useOfficeOrder(id);
  const advance = useAdvanceOfficeOrder();
  const answer = useAnswerOfficeOrder();
  const [answerText, setAnswerText] = useState('');
  const [lastError, setLastError] = useState<string | null>(null);
  const advancingSeconds = useElapsedSeconds(advance.isPending);
  const answeringSeconds = useElapsedSeconds(answer.isPending);

  if (query.isLoading) return <p className="muted">Cargando expediente…</p>;
  if (query.error instanceof ApiError && query.error.status === 401) return <SessionExpired />;
  if (query.error instanceof ApiError && query.error.status === 404) return <p className="error">Este expediente no existe o no está en tu ámbito.</p>;
  if (query.error) return <p className="error">No se pudo cargar: {(query.error as Error).message}</p>;
  if (!query.data) return null;

  const { order, turns, rejectedDecisions, interrupted, pendingQuestion, modelCalls, limits, budget } = query.data;
  const canAdvance = order.status === 'active' && !interrupted;
  const orderStatus = ORDER_STATUS[order.status];

  const report = (promise: Promise<unknown>) => promise.catch((error: unknown) => setLastError(error instanceof Error ? error.message : 'Error inesperado'));

  return (
    <div className="run-detail">
      <button type="button" className="button button--link" onClick={onBack}>← Volver a expedientes</button>

      <header className="run-detail__header">
        <h2>{order.objective}</h2>
        <div className="run-detail__meta">
          <span title={order.id}>Expediente {order.id.slice(0, 8)}</span>
          <span className={`status-pill status-pill--${orderStatus.tone}`}>{orderStatus.label}</span>
          <span className="muted">Llamadas reales: {modelCalls.length}</span>
        </div>
        <LimitsGauge turns={turns} maxTurns={limits.maxTurns} rejectedDecisions={rejectedDecisions} maxRejectedDecisions={limits.maxRejectedDecisions} />
        <BudgetLine budget={budget} />
        {order.pauseReason && <p className="task-panel__alert">[ ! ] Pausado: {order.pauseReason}</p>}
      </header>

      {lastError && <p className="error">{lastError}</p>}

      {order.status === 'completed' && order.assessments && (
        <div className="order-result">
          <p className="panel-title">RESULTADO FINAL</p>
          <AssessmentList assessments={order.assessments} />
        </div>
      )}

      <InvolvedAgents modelCalls={modelCalls} />

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
            {answer.isPending ? `Procesando con IA real… (${answeringSeconds}s)` : 'Responder (dispara IA real)'}
          </button>
          {answer.isPending && <p className="muted">Puede tardar uno o dos minutos: hay varias llamadas reales de IA encadenadas, una tras otra.</p>}
        </div>
      )}

      <div className="run-detail__columns">
        <div className="run-detail__main">
          <div>
            <p className="panel-title">TAREAS</p>
            {order.tasks.length === 0 && <p className="muted">Sin tareas todavía.</p>}
            <ul className="org-agents">
              {order.tasks.map((task) => {
                const taskStatus = TASK_STATUS[task.status];
                return (
                  <li key={task.id} className="org-agent org-agent--block" style={{ cursor: 'default' }}>
                    <div className="org-agent__row">
                      <span className="org-agent__id">{task.assignedAgentId}</span>
                      <span>{task.title}</span>
                      <span className={`status-pill status-pill--${taskStatus.tone}`}>{taskStatus.label}</span>
                      {task.departmentId && <span className="muted">{task.departmentId}</span>}
                    </div>
                    {task.blocker && <p className="org-agent__caps error">Bloqueo: {task.blocker}</p>}
                    {task.submission && (
                      <div className="task-result">
                        <p className="panel-title">ENTREGABLE</p>
                        <pre className="artifact-text">{task.submission.summary}</pre>
                        <EvidenceList evidence={task.submission.evidence} />
                      </div>
                    )}
                    {task.assessments && (
                      <div className="task-result">
                        <p className="panel-title">REVISIÓN</p>
                        <AssessmentList assessments={task.assessments} />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
        <div className="run-detail__side">
          <p className="panel-title">EVENTOS</p>
          <ul className="audit-timeline__list">
            {[...order.events].reverse().map((event) => {
              const detail = eventDetail(event);
              return (
                <li key={event.sequence} className="audit-timeline__item">
                  {event.occurredAt && <span className="audit-timeline__time">{new Date(event.occurredAt).toLocaleString()}</span>}
                  <span className="audit-timeline__event">{EVENT_LABELS[event.command.type] ?? event.command.type}</span>
                  <span className="audit-timeline__who">{event.actor.role === 'agent' ? event.actor.agentId : 'coordinador'}</span>
                  {detail && <p className="muted" style={{ margin: '2px 0 0' }}>{detail}</p>}
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      <div className="action-bar">
        <div className="action-bar__buttons">
          <button type="button" className="button" disabled={!canAdvance || advance.isPending}
            title={canAdvance ? '' : 'No hay nada que avanzar en este estado'}
            onClick={() => report(advance.mutateAsync({ id, args: [] }))}>
            {advance.isPending ? `Avanzando… (${advancingSeconds}s)` : 'Avanzar (IA real)'}
          </button>
          {advance.isPending && <span className="muted">Puede tardar uno o dos minutos: varias llamadas reales de IA, una tras otra.</span>}
        </div>
      </div>
    </div>
  );
}
