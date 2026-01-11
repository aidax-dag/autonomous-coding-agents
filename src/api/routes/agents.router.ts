/**
 * Agents Router
 *
 * Feature: F4.1 - REST API Interface
 *
 * @module api/routes/agents
 */

import { FastifyReply } from 'fastify';
import { BaseRouter } from './base.router.js';
import type {
  TypedRequest,
  ApiResponse,
} from '../interfaces/api.interface.js';
import type {
  CreateAgentRequest,
  UpdateAgentRequest,
  SubmitTaskRequest,
  AgentListQuery,
  AgentIdParam,
  TaskIdParam,
  AgentDetail,
  AgentSummary,
  AgentTaskResponse,
} from '../interfaces/agent-api.interface.js';
import { NotFoundException } from '../middleware/error.middleware.js';
import { AgentType, AgentStatus, TaskPriority } from '../../core/interfaces/agent.interface.js';
import { AgentsService, createAgentsService } from '../services/agents.service.js';

/**
 * Agents API Router
 *
 * Handles all agent-related API endpoints
 */
export class AgentsRouter extends BaseRouter {
  readonly prefix = '/agents';
  private readonly service: AgentsService;

  constructor(service?: AgentsService) {
    super('AgentsRouter');
    this.service = service || createAgentsService();
    this.initializeRoutes();
  }

