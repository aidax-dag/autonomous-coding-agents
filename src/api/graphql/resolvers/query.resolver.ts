/**
 * GraphQL Query Resolvers
 *
 * Feature: F4.3 - GraphQL API
 *
 * Implements query resolvers for agents, workflows, tasks, tools, and hooks.
 *
 * @module api/graphql/resolvers/query
 */

import { createLogger } from '../../../core/services/logger.js';
import type {
  GraphQLContext,
  ResolverFn,
  GqlAgent,
  GqlWorkflow,
  GqlTask,
  GqlTool,
  GqlHook,
  GqlSystemMetrics,
  GqlHealthStatus,
  Connection,
  PageInfo,
  PaginationInput,
  SortInput,
  AgentFilterInput,
  WorkflowFilterInput,
  TaskFilterInput,
  GqlAgentStatus,
  GqlWorkflowStatus,
  GqlTaskStatus,
  GqlToolType,
  GqlHookTrigger,
} from '../interfaces/graphql.interface.js';
import { GraphQLError } from 'graphql';
import { GRAPHQL_ERROR_CODES } from '../interfaces/graphql.interface.js';

const logger = createLogger('GraphQL:QueryResolver');

// ==================== Helper Functions ====================

/**
 * Create page info from pagination params and total count
 */
function createPageInfo(
  page: number,
  limit: number,
  totalCount: number,
  edges: { cursor: string }[]
): PageInfo {
  const totalPages = Math.ceil(totalCount / limit);
  return {
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
    startCursor: edges[0]?.cursor,
    endCursor: edges[edges.length - 1]?.cursor,
    totalCount,
    totalPages,
    currentPage: page,
  };
}

/**
 * Create cursor from id and index
 */
function createCursor(id: string, index: number): string {
  return Buffer.from(`cursor:${id}:${index}`).toString('base64');
}

/**
 * Parse pagination input with defaults
 */
function parsePagination(pagination?: PaginationInput): { page: number; limit: number; offset: number } {
  const page = pagination?.page ?? 1;
  const limit = Math.min(pagination?.limit ?? 20, 100);
  const offset = pagination?.offset ?? (page - 1) * limit;
  return { page, limit, offset };
}

/**
 * Throw GraphQL error with code
 */
function throwNotFound(resource: string, id: string): never {
  throw new GraphQLError(`${resource} not found: ${id}`, {
    extensions: {
      code: GRAPHQL_ERROR_CODES.NOT_FOUND,
      resource,
      id,
    },
  });
}

// ==================== Mock Data (Replace with actual service calls) ====================

// These mock functions simulate service layer calls
// In production, replace with actual AgentService, WorkflowService, etc.

function getMockAgents(): GqlAgent[] {
  return [
    {
      id: 'agent-1',
      name: 'CodeReviewer',
      type: 'reviewer',
      description: 'Automated code review agent',
      status: 'RUNNING' as GqlAgentStatus,
      config: { maxTokens: 4096 },
      tools: [],
      hooks: [],
      metrics: {
        tasksCompleted: 150,
        tasksFailed: 5,
        averageExecutionTime: 2500,
        uptime: 86400000,
        lastActiveAt: new Date(),
      },
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date(),
    },
    {
      id: 'agent-2',
      name: 'TestGenerator',
      type: 'generator',
      description: 'Automated test generation agent',
      status: 'IDLE' as GqlAgentStatus,
      config: { framework: 'jest' },
      tools: [],
      hooks: [],
      metrics: {
        tasksCompleted: 75,
        tasksFailed: 2,
        averageExecutionTime: 5000,
        uptime: 43200000,
        lastActiveAt: new Date(),
      },
      createdAt: new Date('2024-02-01'),
      updatedAt: new Date(),
    },
  ];
}

function getMockWorkflows(): GqlWorkflow[] {
  const agents = getMockAgents();
  return [
    {
      id: 'workflow-1',
      name: 'PR Review Workflow',
      description: 'Automated PR review process',
      status: 'RUNNING' as GqlWorkflowStatus,
      agent: agents[0],
      steps: [
        {
          id: 'step-1',
          name: 'Fetch PR',
          type: 'fetch',
          status: 'COMPLETED' as GqlTaskStatus,
          dependencies: [],
          startedAt: new Date(),
          completedAt: new Date(),
        },
        {
          id: 'step-2',
          name: 'Analyze Code',
          type: 'analyze',
          status: 'RUNNING' as GqlTaskStatus,
          dependencies: ['step-1'],
          startedAt: new Date(),
        },
      ],
      config: { autoApprove: false },
      progress: 0.5,
      startedAt: new Date(),
      createdAt: new Date('2024-03-01'),
      updatedAt: new Date(),
    },
  ];
}

