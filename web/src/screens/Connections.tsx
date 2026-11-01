import { useState } from 'react';
import {
  useAddConnection, useConfirmConnection, useConnectionCredential, useConnectionTools, useConnections, useRefreshConnection, useRemoveConnection,
} from '../api/hooks';
import { ApiError } from '../api/client';
import { SessionExpired } from '../components/SessionExpired';
import type { McpConnection, McpStatus, McpTool } from '../api/types';

const ACCESS_LABEL: Record<McpTool['access'], string> = { read: 'lectura', write: 'escribe', unknown: 'no declara' };

const STATUS: Record<McpStatus, { label: string; tone: 'ok' | 'warn' | 'danger' }> = {
  active: { label: 'Activa', tone: 'ok' },
  needs_auth: { label: 'Requiere credencial', tone: 'warn' },
  error: { label: 'Con error', tone: 'danger' },
  requested: { label: 'Solicitada', tone: 'warn' },
  removed: { label: 'Retirada', tone: 'danger' },
};

const errorText = (error: unknown) => (error instanceof Error ? error.message : null);

function relative(iso: string | null): string {
  if (!iso) return 'nunca';
  const minutes = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (minutes < 1) return 'hace un momento';
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  return hours < 48 ? `hace ${hours} h` : new Date(iso).toLocaleDateString('es-MX');
}

type FormValues = { name: string; url: string; purpose: string; headerName: string; secret: string };

function ConnectionForm({ initial, lockedName, submitting, error, onCancel, onSubmit }: {
  initial?: Partial<FormValues>; lockedName?: boolean; submitting: boolean; error: string | null;
  onCancel: () => void; onSubmit: (values: FormValues) => void;
}) {
  const [values, setValues] = useState<FormValues>({ name: '', url: '', purpose: '', headerName: 'Authorization', secret: '', ...initial });
  const set = (key: keyof FormValues) => (event: { target: { value: string } }) => setValues((v) => ({ ...v, [key]: event.target.value }));
  const ready = values.name.trim() && values.purpose.trim() && !submitting;
  return (
    <form className="connections__form" onSubmit={(e) => { e.preventDefault(); if (ready) onSubmit(values); }}>
      <p className="panel-title">{lockedName ? `COMPLETAR «${values.name}»` : 'NUEVA CONEXIÓN MCP'}</p>
      <label className="connections__field">Nombre
        <input value={values.name} onChange={set('name')} readOnly={lockedName} maxLength={40} placeholder="p. ej. deepwiki, n8n-oficina" autoFocus={!lockedName} />
      </label>
      <label className="connections__field">URL del servidor MCP
        <input value={values.url} onChange={set('url')} maxLength={500} placeholder="https://… o http://192.168.1.97:5678/mcp/…" autoFocus={lockedName} />
        <span className="muted">Vacía, la conexión queda solicitada. Tú puedes conectar tu red local; los agentes solo https público.</span>
      </label>
      <label className="connections__field">Para qué la necesita la empresa
        <input value={values.purpose} onChange={set('purpose')} maxLength={500} placeholder="Una frase: queda en la memoria y así la oficina sabe cuándo usarla" />
      </label>
      <details className="connections__credential">
        <summary>Credencial (opcional)</summary>
        <div className="connections__credential-fields">
          <label className="connections__field">Cabecera
            <input value={values.headerName} onChange={set('headerName')} maxLength={80} />
          </label>
          <label className="connections__field">Valor
            <input type="password" value={values.secret} onChange={set('secret')} maxLength={4000} autoComplete="off" placeholder="token o llave del servidor" />
            <span className="muted">Se guarda cifrada. Con Authorization se antepone "Bearer " si no lo trae.</span>
          </label>
        </div>
      </details>
      {error && <p className="error">{error}</p>}
      <div className="connections__actions">
        <button type="submit" className="button button--primary" disabled={!ready}>{submitting ? 'Conectando…' : values.url.trim() ? '[ CONECTAR ]' : '[ DEJAR SOLICITADA ]'}</button>
        <button type="button" className="button" onClick={onCancel} disabled={submitting}>[ CANCELAR ]</button>
      </div>
    </form>
  );
}

