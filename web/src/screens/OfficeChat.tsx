import { useEffect, useRef, useState } from 'react';
import { useOfficeOrders, useOfficeOrder, useStartOfficeOrder, useAnswerOfficeOrder } from '../api/hooks';
import { ApiError } from '../api/client';
import { SessionExpired } from '../components/SessionExpired';
import { InvolvedAgents } from '../components/InvolvedAgents';
import { useElapsedSeconds } from '../useElapsedSeconds';
import { useSpinnerFrame } from '../useSpinnerFrame';
import { useTypewriter } from '../useTypewriter';
import { ORDER_STATUS } from '../officeStatus';
import type { OfficeOrderDetail, OfficeWorkOrder } from '../api/types';

type ChatTurn = { kind: 'user'; text: string } | { kind: 'assistant'; text: string };

// El entregable y la evaluación final ya están en los mismos datos que listan los expedientes
// — no hace falta ningún endpoint nuevo, solo redactarlos como una respuesta legible.
function summarizeResult(order: OfficeWorkOrder): string {
  if (order.assessments && order.assessments.length > 0) {
    return order.assessments.map((a) => a.explanation).join('\n\n');
  }
  const summaries = order.tasks.filter((t) => t.submission).map((t) => t.submission!.summary);
  if (summaries.length > 0) return summaries.join('\n\n');
  return 'El expediente se completó sin un resultado registrado.';
}

// Reconstruye la conversación a partir del mismo estado que ya devuelve la API: el objetivo
// es el primer mensaje, exchanges son rondas de pregunta/respuesta ya resueltas, y el final
// depende del estado (durante un ask_user el expediente sigue 'active', solo cambia
// `interrupted`; una pausa real sí marca `status: 'paused'` con pauseReason).
function buildTurns(detail: OfficeOrderDetail): ChatTurn[] {
  const turns: ChatTurn[] = [{ kind: 'user', text: detail.order.objective }];
  for (const exchange of detail.exchanges) {
    turns.push({ kind: 'assistant', text: exchange.question });
    turns.push({ kind: 'user', text: exchange.answer });
  }
  if (detail.interrupted && detail.pendingQuestion) {
    turns.push({ kind: 'assistant', text: detail.pendingQuestion });
  } else if (detail.order.status === 'completed') {
    turns.push({ kind: 'assistant', text: summarizeResult(detail.order) });
  } else if (detail.order.status === 'paused' && detail.order.pauseReason) {
    turns.push({ kind: 'assistant', text: `Pausado: ${detail.order.pauseReason}` });
  }
  return turns;
}

function TypedBubble({ text, messageKey }: { text: string; messageKey: string }) {
  const revealed = useTypewriter(text, messageKey);
  return <p className="chat-bubble__text">{revealed}</p>;
}

export function OfficeChat({ onOpenTechnical }: { onOpenTechnical: (id: string) => void }) {
  const list = useOfficeOrders();
  const [activeId, setActiveId] = useState<string | null>(null);
  const detail = useOfficeOrder(activeId);
  const start = useStartOfficeOrder();
  const answer = useAnswerOfficeOrder();
  const [draft, setDraft] = useState('');
  const [lastError, setLastError] = useState<string | null>(null);
  const [sentText, setSentText] = useState<string | null>(null);
  const threadRef = useRef<HTMLDivElement>(null);

  const pending = start.isPending || answer.isPending;
  const seconds = useElapsedSeconds(pending);
  const spinner = useSpinnerFrame(pending);

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: 'smooth' });
  });

  if (list.error instanceof ApiError && list.error.status === 401) return <SessionExpired />;

  const orders = list.data?.orders ?? [];
  // Mientras la mutación está en vuelo, el texto enviado todavía no aparece en `exchanges` (el
  // servidor aún no respondió), así que se muestra como burbuja optimista aparte — sin esto el
  // usuario ve desaparecer su propio mensaje hasta que termina de pensar.
  const turns = detail.data ? buildTurns(detail.data) : [];
  if (pending && sentText) turns.push({ kind: 'user', text: sentText });
  const isClosed = detail.data?.order.status === 'completed';

  const onSendError = (error: unknown) => { setSentText(null); setLastError(error instanceof Error ? error.message : 'Error inesperado'); };

  const send = () => {
    const text = draft.trim();
    if (!text || pending) return;
    setLastError(null);
    setSentText(text);
    if (!activeId || isClosed) {
      start.mutate(text, {
        onSuccess: (data) => { setDraft(''); setSentText(null); setActiveId(data.id); },
        onError: onSendError,
      });
    } else {
      answer.mutate({ id: activeId, args: [text] }, {
        onSuccess: () => { setDraft(''); setSentText(null); },
        onError: onSendError,
      });
    }
  };

  return (
    <div className="chat-layout">
      <aside className="chat-sidebar">
        <button type="button" className="button button--primary chat-sidebar__new" onClick={() => { setActiveId(null); setDraft(''); setLastError(null); }}>
          + nueva conversación
        </button>
        {list.isLoading && <p className="muted">Cargando…</p>}
        <ul className="chat-sidebar__list">
          {orders.map((order) => {
            const status = ORDER_STATUS[order.status];
            return (
              <li key={order.id}
                className={`chat-sidebar__item ${order.id === activeId ? 'chat-sidebar__item--active' : ''}`}
                onClick={() => { setActiveId(order.id); setLastError(null); }}>
                <span className={`status-pill status-pill--${status.tone}`}>{status.label}</span>
                <span className="chat-sidebar__brief" title={order.objective}>{order.objective}</span>
              </li>
            );
          })}
        </ul>
      </aside>

      <div className="chat-main">
        <div className="chat-thread" ref={threadRef}>
          {!activeId && turns.length === 0 && (
            <p className="muted chat-empty">Escribe lo que necesitas — el CEO real decide a qué especialista mandarlo.</p>
          )}
          {turns.map((turn, index) => (
            <div key={index} className={`chat-bubble chat-bubble--${turn.kind}`}>
              {turn.kind === 'assistant' && index === turns.length - 1 && !pending
                ? <TypedBubble text={turn.text} messageKey={`${activeId}:${index}`} />
                : <p className="chat-bubble__text">{turn.text}</p>}
            </div>
          ))}
          {pending && (
            <div className="chat-bubble chat-bubble--assistant chat-bubble--thinking">
              <p className="chat-bubble__text">{spinner} VeridisCorp está trabajando… ({seconds}s)</p>
              <p className="muted">Puede tardar uno o dos minutos: varias llamadas reales de IA, una tras otra.</p>
            </div>
          )}
        </div>

        {detail.data && (
          <details className="chat-process">
            <summary>ver proceso real</summary>
            <InvolvedAgents modelCalls={detail.data.modelCalls} />
            <button type="button" className="button button--link" onClick={() => onOpenTechnical(detail.data!.id)}>
              Ver detalle técnico completo →
            </button>
          </details>
        )}

        {lastError && <p className="error">{lastError}</p>}
        {isClosed && <p className="muted chat-closed-note">Este expediente ya cerró — un mensaje nuevo abre otra conversación.</p>}

        <div className="chat-input">
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); send(); } }}
            rows={2}
            placeholder={!activeId || isClosed ? 'Objetivo del expediente…' : 'Tu respuesta…'}
            disabled={pending}
          />
          <button type="button" className="button button--primary" disabled={pending || draft.trim().length === 0} onClick={send}>
            Enviar
          </button>
        </div>
      </div>
    </div>
  );
}
