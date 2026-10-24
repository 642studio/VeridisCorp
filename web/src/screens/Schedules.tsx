import { useState } from 'react';
import { useCreateSchedule, useDeleteSchedule, useFireSchedule, useSchedules, useUpdateSchedule } from '../api/hooks';
import { ApiError } from '../api/client';
import { SessionExpired } from '../components/SessionExpired';
import { ScheduleForm } from './ScheduleForm';
import type { OfficeSchedule } from '../api/types';

export function Schedules({ onOpenOrder }: { onOpenOrder: (id: string) => void }) {
  const query = useSchedules();
  const create = useCreateSchedule();
  const update = useUpdateSchedule();
  const del = useDeleteSchedule();
  const fire = useFireSchedule();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<OfficeSchedule | null>(null);
  const [firingId, setFiringId] = useState<string | null>(null);

  if (query.error instanceof ApiError && query.error.status === 401) return <SessionExpired />;
  const schedules = query.data?.schedules ?? [];

  const closeForm = () => { setFormOpen(false); setEditing(null); create.reset(); update.reset(); };
  const openCreate = () => { setEditing(null); setFormOpen(true); };
  const openEdit = (schedule: OfficeSchedule) => { setEditing(schedule); setFormOpen(true); };

  return (
    <div className="schedules">
      <div className="schedules__header">
        <p className="panel-title">TAREAS_PROGRAMADAS</p>
        {!formOpen && <button type="button" className="button button--primary" onClick={openCreate}>[ NUEVA TAREA ]</button>}
      </div>
      <p className="muted">
        Cada tarea dispara un expediente real con el CEO decidiendo de verdad, en la frecuencia y hora que elijas aquí
        — sin escribir cron a mano. Tres fallos seguidos la apagan sola; reactivarla no borra su historial.
      </p>

      {formOpen && (
        <ScheduleForm
          schedule={editing ?? undefined}
          submitting={create.isPending || update.isPending}
          error={(create.error as Error | null)?.message ?? (update.error as Error | null)?.message ?? null}
          onCancel={closeForm}
          onSubmit={(input) => {
            if (editing) update.mutate([editing.id, input], { onSuccess: closeForm });
            else create.mutate([input], { onSuccess: closeForm });
          }}
        />
      )}

      {query.isLoading && <p className="muted">Cargando…</p>}
      {query.error && !(query.error instanceof ApiError && query.error.status === 401) && (
        <p className="error">No se pudo cargar: {(query.error as Error).message}</p>
      )}
      {!query.isLoading && schedules.length === 0 && !formOpen && <p className="muted">Todavía no hay tareas programadas.</p>}

      <ul className="schedules__rows">
        {schedules.map((schedule) => {
          const lastFiredOrderId = schedule.lastFiredOrderId;
          return (
            <li key={schedule.id} className="schedules__row">
              <div className="schedules__row-main">
                <span className="schedules__name">{schedule.name}</span>
                <span className="muted">{schedule.objective}</span>
              </div>
              <div className="schedules__row-meta">
                <span className={`status-pill status-pill--${schedule.enabled ? 'done' : 'attention'}`}>{schedule.enabled ? 'activa' : 'apagada'}</span>
                {schedule.running && <span className="status-pill status-pill--progress">disparando…</span>}
                {schedule.consecutiveFailures > 0 && <span className="muted">fallos seguidos: {schedule.consecutiveFailures}</span>}
                <span className="muted">{schedule.cronExpression} · {schedule.timezone}</span>
                <span className="muted">próxima: {schedule.nextRunAt ? new Date(schedule.nextRunAt).toLocaleString() : '—'}</span>
                {schedule.lastRunAt && <span className="muted">última: {new Date(schedule.lastRunAt).toLocaleString()}</span>}
                {lastFiredOrderId && (
                  <button type="button" className="button button--link" onClick={() => onOpenOrder(lastFiredOrderId)}>ver último expediente</button>
                )}
              </div>
              <div className="schedules__row-actions">
                {schedule.enabled
                  ? <button type="button" className="button" onClick={() => update.mutate([schedule.id, { enabled: false }])}>[ PAUSAR ]</button>
                  : <button type="button" className="button" onClick={() => update.mutate([schedule.id, { enabled: true }])}>[ REACTIVAR ]</button>}
                <button
                  type="button" className="button"
                  disabled={schedule.running || (fire.isPending && firingId === schedule.id)}
                  onClick={() => { setFiringId(schedule.id); fire.mutate([schedule.id]); }}
                >
                  {fire.isPending && firingId === schedule.id ? 'Disparando…' : '[ DISPARAR AHORA ]'}
                </button>
                <button type="button" className="button" onClick={() => openEdit(schedule)}>[ EDITAR ]</button>
                <button
                  type="button" className="button button--danger"
                  onClick={() => { if (window.confirm(`¿Borrar "${schedule.name}"? No se puede deshacer.`)) del.mutate([schedule.id]); }}
                >
                  [ BORRAR ]
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
