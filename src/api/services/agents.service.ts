/**
 * Agents API Service
 *
 * Service layer for Agents API operations - simplified for API usage
 */

import { AgentType, AgentStatus } from '../../core/interfaces/agent.interface.js';
import { createLogger, ILogger } from '../../core/services/logger.js';

export interface AgentInfo {
  id: string;
  type: AgentType;
  name: string;
  status: AgentStatus;
  version: string;
  description?: string;
  config: Record<string, unknown>;
  capabilities: unknown[];
  metrics: AgentMetrics;
  health: AgentHealthInfo;
  currentTask: string | null;
  queuedTasks: number;
  createdAt: string;
  lastActiveAt: string | null;
}

export interface AgentMetrics {
  tasksProcessed: number;
  tasksFailed: number;
  averageTaskDuration: number;
  totalTokensUsed: number;
  uptime: number;
  lastActiveAt: Date | null;
  errorRate: number;
}

export interface AgentHealthInfo {
  healthy: boolean;
  status: AgentStatus;
  uptime: number;
  lastCheck: Date;
  issues?: string[];
}

export interface ListAgentsOptions {
  type?: AgentType;
  status?: AgentStatus;
  name?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface ListAgentsResult {
  agents: AgentInfo[];
  total: number;
  page: number;
  limit: number;
}

export interface CreateAgentData {
  type: AgentType;
  name: string;
  description?: string;
  llm?: {
    provider: 'claude' | 'openai' | 'gemini';
    model: string;
    temperature?: number;
    maxTokens?: number;
    systemPrompt?: string;
  };
  maxConcurrentTasks?: number;
  taskTimeout?: number;
  retryAttempts?: number;
  capabilities?: unknown[];
  metadata?: Record<string, unknown>;
}

export interface TaskSubmission {
  type: string;
  payload: Record<string, unknown>;
  priority?: number;
  timeout?: number;
  metadata?: {
    requestId?: string;
    parentTaskId?: string;
    tags?: string[];
  };
}

export interface TaskInfo {
  taskId: string;
  agentId: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  position?: number;
  estimatedWaitTime?: number;
  result?: unknown;
  error?: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

/**
 * Agents Service
 *
 * Provides API-friendly operations for agent management
 */
export class AgentsService {
  private readonly logger: ILogger;
  private readonly agents: Map<string, {
    info: AgentInfo;
    tasks: Map<string, TaskInfo>;
  }>;
  private readonly startTimes: Map<string, Date>;

  constructor() {
    this.logger = createLogger('AgentsService');
    this.agents = new Map();
    this.startTimes = new Map();
  }

  /**
   * List agents with filtering and pagination
   */
  async listAgents(options: ListAgentsOptions = {}): Promise<ListAgentsResult> {
    const { type, status, name, page = 1, limit = 20, sortBy, sortOrder = 'desc' } = options;

    let agents = Array.from(this.agents.values()).map((d) => d.info);

    // Filter by type
    if (type) {
      agents = agents.filter((a) => a.type === type);
    }

    // Filter by status
    if (status) {
      agents = agents.filter((a) => a.status === status);
    }

    // Filter by name
    if (name) {
      const nameLower = name.toLowerCase();
      agents = agents.filter((a) => a.name.toLowerCase().includes(nameLower));
    }

    // Sort
    if (sortBy) {
      agents.sort((a, b) => {
        const aVal = (a as unknown as Record<string, unknown>)[sortBy];
        const bVal = (b as unknown as Record<string, unknown>)[sortBy];
        if (aVal === bVal) return 0;
        const cmp = aVal! > bVal! ? 1 : -1;
        return sortOrder === 'asc' ? cmp : -cmp;
      });
    }

    const total = agents.length;
    const offset = (page - 1) * limit;
    const paginatedAgents = agents.slice(offset, offset + limit);

    return {
      agents: paginatedAgents,
      total,
      page,
      limit,
    };
  }

