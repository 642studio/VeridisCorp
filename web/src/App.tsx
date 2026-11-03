import { useState } from 'react';
import { TokenGate } from './auth/TokenGate';
import { RunsList } from './screens/RunsList';
import { RunDetail } from './screens/RunDetail';
import { OrgChart } from './screens/OrgChart';
import { AgentsMenu } from './screens/AgentsMenu';
import { OfficeOrders } from './screens/OfficeOrders';
import { OfficeOrderDetail } from './screens/OfficeOrderDetail';
import { OfficeChat } from './screens/OfficeChat';
import { VoiceChat } from './screens/VoiceChat';
import { Schedules } from './screens/Schedules';
import { Memory } from './screens/Memory';
import { Settings } from './screens/Settings';
import { clearToken } from './api/client';

type View = 'voice' | 'chat' | 'runs' | 'office' | 'schedules' | 'memory' | 'settings' | 'organization' | 'agents';

const NAV: { id: View; label: string }[] = [
  { id: 'voice', label: 'VOZ' },
  { id: 'chat', label: 'ASISTENTE' },
  { id: 'runs', label: 'EXPEDIENTES' },
  { id: 'office', label: 'OFICINA' },
  { id: 'schedules', label: 'TAREAS PROGRAMADAS' },
  { id: 'memory', label: 'MEMORIA' },
  { id: 'settings', label: 'CONFIGURACIONES' },
  { id: 'organization', label: 'ORGANIGRAMA' },
  { id: 'agents', label: 'AGENTES' },
];

export function App() {
  const [view, setView] = useState<View>('voice');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedOfficeId, setSelectedOfficeId] = useState<string | null>(null);
  const [navOpen, setNavOpen] = useState(false);

  const section = view === 'voice' ? 'VOZ'
    : view === 'chat' ? 'ASISTENTE'
    : view === 'runs' ? (selectedId ? `EXPEDIENTES / ${selectedId.slice(0, 8)}` : 'EXPEDIENTES')
    : view === 'office' ? (selectedOfficeId ? `OFICINA / ${selectedOfficeId.slice(0, 8)}` : 'OFICINA')
    : view === 'schedules' ? 'TAREAS PROGRAMADAS'
    : view === 'memory' ? 'MEMORIA'
    : view === 'settings' ? 'CONFIGURACIONES'
    : view === 'organization' ? 'ORGANIGRAMA' : 'AGENTES';

  return (
    <TokenGate>
      <div className="shell">
        {navOpen && <div className="shell__backdrop" onClick={() => setNavOpen(false)} />}
        <aside className={`shell__sidebar ${navOpen ? 'shell__sidebar--open' : ''}`}>
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
                onClick={() => { setView(item.id); setSelectedId(null); setSelectedOfficeId(null); setNavOpen(false); }}
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
            <button type="button" className="shell__menu-toggle" aria-label="Abrir menú" onClick={() => setNavOpen((open) => !open)}>
              ☰
            </button>
            <span className="breadcrumb">ROOT / RUNTIME / {section}</span>
            <span className="badge badge--ok">SESIÓN: ACTIVA</span>
          </header>
          <main className="shell__content">
            {view === 'voice' && <VoiceChat />}
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
            {view === 'memory' && <Memory />}
            {view === 'settings' && <Settings />}
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