  /**
   * Initialize route definitions
   */
  private initializeRoutes(): void {
    this.routes = [
      // List agents
      {
        method: 'GET',
        path: '',
        handler: this.listAgents.bind(this),
        schema: {
          tags: ['Agents'],
          summary: 'List all agents',
          description: 'Get a paginated list of all registered agents',
          querystring: {
            type: 'object',
            properties: {
              page: { type: 'integer', minimum: 1, default: 1 },
              limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
              type: { type: 'string', enum: Object.values(AgentType) },
              status: { type: 'string', enum: Object.values(AgentStatus) },
              name: { type: 'string' },
              sortBy: { type: 'string' },
              sortOrder: { type: 'string', enum: ['asc', 'desc'] },
            },
          },
        },
      },

      // Create agent
      {
        method: 'POST',
        path: '',
        handler: this.createAgent.bind(this),
        schema: {
          tags: ['Agents'],
          summary: 'Create a new agent',
          description: 'Register a new agent with the specified configuration',
          body: {
            type: 'object',
            required: ['type', 'name', 'llm'],
            properties: {
              type: { type: 'string', enum: Object.values(AgentType) },
              name: { type: 'string', minLength: 1, maxLength: 100 },
              description: { type: 'string', maxLength: 500 },
              llm: {
                type: 'object',
                required: ['provider', 'model'],
                properties: {
                  provider: { type: 'string', enum: ['claude', 'openai', 'gemini'] },
                  model: { type: 'string' },
                  temperature: { type: 'number', minimum: 0, maximum: 2 },
                  maxTokens: { type: 'integer', minimum: 1 },
                  systemPrompt: { type: 'string' },
                },
              },
              maxConcurrentTasks: { type: 'integer', minimum: 1, default: 1 },
              taskTimeout: { type: 'integer', minimum: 1000, default: 60000 },
              retryAttempts: { type: 'integer', minimum: 0, default: 3 },
              capabilities: { type: 'array', items: { type: 'object' } },
              metadata: { type: 'object' },
            },
          },
        },
      },

      // Get agent by ID
      {
        method: 'GET',
        path: '/:agentId',
        handler: this.getAgent.bind(this),
        schema: {
          tags: ['Agents'],
          summary: 'Get agent by ID',
          description: 'Get detailed information about a specific agent',
          params: {
            type: 'object',
            required: ['agentId'],
            properties: {
              agentId: { type: 'string', format: 'uuid' },
            },
          },
        },
      },

      // Update agent
      {
        method: 'PATCH',
        path: '/:agentId',
        handler: this.updateAgent.bind(this),
        schema: {
          tags: ['Agents'],
          summary: 'Update agent',
          description: 'Update an existing agent configuration',
          params: {
            type: 'object',
            required: ['agentId'],
            properties: {
              agentId: { type: 'string', format: 'uuid' },
            },
          },
          body: {
            type: 'object',
            properties: {
              name: { type: 'string', minLength: 1, maxLength: 100 },
              description: { type: 'string', maxLength: 500 },
              llm: {
                type: 'object',
                properties: {
                  temperature: { type: 'number', minimum: 0, maximum: 2 },
                  maxTokens: { type: 'integer', minimum: 1 },
                  systemPrompt: { type: 'string' },
                },
              },
              maxConcurrentTasks: { type: 'integer', minimum: 1 },
              taskTimeout: { type: 'integer', minimum: 1000 },
              retryAttempts: { type: 'integer', minimum: 0 },
              metadata: { type: 'object' },
            },
          },
        },
      },

      // Delete agent
      {
        method: 'DELETE',
        path: '/:agentId',
        handler: this.deleteAgent.bind(this),
        schema: {
          tags: ['Agents'],
          summary: 'Delete agent',
          description: 'Unregister and delete an agent',
          params: {
            type: 'object',
            required: ['agentId'],
            properties: {
              agentId: { type: 'string', format: 'uuid' },
            },
          },
        },
      },

      // Start agent
      {
        method: 'POST',
        path: '/:agentId/start',
        handler: this.startAgent.bind(this),
        schema: {
          tags: ['Agents'],
          summary: 'Start agent',
          description: 'Start an agent to begin processing tasks',
          params: {
            type: 'object',
            required: ['agentId'],
            properties: {
              agentId: { type: 'string', format: 'uuid' },
            },
          },
        },
      },

      // Stop agent
      {
        method: 'POST',
        path: '/:agentId/stop',
        handler: this.stopAgent.bind(this),
        schema: {
          tags: ['Agents'],
          summary: 'Stop agent',
          description: 'Stop an agent gracefully',
          params: {
            type: 'object',
            required: ['agentId'],
            properties: {
              agentId: { type: 'string', format: 'uuid' },
            },
          },
        },
      },

      // Pause agent
      {
        method: 'POST',
        path: '/:agentId/pause',
        handler: this.pauseAgent.bind(this),
        schema: {
          tags: ['Agents'],
          summary: 'Pause agent',
          description: 'Pause an agent (stops accepting new tasks)',
          params: {
            type: 'object',
            required: ['agentId'],
            properties: {
              agentId: { type: 'string', format: 'uuid' },
            },
          },
        },
      },

      // Resume agent
      {
        method: 'POST',
        path: '/:agentId/resume',
        handler: this.resumeAgent.bind(this),
        schema: {
          tags: ['Agents'],
          summary: 'Resume agent',
          description: 'Resume a paused agent',
          params: {
            type: 'object',
            required: ['agentId'],
            properties: {
              agentId: { type: 'string', format: 'uuid' },
            },
          },
        },
      },

      // Submit task
      {
        method: 'POST',
        path: '/:agentId/tasks',
        handler: this.submitTask.bind(this),
        schema: {
          tags: ['Agents'],
          summary: 'Submit task to agent',
          description: 'Submit a new task for the agent to process',
          params: {
            type: 'object',
            required: ['agentId'],
            properties: {
              agentId: { type: 'string', format: 'uuid' },
            },
          },
          body: {
            type: 'object',
            required: ['type', 'payload'],
            properties: {
              type: { type: 'string' },
              payload: { type: 'object' },
              priority: { type: 'integer', enum: Object.values(TaskPriority).filter(v => typeof v === 'number') },
              timeout: { type: 'integer', minimum: 1000 },
              metadata: {
                type: 'object',
                properties: {
                  requestId: { type: 'string' },
                  parentTaskId: { type: 'string' },
                  tags: { type: 'array', items: { type: 'string' } },
                },
              },
            },
          },
        },
      },

      // Get agent health
      {
        method: 'GET',
        path: '/:agentId/health',
        handler: this.getAgentHealth.bind(this),
        schema: {
          tags: ['Agents'],
          summary: 'Get agent health',
          description: 'Get health status and metrics for an agent',
          params: {
            type: 'object',
            required: ['agentId'],
            properties: {
              agentId: { type: 'string', format: 'uuid' },
            },
          },
        },
      },

      // Get agent capabilities
      {
        method: 'GET',
        path: '/:agentId/capabilities',
        handler: this.getAgentCapabilities.bind(this),
        schema: {
          tags: ['Agents'],
          summary: 'Get agent capabilities',
          description: 'Get the list of capabilities for an agent',
          params: {
            type: 'object',
            required: ['agentId'],
            properties: {
              agentId: { type: 'string', format: 'uuid' },
            },
          },
        },
      },

      // Get task status
      {
        method: 'GET',
        path: '/:agentId/tasks/:taskId',
        handler: this.getTaskStatus.bind(this),
        schema: {
          tags: ['Agents'],
          summary: 'Get task status',
          description: 'Get the status of a submitted task',
          params: {
            type: 'object',
            required: ['agentId', 'taskId'],
            properties: {
              agentId: { type: 'string', format: 'uuid' },
              taskId: { type: 'string', format: 'uuid' },
            },
          },
        },
      },
    ];
  }