  /**
   * Get agent by ID
   */
  async getAgent(agentId: string): Promise<AgentInfo | null> {
    const data = this.agents.get(agentId);
    if (data) {
      return data.info;
    }
    return null;
  }

  /**
   * Create a new agent
   */
  async createAgent(data: CreateAgentData): Promise<AgentInfo> {
    const id = crypto.randomUUID();
    const now = new Date();

    const info: AgentInfo = {
      id,
      type: data.type,
      name: data.name,
      status: AgentStatus.INITIALIZING,
      version: '1.0.0',
      description: data.description,
      config: {
        type: data.type,
        name: data.name,
        llm: data.llm,
        maxConcurrentTasks: data.maxConcurrentTasks || 1,
        taskTimeout: data.taskTimeout || 60000,
        retryAttempts: data.retryAttempts || 3,
      },
      capabilities: data.capabilities || [],
      metrics: {
        tasksProcessed: 0,
        tasksFailed: 0,
        averageTaskDuration: 0,
        totalTokensUsed: 0,
        uptime: 0,
        lastActiveAt: null,
        errorRate: 0,
      },
      health: {
        healthy: true,
        status: AgentStatus.INITIALIZING,
        uptime: 0,
        lastCheck: now,
      },
      currentTask: null,
      queuedTasks: 0,
      createdAt: now.toISOString(),
      lastActiveAt: null,
    };

    this.agents.set(id, { info, tasks: new Map() });
    this.startTimes.set(id, now);

    // Transition to IDLE status
    setTimeout(() => {
      const agentData = this.agents.get(id);
      if (agentData && agentData.info.status === AgentStatus.INITIALIZING) {
        agentData.info.status = AgentStatus.IDLE;
        agentData.info.health.status = AgentStatus.IDLE;
      }
    }, 100);

    this.logger.info('Agent created', { id, type: data.type, name: data.name });

    return info;
  }

  /**
   * Update agent configuration
   */
  async updateAgent(
    agentId: string,
    updates: Partial<{
      name: string;
      description: string;
      llm: Record<string, unknown>;
      maxConcurrentTasks: number;
      taskTimeout: number;
      retryAttempts: number;
      metadata: Record<string, unknown>;
    }>
  ): Promise<AgentInfo | null> {
    const data = this.agents.get(agentId);
    if (!data) {
      return null;
    }

    if (updates.name) {
      data.info.name = updates.name;
    }
    if (updates.description) {
      data.info.description = updates.description;
    }
    if (updates.llm && data.info.config.llm) {
      Object.assign(data.info.config.llm as object, updates.llm);
    }
    if (updates.maxConcurrentTasks !== undefined) {
      data.info.config.maxConcurrentTasks = updates.maxConcurrentTasks;
    }
    if (updates.taskTimeout !== undefined) {
      data.info.config.taskTimeout = updates.taskTimeout;
    }
    if (updates.retryAttempts !== undefined) {
      data.info.config.retryAttempts = updates.retryAttempts;
    }

    this.logger.info('Agent updated', { agentId, updates: Object.keys(updates) });

    return data.info;
  }

  /**
   * Delete an agent
   */
  async deleteAgent(agentId: string): Promise<boolean> {
    if (!this.agents.has(agentId)) {
      return false;
    }

    this.agents.delete(agentId);
    this.startTimes.delete(agentId);

    this.logger.info('Agent deleted', { agentId });

    return true;
  }

  /**
   * Start an agent
   */
  async startAgent(agentId: string): Promise<AgentInfo | null> {
    const data = this.agents.get(agentId);
    if (!data) {
      return null;
    }

    if (data.info.status === AgentStatus.PROCESSING) {
      return data.info;
    }

    data.info.status = AgentStatus.PROCESSING;
    data.info.health.status = AgentStatus.PROCESSING;
    data.info.health.healthy = true;
    this.startTimes.set(agentId, new Date());

    this.logger.info('Agent started', { agentId });

    return data.info;
  }