function getMockTasks(): GqlTask[] {
  return [
    {
      id: 'task-1',
      name: 'Review PR #123',
      status: 'COMPLETED' as GqlTaskStatus,
      input: { prNumber: 123 },
      output: { approved: true, comments: 2 },
      progress: 1.0,
      startedAt: new Date(Date.now() - 60000),
      completedAt: new Date(),
      createdAt: new Date(Date.now() - 120000),
      updatedAt: new Date(),
    },
    {
      id: 'task-2',
      name: 'Generate Tests',
      status: 'RUNNING' as GqlTaskStatus,
      input: { file: 'src/utils.ts' },
      progress: 0.6,
      startedAt: new Date(Date.now() - 30000),
      createdAt: new Date(Date.now() - 60000),
      updatedAt: new Date(),
    },
  ];
}

function getMockTools(): GqlTool[] {
  return [
    {
      id: 'tool-1',
      name: 'file_read',
      type: 'BUILTIN' as GqlToolType,
      description: 'Read file contents',
      version: '1.0.0',
      schema: { type: 'object', properties: { path: { type: 'string' } } },
      enabled: true,
      executionCount: 1000,
      lastExecutedAt: new Date(),
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date(),
    },
    {
      id: 'tool-2',
      name: 'code_search',
      type: 'BUILTIN' as GqlToolType,
      description: 'Search code in repository',
      version: '1.0.0',
      schema: { type: 'object', properties: { query: { type: 'string' } } },
      enabled: true,
      executionCount: 500,
      lastExecutedAt: new Date(),
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date(),
    },
  ];
}

function getMockHooks(): GqlHook[] {
  return [
    {
      id: 'hook-1',
      name: 'Pre-Review Validation',
      trigger: 'BEFORE' as GqlHookTrigger,
      targetType: 'workflow',
      targetId: 'workflow-1',
      handler: 'validatePR',
      config: { required: true },
      enabled: true,
      executionCount: 50,
      lastExecutedAt: new Date(),
      createdAt: new Date('2024-01-15'),
      updatedAt: new Date(),
    },
    {
      id: 'hook-2',
      name: 'Post-Task Notification',
      trigger: 'AFTER' as GqlHookTrigger,
      targetType: 'task',
      handler: 'sendNotification',
      config: { channel: 'slack' },
      enabled: true,
      executionCount: 200,
      lastExecutedAt: new Date(),
      createdAt: new Date('2024-02-01'),
      updatedAt: new Date(),
    },
  ];
}

// ==================== Query Resolvers ====================

/**
 * Query resolvers
 */
