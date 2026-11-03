import type {
  AgentDetail, AgentTextField, AssistantMessage, ElevenLabsVoice, McpConnection, McpCredentialInput, AssistantThreadSummary, CorporateMemoryRecord, FireScheduleResponse, MemoryGraph, MemoryListResponse, MemoryStatus,
  ModelPolicyResponse, ModelStage, OfficeOrderDetail, OfficeOrdersListResponse, OfficeSchedule,
  OfficeSchedulesListResponse, OrganizationResponse, RunDetailResponse, RunsListResponse, RunStatus, SettingsSummary, UsageSummary,
} from './types';

const TOKEN_KEY = 'veridis_runtime_token';
const BASE = import.meta.env.VITE_RUNTIME_API_BASE ?? '/api';

export function getToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}
export function setToken(token: string): void {
  try { localStorage.setItem(TOKEN_KEY, token); } catch { /* almacenamiento no disponible en este navegador */ }
}
export function clearToken(): void {
  try { localStorage.removeItem(TOKEN_KEY); } catch { /* nada que limpiar */ }
}

export class ApiError extends Error {
  constructor(public readonly status: number, message: string) { super(message); }
}

// Única llamada sin Bearer (ver /auth/login en http.ts): intercambia el código de la app de
// autenticación por una sesión real y la guarda, igual que si se hubiera pegado el token a mano.
export async function loginWithTotp(principalId: string, code: string): Promise<void> {
  const response = await fetch(BASE + '/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ principalId, code }),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(response.status, (data && typeof data.error === 'string' && data.error) || 'Error inesperado del servidor');
  }
  setToken((data as { token: string }).token);
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
  updateAgentText(id: string, field: AgentTextField, text: string) {
    return request<AgentDetail>(`/agents/${encodeURIComponent(id)}/text`, { method: 'POST', body: JSON.stringify({ field, text }) });
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
  getUsage() {
    return request<UsageSummary>('/office/usage');
  },
  getSettings() {
    return request<SettingsSummary>('/office/settings');
  },
  setElevenLabsVoice(voiceId: string) {
    return request<{ voiceId: string }>('/office/settings/elevenlabs-voice', { method: 'POST', body: JSON.stringify({ voiceId }) });
  },
  getModelPolicy() {
    return request<ModelPolicyResponse>('/office/settings/models');
  },
  setAgentModelProfile(agentId: string, stage: ModelStage, profileId: string | null) {
    return request<{ agentId: string; stage: ModelStage; profileId: string | null }>(
      '/office/settings/models/agent', { method: 'POST', body: JSON.stringify({ agentId, stage, profileId }) });
  },
  listElevenLabsVoices() {
    return request<{ voices: ElevenLabsVoice[] }>('/tts/elevenlabs/voices');
  },
  listConnections() {
    return request<{ connections: McpConnection[] }>('/office/connections');
  },
  addConnection(input: { name: string; url: string | null; purpose: string; credential: McpCredentialInput | null }) {
    return request<McpConnection>('/office/connections', { method: 'POST', body: JSON.stringify(input) });
  },
  refreshConnection(id: string) {
    return request<McpConnection>(`/office/connections/${id}/refresh`, { method: 'POST', body: '{}' });
  },
  setConnectionCredential(id: string, credential: McpCredentialInput | null) {
    return request<McpConnection>(`/office/connections/${id}/credential`, { method: 'POST', body: JSON.stringify({ credential }) });
  },
  setConnectionTools(id: string, change: { enabled?: Record<string, boolean>; access?: Record<string, 'read' | 'write'> }) {
    return request<McpConnection>(`/office/connections/${id}/tools`, { method: 'POST', body: JSON.stringify(change) });
  },
  confirmConnection(id: string) {
    return request<McpConnection>(`/office/connections/${id}/confirm`, { method: 'POST', body: '{}' });
  },
  removeConnection(id: string) {
    return request<McpConnection>(`/office/connections/${id}/remove`, { method: 'POST', body: '{}' });
  },
  fireSchedule(id: string) {
    return request<FireScheduleResponse>(`/office/schedules/${id}/fire`, { method: 'POST', body: '{}' });
  },
  listMemory(status: MemoryStatus) {
    return request<MemoryListResponse>(`/office/memory?status=${status}`);
  },
  memoryGraph() {
    return request<MemoryGraph>('/office/memory/graph');
  },
  planMemoryImport(title: string, text: string) {
    return request<{ title: string; sections: { section: string; text: string }[] }>('/office/memory/import/plan', { method: 'POST', body: JSON.stringify({ title, text }) });
  },
  askAssistant(question: string, threadId: string | null) {
    return request<AssistantMessage>('/office/assistant/ask', { method: 'POST', body: JSON.stringify(threadId ? { question, threadId } : { question }) });
  },
  listAssistantThreads() {
    return request<{ threads: AssistantThreadSummary[] }>('/office/assistant/threads');
  },
  getAssistantThread(threadId: string) {
    return request<{ threadId: string; messages: AssistantMessage[] }>(`/office/assistant/threads/${threadId}`);
  },
  importMemorySection(title: string, section: string, text: string, confirm = false) {
    return request<{ section: string; memories: CorporateMemoryRecord[]; inputTokens: number | null; outputTokens: number | null }>(
      '/office/memory/import/section', { method: 'POST', body: JSON.stringify({ title, section, text, confirm }) });
  },
  validateMemory(id: string) {
    return request<CorporateMemoryRecord>(`/office/memory/${id}/validate`, { method: 'POST', body: '{}' });
  },
  quarantineMemory(id: string, reason: string) {
    return request<CorporateMemoryRecord>(`/office/memory/${id}/quarantine`, { method: 'POST', body: JSON.stringify({ reason }) });
  },
  // La sesión usa token Bearer, no cookie — no puede ser un <a href> plano (el navegador no
  // mandaría la cabecera). Se pide el archivo con fetch autenticado y se dispara la descarga
  // del navegador con un URL de objeto temporal.
  async downloadOfficeFile(id: string, fallbackFilename: string): Promise<void> {
    const token = getToken();
    const response = await fetch(`${BASE}/office/files/${id}`, {
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });
    if (!response.ok) {
      const body = await response.json().catch(() => null) as { error?: string } | null;
      throw new ApiError(response.status, body?.error ?? 'No se pudo descargar el archivo');
    }
    const disposition = response.headers.get('content-disposition') ?? '';
    const filename = /filename="([^"]+)"/.exec(disposition)?.[1] ?? fallbackFilename;
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = filename;
    document.body.appendChild(anchor); anchor.click(); anchor.remove();
    URL.revokeObjectURL(url);
  },
};