  /**
   * Stop an agent
   */
  async stopAgent(agentId: string): Promise<AgentInfo | null> {
    const data = this.agents.get(agentId);
    if (!data) {
      return null;
    }

    data.info.status = AgentStatus.STOPPED;
    data.info.health.status = AgentStatus.STOPPED;
    this.updateUptime(agentId);

    this.logger.info('Agent stopped', { agentId });

    return data.info;
  }

  /**
   * Pause an agent
   */
  async pauseAgent(agentId: string): Promise<AgentInfo | null> {
    const data = this.agents.get(agentId);
    if (!data) {
      return null;
    }

    data.info.status = AgentStatus.PAUSED;
    data.info.health.status = AgentStatus.PAUSED;

    this.logger.info('Agent paused', { agentId });

    return data.info;
  }

  /**
   * Resume an agent
   */
  async resumeAgent(agentId: string): Promise<AgentInfo | null> {
    const data = this.agents.get(agentId);
    if (!data) {
      return null;
    }

    if (data.info.status !== AgentStatus.PAUSED) {
      return data.info;
    }

    data.info.status = AgentStatus.PROCESSING;
    data.info.health.status = AgentStatus.PROCESSING;

    this.logger.info('Agent resumed', { agentId });

    return data.info;
  }

  /**
   * Get agent health
   */
  async getAgentHealth(agentId: string): Promise<AgentHealthInfo | null> {
    const data = this.agents.get(agentId);
    if (!data) {
      return null;
    }

    this.updateUptime(agentId);
    data.info.health.lastCheck = new Date();

    return data.info.health;
  }

  /**
   * Get agent capabilities
   */
  async getAgentCapabilities(agentId: string): Promise<unknown[] | null> {
    const data = this.agents.get(agentId);
    if (!data) {
      return null;
    }

    return data.info.capabilities;
  }

  /**
   * Submit task to agent
   */
  async submitTask(agentId: string, task: TaskSubmission): Promise<TaskInfo | null> {
    const data = this.agents.get(agentId);
    if (!data) {
      return null;
    }

    const taskId = crypto.randomUUID();
    const now = new Date();

    const taskInfo: TaskInfo = {
      taskId,
      agentId,
      status: 'queued',
      position: data.tasks.size + 1,
      estimatedWaitTime: data.tasks.size * 5000,
      createdAt: now,
    };

    data.tasks.set(taskId, taskInfo);
    data.info.queuedTasks = data.tasks.size;

    this.logger.info('Task submitted', { agentId, taskId, type: task.type });

    // Simulate task processing
    setTimeout(() => {
      const taskData = data.tasks.get(taskId);
      if (taskData && taskData.status === 'queued') {
        taskData.status = 'running';
        taskData.startedAt = new Date();
        data.info.currentTask = taskId;

        // Complete after some time
        setTimeout(() => {
          taskData.status = 'completed';
          taskData.completedAt = new Date();
          taskData.result = { success: true };
          data.info.currentTask = null;
          data.info.metrics.tasksProcessed++;
          data.info.lastActiveAt = new Date().toISOString();
        }, 1000);
      }
    }, 500);

    return taskInfo;
  }

  /**
   * Get task status
   */
  async getTaskStatus(agentId: string, taskId: string): Promise<TaskInfo | null> {
    const data = this.agents.get(agentId);
    if (!data) {
      return null;
    }

    return data.tasks.get(taskId) || null;
  }

  /**
   * Update uptime for an agent
   */
  private updateUptime(agentId: string): void {
    const data = this.agents.get(agentId);
    const startTime = this.startTimes.get(agentId);
    if (data && startTime) {
      data.info.metrics.uptime = Date.now() - startTime.getTime();
      data.info.health.uptime = data.info.metrics.uptime;
    }
  }
}

/**
 * Create agents service instance
 */
export function createAgentsService(): AgentsService {
  return new AgentsService();
}
