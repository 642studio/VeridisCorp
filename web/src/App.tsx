import { useState } from 'react';
import { TokenGate } from './auth/TokenGate';
import { RunsList } from './screens/RunsList';
import { RunDetail } from './screens/RunDetail';
import { OrgChart } from './screens/OrgChart';
import { AgentsMenu } from './screens/AgentsMenu';
import { clearToken } from './api/client';

type View = 'runs' | 'organization' | 'agents';

const NAV: { id: View; label: string }[] = [
  { id: 'runs', label: 'EXPEDIENTES' },
  { id: 'organization', label: 'ORGANIGRAMA' },
  { id: 'agents', label: 'AGENTES' },
];

export function App() {
  const [view, setView] = useState<View>('runs');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const section = view === 'runs' ? (selectedId ? `EXPEDIENTES / ${selectedId.slice(0, 8)}` : 'EXPEDIENTES')
    : view === 'organization' ? 'ORGANIGRAMA' : 'AGENTES';

  return (
    <TokenGate>
      <div className="shell">
        <aside className="shell__sidebar">
          <div className="shell__brand">
            <span>VERIDIS<span className="shell__brand-accent">CORP</span></span>
            <span className="muted">runtime v0.1 // pilot</span>
          </div>
          <nav className="shell__nav">
            {NAV.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`shell__nav-item ${view === item.id ? 'shell__nav-item--active' : ''}`}
                onClick={() => { setView(item.id); setSelectedId(null); }}
              >
                {item.label}
              </button>
            ))}
          </nav>
          <div className="shell__sidebar-footer">
            <button type="button" className="button button--link" onClick={() => { clearToken(); window.location.reload(); }}>
              [ CAMBIAR_TOKEN ]
            </button>
          </div>
        </aside>
        <div className="shell__main">
          <header className="shell__topbar">
            <span className="breadcrumb">ROOT / RUNTIME / {section}</span>
            <span className="badge badge--ok">SESIÓN: ACTIVA</span>
          </header>
          <main className="shell__content">
            {view === 'organization' && <OrgChart />}
            {view === 'agents' && <AgentsMenu />}
            {view === 'runs' && (
              selectedId
                ? <RunDetail id={selectedId} onBack={() => setSelectedId(null)} />
                : <RunsList onSelect={setSelectedId} />
            )}
          </main>
        </div>
      </div>
    </TokenGate>
  );
}
