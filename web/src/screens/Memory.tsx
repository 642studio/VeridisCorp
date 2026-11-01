import { useState } from 'react';
import { useMemoryList, useMemoryGraph, useValidateMemory, useQuarantineMemory } from '../api/hooks';
import { ApiError } from '../api/client';
import { SessionExpired } from '../components/SessionExpired';
import { MemoryMap } from '../components/memoryMap/MemoryMap';
import { MemoryImport } from '../components/MemoryImport';
import { KINDS } from '../components/memoryMap/engine';
import type { CorporateMemoryRecord, MemoryStatus } from '../api/types';

const TABS: { id: MemoryStatus; label: string }[] = [
  { id: 'proposed', label: 'SIN CONFIRMAR' },
  { id: 'validated', label: 'CONFIRMADAS' },
  { id: 'quarantined', label: 'CUARENTENA' },
  { id: 'superseded', label: 'SUSTITUIDAS' },
];

const TRUST_LABEL: Record<CorporateMemoryRecord['trust'], string> = {
  external_untrusted: 'externo sin verificar',
  internal_unverified: 'interno sin verificar',
  verified: 'verificado',
};
const STATUS_LABEL: Record<MemoryStatus, string> = {
  proposed: 'sin confirmar', validated: 'confirmada', quarantined: 'en cuarentena', superseded: 'sustituida',
};

