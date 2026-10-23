import { useMutation, useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './client';
import type { OfficeOrderDetail, RunDetailResponse, RunStatus } from './types';

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
