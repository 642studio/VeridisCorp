import type { OrganizationResponse, RunDetailResponse, RunsListResponse, RunStatus } from './types';

const TOKEN_KEY = 'veridis_runtime_token';
const BASE = import.meta.env.VITE_RUNTIME_API_BASE ?? '/api';

export function getToken(): string | null {
  try { return sessionStorage.getItem(TOKEN_KEY); } catch { return null; }
}
export function setToken(token: string): void {
  try { sessionStorage.setItem(TOKEN_KEY, token); } catch { /* almacenamiento no disponible en este navegador */ }
}
export function clearToken(): void {
  try { sessionStorage.removeItem(TOKEN_KEY); } catch { /* nada que limpiar */ }
}

export class ApiError extends Error {
  constructor(public readonly status: number, message: string) { super(message); }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const response = await fetch(BASE + path, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 401) clearToken();
    throw new ApiError(response.status, (body && typeof body.error === 'string' && body.error) || 'Error inesperado del servidor');
  }
  return body as T;
}

export const api = {
  listRuns(params: { status?: RunStatus[]; limit?: number; cursor?: string } = {}) {
    const query = new URLSearchParams();
    if (params.status?.length) query.set('status', params.status.join(','));
    query.set('limit', String(params.limit ?? 20));
    if (params.cursor) query.set('cursor', params.cursor);
    return request<RunsListResponse>(`/runs?${query.toString()}`);
  },
  getRun(id: string) {
    return request<RunDetailResponse>(`/runs/${id}`);
  },
  advance(id: string) {
    return request<RunDetailResponse>(`/runs/${id}/advance`, { method: 'POST', body: '{}' });
  },
  revise(id: string, text: string) {
    return request<RunDetailResponse>(`/runs/${id}/revise`, { method: 'POST', body: JSON.stringify({ text }) });
  },
  approve(id: string, version: number, decision: 'approved' | 'rejected', reason: string) {
    return request<RunDetailResponse>(`/runs/${id}/approve`, { method: 'POST', body: JSON.stringify({ version, decision, reason }) });
  },
  execute(id: string) {
    return request<RunDetailResponse>(`/runs/${id}/execute`, { method: 'POST', body: '{}' });
  },
  reconcile(id: string) {
    return request<RunDetailResponse>(`/runs/${id}/reconcile`, { method: 'POST', body: '{}' });
  },
  getOrganization() {
    return request<OrganizationResponse>('/organization');
  },
};