  // ==================== Route Handlers ====================

  /**
   * List agents
   */
  private async listAgents(
    request: TypedRequest<unknown, unknown, AgentListQuery>,
    _reply: FastifyReply
  ): Promise<ApiResponse<AgentSummary[]>> {
    const { page, limit } = this.parsePagination(request.query as Record<string, unknown>);
    const query = request.query || {};

    this.logger.info('Listing agents', { page, limit });

    const typeFilter = Array.isArray(query.type) ? query.type[0] : query.type;
    const statusFilter = Array.isArray(query.status) ? query.status[0] : query.status;

    const result = await this.service.listAgents({
      type: typeFilter,
      status: statusFilter,
      name: query.name,
      page,
      limit,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
    });

    const summaries: AgentSummary[] = result.agents.map((agent) => ({
      id: agent.id,
      type: agent.type,
      name: agent.name,
      status: agent.status,
      version: agent.version,
      tasksProcessed: agent.metrics.tasksProcessed,
      lastActiveAt: agent.lastActiveAt,
      createdAt: agent.createdAt,
    }));

    return this.listResponse(summaries, result.total, { page, limit }, request.id as string);
  }

  /**
   * Create agent
   */
  private async createAgent(
    request: TypedRequest<CreateAgentRequest, unknown, unknown>,
    reply: FastifyReply
  ): Promise<FastifyReply> {
    const body = request.body;

    this.logger.info('Creating agent', { type: body.type, name: body.name });

    const agentInfo = await this.service.createAgent({
      type: body.type,
      name: body.name,
      description: body.description,
      llm: body.llm,
      maxConcurrentTasks: body.maxConcurrentTasks,
      taskTimeout: body.taskTimeout,
      retryAttempts: body.retryAttempts,
      capabilities: body.capabilities,
      metadata: body.metadata,
    });

    const agent: AgentDetail = {
      id: agentInfo.id,
      type: agentInfo.type,
      name: agentInfo.name,
      status: agentInfo.status,
      version: agentInfo.version,
      description: agentInfo.description,
      tasksProcessed: agentInfo.metrics.tasksProcessed,
      lastActiveAt: agentInfo.lastActiveAt,
      createdAt: agentInfo.createdAt,
      config: agentInfo.config as Omit<import('../../core/interfaces/agent.interface.js').IAgentConfig, 'id'>,
      capabilities: agentInfo.capabilities as import('../../core/interfaces/agent.interface.js').AgentCapability[],
      metrics: agentInfo.metrics,
      health: agentInfo.health as import('../../core/interfaces/agent.interface.js').HealthStatus,
      currentTask: agentInfo.currentTask
        ? {
            id: agentInfo.currentTask,
            type: 'task',
            priority: 'medium' as unknown as TaskPriority,
            startedAt: new Date().toISOString(),
          }
        : null,
      queuedTasks: agentInfo.queuedTasks,
    };

    return this.created(agent, request.id as string, reply);
  }

  /**
   * Get agent by ID
   */
  private async getAgent(
    request: TypedRequest<unknown, AgentIdParam, unknown>,
    _reply: FastifyReply
  ): Promise<ApiResponse<AgentDetail>> {
    const { agentId } = request.params;

    this.logger.info('Getting agent', { agentId });

    const agentInfo = await this.service.getAgent(agentId);
    if (!agentInfo) {
      throw new NotFoundException('Agent', agentId);
    }

    const agent: AgentDetail = {
      id: agentInfo.id,
      type: agentInfo.type,
      name: agentInfo.name,
      status: agentInfo.status,
      version: agentInfo.version,
      description: agentInfo.description,
      tasksProcessed: agentInfo.metrics.tasksProcessed,
      lastActiveAt: agentInfo.lastActiveAt,
      createdAt: agentInfo.createdAt,
      config: agentInfo.config as Omit<import('../../core/interfaces/agent.interface.js').IAgentConfig, 'id'>,
      capabilities: agentInfo.capabilities as import('../../core/interfaces/agent.interface.js').AgentCapability[],
      metrics: agentInfo.metrics,
      health: agentInfo.health as import('../../core/interfaces/agent.interface.js').HealthStatus,
      currentTask: agentInfo.currentTask
        ? {
            id: agentInfo.currentTask,
            type: 'task',
            priority: 'medium' as unknown as TaskPriority,
            startedAt: new Date().toISOString(),
          }
        : null,
      queuedTasks: agentInfo.queuedTasks,
    };

    return this.success(agent, request.id as string);
  }

