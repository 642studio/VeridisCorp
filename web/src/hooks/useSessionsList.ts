import { useMemo } from 'react';
import { useAssistantThreads, useOfficeOrders } from '../api/hooks';
import { ORDER_STATUS, type SessionTone } from '../officeStatus';
import { useActiveSession } from '../context/ActiveSessionContext';
import type { OfficeOrderSummary } from '../api/types';

export type SessionKind = 'thread' | 'order';

export interface SessionItem {
  kind: SessionKind;
  id: string;
  title: string;
  at: string;
  tone: SessionTone;
  label: string;
  order?: OfficeOrderSummary;
}

// Misma mezcla que antes vivía solo dentro de OfficeChat.tsx (hilos rápidos + expedientes de
// oficina, ordenados por fecha), ahora disponible para el sidebar global. El estado de "pensando"
// (pendingAnswerIds/startingObjectives/pendingQuestions) viene de ActiveSessionContext — es el
// mismo estado que OfficeChat.tsx actualiza al enviar una pregunta o abrir un encargo.
export function useSessionsList() {
  const threadsQuery = useAssistantThreads();
  const ordersQuery = useOfficeOrders();
  const { focusedKind, focusedId, pendingAnswerIds, startingObjectives, pendingQuestions } = useActiveSession();
  const openThreadId = focusedKind === 'thread' ? focusedId : null;

  const items = useMemo<SessionItem[]>(() => {
    const threadItems: SessionItem[] = (threadsQuery.data?.threads ?? [])
      .filter((t) => !t.onlyHandoffs || t.threadId === openThreadId)
      .map((t) => {
        const thinking = pendingQuestions[t.threadId] !== undefined;
        return {
          kind: 'thread', id: t.threadId, title: t.title, at: t.updatedAt,
          tone: thinking ? 'progress' : 'neutral', label: thinking ? 'pensando' : 'chat',
        };
      });

    const orderItems: SessionItem[] = (ordersQuery.data?.orders ?? []).map((o) => {
      const thinking = pendingAnswerIds.has(o.id) || startingObjectives.has(o.objective);
      const status = thinking ? { label: 'pensando', tone: 'progress' as const } : ORDER_STATUS[o.status];
      return { kind: 'order', id: o.id, title: o.objective, at: o.updated_at, tone: status.tone, label: status.label, order: o };
    });

    const items = [...threadItems, ...orderItems];
    // La conversación que todavía no tiene hilo (primer mensaje en vuelo) no tiene id real —
    // mismo "new" que usaba el sidebar local de OfficeChat.tsx.
    if (pendingQuestions.new !== undefined) {
      items.push({
        kind: 'thread', id: 'new', title: pendingQuestions.new, at: new Date().toISOString(),
        tone: 'progress', label: 'pensando',
      });
    }
    return items.sort((a, b) => b.at.localeCompare(a.at));
  }, [threadsQuery.data, ordersQuery.data, openThreadId, pendingAnswerIds, startingObjectives, pendingQuestions]);

  return {
    items,
    threadsQuery,
    ordersQuery,
    isLoading: threadsQuery.isLoading || ordersQuery.isLoading,
  };
}
