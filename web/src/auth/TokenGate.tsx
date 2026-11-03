import { useState, type FormEvent, type ReactNode } from 'react';
import { ApiError, getToken, loginWithTotp, setToken } from '../api/client';

export function TokenGate({ children }: { children: ReactNode }) {
  const [token, setLocalToken] = useState(() => getToken());
  const [mode, setMode] = useState<'totp' | 'paste'>('totp');
  const [principalId, setPrincipalId] = useState('');
  const [code, setCode] = useState('');
  const [pasted, setPasted] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!token) {
    const submitTotp = async (event: FormEvent) => {
      event.preventDefault();
      if (!principalId.trim() || code.trim().length !== 6) return;
      setBusy(true); setError(null);
      try {
        await loginWithTotp(principalId.trim(), code.trim());
        setLocalToken(getToken());
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Error inesperado del servidor');
      } finally { setBusy(false); }
    };
    const submitPaste = (event: FormEvent) => {
      event.preventDefault();
      if (!pasted.trim()) return;
      setToken(pasted.trim());
      setLocalToken(pasted.trim());
    };
    return (
      <div className="token-gate">
        <div className="token-gate__brand">VERIDIS<span className="token-gate__brand-accent">CORP</span></div>
        <h1>RUNTIME_ACCESS // 642 STUDIO</h1>
        {mode === 'totp' ? (
          <>
            <p>
              Entra con el código de 6 dígitos de tu app de autenticación (Google Authenticator, Authy, 1Password, etc).
              La sesión queda guardada en este navegador hasta que cierres sesión o la borres.
            </p>
            <form onSubmit={submitTotp}>
              <span className="token-gate__prompt">&gt;</span>
              <input type="text" value={principalId} onChange={(event) => setPrincipalId(event.target.value)} placeholder="USUARIO" autoFocus autoComplete="username" />
              <input
                type="text" inputMode="numeric" pattern="[0-9]*" maxLength={6} value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
                placeholder="CÓDIGO_6_DÍGITOS" autoComplete="one-time-code"
              />
              <button type="submit" className="button button--primary" disabled={busy || !principalId.trim() || code.trim().length !== 6}>
                {busy ? '[ ... ]' : '[ ENTRAR ]'}
              </button>
            </form>
            {error && <p className="token-gate__error">{error}</p>}
            <button type="button" className="button" onClick={() => { setMode('paste'); setError(null); }}>
              [ USAR_TOKEN_DIRECTO ]
            </button>
          </>
        ) : (
          <>
            <p>
              Pega el token de sesión que generaste con <code>runtime:provision</code>. Se guarda en este navegador
              hasta que lo borres.
            </p>
            <form onSubmit={submitPaste}>
              <span className="token-gate__prompt">&gt;</span>
              <input type="password" value={pasted} onChange={(event) => setPasted(event.target.value)} placeholder="TOKEN_BEARER" autoFocus />
              <button type="submit" className="button button--primary" disabled={!pasted.trim()}>[ ENTRAR ]</button>
            </form>
            <button type="button" className="button" onClick={() => { setMode('totp'); setError(null); }}>
              [ USAR_CÓDIGO_DE_APP ]
            </button>
          </>
        )}
      </div>
    );
  }

  return <>{children}</>;
}