  /**
   * Update agent
   */
  private async updateAgent(
    request: TypedRequest<UpdateAgentRequest, AgentIdParam, unknown>,
    _reply: FastifyReply
  ): Promise<ApiResponse<AgentDetail>> {
    const { agentId } = request.params;
    const updates = request.body;

    this.logger.info('Updating agent', { agentId, updates: Object.keys(updates) });

    const agentInfo = await this.service.updateAgent(agentId, {
      name: updates.name,
      description: updates.description,
      llm: updates.llm,
      maxConcurrentTasks: updates.maxConcurrentTasks,
      taskTimeout: updates.taskTimeout,
      retryAttempts: updates.retryAttempts,
      metadata: updates.metadata,
    });

    if (!agentInfo) {
      throw new NotFoundException('Agent', agentId);
    }

    const agent: AgentDetail = {
      id: agentInfo.id,
      type: agentInfo.type,
      name: agentInfo.name,
      status: agentInfo.status,
      version: agentInfo.version,
      description: agentInfo.description,
      tasksProcessed: agentInfo.metrics.tasksProcessed,
      lastActiveAt: agentInfo.lastActiveAt,
      createdAt: agentInfo.createdAt,
      config: agentInfo.config as Omit<import('../../core/interfaces/agent.interface.js').IAgentConfig, 'id'>,
      capabilities: agentInfo.capabilities as import('../../core/interfaces/agent.interface.js').AgentCapability[],
      metrics: agentInfo.metrics,
      health: agentInfo.health as import('../../core/interfaces/agent.interface.js').HealthStatus,
      currentTask: agentInfo.currentTask
        ? {
            id: agentInfo.currentTask,
            type: 'task',
            priority: 'medium' as unknown as TaskPriority,
            startedAt: new Date().toISOString(),
          }
        : null,
      queuedTasks: agentInfo.queuedTasks,
    };

    return this.success(agent, request.id as string);
  }

  /**
   * Delete agent
   */
  private async deleteAgent(
    request: TypedRequest<unknown, AgentIdParam, unknown>,
    _reply: FastifyReply
  ): Promise<ApiResponse<{ deleted: boolean; agentId: string }>> {
    const { agentId } = request.params;

    this.logger.info('Deleting agent', { agentId });

    const deleted = await this.service.deleteAgent(agentId);
    if (!deleted) {
      throw new NotFoundException('Agent', agentId);
    }

    return this.success({ deleted: true, agentId }, request.id as string);
  }

  /**
   * Start agent
   */
  private async startAgent(
    request: TypedRequest<unknown, AgentIdParam, unknown>,
    _reply: FastifyReply
  ): Promise<ApiResponse> {
    const { agentId } = request.params;

    this.logger.info('Starting agent', { agentId });

    const agentInfo = await this.service.startAgent(agentId);
    if (!agentInfo) {
      throw new NotFoundException('Agent', agentId);
    }

    return this.success({
      id: agentInfo.id,
      name: agentInfo.name,
      status: agentInfo.status,
      message: 'Agent started successfully',
    }, request.id as string);
  }

  /**
   * Stop agent
   */
  private async stopAgent(
    request: TypedRequest<unknown, AgentIdParam, unknown>,
    _reply: FastifyReply
  ): Promise<ApiResponse> {
    const { agentId } = request.params;

    this.logger.info('Stopping agent', { agentId });

    const agentInfo = await this.service.stopAgent(agentId);
    if (!agentInfo) {
      throw new NotFoundException('Agent', agentId);
    }

    return this.success({
      id: agentInfo.id,
      name: agentInfo.name,
      status: agentInfo.status,
      message: 'Agent stopped successfully',
    }, request.id as string);
  }

