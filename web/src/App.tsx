import { useState } from 'react';
import { TokenGate } from './auth/TokenGate';
import { RunsList } from './screens/RunsList';
import { RunDetail } from './screens/RunDetail';
import { OrgChart } from './screens/OrgChart';
import { AgentsMenu } from './screens/AgentsMenu';
import { OfficeOrders } from './screens/OfficeOrders';
import { OfficeOrderDetail } from './screens/OfficeOrderDetail';
import { OfficeChat } from './screens/OfficeChat';
import { Schedules } from './screens/Schedules';
import { clearToken } from './api/client';

type View = 'chat' | 'runs' | 'office' | 'schedules' | 'organization' | 'agents';

const NAV: { id: View; label: string }[] = [
  { id: 'chat', label: 'ASISTENTE' },
  { id: 'runs', label: 'EXPEDIENTES' },
  { id: 'office', label: 'OFICINA' },
  { id: 'schedules', label: 'TAREAS PROGRAMADAS' },
  { id: 'organization', label: 'ORGANIGRAMA' },
  { id: 'agents', label: 'AGENTES' },
];

export function App() {
  const [view, setView] = useState<View>('chat');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedOfficeId, setSelectedOfficeId] = useState<string | null>(null);

  const section = view === 'chat' ? 'ASISTENTE'
    : view === 'runs' ? (selectedId ? `EXPEDIENTES / ${selectedId.slice(0, 8)}` : 'EXPEDIENTES')
    : view === 'office' ? (selectedOfficeId ? `OFICINA / ${selectedOfficeId.slice(0, 8)}` : 'OFICINA')
    : view === 'schedules' ? 'TAREAS PROGRAMADAS'
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
                onClick={() => { setView(item.id); setSelectedId(null); setSelectedOfficeId(null); }}
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
            {view === 'chat' && (
              <OfficeChat onOpenTechnical={(id) => { setSelectedOfficeId(id); setView('office'); }} />
            )}
            {view === 'organization' && <OrgChart />}
            {view === 'agents' && <AgentsMenu />}
            {view === 'office' && (
              selectedOfficeId
                ? <OfficeOrderDetail id={selectedOfficeId} onBack={() => setSelectedOfficeId(null)} />
                : <OfficeOrders onSelect={setSelectedOfficeId} />
            )}
            {view === 'schedules' && (
              <Schedules onOpenOrder={(id) => { setSelectedOfficeId(id); setView('office'); }} />
            )}
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
