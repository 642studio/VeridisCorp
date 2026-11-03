import { useState } from 'react';
import { useElevenLabsVoices, useSetElevenLabsVoice, useSettings } from '../api/hooks';
import { ApiError } from '../api/client';
import { SessionExpired } from '../components/SessionExpired';
import { Connections } from './Connections';
import { Consumption } from './Consumption';

type Tab = 'providers' | 'voice' | 'connections' | 'consumption' | 'integrations';

const TABS: { id: Tab; label: string }[] = [
  { id: 'providers', label: 'PROVEEDORES DE IA' },
  { id: 'voice', label: 'VOZ' },
  { id: 'connections', label: 'CONEXIONES MCP' },
  { id: 'consumption', label: 'CONSUMO' },
  { id: 'integrations', label: 'INTEGRACIONES' },
];

// Tabla de solo lectura: perfil de modelo -> proveedor/modelo resuelto -> si el servidor tiene
// definida la variable de entorno de su credencial. Nunca el valor — eso sigue siendo .env +
// reinicio del proceso (ver AGENTS.md: las credenciales no viven en archivos ni en la base).
function ProvidersPanel() {
  const settings = useSettings();
  if (settings.error instanceof ApiError && settings.error.status === 401) return <SessionExpired />;
  const providers = settings.data?.providers ?? [];
  return (
    <div className="settings__panel">
      <p className="muted">
        Qué modelo usa cada perfil de la política activa (<code>config/models.active.json</code> o{' '}
        <code>VERIDIS_MODELS_FILE</code>) y si el servidor tiene definida la variable de entorno de su credencial.
        Para cambiar un modelo o una clave, edita el archivo de política o el <code>.env</code> del servidor y
        reinicia el proceso — este panel es solo de lectura a propósito.
      </p>
      {settings.isLoading && <p className="muted">Cargando…</p>}
      {settings.error && !(settings.error instanceof ApiError && settings.error.status === 401) && (
        <p className="error">No se pudo cargar: {(settings.error as Error).message}</p>
      )}
      {settings.data && providers.length === 0 && <p className="muted">No se pudo cargar la política de modelos en este servidor.</p>}
      {providers.length > 0 && (
        <table className="agents-table">
          <thead>
            <tr><th>Perfil</th><th>Proveedor</th><th>Modelo</th><th>Variable de clave</th><th>Estado</th></tr>
          </thead>
          <tbody>
            {providers.map((p) => (
              <tr key={p.profileId}>
                <td className="agents-table__id">{p.profileId}</td>
                <td>{p.provider}{p.baseURL ? <span className="muted"> · {p.baseURL}</span> : null}</td>
                <td>{p.model}</td>
                <td>{p.apiKeyEnv}</td>
                <td><span className={`badge badge--${p.configured ? 'ok' : 'danger'}`}>{p.configured ? 'configurada' : 'falta'}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// La voz elegida aquí queda guardada para todo el ámbito (todas las sesiones), no solo este
// navegador — igual que el resto de /office/settings. La API key de ElevenLabs nunca llega al
// navegador: este panel solo pide el catálogo de voces de la cuenta ya configurada en el servidor.
function VoicePanel() {
  const settings = useSettings();
  const configured = settings.data?.elevenlabs.configured ?? false;
  const voices = useElevenLabsVoices(configured);
  const setVoice = useSetElevenLabsVoice();
  const [selected, setSelected] = useState<string | null>(null);

  if (settings.error instanceof ApiError && settings.error.status === 401) return <SessionExpired />;
  const current = selected ?? settings.data?.elevenlabs.voiceId ?? '';

  return (
    <div className="settings__panel">
      {settings.isLoading && <p className="muted">Cargando…</p>}
      {settings.data && (
        <>
          <div className="settings__status-row">
            <span className={`badge badge--${configured ? 'ok' : 'warn'}`}>{configured ? 'ElevenLabs configurado' : 'ElevenLabs sin configurar'}</span>
            {!configured && <span className="muted">Define VERIDIS_ELEVENLABS_API_KEY en el .env del servidor y reinicia.</span>}
          </div>

          {configured && (
            <div className="settings__field">
              <label>Voz por defecto</label>
              {voices.isLoading && <p className="muted">Cargando catálogo de voces…</p>}
              {voices.error && <p className="error">No se pudo cargar el catálogo: {(voices.error as Error).message}</p>}
              {voices.data && (
                <select value={current} onChange={(event) => setSelected(event.target.value)}>
                  <option value="" disabled>Elegir…</option>
                  {voices.data.voices.map((v) => (
                    <option key={v.voiceId} value={v.voiceId}>{v.name}{v.category ? ` (${v.category})` : ''}</option>
                  ))}
                </select>
              )}
              <button
                type="button" className="button button--primary"
                disabled={!current || setVoice.isPending}
                onClick={() => current && setVoice.mutate(current, { onSuccess: () => setSelected(null) })}
              >
                {setVoice.isPending ? 'Guardando…' : '[ GUARDAR COMO VOZ POR DEFECTO ]'}
              </button>
              {setVoice.isError && <p className="error">{(setVoice.error as Error).message}</p>}
              <p className="muted">Se aplica a toda la empresa, no solo a este navegador — compárala en la pantalla VOZ del chat.</p>
            </div>
          )}

          <p className="muted">
            Voicebox (motor local, "Dora") le habla directo a 127.0.0.1:17493 desde el navegador — no pasa por el
            servidor, así que no hay nada que configurar ni que mostrar aquí sobre su estado.
          </p>
        </>
      )}
    </div>
  );
}

// Alta y baja de Telegram y Gmail siguen siendo trabajo de servidor (variables de entorno,
// npm run runtime:gmail-authorize); aquí solo el estado, para no duplicar ese flujo en la web.
function IntegrationsPanel() {
  const settings = useSettings();
  if (settings.error instanceof ApiError && settings.error.status === 401) return <SessionExpired />;
  const data = settings.data;
  return (
    <div className="settings__panel">
      <p className="muted">
        Alta y baja siguen por línea de comandos en el servidor; aquí solo el estado de cada una.
      </p>
      {settings.isLoading && <p className="muted">Cargando…</p>}
      {data && (
        <ul className="settings__integration-list">
          <li>
            <span className={`badge badge--${data.integrations.telegram ? 'ok' : 'warn'}`}>{data.integrations.telegram ? 'Activo' : 'Sin configurar'}</span>
            Bot de Telegram <span className="muted">(TELEGRAM_BOT_TOKEN + TELEGRAM_ALLOWED_CHAT_IDS)</span>
          </li>
          <li>
            <span className={`badge badge--${data.integrations.gmail ? 'ok' : 'warn'}`}>{data.integrations.gmail ? 'Activo' : 'Sin configurar'}</span>
            Gmail <span className="muted">(GMAIL_OAUTH_CLIENT_ID / GMAIL_OAUTH_CLIENT_SECRET)</span>
          </li>
          <li>
            <span className={`badge badge--${data.totpEnrolled ? 'ok' : 'warn'}`}>{data.totpEnrolled ? 'Hay personas enroladas' : 'Nadie enrolado'}</span>
            Login con authenticator app (2FA) <span className="muted">(alta con npm run runtime:totp-enroll)</span>
          </li>
        </ul>
      )}
    </div>
  );
}

// Un solo lugar para todo lo relacionado con claves e integraciones. Las credenciales reales de
// proveedores de modelo y ElevenLabs nunca pasan por aquí — viven solo en el entorno del
// servidor (ver AGENTS.md); lo que esta pantalla sí gestiona son las conexiones MCP (que ya
// tenían su propio flujo cifrado) y preferencias no secretas como la voz por defecto.
export function Settings() {
  const [tab, setTab] = useState<Tab>('providers');
  return (
    <div className="settings">
      <p className="panel-title">CONFIGURACIONES</p>
      <p className="muted">
        Proveedores de IA, voz, conexiones MCP, consumo e integraciones — todo en un solo lugar.
      </p>
      <div className="settings__tabs">
        {TABS.map((t) => (
          <button
            key={t.id} type="button"
            className={`shell__nav-item ${tab === t.id ? 'shell__nav-item--active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'providers' && <ProvidersPanel />}
      {tab === 'voice' && <VoicePanel />}
      {tab === 'connections' && <Connections />}
      {tab === 'consumption' && <Consumption />}
      {tab === 'integrations' && <IntegrationsPanel />}
    </div>
  );
}
