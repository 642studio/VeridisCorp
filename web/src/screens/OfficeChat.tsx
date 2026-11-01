import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  useOfficeOrders, useOfficeOrder, useStartOfficeOrder, useAnswerOfficeOrder,
  useAssistantThreads, useAssistantThread, useAskAssistant,
} from '../api/hooks';
import { ApiError } from '../api/client';
import { SessionExpired } from '../components/SessionExpired';
import { InvolvedAgents } from '../components/InvolvedAgents';
import { RichText } from '../components/RichText';
import { useElapsedSeconds } from '../useElapsedSeconds';
import { useSpinnerFrame } from '../useSpinnerFrame';
import { useTypewriter } from '../useTypewriter';
import { useSpeechToText, useTextToSpeech } from '../useVoice';
import { ORDER_STATUS } from '../officeStatus';
import type { AssistantMessage, OfficeOrderDetail, OfficeOrderSummary, OfficeWorkOrder } from '../api/types';

// Mismo tope que AskInput/StartInput en src/runtime/office-runtime.ts: pasarlo daba un 400 críptico.
const CHAT_LIMIT = 4000;

type ChatTurn = { kind: 'user'; text: string } | { kind: 'assistant'; text: string };

// El entregable real (lo que cada tarea entregó) es la respuesta del asistente — el veredicto
// de cierre ("el objetivo pedía X, la evidencia respalda Y") es el razonamiento interno del
// coordinador sobre por qué aceptó la evidencia, no la respuesta en sí. El veredicto ya se ve
// aparte en "ver proceso real" / detalle técnico — aquí solo se usa si no hay ningún entregable.
function summarizeResult(order: OfficeWorkOrder): string {
  const summaries = order.tasks.filter((t) => t.submission).map((t) => t.submission!.summary);
  if (summaries.length > 0) return summaries.join('\n\n');
  if (order.assessments && order.assessments.length > 0) {
    return order.assessments.map((a) => a.explanation).join('\n\n');
  }
  return 'El expediente se completó sin un resultado registrado.';
}

// Reconstruye la conversación de un expediente a partir del estado que ya devuelve la API.
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

// "Hacerlo con la oficina" desde una respuesta rápida: el encargo lleva lo último de la
// conversación para que el expediente no empiece sin contexto.
function objectiveFrom(messages: AssistantMessage[], index: number): string {
  const current = messages[index]!;
  const before = messages.slice(Math.max(0, index - 2), index);
  const context = before.map((m) => `- ${m.question} → ${m.answer.slice(0, 300)}`).join('\n');
  return (context ? `${current.question}\n\nContexto de la conversación:\n${context}` : current.question).slice(0, CHAT_LIMIT);
}

function TypedBubble({ text, messageKey }: { text: string; messageKey: string }) {
  // Una respuesta larga no debe tardar más en "escribirse" que en llegar: ~100 pasos, poco más de 1 s.
  const revealed = useTypewriter(text, messageKey, Math.max(3, Math.ceil(text.length / 100)));
  return <RichText className="chat-bubble__text" text={revealed} />;
}

function ThinkingBubble({ pending, quick }: { pending: boolean; quick: boolean }) {
  const seconds = useElapsedSeconds(pending);
  const spinner = useSpinnerFrame(pending);
  if (!pending) return null;
  return (
    <div className="chat-bubble chat-bubble--assistant chat-bubble--thinking">
      <p className="chat-bubble__text">{spinner} {quick ? 'Pensando' : 'VeridisCorp está trabajando'}… ({seconds}s)</p>
      {!quick && <p className="muted">Puede tardar uno o dos minutos: varias llamadas reales de IA, una tras otra. Mientras tanto puedes seguir viendo o escribiendo en otra conversación — esta sigue en segundo plano.</p>}
    </div>
  );
}

// Qué sabía la empresa al responder: tiempo de respuesta y las memorias usadas, desplegables.
function AnswerMeta({ message }: { message: AssistantMessage }) {
  const seconds = (message.latencyMs / 1000).toLocaleString('es-MX', { maximumFractionDigits: 1 });
  if (!message.memories.length) return <p className="chat-answer-meta">{seconds} s · sin memoria relevante</p>;
  return (
    <details className="chat-answer-meta">
      <summary>{seconds} s · usó {message.memories.length} {message.memories.length === 1 ? 'memoria' : 'memorias'}</summary>
      <ul>
        {message.memories.map((m) => (
          <li key={m.id}>
            <span className={`chat-answer-meta__state ${m.confirmed ? 'chat-answer-meta__state--confirmed' : ''}`}>{m.confirmed ? 'confirmada' : 'sin confirmar'}</span>
            {m.content}
          </li>
        ))}
      </ul>
    </details>
  );
}