export const QueryResolvers = {
  // ==================== Agent Queries ====================

  agent: (async (
    _parent: unknown,
    args: { id: string },
    context: GraphQLContext
  ): Promise<GqlAgent | null> => {
    logger.debug('Query: agent', { id: args.id, requestId: context.requestId });

    const agents = getMockAgents();
    const agent = agents.find(a => a.id === args.id);

    if (!agent) {
      return null;
    }

    return agent;
  }) as ResolverFn<GqlAgent | null>,

  agents: (async (
    _parent: unknown,
    args: {
      filter?: AgentFilterInput;
      sort?: SortInput;
      pagination?: PaginationInput;
    },
    context: GraphQLContext
  ): Promise<Connection<GqlAgent>> => {
    logger.debug('Query: agents', { args, requestId: context.requestId });

    const { page, limit, offset } = parsePagination(args.pagination);
    let agents = getMockAgents();

    // Apply filters
    if (args.filter) {
      if (args.filter.status?.length) {
        agents = agents.filter(a => args.filter!.status!.includes(a.status));
      }
      if (args.filter.type?.length) {
        agents = agents.filter(a => args.filter!.type!.includes(a.type));
      }
      if (args.filter.search) {
        const search = args.filter.search.toLowerCase();
        agents = agents.filter(a =>
          a.name.toLowerCase().includes(search) ||
          a.description?.toLowerCase().includes(search)
        );
      }
    }

    // Apply sorting
    if (args.sort) {
      const { field, order } = args.sort;
      agents.sort((a, b) => {
        const aVal = (a as unknown as Record<string, unknown>)[field];
        const bVal = (b as unknown as Record<string, unknown>)[field];
        const comparison = String(aVal).localeCompare(String(bVal));
        return order === 'ASC' ? comparison : -comparison;
      });
    }

    const totalCount = agents.length;
    const paginatedAgents = agents.slice(offset, offset + limit);

    const edges = paginatedAgents.map((agent, index) => ({
      node: agent,
      cursor: createCursor(agent.id, offset + index),
    }));

    return {
      edges,
      pageInfo: createPageInfo(page, limit, totalCount, edges),
      totalCount,
    };
  }) as ResolverFn<Connection<GqlAgent>>,

  agentByName: (async (
    _parent: unknown,
    args: { name: string },
    context: GraphQLContext
  ): Promise<GqlAgent | null> => {
    logger.debug('Query: agentByName', { name: args.name, requestId: context.requestId });

    const agents = getMockAgents();
    return agents.find(a => a.name === args.name) || null;
  }) as ResolverFn<GqlAgent | null>,

  // ==================== Workflow Queries ====================

  workflow: (async (
    _parent: unknown,
    args: { id: string },
    context: GraphQLContext
  ): Promise<GqlWorkflow | null> => {
    logger.debug('Query: workflow', { id: args.id, requestId: context.requestId });

    const workflows = getMockWorkflows();
    return workflows.find(w => w.id === args.id) || null;
  }) as ResolverFn<GqlWorkflow | null>,

  workflows: (async (
    _parent: unknown,
    args: {
      filter?: WorkflowFilterInput;
      sort?: SortInput;
      pagination?: PaginationInput;
    },
    context: GraphQLContext
  ): Promise<Connection<GqlWorkflow>> => {
    logger.debug('Query: workflows', { args, requestId: context.requestId });

    const { page, limit, offset } = parsePagination(args.pagination);
    let workflows = getMockWorkflows();

    // Apply filters
    if (args.filter) {
      if (args.filter.status?.length) {
        workflows = workflows.filter(w => args.filter!.status!.includes(w.status));
      }
      if (args.filter.agentId) {
        workflows = workflows.filter(w => w.agent.id === args.filter!.agentId);
      }
      if (args.filter.search) {
        const search = args.filter.search.toLowerCase();
        workflows = workflows.filter(w =>
          w.name.toLowerCase().includes(search) ||
          w.description?.toLowerCase().includes(search)
        );
      }
    }

    const totalCount = workflows.length;
    const paginatedWorkflows = workflows.slice(offset, offset + limit);

    const edges = paginatedWorkflows.map((workflow, index) => ({
      node: workflow,
      cursor: createCursor(workflow.id, offset + index),
    }));

    return {
      edges,
      pageInfo: createPageInfo(page, limit, totalCount, edges),
      totalCount,
    };
  }) as ResolverFn<Connection<GqlWorkflow>>,

  workflowsByAgent: (async (
    _parent: unknown,
    args: { agentId: string; pagination?: PaginationInput },
    context: GraphQLContext
  ): Promise<Connection<GqlWorkflow>> => {
    logger.debug('Query: workflowsByAgent', { agentId: args.agentId, requestId: context.requestId });

    const { page, limit, offset } = parsePagination(args.pagination);
    const workflows = getMockWorkflows().filter(w => w.agent.id === args.agentId);

    const totalCount = workflows.length;
    const paginatedWorkflows = workflows.slice(offset, offset + limit);

    const edges = paginatedWorkflows.map((workflow, index) => ({
      node: workflow,
      cursor: createCursor(workflow.id, offset + index),
    }));

    return {
      edges,
      pageInfo: createPageInfo(page, limit, totalCount, edges),
      totalCount,
    };
  }) as ResolverFn<Connection<GqlWorkflow>>,

  // ==================== Task Queries ====================

  task: (async (
    _parent: unknown,
    args: { id: string },
    context: GraphQLContext
  ): Promise<GqlTask | null> => {
    logger.debug('Query: task', { id: args.id, requestId: context.requestId });

    const tasks = getMockTasks();
    return tasks.find(t => t.id === args.id) || null;
  }) as ResolverFn<GqlTask | null>,

  tasks: (async (
    _parent: unknown,
    args: {
      filter?: TaskFilterInput;
      sort?: SortInput;
      pagination?: PaginationInput;
    },
    context: GraphQLContext
  ): Promise<Connection<GqlTask>> => {
    logger.debug('Query: tasks', { args, requestId: context.requestId });

    const { page, limit, offset } = parsePagination(args.pagination);
    let tasks = getMockTasks();

    // Apply filters
    if (args.filter) {
      if (args.filter.status?.length) {
        tasks = tasks.filter(t => args.filter!.status!.includes(t.status));
      }
      if (args.filter.search) {
        const search = args.filter.search.toLowerCase();
        tasks = tasks.filter(t => t.name.toLowerCase().includes(search));
      }
    }

    const totalCount = tasks.length;
    const paginatedTasks = tasks.slice(offset, offset + limit);

    const edges = paginatedTasks.map((task, index) => ({
      node: task,
      cursor: createCursor(task.id, offset + index),
    }));

    return {
      edges,
      pageInfo: createPageInfo(page, limit, totalCount, edges),
      totalCount,
    };
  }) as ResolverFn<Connection<GqlTask>>,

  tasksByWorkflow: (async (
    _parent: unknown,
    args: { workflowId: string; pagination?: PaginationInput },
    context: GraphQLContext
  ): Promise<Connection<GqlTask>> => {
    logger.debug('Query: tasksByWorkflow', { workflowId: args.workflowId, requestId: context.requestId });

    const { page, limit, offset } = parsePagination(args.pagination);
    const tasks = getMockTasks().filter(t => t.workflow?.id === args.workflowId);

    const totalCount = tasks.length;
    const paginatedTasks = tasks.slice(offset, offset + limit);

    const edges = paginatedTasks.map((task, index) => ({
      node: task,
      cursor: createCursor(task.id, offset + index),
    }));

    return {
      edges,
      pageInfo: createPageInfo(page, limit, totalCount, edges),
      totalCount,
    };
  }) as ResolverFn<Connection<GqlTask>>,

  tasksByAgent: (async (
    _parent: unknown,
    args: { agentId: string; pagination?: PaginationInput },
    context: GraphQLContext
  ): Promise<Connection<GqlTask>> => {
    logger.debug('Query: tasksByAgent', { agentId: args.agentId, requestId: context.requestId });

    const { page, limit, offset } = parsePagination(args.pagination);
    const tasks = getMockTasks().filter(t => t.agent?.id === args.agentId);

    const totalCount = tasks.length;
    const paginatedTasks = tasks.slice(offset, offset + limit);

    const edges = paginatedTasks.map((task, index) => ({
      node: task,
      cursor: createCursor(task.id, offset + index),
    }));

    return {
      edges,
      pageInfo: createPageInfo(page, limit, totalCount, edges),
      totalCount,
    };
  }) as ResolverFn<Connection<GqlTask>>,

  // ==================== Tool Queries ====================

  tool: (async (
    _parent: unknown,
    args: { id: string },
    context: GraphQLContext
  ): Promise<GqlTool | null> => {
    logger.debug('Query: tool', { id: args.id, requestId: context.requestId });

    const tools = getMockTools();
    return tools.find(t => t.id === args.id) || null;
  }) as ResolverFn<GqlTool | null>,

  tools: (async (
    _parent: unknown,
    args: {
      filter?: { type?: GqlToolType[]; enabled?: boolean; search?: string };
      sort?: SortInput;
      pagination?: PaginationInput;
    },
    context: GraphQLContext
  ): Promise<Connection<GqlTool>> => {
    logger.debug('Query: tools', { args, requestId: context.requestId });

    const { page, limit, offset } = parsePagination(args.pagination);
    let tools = getMockTools();

    // Apply filters
    if (args.filter) {
      if (args.filter.type?.length) {
        tools = tools.filter(t => args.filter!.type!.includes(t.type));
      }
      if (args.filter.enabled !== undefined) {
        tools = tools.filter(t => t.enabled === args.filter!.enabled);
      }
      if (args.filter.search) {
        const search = args.filter.search.toLowerCase();
        tools = tools.filter(t =>
          t.name.toLowerCase().includes(search) ||
          t.description?.toLowerCase().includes(search)
        );
      }
    }

    const totalCount = tools.length;
    const paginatedTools = tools.slice(offset, offset + limit);

    const edges = paginatedTools.map((tool, index) => ({
      node: tool,
      cursor: createCursor(tool.id, offset + index),
    }));

    return {
      edges,
      pageInfo: createPageInfo(page, limit, totalCount, edges),
      totalCount,
    };
  }) as ResolverFn<Connection<GqlTool>>,

  toolByName: (async (
    _parent: unknown,
    args: { name: string },
    context: GraphQLContext
  ): Promise<GqlTool | null> => {
    logger.debug('Query: toolByName', { name: args.name, requestId: context.requestId });

    const tools = getMockTools();
    return tools.find(t => t.name === args.name) || null;
  }) as ResolverFn<GqlTool | null>,

  // ==================== Hook Queries ====================

  hook: (async (
    _parent: unknown,
    args: { id: string },
    context: GraphQLContext
  ): Promise<GqlHook | null> => {
    logger.debug('Query: hook', { id: args.id, requestId: context.requestId });

    const hooks = getMockHooks();
    return hooks.find(h => h.id === args.id) || null;
  }) as ResolverFn<GqlHook | null>,

  hooks: (async (
    _parent: unknown,
    args: {
      filter?: { trigger?: GqlHookTrigger[]; targetType?: string; enabled?: boolean; search?: string };
      sort?: SortInput;
      pagination?: PaginationInput;
    },
    context: GraphQLContext
  ): Promise<Connection<GqlHook>> => {
    logger.debug('Query: hooks', { args, requestId: context.requestId });

    const { page, limit, offset } = parsePagination(args.pagination);
    let hooks = getMockHooks();

    // Apply filters
    if (args.filter) {
      if (args.filter.trigger?.length) {
        hooks = hooks.filter(h => args.filter!.trigger!.includes(h.trigger));
      }
      if (args.filter.targetType) {
        hooks = hooks.filter(h => h.targetType === args.filter!.targetType);
      }
      if (args.filter.enabled !== undefined) {
        hooks = hooks.filter(h => h.enabled === args.filter!.enabled);
      }
      if (args.filter.search) {
        const search = args.filter.search.toLowerCase();
        hooks = hooks.filter(h => h.name.toLowerCase().includes(search));
      }
    }

    const totalCount = hooks.length;
    const paginatedHooks = hooks.slice(offset, offset + limit);

    const edges = paginatedHooks.map((hook, index) => ({
      node: hook,
      cursor: createCursor(hook.id, offset + index),
    }));

    return {
      edges,
      pageInfo: createPageInfo(page, limit, totalCount, edges),
      totalCount,
    };
  }) as ResolverFn<Connection<GqlHook>>,

  hooksByTarget: (async (
    _parent: unknown,
    args: { targetType: string; targetId?: string },
    context: GraphQLContext
  ): Promise<Connection<GqlHook>> => {
    logger.debug('Query: hooksByTarget', { args, requestId: context.requestId });

    let hooks = getMockHooks().filter(h => h.targetType === args.targetType);
    if (args.targetId) {
      hooks = hooks.filter(h => h.targetId === args.targetId);
    }

    const edges = hooks.map((hook, index) => ({
      node: hook,
      cursor: createCursor(hook.id, index),
    }));

    return {
      edges,
      pageInfo: createPageInfo(1, hooks.length, hooks.length, edges),
      totalCount: hooks.length,
    };
  }) as ResolverFn<Connection<GqlHook>>,

  // ==================== System Queries ====================

  metrics: (async (
    _parent: unknown,
    _args: unknown,
    context: GraphQLContext
  ): Promise<GqlSystemMetrics> => {
    logger.debug('Query: metrics', { requestId: context.requestId });

    return {
      agents: {
        total: 10,
        active: 5,
        completed: undefined,
        failed: undefined,
      },
      workflows: {
        total: 50,
        active: 8,
        completed: 38,
        failed: 4,
      },
      tasks: {
        total: 500,
        active: 25,
        completed: 450,
        failed: 25,
      },
      tools: {
        total: 20,
        active: 18,
        completed: undefined,
        failed: undefined,
      },
      hooks: {
        total: 15,
        active: 12,
        completed: undefined,
        failed: undefined,
      },
      system: {
        uptime: process.uptime() * 1000,
        memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024,
        cpuUsage: 0.25,
        requestsPerSecond: 150,
        averageResponseTime: 45,
      },
    };
  }) as ResolverFn<GqlSystemMetrics>,

  health: (async (
    _parent: unknown,
    _args: unknown,
    context: GraphQLContext
  ): Promise<GqlHealthStatus> => {
    logger.debug('Query: health', { requestId: context.requestId });

    return {
      status: 'healthy',
      version: '1.0.0',
      uptime: process.uptime() * 1000,
      timestamp: new Date(),
      services: [
        { name: 'database', status: 'healthy', latency: 5 },
        { name: 'cache', status: 'healthy', latency: 2 },
        { name: 'queue', status: 'healthy', latency: 10 },
      ],
    };
  }) as ResolverFn<GqlHealthStatus>,
};

export { throwNotFound };
