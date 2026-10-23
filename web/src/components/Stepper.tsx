import type { RunStatus } from '../api/types';

// Línea feliz del pipeline real (src/runtime/service.ts), con el agente o servicio que
// actúa en cada etapa — son identidades reales de src/runtime/contracts.ts, no decorativas.
const HAPPY_PATH: { status: RunStatus; label: string; agent: string }[] = [
  { status: 'queued', label: 'EN COLA', agent: 'content-orchestrator' },
  { status: 'generating', label: 'GENERANDO', agent: 'content' },
  { status: 'awaiting_review', label: 'POR REVISAR', agent: 'review' },
  { status: 'reviewing', label: 'REVISANDO', agent: 'review' },
  { status: 'awaiting_approval', label: 'POR APROBAR', agent: 'humano' },
  { status: 'approved', label: 'APROBADO', agent: 'humano' },
  { status: 'dispatching', label: 'ENTREGANDO', agent: 'delivery-executor' },
  { status: 'completed', label: 'COMPLETADO', agent: '—' },
];

export function Stepper({ status }: { status: RunStatus }) {
  const isAlert = status === 'failed' || status === 'outcome_unknown';
  const activeIndex = HAPPY_PATH.findIndex((step) => step.status === status);

  return (
    <div className="stepper">
      <p className="panel-title">AGENT_FLOW</p>
      <ol className="stepper__track">
        {HAPPY_PATH.map((step, index) => {
          const state = isAlert
            ? 'past'
            : activeIndex === -1 ? 'past' : index < activeIndex ? 'past' : index === activeIndex ? 'active' : 'future';
          return (
            <li key={step.status} className={`stepper__step stepper__step--${state}`}>
              <span className="stepper__agent">{step.agent}</span>
              <span className="stepper__label">{step.label}</span>
              {index < HAPPY_PATH.length - 1 && <span className="stepper__arrow">→</span>}
            </li>
          );
        })}
      </ol>
      {isAlert && (
        <div className="stepper__alert">
          {status === 'failed' ? '[ ! ] FALLÓ — requiere avanzar de nuevo o intervención' : '[ ! ] RESULTADO DESCONOCIDO tras la entrega — requiere conciliar'}
        </div>
      )}
    </div>
  );
}
