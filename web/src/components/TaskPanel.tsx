import type { Run } from '../api/types';

// Hoy runtime/ tiene una sola tarea fija por expediente (ver docs/runtime-pilot.md),
// así que el agente activo se deriva del estado en vez de leer una tabla de tareas.
function activeAgent(status: Run['status']): string | null {
  switch (status) {
    case 'generating': return 'content (borrador)';
    case 'awaiting_review':
    case 'reviewing': return 'review (revisión independiente)';
    case 'dispatching': return 'delivery-executor (entrega)';
    default: return null;
  }
}

export function TaskPanel({ run }: { run: Run }) {
  const agent = activeAgent(run.status);
  const leaseExpired = Boolean(run.leaseUntil && run.activeAttemptId && new Date(run.leaseUntil).getTime() <= Date.now());

  return (
    <div className="task-panel">
      <h3>Tarea</h3>
      {agent ? <p>Agente activo: <strong>{agent}</strong></p> : <p className="muted">Sin agente trabajando en este momento.</p>}
      {run.status === 'failed' && (
        <div className="task-panel__alert">
          Falló el último intento (modelo o contrato inválido). No se liberó la reserva de presupuesto.
          Usa «avanzar» para reintentar, si el presupuesto lo permite.
        </div>
      )}
      {run.status === 'outcome_unknown' && (
        <div className="task-panel__alert">
          Se envió la entrega pero no se confirmó la respuesta. Usa «conciliar» para consultar al receptor por clave y hash
          — nunca se reenvía el contenido.
        </div>
      )}
      {leaseExpired && run.status === 'dispatching' && (
        <div className="task-panel__alert">
          El intento activo venció su reserva sin confirmarse. Usa «conciliar» para recuperar el estado real antes de reintentar.
        </div>
      )}
    </div>
  );
}
