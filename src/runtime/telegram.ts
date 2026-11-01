import type { AccessScope } from '../governance/contracts.js';
import { telegramBridge, type OfficeRuntime } from './office-runtime.js';

// Puente de Telegram para el chat ASISTENTE, por long polling saliente (el proceso llama hacia
// afuera a api.telegram.org; no abre ningún puerto nuevo ni expone nada — mismo criterio de "no
// exponer superficie nueva" que el resto del proyecto). Cada mensaje de un chat autorizado arranca
// o continúa un expediente real de office/ con el mismo OfficeRuntime que usa la API HTTP, nunca
// una ruta de ejecución aparte. El bot actúa con el principal de servicio telegramBridge (mismo
// patrón que scheduler en office-runtime.ts) — necesita un grant real para ese principal en la
// tabla grants (se añade con runtime:provision, no con un token propio: no hay sesión que guardar
// ni que pueda vencer o filtrarse). El mapeo chat → expediente vive solo en memoria: se pierde al
// reiniciar, igual que el scheduler ("Sin recuperación al reiniciar" ya documentado en
// docs/runtime-pilot.md) — cada chat simplemente arranca un expediente nuevo en su próximo mensaje.

export interface TelegramConfig {
  botToken: string;
  allowedChatIds: Set<string>;
  scope: AccessScope;
}

export function telegramConfigFromEnv(scope: AccessScope, env: NodeJS.ProcessEnv = process.env): TelegramConfig | null {
  const botToken = env.TELEGRAM_BOT_TOKEN?.trim();
  const allowedRaw = env.TELEGRAM_ALLOWED_CHAT_IDS?.trim();
  if (!botToken || !allowedRaw) return null;
  const allowedChatIds = new Set(allowedRaw.split(',').map((id) => id.trim()).filter(Boolean));
  if (!allowedChatIds.size) return null;
  return { botToken, allowedChatIds, scope };
}

type TelegramUpdate = {
  update_id: number;
  message?: { chat: { id: number }; from?: { id: number; username?: string }; text?: string };
};

async function callTelegram(botToken: string, method: string, body: Record<string, unknown>, timeoutMs: number): Promise<unknown> {
  const response = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const data = await response.json() as { ok: boolean; result?: unknown; description?: string };
  if (!data.ok) throw new Error(`Telegram ${method} respondió error: ${data.description ?? response.status}`);
  return data.result;
}

// state.order llega tipado como unknown desde OfficeRuntime.shape() (mismo patrón de cast local
// que ya usa office-runtime.ts, en vez de acoplar este puente al tipo exacto de WorkOrder).
type OrderShape = { status: string; tasks: { status: string; submission?: { summary: string } }[]; pauseReason?: string };
function summarizeOrder(detail: { order: unknown; pendingQuestion: string | null }): string {
  if (detail.pendingQuestion) return `❓ ${detail.pendingQuestion}`;
  const order = detail.order as OrderShape;
  if (order.status === 'completed') {
    const summaries = order.tasks.filter((t) => t.status === 'completed' && t.submission?.summary).map((t) => t.submission!.summary);
    return summaries.length ? `✅ Listo:\n\n${summaries.join('\n\n')}` : '✅ Listo (sin entregable escrito que resumir).';
  }
  if (order.status === 'paused') return `⏸️ Se pausó: ${order.pauseReason ?? 'sin motivo registrado'}`;
  return '⏳ Sigo trabajando — mándame otro mensaje en un momento para ver el avance.';
}

// Preguntar "¿cómo vas?" nunca debe esperar a que el expediente avance: se contesta leyendo su
// estado ya guardado (getAsService -> getState(), sin invoke(), sin IA) al instante, sin tocar el
// motor. Heurística simple y barata a propósito — no vale la pena una llamada de IA solo para
// clasificar esto, y añadiría la misma espera que se está evitando.
const STATUS_CHECK_PATTERN = /\b(c[oó]mo (vas|va|est[aá]|estamos)|avance|progreso|status|estado|novedades?|qu[eé] (ha pasado|pas[oó])|ya (termin|acab|qued[oó])|terminaste|listo\??)\b/i;

