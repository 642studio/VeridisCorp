import { useState } from 'react';
import type { AuditRow } from '../api/types';

const COLLAPSED_COUNT = 8;

export function AuditTimeline({ audit }: { audit: AuditRow[] }) {
  const [expanded, setExpanded] = useState(false);
  const sorted = [...audit].sort((a, b) => b.sequence - a.sequence);
  const visible = expanded ? sorted : sorted.slice(0, COLLAPSED_COUNT);

  return (
    <div className="audit-timeline">
      <h3>Auditoría</h3>
      {sorted.length === 0 && <p className="muted">Sin eventos todavía.</p>}
      <ul className="audit-timeline__list">
        {visible.map((entry) => (
          <li key={entry.sequence} className="audit-timeline__item">
            <span className="audit-timeline__time">{new Date(entry.occurred_at).toLocaleString()}</span>
            <span className="audit-timeline__event">{entry.data.event}</span>
            <span className="audit-timeline__who">{entry.data.principal.kind}:{entry.data.principal.id}</span>
          </li>
        ))}
      </ul>
      {sorted.length > COLLAPSED_COUNT && (
        <button type="button" className="button button--link" onClick={() => setExpanded((v) => !v)}>
          {expanded ? 'Ver menos' : `Ver los ${sorted.length} eventos`}
        </button>
      )}
    </div>
  );
}