function CredentialForm({ connection, onDone }: { connection: McpConnection; onDone: () => void }) {
  const save = useConnectionCredential();
  const [headerName, setHeaderName] = useState('Authorization');
  const [secret, setSecret] = useState('');
  return (
    <div className="connections__inline">
      <label className="connections__field">Cabecera<input value={headerName} onChange={(e) => setHeaderName(e.target.value)} maxLength={80} /></label>
      <label className="connections__field">Valor<input type="password" value={secret} onChange={(e) => setSecret(e.target.value)} autoComplete="off" autoFocus /></label>
      {errorText(save.error) && <p className="error">{errorText(save.error)}</p>}
      <div className="connections__actions">
        <button type="button" className="button button--primary" disabled={!secret.trim() || save.isPending}
          onClick={() => save.mutate([connection.id, { headerName: headerName.trim() || 'Authorization', value: secret }], { onSuccess: onDone })}>
          {save.isPending ? 'Probando…' : '[ GUARDAR Y PROBAR ]'}
        </button>
        {connection.hasCredential && (
          <button type="button" className="button button--danger" disabled={save.isPending}
            onClick={() => save.mutate([connection.id, null], { onSuccess: onDone })}>[ QUITAR CREDENCIAL ]</button>
        )}
        <button type="button" className="button" onClick={onDone}>[ CANCELAR ]</button>
      </div>
    </div>
  );
}

function ConnectionRow({ connection, onComplete }: { connection: McpConnection; onComplete: () => void }) {
  const tools = useConnectionTools();
  const refresh = useRefreshConnection();
  const confirm = useConfirmConnection();
  const remove = useRemoveConnection();
  const [credentialOpen, setCredentialOpen] = useState(false);
  const status = STATUS[connection.status];
  const by = connection.addedBy.kind === 'human' ? connection.addedBy.id : `agente ${connection.addedBy.id}`;
  const failure = errorText(tools.error) ?? errorText(refresh.error) ?? errorText(confirm.error) ?? errorText(remove.error);

  const toggle = (name: string, access: McpTool['access'], enabled: boolean) => {
    const warning = access === 'write' ? `«${name}» puede cambiar datos en el servidor ${connection.name}.`
      : access === 'unknown' ? `El servidor ${connection.name} no declara si «${name}» solo lee o también escribe.` : null;
    if (enabled && warning && !window.confirm(`${warning} ¿Activarla para los agentes?`)) return;
    tools.mutate([connection.id, { enabled: { [name]: enabled } }]);
  };

  return (
    <li className="connections__row">
      <div className="connections__row-head">
        <span className="connections__name">{connection.name}</span>
        <span className={`badge badge--${status.tone}`}>{status.label}</span>
        {connection.trust === 'unconfirmed' && <span className="badge badge--warn" title="La conectó un agente y nadie la ha revisado">Sin confirmar</span>}
      </div>
      <p className="connections__purpose">{connection.purpose}</p>
      <div className="connections__meta muted">
        {connection.displayUrl && <span>{connection.displayUrl}</span>}
        {connection.server?.name && <span>{connection.server.name}{connection.server.version ? ` v${connection.server.version}` : ''}</span>}
        <span>por {by} · {relative(connection.createdAt)}</span>
        {connection.status === 'active' && <span>{connection.callCount} llamadas · última {relative(connection.lastUsedAt)}</span>}
        {connection.hasCredential && <span>con credencial</span>}
      </div>
      {connection.server?.instructions && (
        <p className="connections__server-says muted" title="Texto del propio servidor: los agentes lo tratan como dato, no como instrucciones">
          El servidor se describe así: «{connection.server.instructions}»
        </p>
      )}
      {connection.lastError && connection.status !== 'active' && <p className="error">{connection.lastError}</p>}

      {connection.tools.length > 0 && (
        <ul className="connections__tools">
          {connection.tools.map((tool) => (
            <li key={tool.name} className="connections__tool">
              <label className="connections__tool-toggle">
                <input type="checkbox" checked={tool.enabled} disabled={tools.isPending}
                  onChange={(e) => toggle(tool.name, tool.access, e.target.checked)} />
                <span className="connections__tool-name">{tool.name}</span>
              </label>
              <span className={`connections__access connections__access--${tool.access}`}
                title={tool.accessSetBy === 'human' ? 'Clasificada por un humano: el servidor no lo declara' : 'Según lo que declara el servidor'}>
                {ACCESS_LABEL[tool.access]}{tool.accessSetBy === 'human' ? ' · tú' : ''}
                {(tool.access === 'unknown' || tool.accessSetBy === 'human') && (
                  <span className="connections__classify">
                    {tool.access !== 'read' && (
                      <button type="button" className="button--link" disabled={tools.isPending}
                        title="El revisor podrá volver a llamarla para verificar"
                        onClick={() => tools.mutate([connection.id, { access: { [tool.name]: 'read' } }])}>solo lee</button>
                    )}
                    {tool.access !== 'write' && (
                      <button type="button" className="button--link" disabled={tools.isPending}
                        onClick={() => tools.mutate([connection.id, { access: { [tool.name]: 'write' } }])}>escribe</button>
                    )}
                  </span>
                )}
              </span>
              {tool.description && <span className="connections__tool-desc muted">{tool.description}</span>}
            </li>
          ))}
        </ul>
      )}

      {credentialOpen && <CredentialForm connection={connection} onDone={() => setCredentialOpen(false)} />}
      {failure && <p className="error">{failure}</p>}

      <div className="connections__actions">
        {connection.status === 'requested' && <button type="button" className="button button--primary" onClick={onComplete}>[ COMPLETAR ]</button>}
        {connection.trust === 'unconfirmed' && connection.status !== 'requested' && (
          <button type="button" className="button button--primary" disabled={confirm.isPending} onClick={() => confirm.mutate([connection.id])}>[ CONFIRMAR ]</button>
        )}
        {connection.url && (
          <button type="button" className="button" disabled={refresh.isPending} onClick={() => refresh.mutate([connection.id])}>
            {refresh.isPending ? 'Probando…' : '[ VOLVER A PROBAR ]'}
          </button>
        )}
        {connection.url && !credentialOpen && (
          <button type="button" className="button" onClick={() => setCredentialOpen(true)}>{connection.hasCredential ? '[ CAMBIAR CREDENCIAL ]' : '[ AGREGAR CREDENCIAL ]'}</button>
        )}
        <button type="button" className="button button--danger" disabled={remove.isPending}
          onClick={() => { if (window.confirm(`¿Retirar «${connection.name}»? Los agentes dejan de poder usarla; la memoria lo registra.`)) remove.mutate([connection.id]); }}>
          [ RETIRAR ]
        </button>
      </div>
    </li>
  );
}

