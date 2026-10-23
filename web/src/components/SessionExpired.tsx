export function SessionExpired() {
  return (
    <div className="session-expired">
      <p>La sesión no es válida o venció.</p>
      <button type="button" className="button button--primary" onClick={() => window.location.reload()}>Volver a entrar</button>
    </div>
  );
}
