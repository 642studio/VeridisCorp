import { useMutation, useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './client';
import type { AssistantMessage, MemoryStatus, OfficeOrderDetail, OfficeSchedule, RunDetailResponse, RunStatus } from './types';

export function useRunsList(status?: RunStatus[]) {
  return useInfiniteQuery({
    queryKey: ['runs', status ?? []],
    queryFn: ({ pageParam }) => api.listRuns({ status, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    refetchInterval: 8000,
  });
}

export function useOrganization() {
  // Dato estático (archivos, no Postgres): no hace falta refetch periódico.
  return useQuery({ queryKey: ['organization'], queryFn: () => api.getOrganization(), staleTime: 5 * 60 * 1000 });
}

export function useAgent(id: string | null) {
  return useQuery({
    queryKey: ['agent', id],
    queryFn: () => api.getAgent(id!),
    enabled: id !== null,
    staleTime: 5 * 60 * 1000,
  });
}

export function useRun(id: string) {
  return useQuery({
    queryKey: ['run', id],
    queryFn: () => api.getRun(id),
    refetchInterval: 4000,
  });
}

function useRunAction<A extends unknown[]>(fn: (id: string, ...args: A) => Promise<RunDetailResponse>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, args }: { id: string; args: A }) => fn(id, ...args),
    onSuccess: (data, { id }) => {
      client.setQueryData(['run', id], data);
      void client.invalidateQueries({ queryKey: ['runs'] });
    },
  });
}

export const useAdvance = () => useRunAction((id: string) => api.advance(id));
export const useRevise = () => useRunAction((id: string, text: string) => api.revise(id, text));
export const useApprove = () =>
  useRunAction((id: string, version: number, decision: 'approved' | 'rejected', reason: string | undefined) => api.approve(id, version, decision, reason));
export const useExecute = () => useRunAction((id: string) => api.execute(id));
export const useReconcile = () => useRunAction((id: string) => api.reconcile(id));
export const useRegenerate = () => useRunAction((id: string) => api.regenerate(id));

export function useOfficeOrders() {
  return useQuery({ queryKey: ['office-orders'], queryFn: () => api.listOfficeOrders(), refetchInterval: 8000 });
}

export function useOfficeOrder(id: string | null) {
  return useQuery({
    queryKey: ['office-order', id],
    queryFn: () => api.getOfficeOrder(id!),
    enabled: id !== null,
  });
}

export function useAssistantThreads() {
  return useQuery({ queryKey: ['assistant', 'threads'], queryFn: () => api.listAssistantThreads(), staleTime: 30000 });
}

export function useAssistantThread(threadId: string | null) {
  return useQuery({
    queryKey: ['assistant', 'thread', threadId],
    queryFn: () => api.getAssistantThread(threadId!),
    enabled: threadId !== null,
    // Solo cambia cuando se pregunta aquí, y useAskAssistant ya agrega la respuesta a esta caché.
    staleTime: Infinity,
  });
}

// La respuesta se agrega al hilo en caché en el acto (sin esperar un refetch) para que se sienta inmediata.
export function useAskAssistant() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ question, threadId }: { question: string; threadId: string | null }) => api.askAssistant(question, threadId),
    onSuccess: (message) => {
      client.setQueryData<{ threadId: string; messages: AssistantMessage[] }>(['assistant', 'thread', message.threadId],
        (prev) => ({ threadId: message.threadId, messages: [...(prev?.messages ?? []), message] }));
      void client.invalidateQueries({ queryKey: ['assistant', 'threads'] });
      void client.invalidateQueries({ queryKey: ['memory'] });
    },
  });
}

export function useStartOfficeOrder() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (objective: string) => api.startOfficeOrder(objective),
    onSuccess: (data) => {
      client.setQueryData(['office-order', data.id], data);
      void client.invalidateQueries({ queryKey: ['office-orders'] });
    },
  });
}

function useOfficeOrderAction<A extends unknown[]>(fn: (id: string, ...args: A) => Promise<OfficeOrderDetail>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, args }: { id: string; args: A }) => fn(id, ...args),
    onSuccess: (data, { id }) => {
      client.setQueryData(['office-order', id], data);
      void client.invalidateQueries({ queryKey: ['office-orders'] });
    },
  });
}

export const useAdvanceOfficeOrder = () => useOfficeOrderAction((id: string) => api.advanceOfficeOrder(id));
export const useAnswerOfficeOrder = () => useOfficeOrderAction((id: string, answer: string) => api.answerOfficeOrder(id, answer));

export function useSchedules() {
  return useQuery({ queryKey: ['schedules'], queryFn: () => api.listSchedules(), refetchInterval: 15000 });
}

function useScheduleMutation<A extends unknown[], R>(fn: (...args: A) => Promise<R>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (args: A) => fn(...args),
    onSuccess: () => { void client.invalidateQueries({ queryKey: ['schedules'] }); },
  });
}

export const useCreateSchedule = () =>
  useScheduleMutation((input: { name: string; objective: string; cronExpression: string; timezone: string }) => api.createSchedule(input));
export const useUpdateSchedule = () =>
  useScheduleMutation((id: string, input: Partial<Pick<OfficeSchedule, 'name' | 'objective' | 'cronExpression' | 'timezone' | 'enabled'>>) => api.updateSchedule(id, input));
export const useDeleteSchedule = () => useScheduleMutation((id: string) => api.deleteSchedule(id));
export const useFireSchedule = () => useScheduleMutation((id: string) => api.fireSchedule(id));

export function useMemoryList(status: MemoryStatus) {
  return useQuery({ queryKey: ['memory', status], queryFn: () => api.listMemory(status), refetchInterval: 15000 });
}

// Bajo la misma raíz ['memory'] que la lista: confirmar o poner en cuarentena refresca también el mapa.
export function useMemoryGraph() {
  return useQuery({ queryKey: ['memory', 'graph'], queryFn: () => api.memoryGraph(), refetchInterval: 15000 });
}

export function useValidateMemory() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.validateMemory(id),
    onSuccess: () => { void client.invalidateQueries({ queryKey: ['memory'] }); },
  });
}

export function useQuarantineMemory() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => api.quarantineMemory(id, reason),
    onSuccess: () => { void client.invalidateQueries({ queryKey: ['memory'] }); },
  });
}