// Servidores MCP que la oficina puede usar. Cada conexión tiene su memoria corporativa: al conectar,
// cambiar herramientas, confirmar o retirar, el motor reescribe lo que la empresa sabe de ella.
export function Connections() {
  const query = useConnections();
  const add = useAddConnection();
  const [form, setForm] = useState<{ completing?: McpConnection } | null>(null);

  if (query.error instanceof ApiError && query.error.status === 401) return <SessionExpired />;
  const connections = query.data?.connections ?? [];
  const pending = connections.filter((c) => c.status === 'requested' || c.status === 'needs_auth' || c.trust === 'unconfirmed').length;
  const close = () => { setForm(null); add.reset(); };

  return (
    <div className="connections">
      <div className="schedules__header">
        <p className="panel-title">CONEXIONES_MCP</p>
        {!form && <button type="button" className="button button--primary" onClick={() => setForm({})}>[ NUEVA CONEXIÓN ]</button>}
      </div>
      <p className="muted">
        Servidores MCP que los agentes pueden usar como herramientas. Cada conexión queda descrita en la memoria corporativa
        — qué es, para qué sirve y qué hace cada herramienta — para que la oficina la encuentre cuando la necesite.
        Las herramientas que escriben nacen apagadas: tú decides cuáles activar.
        {pending > 0 && <strong className="connections__pending"> {pending} {pending === 1 ? 'necesita' : 'necesitan'} tu revisión.</strong>}
      </p>

      {form && (
        <ConnectionForm
          key={form.completing?.id ?? 'nueva'}
          initial={form.completing ? { name: form.completing.name, purpose: form.completing.purpose } : undefined}
          lockedName={Boolean(form.completing)}
          submitting={add.isPending}
          error={errorText(add.error)}
          onCancel={close}
          onSubmit={(v) => add.mutate([{
            name: v.name.trim(), url: v.url.trim() || null, purpose: v.purpose.trim(),
            credential: v.secret.trim() ? { headerName: v.headerName.trim() || 'Authorization', value: v.secret } : null,
          }], { onSuccess: close })}
        />
      )}

      {query.isLoading && <p className="muted">Cargando…</p>}
      {query.error && !(query.error instanceof ApiError && query.error.status === 401) && (
        <p className="error">No se pudo cargar: {errorText(query.error)}</p>
      )}
      {!query.isLoading && !query.error && connections.length === 0 && !form && (
        <p className="muted">Todavía no hay conexiones. Agrega una aquí o pídesela al asistente: «conecta el servidor MCP de …».</p>
      )}

      <ul className="connections__rows">
        {connections.map((connection) => (
          <ConnectionRow key={connection.id} connection={connection} onComplete={() => setForm({ completing: connection })} />
        ))}
      </ul>
    </div>
  );
}
