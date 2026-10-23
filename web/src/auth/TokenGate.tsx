import { useState, type ReactNode } from 'react';
import { clearToken, getToken, setToken } from '../api/client';

export function TokenGate({ children }: { children: ReactNode }) {
  const [token, setLocalToken] = useState(() => getToken());
  const [input, setInput] = useState('');

  if (!token) {
    return (
      <div className="token-gate">
        <h1>VeridisCorp — Supervisión del runtime</h1>
        <p>
          Pega el token de sesión que generaste con <code>runtime:provision</code>. Se guarda solo en esta pestaña
          (<code>sessionStorage</code>) y se olvida al cerrarla — no hay login todavía, igual que el resto del piloto.
        </p>
        <form onSubmit={(event) => { event.preventDefault(); if (input.trim()) { setToken(input.trim()); setLocalToken(input.trim()); } }}>
          <input type="password" value={input} onChange={(event) => setInput(event.target.value)} placeholder="Token Bearer" autoFocus />
          <button type="submit" className="button button--primary" disabled={!input.trim()}>Entrar</button>
        </form>
      </div>
    );
  }

  return (
    <div>
      <div className="token-gate__bar">
        <span>Sesión activa</span>
        <button type="button" className="button button--link" onClick={() => { clearToken(); setLocalToken(null); }}>Cambiar token</button>
      </div>
      {children}
    </div>
  );
}
