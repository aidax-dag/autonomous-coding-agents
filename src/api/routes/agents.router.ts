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

/**
 * Agents API Router
 *
 * Handles all agent-related API endpoints
 */
export class AgentsRouter extends BaseRouter {
  readonly prefix = '/agents';

  constructor() {
    super('AgentsRouter');
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

    // TODO: Replace with actual agent registry implementation
    const mockAgents: AgentSummary[] = [];
    const total = 0;

    this.logger.info('Listing agents', { page, limit, total });

    return this.listResponse(mockAgents, total, { page, limit }, request.id as string);
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

    // TODO: Replace with actual agent creation
    const agent: AgentDetail = {
      id: crypto.randomUUID(),
      type: body.type,
      name: body.name,
      status: AgentStatus.INITIALIZING,
      version: '1.0.0',
      description: body.description,
      tasksProcessed: 0,
      lastActiveAt: null,
      createdAt: new Date().toISOString(),
      config: {
        type: body.type,
        name: body.name,
        llm: body.llm,
        maxConcurrentTasks: body.maxConcurrentTasks,
        taskTimeout: body.taskTimeout,
        retryAttempts: body.retryAttempts,
      },
      capabilities: body.capabilities || [],
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
        lastCheck: new Date(),
      },
      currentTask: null,
      queuedTasks: 0,
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

    // TODO: Replace with actual agent lookup
    throw new NotFoundException('Agent', agentId);
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

    // TODO: Replace with actual agent update
    throw new NotFoundException('Agent', agentId);
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

    // TODO: Replace with actual agent deletion
    throw new NotFoundException('Agent', agentId);
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

    // TODO: Replace with actual agent start
    throw new NotFoundException('Agent', agentId);
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

    // TODO: Replace with actual agent stop
    throw new NotFoundException('Agent', agentId);
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

    // TODO: Replace with actual agent pause
    throw new NotFoundException('Agent', agentId);
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

    // TODO: Replace with actual agent resume
    throw new NotFoundException('Agent', agentId);
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

    // TODO: Replace with actual task submission
    const response: AgentTaskResponse = {
      taskId: crypto.randomUUID(),
      agentId,
      status: 'queued',
      position: 1,
      estimatedWaitTime: 5000,
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

    // TODO: Replace with actual agent health lookup
    throw new NotFoundException('Agent', agentId);
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

    // TODO: Replace with actual agent capabilities lookup
    throw new NotFoundException('Agent', agentId);
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

    // TODO: Replace with actual task status lookup
    throw new NotFoundException('Task', taskId);
  }
}

/**
 * Create agents router instance
 */
export function createAgentsRouter(): AgentsRouter {
  return new AgentsRouter();
}
