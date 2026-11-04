import { useState } from 'react';
import { TokenGate } from './auth/TokenGate';
import { OrgChart } from './screens/OrgChart';
import { AgentsMenu } from './screens/AgentsMenu';
import { OfficeOrders } from './screens/OfficeOrders';
import { OfficeOrderDetail } from './screens/OfficeOrderDetail';
import { OfficeChat } from './screens/OfficeChat';
import { Schedules } from './screens/Schedules';
import { Memory } from './screens/Memory';
import { Settings } from './screens/Settings';
import { SessionList } from './components/SessionList';
import { MiniAvatar } from './components/MiniAvatar';
import { ActiveSessionProvider } from './context/ActiveSessionContext';
import { clearToken } from './api/client';

// La voz ya no es una pantalla aparte: vive dentro de los hilos de ASISTENTE (ver VoiceDock,
// montado en OfficeChat.tsx) — el mini-avatar del sidebar es el acceso rápido (ver MiniAvatar).
type View = 'chat' | 'office' | 'schedules' | 'memory' | 'settings' | 'organization' | 'agents';

const NAV: { id: View; label: string }[] = [
  { id: 'chat', label: 'ASISTENTE' },
  { id: 'office', label: 'ORDENES' },
  { id: 'schedules', label: 'TAREAS PROGRAMADAS' },
  { id: 'memory', label: 'MEMORIA' },
  { id: 'settings', label: 'CONFIGURACIONES' },
  { id: 'organization', label: 'ORGANIGRAMA' },
  { id: 'agents', label: 'AGENTES' },
];

export function App() {
  return (
    <TokenGate>
      <ActiveSessionProvider>
        <AppShell />
      </ActiveSessionProvider>
    </TokenGate>
  );
}

function AppShell() {
  const [view, setView] = useState<View>('chat');
  const [selectedOfficeId, setSelectedOfficeId] = useState<string | null>(null);
  const [navOpen, setNavOpen] = useState(false);

  const section = view === 'chat' ? 'ASISTENTE'
    : view === 'office' ? (selectedOfficeId ? `ORDENES / ${selectedOfficeId.slice(0, 8)}` : 'ORDENES')
    : view === 'schedules' ? 'TAREAS PROGRAMADAS'
    : view === 'memory' ? 'MEMORIA'
    : view === 'settings' ? 'CONFIGURACIONES'
    : view === 'organization' ? 'ORGANIGRAMA' : 'AGENTES';

  // Click en una fila del sidebar global (hilo u orden, ver SessionList/useSessionsList): siempre
  // lleva a ASISTENTE con esa sesión enfocada — ahí es donde se conversa, tanto con hilos como con
  // expedientes; "ver detalle técnico completo" es la puerta a OFICINA/OfficeOrderDetail aparte.
  const openSession = () => setView('chat');

  return (
    <div className="shell">
      {navOpen && <div className="shell__backdrop" onClick={() => setNavOpen(false)} />}
      <aside className={`shell__sidebar ${navOpen ? 'shell__sidebar--open' : ''}`}>
        <div className="shell__brand">
          <div className="shell__brand-row">
            <span>VERIDIS<span className="shell__brand-accent">CORP</span></span>
            <MiniAvatar className="shell__mini-avatar" onActivate={openSession} />
          </div>
          <span className="muted">runtime v0.1 // pilot</span>
        </div>
        <nav className="shell__quicknav">
          {NAV.map((item) => (
            <button
              key={item.id}
              type="button"
              title={item.label}
              className={`shell__nav-item ${view === item.id ? 'shell__nav-item--active' : ''}`}
              onClick={() => { setView(item.id); setSelectedOfficeId(null); setNavOpen(false); }}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <SessionList onOpenSession={() => { openSession(); setNavOpen(false); }} />
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
        </main>
      </div>
    </div>
  );
}
