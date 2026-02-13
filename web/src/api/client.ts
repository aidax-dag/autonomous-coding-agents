import type {
  HealthResponse,
  DashboardSnapshot,
  AgentSnapshot,
  SubmitTaskRequest,
  SubmitTaskResponse,
  SSEClientsResponse,
} from '../types/api';

const BASE = '/api';
const TOKEN_KEY = 'aca_tokens';

function getAccessToken(): string | null {
  try {
    const raw = localStorage.getItem(TOKEN_KEY);
    if (!raw) return null;
    return (JSON.parse(raw) as { accessToken?: string }).accessToken ?? null;
  } catch {
    return null;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getAccessToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init?.headers as Record<string, string>),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE}${path}`, { ...init, headers });

  if (res.status === 401) {
    // Token expired or invalid — clear stored tokens and redirect to login
    localStorage.removeItem(TOKEN_KEY);
    window.location.href = '/login';
    throw new Error('Session expired');
  }

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
