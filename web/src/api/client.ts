import type {
  HealthResponse,
  DashboardSnapshot,
  AgentSnapshot,
  SubmitTaskRequest,
  SubmitTaskResponse,
  SSEClientsResponse,
} from '../types/api';

const BASE = '/api';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  getHealth: () => request<HealthResponse>('/health'),

  getSnapshot: () => request<DashboardSnapshot>('/snapshot'),

  getAgents: () =>
    request<{ agents: AgentSnapshot[] }>('/agents').then((r) => r.agents),

  getAgent: (id: string) => request<AgentSnapshot>(`/agents/${id}`),

  submitTask: (task: SubmitTaskRequest) =>
    request<SubmitTaskResponse>('/tasks', {
      method: 'POST',
      body: JSON.stringify(task),
    }),

  getSSEClients: () => request<SSEClientsResponse>('/sse/clients'),
};