// Un mensaje de un chat no autorizado se registra (para que el operador pueda ver el chat_id real
// y sumarlo a TELEGRAM_ALLOWED_CHAT_IDS) pero nunca se responde — no confirma que el bot exista ni
// que algo esté escuchando, igual que cualquier recurso fuera de ámbito en el resto del proyecto.
//
// El bucle de getUpdates nunca espera a que un expediente pesado (una o varias llamadas reales de
// IA encadenadas, uno o dos minutos) termine antes de seguir leyendo mensajes nuevos — si no, el
// bot se queda "tildado" para cualquier otra cosa (otra pregunta, un chequeo de estado, un mensaje
// sin relación) mientras tanto. Por chat: un chequeo de estado siempre contesta al instante (solo
// lee, nunca dispara IA); arrancar o continuar un expediente contesta con un acuse al instante y
// sigue en segundo plano (sin await en el bucle principal), avisando con un segundo mensaje cuando
// de verdad termine; y si ya hay algo en curso para ese chat, un mensaje nuevo que no sea chequeo
// de estado se avisa como tal y se encola — nunca se descarta en silencio: la cola es FIFO y por
// chat, se vacía sola, un mensaje a la vez, cuando el anterior termina.
export function startTelegramBridge(office: OfficeRuntime, config: TelegramConfig): void {
  const chatOrders = new Map<number, string>();
  const inFlight = new Set<number>();
  const queues = new Map<number, string[]>();
  let offset = 0;

  const processInBackground = (chatId: number, text: string): void => {
    inFlight.add(chatId);
    (async () => {
      const existingOrderId = chatOrders.get(chatId);
      let detail;
      try {
        if (!existingOrderId) throw new Error('sin expediente previo en memoria');
        detail = await office.answerAsService(telegramBridge, config.scope, existingOrderId, { answer: text });
      } catch {
        // Sin expediente previo, o sin pregunta pendiente que responder (RuntimeError 409):
        // en ambos casos el mensaje arranca un expediente nuevo, nunca se descarta en silencio.
        detail = await office.startAsService(telegramBridge, config.scope, text);
      }
      chatOrders.set(chatId, detail.id);
      return detail;
    })()
      .then((detail) => callTelegram(config.botToken, 'sendMessage', { chat_id: chatId, text: summarizeOrder(detail) }, 15000))
      .catch((error) => {
        process.stderr.write(`Telegram: fallo procesando mensaje del chat ${chatId}: ${error instanceof Error ? error.message : error}\n`);
        return callTelegram(config.botToken, 'sendMessage', { chat_id: chatId, text: '⚠️ Algo falló procesando tu mensaje; un humano debería revisar los logs.' }, 15000).catch(() => {});
      })
      .finally(() => {
        inFlight.delete(chatId);
        // Si se encoló algo mientras esto corría, sigue con lo próximo de la fila — un mensaje a
        // la vez por chat, pero nada queda esperando a que el usuario lo vuelva a mandar.
        const queue = queues.get(chatId);
        const next = queue?.shift();
        if (!next) return;
        if (!queue!.length) queues.delete(chatId);
        callTelegram(config.botToken, 'sendMessage', { chat_id: chatId, text: '👍 Ahora sigo con lo que tenías en cola.' }, 15000).catch(() => {});
        processInBackground(chatId, next);
      });
  };

  (async () => {
    try {
      const me = await callTelegram(config.botToken, 'getMe', {}, 10000) as { username?: string };
      process.stderr.write(`Telegram: conectado como @${me.username ?? '(desconocido)'}\n`);
    } catch (error) {
      process.stderr.write(`Telegram: token inválido o sin red, el puente no arranca: ${error instanceof Error ? error.message : error}\n`);
      return;
    }
    for (;;) {
      let updates: TelegramUpdate[];
      try {
        updates = await callTelegram(config.botToken, 'getUpdates', { offset, timeout: 30 }, 35000) as TelegramUpdate[];
      } catch (error) {
        process.stderr.write(`Telegram: fallo consultando actualizaciones, reintenta en 5s: ${error instanceof Error ? error.message : error}\n`);
        await new Promise((resolve) => setTimeout(resolve, 5000));
        continue;
      }
      for (const update of updates) {
        offset = update.update_id + 1;
        const chatId = update.message?.chat.id;
        const text = update.message?.text?.trim();
        if (!chatId || !text) continue;
        if (!config.allowedChatIds.has(String(chatId))) {
          process.stderr.write(`Telegram: mensaje de chat no autorizado ${chatId} (@${update.message?.from?.username ?? '?'}), ignorado\n`);
          continue;
        }
        const existingOrderId = chatOrders.get(chatId);
        if (STATUS_CHECK_PATTERN.test(text) && existingOrderId) {
          office.getAsService(telegramBridge, config.scope, existingOrderId)
            .then((detail) => callTelegram(config.botToken, 'sendMessage', { chat_id: chatId, text: summarizeOrder(detail) }, 15000))
            .catch((error) => process.stderr.write(`Telegram: fallo consultando estado del chat ${chatId}: ${error instanceof Error ? error.message : error}\n`));
          continue;
        }
        if (inFlight.has(chatId)) {
          const queue = queues.get(chatId) ?? [];
          queue.push(text);
          queues.set(chatId, queue);
          callTelegram(config.botToken, 'sendMessage', { chat_id: chatId,
            text: `⏳ Sigo trabajando en lo anterior — lo agrego a tu cola (posición ${queue.length}). `
              + 'Si quieres ver el avance mientras tanto, pregúntame "¿cómo vas?".' }, 15000)
            .catch(() => {});
          continue;
        }
        callTelegram(config.botToken, 'sendMessage', { chat_id: chatId, text: '👍 Recibido, lo estoy procesando — puede tardar uno o dos minutos. Te aviso en cuanto tenga algo.' }, 15000)
          .catch(() => {});
        processInBackground(chatId, text);
      }
    }
  })();
}
