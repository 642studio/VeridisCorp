import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './client';
import type { RunDetailResponse, RunStatus } from './types';

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
  useRunAction((id: string, version: number, decision: 'approved' | 'rejected', reason: string) => api.approve(id, version, decision, reason));
export const useExecute = () => useRunAction((id: string) => api.execute(id));
export const useReconcile = () => useRunAction((id: string) => api.reconcile(id));
