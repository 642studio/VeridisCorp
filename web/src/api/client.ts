import type {
  AgentDetail, FireScheduleResponse, OfficeOrderDetail, OfficeOrdersListResponse, OfficeSchedule,
  OfficeSchedulesListResponse, OrganizationResponse, RunDetailResponse, RunsListResponse, RunStatus,
} from './types';

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

// Una sola vez: si varias peticiones en vuelo reciben 401 a la vez, solo la primera dispara
// la recarga (igual que [CAMBIAR_TOKEN]), evitando varios reload() superpuestos.
let sessionExpiredHandled = false;

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
    if (response.status === 401) {
      clearToken();
      if (!sessionExpiredHandled) { sessionExpiredHandled = true; window.location.reload(); }
    }
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
  approve(id: string, version: number, decision: 'approved' | 'rejected', reason: string | undefined) {
    return request<RunDetailResponse>(`/runs/${id}/approve`, { method: 'POST', body: JSON.stringify({ version, decision, reason }) });
  },
  execute(id: string) {
    return request<RunDetailResponse>(`/runs/${id}/execute`, { method: 'POST', body: '{}' });
  },
  reconcile(id: string) {
    return request<RunDetailResponse>(`/runs/${id}/reconcile`, { method: 'POST', body: '{}' });
  },
  regenerate(id: string) {
    return request<RunDetailResponse>(`/runs/${id}/regenerate`, { method: 'POST', body: '{}' });
  },
  getOrganization() {
    return request<OrganizationResponse>('/organization');
  },
  getAgent(id: string) {
    return request<AgentDetail>(`/agents/${encodeURIComponent(id)}`);
  },
  startOfficeOrder(objective: string) {
    return request<OfficeOrderDetail>('/office/orders', { method: 'POST', body: JSON.stringify({ objective }) });
  },
  listOfficeOrders() {
    return request<OfficeOrdersListResponse>('/office/orders');
  },
  getOfficeOrder(id: string) {
    return request<OfficeOrderDetail>(`/office/orders/${id}`);
  },
  advanceOfficeOrder(id: string) {
    return request<OfficeOrderDetail>(`/office/orders/${id}/advance`, { method: 'POST', body: '{}' });
  },
  answerOfficeOrder(id: string, answer: string) {
    return request<OfficeOrderDetail>(`/office/orders/${id}/answer`, { method: 'POST', body: JSON.stringify({ answer }) });
  },
  listSchedules() {
    return request<OfficeSchedulesListResponse>('/office/schedules');
  },
  getSchedule(id: string) {
    return request<OfficeSchedule>(`/office/schedules/${id}`);
  },
  createSchedule(input: { name: string; objective: string; cronExpression: string; timezone: string }) {
    return request<OfficeSchedule>('/office/schedules', { method: 'POST', body: JSON.stringify(input) });
  },
  updateSchedule(id: string, input: Partial<{ name: string; objective: string; cronExpression: string; timezone: string; enabled: boolean }>) {
    return request<OfficeSchedule>(`/office/schedules/${id}/update`, { method: 'POST', body: JSON.stringify(input) });
  },
  deleteSchedule(id: string) {
    return request<{ id: string }>(`/office/schedules/${id}/delete`, { method: 'POST', body: '{}' });
  },
  fireSchedule(id: string) {
    return request<FireScheduleResponse>(`/office/schedules/${id}/fire`, { method: 'POST', body: '{}' });
  },
};
