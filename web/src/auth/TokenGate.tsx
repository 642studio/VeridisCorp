import { useState, type ReactNode } from 'react';
import { getToken, setToken } from '../api/client';

export function TokenGate({ children }: { children: ReactNode }) {
  const [token, setLocalToken] = useState(() => getToken());
  const [input, setInput] = useState('');

  if (!token) {
    return (
      <div className="token-gate">
        <div className="token-gate__brand">VERIDIS<span className="token-gate__brand-accent">CORP</span></div>
        <h1>RUNTIME_ACCESS // 642 STUDIO</h1>
        <p>
          Pega el token de sesión que generaste con <code>runtime:provision</code>. Se guarda solo en esta pestaña
          (<code>sessionStorage</code>) y se olvida al cerrarla — no hay login todavía, igual que el resto del piloto.
        </p>
        <form onSubmit={(event) => { event.preventDefault(); if (input.trim()) { setToken(input.trim()); setLocalToken(input.trim()); } }}>
          <span className="token-gate__prompt">&gt;</span>
          <input type="password" value={input} onChange={(event) => setInput(event.target.value)} placeholder="TOKEN_BEARER" autoFocus />
          <button type="submit" className="button button--primary" disabled={!input.trim()}>[ ENTRAR ]</button>
        </form>
      </div>
    );
  }

  return <>{children}</>;
}
