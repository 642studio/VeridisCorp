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
import { VoiceDock } from '../components/VoiceDock';
import { useElapsedSeconds } from '../useElapsedSeconds';
import { useSpinnerFrame } from '../useSpinnerFrame';
import { useTypewriter } from '../useTypewriter';
import { useTextToSpeech } from '../useVoice';
import { useVoiceDock } from '../hooks/useVoiceDock';
import { useActiveSession } from '../context/ActiveSessionContext';
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
  const {
    focusedKind, focusedId, setFocus,
    pendingAnswerIds, setPendingAnswerIds,
    startingObjectives, setStartingObjectives,
    pendingQuestions, setPendingQuestions,
  } = useActiveSession();
  // Lo que se está viendo: un expediente (activeId), una conversación rápida (threadId) o ninguno
  // (nueva) — derivado del foco global, compartido con el sidebar de sesiones (ver App.tsx).
  const activeId = focusedKind === 'order' ? focusedId : null;
  const threadId = focusedKind === 'thread' ? focusedId : null;
  const focusRef = useRef<{ kind: typeof focusedKind; id: string | null }>({ kind: null, id: null });
  useEffect(() => { focusRef.current = { kind: focusedKind, id: focusedId }; }, [focusedKind, focusedId]);
  const detail = useOfficeOrder(activeId);
  const thread = useAssistantThread(threadId);
  const start = useStartOfficeOrder();
  const answer = useAnswerOfficeOrder();
  const ask = useAskAssistant();
  const [draft, setDraft] = useState('');
  const [lastError, setLastError] = useState<string | null>(null);
  const [optimisticAnswers, setOptimisticAnswers] = useState<Record<string, string>>({});
  const [justArrivedId, setJustArrivedId] = useState<string | null>(null);
  const threadRef = useRef<HTMLDivElement>(null);

  // Lectura en voz alta puntual de un turno ya en pantalla (botón 🔊 por burbuja) — distinta del
  // dock de voz en vivo (VoiceDock/useVoiceDock), que habla cada respuesta nueva automáticamente.
  const tts = useTextToSpeech();

  // Cada vez que cambia la sesión enfocada (desde el sidebar global o internamente, vía setFocus)
  // se limpia el borrador y el error de la conversación anterior.
  useEffect(() => { setDraft(''); setLastError(null); }, [focusedKind, focusedId]);

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

  const openOrder = (id: string) => setFocus('order', id);

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
        if (!inThread && focusRef.current.kind === null && focusRef.current.id === null) setFocus('thread', message.threadId);
        voiceDock.receiveReply(message.answer, message.scene);
        if (message.mode === 'order' && message.objective) startOrder(message.objective);
      },
      onError: (error) => { clear(); setLastError(error instanceof Error ? error.message : 'Error inesperado'); setDraft((d) => d || text); },
    });
  };

  // overrideText: lo usa el dock de voz (dictado) para mandar sin pasar por el textarea.
  const send = (overrideText?: string) => {
    const text = (overrideText ?? draft).trim();
    const over = text.length > CHAT_LIMIT;
    if (!text || pendingForView || over) return;
    setLastError(null);
    if (overrideText === undefined) setDraft('');
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
    const wasActiveOrder = activeId;
    if (wasActiveOrder) setFocus(null, null);
    askQuestion(text, wasActiveOrder ? null : threadId);
  };

  // Voz en vivo, solo para conversaciones de ASISTENTE (no para responder un expediente abierto,
  // ver decisión del plan) — el hook se llama siempre (reglas de hooks), el dock solo se monta
  // cuando !activeId.
  const voiceDock = useVoiceDock(send, askPending);

  if (unauthorized) return <SessionExpired />;
  const placeholder = activeId && !isClosed ? 'Tu respuesta…' : threadId ? 'Sigue la conversación…' : 'Pregunta o pide algo…';

  return (
    <div className="chat-layout">
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

        {/* La voz en vivo (dictar y escuchar la respuesta) solo aplica a conversaciones de
            ASISTENTE, no para responder un expediente abierto — ver decisión del plan. */}
        {!activeId && <VoiceDock dock={voiceDock} />}

        <div className="chat-input">
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); send(); } }}
            rows={2}
            placeholder={placeholder}
            disabled={pendingForView}
          />
          <button type="button" className="button button--primary" disabled={pendingForView || draft.trim().length === 0 || tooLong} onClick={() => send()}>
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