export function Memory() {
  const [view, setView] = useState<'map' | 'list'>('map');
  const [importing, setImporting] = useState(false);
  const [status, setStatus] = useState<MemoryStatus>('proposed');
  const query = useMemoryList(status);
  const graph = useMemoryGraph();
  const validate = useValidateMemory();
  const [validatingId, setValidatingId] = useState<string | null>(null);
  const quarantine = useQuarantineMemory();
  const [quarantiningId, setQuarantiningId] = useState<string | null>(null);
  const [quarantineReason, setQuarantineReason] = useState('');
  // Para mostrar qué memoria confirmada refuta una sin confirmar: confirmar esta la tumba.
  const validatedList = useMemoryList('validated');
  const validatedById = new Map((validatedList.data?.records ?? []).map((r) => [r.id, r]));

  const unauthorized = [query.error, graph.error].some((e) => e instanceof ApiError && e.status === 401);
  if (unauthorized) return <SessionExpired />;
  const records = query.data?.records ?? [];
  const actionError = validate.isError ? (validate.error as Error).message : quarantine.isError ? (quarantine.error as Error).message : null;

  return (
    <div className="memory">
      <p className="panel-title">MEMORIA_CORPORATIVA</p>
      <p className="muted">
        Automática: lo que guardan los agentes y el archivista (al cerrar cada expediente) se usa de inmediato como "sin
        confirmar". Tú la confirmas o la mandas a cuarentena — ahí deja de usarse, pero se conserva para que nadie la vuelva
        a guardar igual. Ámbito único para todo el despliegue.
      </p>

      <div className="memory__views">
        {(['map', 'list'] as const).map((id) => (
          <button key={id} type="button" className={`shell__nav-item ${view === id && !importing ? 'shell__nav-item--active' : ''}`} onClick={() => { setView(id); setImporting(false); }}>
            {id === 'map' ? 'MAPA' : 'LISTA'}
          </button>
        ))}
        <button type="button" className={`button memory__import-button ${importing ? 'button--primary' : ''}`} onClick={() => setImporting(true)}>+ IMPORTAR TEXTO</button>
      </div>

      {importing && <MemoryImport onClose={() => setImporting(false)} onDone={() => { setImporting(false); setView('map'); }} />}

      {!importing && view === 'map' && (
        <>
          {graph.isLoading && <p className="muted">Cargando el mapa…</p>}
          {graph.error && <p className="error">No se pudo cargar el mapa: {(graph.error as Error).message}</p>}
          {graph.data && (
            <MemoryMap
              graph={graph.data}
              busyId={validate.isPending ? validatingId : null}
              actionError={actionError}
              onConfirm={(id) => { setValidatingId(id); validate.mutate(id); }}
              onQuarantine={(id, reason) => quarantine.mutate({ id, reason })}
            />
          )}
        </>
      )}

      {!importing && view === 'list' && (
        <>
          <div className="memory__tabs">
            {TABS.map((tab) => (
              <button
                key={tab.id} type="button"
                className={`shell__nav-item ${status === tab.id ? 'shell__nav-item--active' : ''}`}
                onClick={() => setStatus(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {query.isLoading && <p className="muted">Cargando…</p>}
          {query.error && <p className="error">No se pudo cargar: {(query.error as Error).message}</p>}
          {!query.isLoading && records.length === 0 && (
            <p className="muted">
              {status === 'proposed' ? 'Nada sin confirmar.'
                : status === 'validated' ? 'Ninguna memoria confirmada todavía.'
                : status === 'quarantined' ? 'Sin memorias en cuarentena.'
                : 'Sin versiones sustituidas todavía.'}
            </p>
          )}

          <ul className="schedules__rows">
            {records.map((record) => (
              <li key={record.id} className="schedules__row">
                <div className="schedules__row-main">
                  <span className="schedules__name">
                    {record.entityType} / {record.entityId} <span className="muted">v{record.version} · {KINDS[record.kind ?? 'fact'].label}</span>
                  </span>
                  <pre className="agent-panel__prompt">{record.content}</pre>
                </div>
                <div className="schedules__row-meta">
                  <span className={`status-pill status-pill--${record.status === 'validated' ? 'done' : record.status === 'superseded' ? 'neutral' : 'attention'}`}>
                    {STATUS_LABEL[record.status]}
                  </span>
                  <span className="tag">{TRUST_LABEL[record.trust]}</span>
                  <span className="muted">actualizado: {new Date(record.updatedAt).toLocaleString()}</span>
                  {record.validUntil && <span className="muted">vigente hasta: {new Date(record.validUntil).toLocaleString()}</span>}
                </div>
                <div className="schedules__row-meta">
                  {record.provenance.map((p, i) => (
                    <span key={i} className="muted">fuente: {p.reference} ({new Date(p.observedAt).toLocaleDateString()})</span>
                  ))}
                </div>
                {record.quarantineReason && (
                  <p className="error">motivo de cuarentena: {record.quarantineReason}</p>
                )}
                {record.contradicts && record.status === 'proposed' && (() => {
                  const target = validatedById.get(record.contradicts);
                  return target ? (
                    <div className="memory__contradicts">
                      <p>[ ! ] Refuta a <strong>{target.entityType} / {target.entityId} v{target.version}</strong>, ya confirmada — si confirmas esta, esa pasa a cuarentena:</p>
                      <pre className="agent-panel__prompt">{target.content}</pre>
                    </div>
                  ) : (
                    <p className="muted">Refutó a otra memoria ({record.contradicts.slice(0, 8)}…), que ya no está vigente.</p>
                  );
                })()}
                {(record.status === 'proposed' || record.status === 'validated') && (
                  <div className="schedules__row-actions">
                    {quarantiningId === record.id ? (
                      <>
                        <label className="approval-panel__reason">
                          Por qué esta memoria ya no es confiable
                          <textarea value={quarantineReason} onChange={(event) => setQuarantineReason(event.target.value)} rows={2} />
                        </label>
                        <button
                          type="button" className="button button--primary"
                          disabled={quarantine.isPending || quarantineReason.trim().length === 0}
                          onClick={() => quarantine.mutate({ id: record.id, reason: quarantineReason.trim() }, {
                            onSuccess: () => { setQuarantiningId(null); setQuarantineReason(''); },
                          })}
                        >
                          {quarantine.isPending ? 'Poniendo en cuarentena…' : 'Confirmar cuarentena'}
                        </button>
                        <button type="button" className="button" onClick={() => { setQuarantiningId(null); setQuarantineReason(''); }}>
                          Cancelar
                        </button>
                      </>
                    ) : (
                      <>
                        {record.status === 'proposed' && (
                          <button
                            type="button" className="button button--primary"
                            disabled={validate.isPending && validatingId === record.id}
                            onClick={() => { setValidatingId(record.id); validate.mutate(record.id); }}
                          >
                            {validate.isPending && validatingId === record.id ? 'Confirmando…' : '✓ CONFIRMAR'}
                          </button>
                        )}
                        <button type="button" className="button" onClick={() => { setQuarantiningId(record.id); setQuarantineReason(''); }}>
                          ✕ CUARENTENA
                        </button>
                      </>
                    )}
                  </div>
                )}
                {validate.isError && validatingId === record.id && (
                  <p className="error">{(validate.error as Error).message}</p>
                )}
                {quarantine.isError && quarantiningId === record.id && (
                  <p className="error">{(quarantine.error as Error).message}</p>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