  /**
   * Pause agent
   */
  private async pauseAgent(
    request: TypedRequest<unknown, AgentIdParam, unknown>,
    _reply: FastifyReply
  ): Promise<ApiResponse> {
    const { agentId } = request.params;

    this.logger.info('Pausing agent', { agentId });

    const agentInfo = await this.service.pauseAgent(agentId);
    if (!agentInfo) {
      throw new NotFoundException('Agent', agentId);
    }

    return this.success({
      id: agentInfo.id,
      name: agentInfo.name,
      status: agentInfo.status,
      message: 'Agent paused successfully',
    }, request.id as string);
  }

  /**
   * Resume agent
   */
  private async resumeAgent(
    request: TypedRequest<unknown, AgentIdParam, unknown>,
    _reply: FastifyReply
  ): Promise<ApiResponse> {
    const { agentId } = request.params;

    this.logger.info('Resuming agent', { agentId });

    const agentInfo = await this.service.resumeAgent(agentId);
    if (!agentInfo) {
      throw new NotFoundException('Agent', agentId);
    }

    return this.success({
      id: agentInfo.id,
      name: agentInfo.name,
      status: agentInfo.status,
      message: 'Agent resumed successfully',
    }, request.id as string);
  }

  /**
   * Submit task
   */
  private async submitTask(
    request: TypedRequest<SubmitTaskRequest, AgentIdParam, unknown>,
    reply: FastifyReply
  ): Promise<FastifyReply> {
    const { agentId } = request.params;
    const task = request.body;

    this.logger.info('Submitting task', { agentId, taskType: task.type });

    const taskInfo = await this.service.submitTask(agentId, {
      type: task.type,
      payload: task.payload,
      priority: task.priority,
      timeout: task.timeout,
      metadata: task.metadata,
    });

    if (!taskInfo) {
      throw new NotFoundException('Agent', agentId);
    }

    // Map service status to API status
    const statusMap: Record<string, 'queued' | 'processing' | 'completed' | 'failed'> = {
      queued: 'queued',
      running: 'processing',
      completed: 'completed',
      cancelled: 'failed',
      failed: 'failed',
    };

    const response: AgentTaskResponse = {
      taskId: taskInfo.taskId,
      agentId,
      status: statusMap[taskInfo.status] || 'queued',
      position: taskInfo.position,
      estimatedWaitTime: taskInfo.estimatedWaitTime,
    };

    return this.created(response, request.id as string, reply);
  }

  /**
   * Get agent health
   */
  private async getAgentHealth(
    request: TypedRequest<unknown, AgentIdParam, unknown>,
    _reply: FastifyReply
  ): Promise<ApiResponse> {
    const { agentId } = request.params;

    this.logger.info('Getting agent health', { agentId });

    const health = await this.service.getAgentHealth(agentId);
    if (!health) {
      throw new NotFoundException('Agent', agentId);
    }

    return this.success({
      healthy: health.healthy,
      status: health.status,
      uptime: health.uptime,
      lastCheck: health.lastCheck.toISOString(),
      issues: health.issues,
    }, request.id as string);
  }

  /**
   * Get agent capabilities
   */
  private async getAgentCapabilities(
    request: TypedRequest<unknown, AgentIdParam, unknown>,
    _reply: FastifyReply
  ): Promise<ApiResponse> {
    const { agentId } = request.params;

    this.logger.info('Getting agent capabilities', { agentId });

    const capabilities = await this.service.getAgentCapabilities(agentId);
    if (!capabilities) {
      throw new NotFoundException('Agent', agentId);
    }

    return this.success({ capabilities }, request.id as string);
  }

  /**
   * Get task status
   */
  private async getTaskStatus(
    request: TypedRequest<unknown, TaskIdParam, unknown>,
    _reply: FastifyReply
  ): Promise<ApiResponse> {
    const { agentId, taskId } = request.params;

    this.logger.info('Getting task status', { agentId, taskId });

    const taskInfo = await this.service.getTaskStatus(agentId, taskId);
    if (!taskInfo) {
      throw new NotFoundException('Task', taskId);
    }

    return this.success({
      taskId: taskInfo.taskId,
      agentId: taskInfo.agentId,
      status: taskInfo.status,
      result: taskInfo.result,
      error: taskInfo.error,
      createdAt: taskInfo.createdAt.toISOString(),
      startedAt: taskInfo.startedAt?.toISOString(),
      completedAt: taskInfo.completedAt?.toISOString(),
    }, request.id as string);
  }
}

/**
 * Create agents router instance
 */
export function createAgentsRouter(): AgentsRouter {
  return new AgentsRouter();
}
