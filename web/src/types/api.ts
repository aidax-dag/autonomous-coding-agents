export interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  health: number;
}

export interface AgentSnapshot {
  agentId: string;
  teamType: string;
  status: 'idle' | 'busy' | 'error';
  currentTask?: string;
  tasksCompleted: number;
  tasksFailed: number;
  uptime: number;
}

export interface DashboardSnapshot {
  systemHealth: number;
  agents: AgentSnapshot[];
  activeWorkflows: number;
  totalTasksCompleted: number;
  totalTasksFailed: number;
  uptime: number;
  timestamp: string;
}

export interface SubmitTaskRequest {
  name: string;
  description: string;
}

export interface SubmitTaskResponse {
  taskId: string;
  status: 'accepted';
}

export interface SSEClientsResponse {
  clients: number;
}
