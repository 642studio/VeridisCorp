import { useMemo, useState } from 'react';
import type { OfficeSchedule } from '../api/types';

type Frequency = 'daily' | 'weekly' | 'monthly';

const WEEKDAYS = [
  { value: 1, label: 'Lun' }, { value: 2, label: 'Mar' }, { value: 3, label: 'Mié' },
  { value: 4, label: 'Jue' }, { value: 5, label: 'Vie' }, { value: 6, label: 'Sáb' }, { value: 0, label: 'Dom' },
];

function buildCron(frequency: Frequency, hour: number, minute: number, weekdays: number[], monthDay: number): string {
  const time = `${minute} ${hour}`;
  if (frequency === 'daily') return `${time} * * *`;
  if (frequency === 'weekly') return `${time} * * ${weekdays.length ? [...weekdays].sort().join(',') : '1'}`;
  return `${time} ${monthDay} * *`;
}

// Solo interpreta las formas simples que esta pantalla misma genera (diario/semanal/mensual,
// sin minuto "*", sin rangos ni pasos). Un cron escrito por fuera de este formulario — el único
// caso posible es una tarea migrada a mano en la base — vuelve a un valor por defecto razonable
// al abrir la edición, en vez de intentar representarlo con el mismo selector sin cron crudo.
function parseCron(cron: string): { frequency: Frequency; hour: number; minute: number; weekdays: number[]; monthDay: number } {
  const fallback = { frequency: 'daily' as Frequency, hour: 9, minute: 0, weekdays: [1], monthDay: 1 };
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return fallback;
  const [minuteRaw, hourRaw, dom, month, dow] = parts;
  const minute = Number(minuteRaw); const hour = Number(hourRaw);
  if (!Number.isInteger(minute) || !Number.isInteger(hour) || month !== '*') return fallback;
  if (dom === '*' && dow === '*') return { frequency: 'daily', hour, minute, weekdays: [1], monthDay: 1 };
  if (dom === '*' && dow !== '*') {
    const weekdays = dow.split(',').map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);
    if (weekdays.length) return { frequency: 'weekly', hour, minute, weekdays, monthDay: 1 };
  }
  if (dom !== '*' && dow === '*') {
    const monthDay = Number(dom);
    if (Number.isInteger(monthDay) && monthDay >= 1 && monthDay <= 31) return { frequency: 'monthly', hour, minute, weekdays: [1], monthDay };
  }
  return fallback;
}

export function ScheduleForm({ schedule, onSubmit, onCancel, submitting, error }: {
  schedule?: OfficeSchedule;
  onSubmit: (input: { name: string; objective: string; cronExpression: string; timezone: string }) => void;
  onCancel: () => void;
  submitting: boolean;
  error: string | null;
}) {
  const parsed = useMemo(() => (schedule ? parseCron(schedule.cronExpression) : { frequency: 'daily' as Frequency, hour: 9, minute: 0, weekdays: [1], monthDay: 1 }), [schedule]);
  const [name, setName] = useState(schedule?.name ?? '');
  const [objective, setObjective] = useState(schedule?.objective ?? '');
  const [frequency, setFrequency] = useState<Frequency>(parsed.frequency);
  const [hour, setHour] = useState(parsed.hour);
  const [minute, setMinute] = useState(parsed.minute);
  const [weekdays, setWeekdays] = useState<number[]>(parsed.weekdays);
  const [monthDay, setMonthDay] = useState(parsed.monthDay);
  const [timezone, setTimezone] = useState(schedule?.timezone ?? (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return 'UTC'; } })());

  const cronExpression = useMemo(() => buildCron(frequency, hour, minute, weekdays, monthDay), [frequency, hour, minute, weekdays, monthDay]);
  const toggleWeekday = (day: number) => setWeekdays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
  const canSubmit = name.trim().length > 0 && objective.trim().length > 0 && timezone.trim().length > 0 && (frequency !== 'weekly' || weekdays.length > 0);

  return (
    <div className="schedule-form">
      <p className="panel-title">{schedule ? 'EDITAR_TAREA_PROGRAMADA' : 'NUEVA_TAREA_PROGRAMADA'}</p>
      <label className="schedule-form__field">
        <span>Nombre</span>
        <input value={name} onChange={(event) => setName(event.target.value)} placeholder="p. ej. Resumen semanal de ventas" />
      </label>
      <label className="schedule-form__field">
        <span>Objetivo (lo que se le pedirá al CEO real cada vez que dispare)</span>
        <textarea value={objective} onChange={(event) => setObjective(event.target.value)} rows={2} placeholder="Redactar…" />
      </label>
      <div className="schedule-form__row">
        <label className="schedule-form__field">
          <span>Frecuencia</span>
          <select value={frequency} onChange={(event) => setFrequency(event.target.value as Frequency)}>
            <option value="daily">Diario</option>
            <option value="weekly">Semanal</option>
            <option value="monthly">Mensual</option>
          </select>
        </label>
        <label className="schedule-form__field">
          <span>Hora</span>
          <div className="schedule-form__time">
            <input type="number" min={0} max={23} value={hour} onChange={(event) => setHour(Math.max(0, Math.min(23, Number(event.target.value) || 0)))} />
            <span>:</span>
            <input type="number" min={0} max={59} value={minute} onChange={(event) => setMinute(Math.max(0, Math.min(59, Number(event.target.value) || 0)))} />
          </div>
        </label>
      </div>
      {frequency === 'weekly' && (
        <div className="schedule-form__weekdays">
          {WEEKDAYS.map((day) => (
            <button key={day.value} type="button" className={`chip ${weekdays.includes(day.value) ? 'chip--active' : ''}`} onClick={() => toggleWeekday(day.value)}>
              {day.label}
            </button>
          ))}
        </div>
      )}
      {frequency === 'monthly' && (
        <label className="schedule-form__field">
          <span>Día del mes</span>
          <input type="number" min={1} max={31} value={monthDay} onChange={(event) => setMonthDay(Math.max(1, Math.min(31, Number(event.target.value) || 1)))} />
          <span className="muted">En un mes más corto que ese día, esa tarea simplemente se salta ese mes.</span>
        </label>
      )}
      <label className="schedule-form__field">
        <span>Zona horaria (IANA)</span>
        <input value={timezone} onChange={(event) => setTimezone(event.target.value)} placeholder="America/Hermosillo" />
      </label>
      <p className="muted schedule-form__cron">Expresión resultante: {cronExpression} · {timezone || '—'}</p>
      {error && <p className="error">{error}</p>}
      <div className="schedule-form__actions">
        <button type="button" className="button" onClick={onCancel}>Cancelar</button>
        <button
          type="button"
          className="button button--primary"
          disabled={!canSubmit || submitting}
          onClick={() => onSubmit({ name: name.trim(), objective: objective.trim(), cronExpression, timezone: timezone.trim() })}
        >
          {submitting ? 'Guardando…' : '[ GUARDAR ]'}
        </button>
      </div>
    </div>
  );
}