// Un traspaso a la oficina se enlaza con su expediente por el encargo exacto: es el mismo texto
// que se mandó a start(), y así el enlace también aparece al volver a abrir la conversación.
function HandoffCard({ objective, order, starting, onOpen }: {
  objective: string; order: OfficeOrderSummary | undefined; starting: boolean; onOpen: (id: string) => void;
}) {
  return (
    <div className="chat-handoff">
      <p className="chat-handoff__label">Encargo para la oficina</p>
      <p className="chat-handoff__objective">{objective}</p>
      {order ? (
        <div className="chat-handoff__status">
          <span className={`status-pill status-pill--${ORDER_STATUS[order.status].tone}`}>{ORDER_STATUS[order.status].label}</span>
          <button type="button" className="button button--link" onClick={() => onOpen(order.id)}>Abrir expediente →</button>
        </div>
      ) : (
        <p className="muted">{starting ? 'Abriendo el expediente…' : 'Se pasó a la oficina.'}</p>
      )}
    </div>
  );
}

// El chat responde primero con la respuesta rápida (una llamada con la memoria de la empresa, en
// segundos). Si lo que pides es trabajo, esa misma respuesta trae el encargo redactado y se abre
// un expediente con la oficina completa. Cada conversación piensa por su cuenta: puedes cambiarte
// a otra, o empezar una nueva, mientras alguna sigue pensando.
export function OfficeChat({ onOpenTechnical }: { onOpenTechnical: (id: string) => void }) {
  const client = useQueryClient();
  const list = useOfficeOrders();
  const threads = useAssistantThreads();
  // Lo que se está viendo: un expediente (activeId), una conversación rápida (threadId) o ninguno (nueva).
  const [activeId, setActiveId] = useState<string | null>(null);
  const [threadId, setThreadId] = useState<string | null>(null);
  const viewRef = useRef<{ activeId: string | null; threadId: string | null }>({ activeId: null, threadId: null });
  useEffect(() => { viewRef.current = { activeId, threadId }; }, [activeId, threadId]);
  const detail = useOfficeOrder(activeId);
  const thread = useAssistantThread(threadId);
  const start = useStartOfficeOrder();
  const answer = useAnswerOfficeOrder();
  const ask = useAskAssistant();
  const [draft, setDraft] = useState('');
  const [lastError, setLastError] = useState<string | null>(null);
  // Expedientes esperando respuesta del usuario: por id, nunca global.
  const [pendingAnswerIds, setPendingAnswerIds] = useState<Set<string>>(new Set());
  const [optimisticAnswers, setOptimisticAnswers] = useState<Record<string, string>>({});
  // Conversaciones rápidas pensando, por hilo; "new" es la que todavía no tiene hilo.
  const [pendingQuestions, setPendingQuestions] = useState<Record<string, string>>({});
  // Encargos que se están abriendo como expediente (por texto exacto del encargo).
  const [startingObjectives, setStartingObjectives] = useState<Set<string>>(new Set());
  const [justArrivedId, setJustArrivedId] = useState<string | null>(null);
  const threadRef = useRef<HTMLDivElement>(null);

  const stt = useSpeechToText();
  const tts = useTextToSpeech();
  const [voiceReplyOn, setVoiceReplyOn] = useState(false);
  const voiceRef = useRef(false);
  useEffect(() => { voiceRef.current = voiceReplyOn; }, [voiceReplyOn]);
  const wasPendingRef = useRef(false);

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: 'smooth' });
  });

  const unauthorized = [list.error, threads.error].some((e) => e instanceof ApiError && e.status === 401);

  const orders = list.data?.orders ?? [];
  const orderByObjective = (objective: string) => orders.find((o) => o.objective === objective);
  // Pausado (por presupuesto, límites o rechazos) tampoco acepta respuesta: no hay comando para
  // reanudarlo, así que un mensaje nuevo abre otra conversación igual que con uno completado.
  const orderStatus = detail.data?.order.status;
  const isClosed = orderStatus === 'completed' || orderStatus === 'paused';
  const askKey = threadId ?? 'new';
  // También cuenta como pensando un expediente que se abrió desde un encargo y sigue arrancando.
  const orderPending = activeId
    ? pendingAnswerIds.has(activeId) || startingObjectives.has(detail.data?.order.objective ?? orders.find((o) => o.id === activeId)?.objective ?? '')
    : false;
  const askPending = !activeId && pendingQuestions[askKey] !== undefined;
  const pendingForView = orderPending || askPending;
  const tooLong = draft.trim().length > CHAT_LIMIT;

  const turns = activeId && detail.data ? buildTurns(detail.data) : [];
  if (activeId && pendingAnswerIds.has(activeId) && optimisticAnswers[activeId]) {
    turns.push({ kind: 'user', text: optimisticAnswers[activeId]! });
  }
  const messages = !activeId && threadId ? thread.data?.messages ?? [] : [];

  // Lectura en voz alta de la respuesta de un expediente cuando termina de pensar (las rápidas se
  // leen en cuanto llegan, en onSuccess).
  useEffect(() => {
    if (voiceReplyOn && wasPendingRef.current && !orderPending) {
      const last = turns[turns.length - 1];
      if (last?.kind === 'assistant') tts.speak(last.text);
    }
    wasPendingRef.current = orderPending;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderPending]);

  const openOrder = (id: string) => { setActiveId(id); setThreadId(null); setLastError(null); };
  const openThread = (id: string) => { setThreadId(id); setActiveId(null); setLastError(null); };

  const startOrder = (objective: string) => {
    setStartingObjectives((prev) => new Set(prev).add(objective));
    // El expediente se registra apenas arranca; refrescar la lista pronto hace que aparezca "en curso".
    setTimeout(() => { void client.invalidateQueries({ queryKey: ['office-orders'] }); }, 1500);
    start.mutate(objective, {
      onSettled: () => setStartingObjectives((prev) => { const next = new Set(prev); next.delete(objective); return next; }),
      onError: (error) => setLastError(error instanceof Error ? error.message : 'No se pudo abrir el expediente'),
    });
  };

  const askQuestion = (text: string, inThread: string | null) => {
    const key = inThread ?? 'new';
    setPendingQuestions((prev) => ({ ...prev, [key]: text }));
    const clear = () => setPendingQuestions((prev) => { const next = { ...prev }; delete next[key]; return next; });
    ask.mutate({ question: text, threadId: inThread }, {
      onSuccess: (message) => {
        clear();
        setJustArrivedId(message.id);
        // Una conversación nueva pasa a su hilo solo si el usuario sigue mirándola.
        if (!inThread && viewRef.current.activeId === null && viewRef.current.threadId === null) setThreadId(message.threadId);
        if (voiceRef.current) tts.speak(message.answer);
        if (message.mode === 'order' && message.objective) startOrder(message.objective);
      },
      onError: (error) => { clear(); setLastError(error instanceof Error ? error.message : 'Error inesperado'); setDraft((d) => d || text); },
    });
  };

  const send = () => {
    const text = draft.trim();
    if (!text || pendingForView || tooLong) return;
    setLastError(null);
    setDraft('');
    if (activeId && !isClosed) {
      const id = activeId;
      setPendingAnswerIds((prev) => new Set(prev).add(id));
      setOptimisticAnswers((prev) => ({ ...prev, [id]: text }));
      const done = () => {
        setPendingAnswerIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
        setOptimisticAnswers((prev) => { const next = { ...prev }; delete next[id]; return next; });
      };
      answer.mutate({ id, args: [text] }, {
        onSuccess: done,
        onError: (error) => { done(); setLastError(error instanceof Error ? error.message : 'Error inesperado'); },
      });
      return;
    }
    // Desde un expediente cerrado, el mensaje abre una conversación nueva.
    if (activeId) setActiveId(null);
    askQuestion(text, activeId ? null : threadId);
  };

  type SidebarItem = { kind: 'thread' | 'order'; id: string; title: string; at: string; order?: OfficeOrderSummary };
  const sidebar: SidebarItem[] = [
    ...(threads.data?.threads ?? []).filter((t) => !t.onlyHandoffs || t.threadId === threadId)
      .map((t) => ({ kind: 'thread' as const, id: t.threadId, title: t.title, at: t.updatedAt })),
    ...orders.map((o) => ({ kind: 'order' as const, id: o.id, title: o.objective, at: o.updated_at, order: o })),
  ].sort((a, b) => b.at.localeCompare(a.at));

  if (unauthorized) return <SessionExpired />;
  const placeholder = activeId && !isClosed ? 'Tu respuesta…' : threadId ? 'Sigue la conversación…' : 'Pregunta o pide algo…';

  return (
    <div className="chat-layout">
      <aside className="chat-sidebar">
        <button type="button" className="button button--primary chat-sidebar__new" onClick={() => { setActiveId(null); setThreadId(null); setDraft(''); setLastError(null); }}>
          + nueva conversación
        </button>
        {pendingQuestions.new !== undefined && (
          <div className={`chat-sidebar__item ${!activeId && !threadId ? 'chat-sidebar__item--active' : ''}`} onClick={() => { setActiveId(null); setThreadId(null); }}>
            <span className="status-pill status-pill--progress">pensando</span>
            <span className="chat-sidebar__brief" title={pendingQuestions.new}>{pendingQuestions.new}</span>
          </div>
        )}
        {(list.isLoading || threads.isLoading) && <p className="muted">Cargando…</p>}
        <ul className="chat-sidebar__list">
          {sidebar.map((item) => {
            const active = item.kind === 'order' ? item.id === activeId : item.id === threadId && !activeId;
            const thinking = item.kind === 'order'
              ? pendingAnswerIds.has(item.id) || startingObjectives.has(item.title)
              : pendingQuestions[item.id] !== undefined;
            const pill = thinking ? { label: 'pensando', tone: 'progress' }
              : item.kind === 'order' ? ORDER_STATUS[item.order!.status] : { label: 'chat', tone: 'neutral' };
            return (
              <li key={`${item.kind}:${item.id}`}
                className={`chat-sidebar__item ${active ? 'chat-sidebar__item--active' : ''}`}
                onClick={() => (item.kind === 'order' ? openOrder(item.id) : openThread(item.id))}>
                <span className={`status-pill status-pill--${pill.tone}`}>{pill.label}</span>
                <span className="chat-sidebar__brief" title={item.title}>{item.title}</span>
              </li>
            );
          })}
        </ul>
      </aside>

      <div className="chat-main">
        <div className="chat-thread" ref={threadRef}>
          {!activeId && !threadId && pendingQuestions.new === undefined && (
            <div className="chat-empty">
              <p>Pregunta lo que sea: responde al momento con lo que la empresa ya sabe.</p>
              <p className="muted">Si pides un trabajo (una cotización, un documento, código, un correo, investigar algo), lo pasa a la oficina como expediente.</p>
            </div>
          )}

          {activeId && turns.map((turn, index) => (
            <div key={index} className={`chat-bubble chat-bubble--${turn.kind}`}>
              {turn.kind === 'assistant' && index === turns.length - 1 && !pendingForView
                ? <TypedBubble text={turn.text} messageKey={`${activeId}:${index}`} />
                : turn.kind === 'assistant' ? <RichText className="chat-bubble__text" text={turn.text} /> : <p className="chat-bubble__text">{turn.text}</p>}
              {turn.kind === 'assistant' && tts.supported && (
                <button type="button" className="button button--link chat-bubble__speak" title="Leer en voz alta" onClick={() => tts.speak(turn.text)}>🔊</button>
              )}
            </div>
          ))}

          {!activeId && threadId && thread.isLoading && <p className="muted">Cargando…</p>}
          {!activeId && thread.error && threadId && <p className="error">No se pudo cargar la conversación: {(thread.error as Error).message}</p>}
          {messages.map((message, index) => (
            <div key={message.id} className="chat-exchange">
              <div className="chat-bubble chat-bubble--user"><p className="chat-bubble__text">{message.question}</p></div>
              <div className="chat-bubble chat-bubble--assistant">
                {message.id === justArrivedId
                  ? <TypedBubble text={message.answer} messageKey={message.id} />
                  : <RichText className="chat-bubble__text" text={message.answer} />}
                {message.mode === 'order' && message.objective && (
                  <HandoffCard objective={message.objective} order={orderByObjective(message.objective)}
                    starting={startingObjectives.has(message.objective)} onOpen={openOrder} />
                )}
                <div className="chat-bubble__footer">
                  <AnswerMeta message={message} />
                  {tts.supported && (
                    <button type="button" className="button button--link chat-bubble__speak" title="Leer en voz alta" onClick={() => tts.speak(message.answer)}>🔊</button>
                  )}
                  {message.mode === 'answer' && index === messages.length - 1 && !askPending && !orderByObjective(objectiveFrom(messages, index)) && (
                    <button type="button" className="button button--link chat-bubble__escalate"
                      title="Abre un expediente: el CEO reparte el trabajo entre especialistas y un revisor lo verifica"
                      disabled={startingObjectives.has(objectiveFrom(messages, index))}
                      onClick={() => startOrder(objectiveFrom(messages, index))}>
                      Hacerlo con la oficina →
                    </button>
                  )}
                </div>
                {(() => {
                  const objective = objectiveFrom(messages, index);
                  return message.mode === 'answer' && (startingObjectives.has(objective) || orderByObjective(objective))
                    ? <HandoffCard objective={objective} order={orderByObjective(objective)} starting={startingObjectives.has(objective)} onOpen={openOrder} />
                    : null;
                })()}
              </div>
            </div>
          ))}
          {askPending && <div className="chat-bubble chat-bubble--user"><p className="chat-bubble__text">{pendingQuestions[askKey]}</p></div>}
          <ThinkingBubble pending={pendingForView} quick={askPending} />
        </div>

        {activeId && detail.data && (
          <details className="chat-process">
            <summary>ver proceso real</summary>
            <InvolvedAgents modelCalls={detail.data.modelCalls} />
            <button type="button" className="button button--link" onClick={() => onOpenTechnical(detail.data!.id)}>
              Ver detalle técnico completo →
            </button>
          </details>
        )}

        {lastError && <p className="error chat-error">{lastError}</p>}
        {activeId && isClosed && !pendingForView && (
          <p className="muted chat-closed-note">
            {orderStatus === 'paused' ? 'Este expediente quedó pausado' : 'Este expediente ya cerró'} — un mensaje nuevo abre otra conversación.
          </p>
        )}

        {(stt.supported || tts.supported) && (
          <div className="chat-voice-bar">
            {tts.supported && (
              <label className="chat-voice-bar__toggle">
                <input type="checkbox" checked={voiceReplyOn} onChange={(event) => setVoiceReplyOn(event.target.checked)} />
                🔊 leer respuestas en voz alta
              </label>
            )}
            {tts.speaking && (
              <button type="button" className="button button--link" onClick={tts.stop}>⏹ detener lectura</button>
            )}
          </div>
        )}

        <div className="chat-input">
          {stt.supported && (
            <button type="button"
              className={`button chat-input__mic ${stt.listening ? 'chat-input__mic--active' : ''}`}
              title={stt.listening ? 'Escuchando… clic para detener' : 'Dictar por voz'}
              disabled={pendingForView}
              onClick={() => (stt.listening ? stt.stop() : stt.start((text) => setDraft((prev) => (prev ? `${prev} ${text}` : text))))}>
              {stt.listening ? '🔴' : '🎤'}
            </button>
          )}
          <textarea
            value={stt.listening && stt.interimText ? `${draft} ${stt.interimText}` : draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); send(); } }}
            rows={2}
            placeholder={placeholder}
            disabled={pendingForView}
          />
          <button type="button" className="button button--primary" disabled={pendingForView || draft.trim().length === 0 || tooLong} onClick={send}>
            Enviar
          </button>
        </div>
        {draft.length > CHAT_LIMIT * 0.8 && (
          <p className={tooLong ? 'error chat-input__limit' : 'muted chat-input__limit'}>
            {draft.length.toLocaleString('es-MX')} / {CHAT_LIMIT.toLocaleString('es-MX')} caracteres
            {tooLong && ' — demasiado largo para un mensaje. Si quieres que la empresa lo recuerde, usa MEMORIA → + IMPORTAR TEXTO.'}
          </p>
        )}
      </div>
    </div>
  );
}
