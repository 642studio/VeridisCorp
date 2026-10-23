import type { RunStatus } from '../api/types';

// Línea feliz del pipeline real (src/runtime/service.ts). failed y outcome_unknown
// no son un paso más: son ramas de alerta que cuelgan de la etapa donde ocurrieron.
const HAPPY_PATH: { status: RunStatus; label: string }[] = [
  { status: 'queued', label: 'En cola' },
  { status: 'generating', label: 'Generando' },
  { status: 'awaiting_review', label: 'Por revisar' },
  { status: 'reviewing', label: 'Revisando' },
  { status: 'awaiting_approval', label: 'Por aprobar' },
  { status: 'approved', label: 'Aprobado' },
  { status: 'dispatching', label: 'Entregando' },
  { status: 'completed', label: 'Completado' },
];

export function Stepper({ status }: { status: RunStatus }) {
  const isAlert = status === 'failed' || status === 'outcome_unknown';
  const activeIndex = HAPPY_PATH.findIndex((step) => step.status === status);

  return (
    <div className="stepper">
      <ol className="stepper__track">
        {HAPPY_PATH.map((step, index) => {
          const state = isAlert
            ? 'past'
            : activeIndex === -1 ? 'past' : index < activeIndex ? 'past' : index === activeIndex ? 'active' : 'future';
          return (
            <li key={step.status} className={`stepper__step stepper__step--${state}`}>
              {step.label}
            </li>
          );
        })}
      </ol>
      {isAlert && (
        <div className="stepper__alert">
          {status === 'failed' ? 'Falló — requiere avanzar de nuevo o intervención' : 'Resultado desconocido tras la entrega — requiere conciliar'}
        </div>
      )}
    </div>
  );
}
