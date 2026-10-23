import { useState } from 'react';
import { TokenGate } from './auth/TokenGate';
import { RunsList } from './screens/RunsList';
import { RunDetail } from './screens/RunDetail';
import { OrgChart } from './screens/OrgChart';

type View = 'runs' | 'organization';

export function App() {
  const [view, setView] = useState<View>('runs');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <TokenGate>
      <main className="app">
        <div className="app__header">
          <h1 className="app__title">VeridisCorp — Supervisión del runtime</h1>
          <nav className="app__nav">
            <button type="button" className={`tab ${view === 'runs' ? 'tab--active' : ''}`}
              onClick={() => { setView('runs'); setSelectedId(null); }}>
              Expedientes
            </button>
            <button type="button" className={`tab ${view === 'organization' ? 'tab--active' : ''}`}
              onClick={() => setView('organization')}>
              Organigrama
            </button>
          </nav>
        </div>
        {view === 'organization'
          ? <OrgChart />
          : selectedId
            ? <RunDetail id={selectedId} onBack={() => setSelectedId(null)} />
            : <RunsList onSelect={setSelectedId} />}
      </main>
    </TokenGate>
  );
}
