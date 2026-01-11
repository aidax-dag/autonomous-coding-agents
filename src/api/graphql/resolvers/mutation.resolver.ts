/**
 * GraphQL Mutation Resolvers
 *
 * Feature: F4.3 - GraphQL API
 *
 * Implements mutation resolvers for agents, workflows, tasks, tools, and hooks.
 *
 * @module api/graphql/resolvers/mutation
 */

import { GraphQLError } from 'graphql';
import { v4 as uuidv4 } from 'uuid';
import { createLogger } from '../../../core/services/logger.js';
import type {
  GraphQLContext,
  ResolverFn,
  GqlAgent,
  GqlWorkflow,
  GqlTask,
  GqlTool,
  GqlHook,
  GqlToolResult,
  CreateAgentInput,
  UpdateAgentInput,
  CreateWorkflowInput,
  UpdateWorkflowInput,
  ExecuteToolInput,
  CreateHookInput,
  UpdateHookInput,
  GqlAgentStatus,
  GqlWorkflowStatus,
  GqlTaskStatus,
  GqlToolType,
} from '../interfaces/graphql.interface.js';
import { GRAPHQL_ERROR_CODES } from '../interfaces/graphql.interface.js';

const logger = createLogger('GraphQL:MutationResolver');

// ==================== Helper Functions ====================

/**
 * Throw GraphQL error with code
 */
function throwError(code: string, message: string, details?: Record<string, unknown>): never {
  throw new GraphQLError(message, {
    extensions: {
      code,
      ...details,
    },
  });
}

// Note: requireAuth function available for use when authentication is enforced
// function requireAuth(context: GraphQLContext): void {
//   if (!context.auth?.authenticated) {
//     throwError(GRAPHQL_ERROR_CODES.UNAUTHENTICATED, 'Authentication required');
//   }
// }

// ==================== Mock Data Store (Replace with actual services) ====================

// In-memory stores for demonstration
const agentStore = new Map<string, GqlAgent>();
const workflowStore = new Map<string, GqlWorkflow>();
const taskStore = new Map<string, GqlTask>();
const hookStore = new Map<string, GqlHook>();

// ==================== Mutation Resolvers ====================

/**
 * Mutation resolvers
 */
export const MutationResolvers = {
  // ==================== Agent Mutations ====================

  createAgent: (async (
    _parent: unknown,
    args: { input: CreateAgentInput },
    context: GraphQLContext
  ): Promise<GqlAgent> => {
    logger.info('Mutation: createAgent', { input: args.input, requestId: context.requestId });

    const agent: GqlAgent = {
      id: uuidv4(),
      name: args.input.name,
      type: args.input.type,
      description: args.input.description,
      status: 'IDLE' as GqlAgentStatus,
      config: args.input.config,
      tools: [],
      hooks: [],
      metrics: {
        tasksCompleted: 0,
        tasksFailed: 0,
        averageExecutionTime: 0,
        uptime: 0,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    agentStore.set(agent.id, agent);
    logger.info('Agent created', { agentId: agent.id, name: agent.name });

    return agent;
  }) as ResolverFn<GqlAgent>,

  updateAgent: (async (
    _parent: unknown,
    args: { id: string; input: UpdateAgentInput },
    context: GraphQLContext
  ): Promise<GqlAgent> => {
    logger.info('Mutation: updateAgent', { id: args.id, input: args.input, requestId: context.requestId });

    const agent = agentStore.get(args.id);
    if (!agent) {
      throwError(GRAPHQL_ERROR_CODES.NOT_FOUND, `Agent not found: ${args.id}`);
    }

    const updatedAgent: GqlAgent = {
      ...agent,
      name: args.input.name ?? agent.name,
      description: args.input.description ?? agent.description,
      config: args.input.config ?? agent.config,
      // Keep existing tools and hooks - resolving tool/hook IDs would be done in production
      tools: agent.tools,
      hooks: agent.hooks,
      updatedAt: new Date(),
    };

    agentStore.set(args.id, updatedAgent);
    logger.info('Agent updated', { agentId: args.id });

    return updatedAgent;
  }) as ResolverFn<GqlAgent>,

  deleteAgent: (async (
    _parent: unknown,
    args: { id: string },
    context: GraphQLContext
  ): Promise<{ success: boolean; message?: string }> => {
    logger.info('Mutation: deleteAgent', { id: args.id, requestId: context.requestId });

    const agent = agentStore.get(args.id);
    if (!agent) {
      throwError(GRAPHQL_ERROR_CODES.NOT_FOUND, `Agent not found: ${args.id}`);
    }

    if (agent.status === 'RUNNING') {
      throwError(GRAPHQL_ERROR_CODES.CONFLICT, 'Cannot delete running agent');
    }

    agentStore.delete(args.id);
    logger.info('Agent deleted', { agentId: args.id });

    return { success: true, message: `Agent ${args.id} deleted` };
  }) as ResolverFn<{ success: boolean; message?: string }>,

  startAgent: (async (
    _parent: unknown,
    args: { id: string },
    context: GraphQLContext
  ): Promise<GqlAgent> => {
    logger.info('Mutation: startAgent', { id: args.id, requestId: context.requestId });

    const agent = agentStore.get(args.id);
    if (!agent) {
      throwError(GRAPHQL_ERROR_CODES.NOT_FOUND, `Agent not found: ${args.id}`);
    }

    if (agent.status === 'RUNNING') {
      throwError(GRAPHQL_ERROR_CODES.CONFLICT, 'Agent is already running');
    }

    const updatedAgent: GqlAgent = {
      ...agent,
      status: 'RUNNING' as GqlAgentStatus,
      updatedAt: new Date(),
    };

    agentStore.set(args.id, updatedAgent);
    logger.info('Agent started', { agentId: args.id });

    return updatedAgent;
  }) as ResolverFn<GqlAgent>,

  stopAgent: (async (
    _parent: unknown,
    args: { id: string },
    context: GraphQLContext
  ): Promise<GqlAgent> => {
    logger.info('Mutation: stopAgent', { id: args.id, requestId: context.requestId });

    const agent = agentStore.get(args.id);
    if (!agent) {
      throwError(GRAPHQL_ERROR_CODES.NOT_FOUND, `Agent not found: ${args.id}`);
    }

    const updatedAgent: GqlAgent = {
      ...agent,
      status: 'STOPPED' as GqlAgentStatus,
      updatedAt: new Date(),
    };

    agentStore.set(args.id, updatedAgent);
    logger.info('Agent stopped', { agentId: args.id });

    return updatedAgent;
  }) as ResolverFn<GqlAgent>,

  pauseAgent: (async (
    _parent: unknown,
    args: { id: string },
    context: GraphQLContext
  ): Promise<GqlAgent> => {
    logger.info('Mutation: pauseAgent', { id: args.id, requestId: context.requestId });

    const agent = agentStore.get(args.id);
    if (!agent) {
      throwError(GRAPHQL_ERROR_CODES.NOT_FOUND, `Agent not found: ${args.id}`);
    }

    if (agent.status !== 'RUNNING') {
      throwError(GRAPHQL_ERROR_CODES.CONFLICT, 'Agent is not running');
    }

    const updatedAgent: GqlAgent = {
      ...agent,
      status: 'PAUSED' as GqlAgentStatus,
      updatedAt: new Date(),
    };

    agentStore.set(args.id, updatedAgent);
    logger.info('Agent paused', { agentId: args.id });

    return updatedAgent;
  }) as ResolverFn<GqlAgent>,

  resumeAgent: (async (
    _parent: unknown,
    args: { id: string },
    context: GraphQLContext
  ): Promise<GqlAgent> => {
    logger.info('Mutation: resumeAgent', { id: args.id, requestId: context.requestId });

    const agent = agentStore.get(args.id);
    if (!agent) {
      throwError(GRAPHQL_ERROR_CODES.NOT_FOUND, `Agent not found: ${args.id}`);
    }

    if (agent.status !== 'PAUSED') {
      throwError(GRAPHQL_ERROR_CODES.CONFLICT, 'Agent is not paused');
    }

    const updatedAgent: GqlAgent = {
      ...agent,
      status: 'RUNNING' as GqlAgentStatus,
      updatedAt: new Date(),
    };

    agentStore.set(args.id, updatedAgent);
    logger.info('Agent resumed', { agentId: args.id });

    return updatedAgent;
  }) as ResolverFn<GqlAgent>,

  // ==================== Workflow Mutations ====================

  createWorkflow: (async (
    _parent: unknown,
    args: { input: CreateWorkflowInput },
    context: GraphQLContext
  ): Promise<GqlWorkflow> => {
    logger.info('Mutation: createWorkflow', { input: args.input, requestId: context.requestId });

    const agent = agentStore.get(args.input.agentId);
    if (!agent) {
      throwError(GRAPHQL_ERROR_CODES.NOT_FOUND, `Agent not found: ${args.input.agentId}`);
    }

    const workflow: GqlWorkflow = {
      id: uuidv4(),
      name: args.input.name,
      description: args.input.description,
      status: 'PENDING' as GqlWorkflowStatus,
      agent,
      steps: args.input.steps.map((step) => ({
        id: uuidv4(),
        name: step.name,
        type: step.type,
        status: 'PENDING' as GqlTaskStatus,
        config: step.config,
        dependencies: step.dependencies || [],
      })),
      config: args.input.config,
      progress: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    workflowStore.set(workflow.id, workflow);
    logger.info('Workflow created', { workflowId: workflow.id, name: workflow.name });

    return workflow;
  }) as ResolverFn<GqlWorkflow>,

  updateWorkflow: (async (
    _parent: unknown,
    args: { id: string; input: UpdateWorkflowInput },
    context: GraphQLContext
  ): Promise<GqlWorkflow> => {
    logger.info('Mutation: updateWorkflow', { id: args.id, input: args.input, requestId: context.requestId });

    const workflow = workflowStore.get(args.id);
    if (!workflow) {
      throwError(GRAPHQL_ERROR_CODES.NOT_FOUND, `Workflow not found: ${args.id}`);
    }

    if (workflow.status === 'RUNNING') {
      throwError(GRAPHQL_ERROR_CODES.CONFLICT, 'Cannot update running workflow');
    }

    const updatedWorkflow: GqlWorkflow = {
      ...workflow,
      name: args.input.name ?? workflow.name,
      description: args.input.description ?? workflow.description,
      config: args.input.config ?? workflow.config,
      steps: args.input.steps
        ? args.input.steps.map(step => ({
            id: uuidv4(),
            name: step.name,
            type: step.type,
            status: 'PENDING' as GqlTaskStatus,
            config: step.config,
            dependencies: step.dependencies || [],
          }))
        : workflow.steps,
      updatedAt: new Date(),
    };

    workflowStore.set(args.id, updatedWorkflow);
    logger.info('Workflow updated', { workflowId: args.id });

    return updatedWorkflow;
  }) as ResolverFn<GqlWorkflow>,

  deleteWorkflow: (async (
    _parent: unknown,
    args: { id: string },
    context: GraphQLContext
  ): Promise<{ success: boolean; message?: string }> => {
    logger.info('Mutation: deleteWorkflow', { id: args.id, requestId: context.requestId });

    const workflow = workflowStore.get(args.id);
    if (!workflow) {
      throwError(GRAPHQL_ERROR_CODES.NOT_FOUND, `Workflow not found: ${args.id}`);
    }

    if (workflow.status === 'RUNNING') {
      throwError(GRAPHQL_ERROR_CODES.CONFLICT, 'Cannot delete running workflow');
    }

    workflowStore.delete(args.id);
    logger.info('Workflow deleted', { workflowId: args.id });

    return { success: true, message: `Workflow ${args.id} deleted` };
  }) as ResolverFn<{ success: boolean; message?: string }>,

  startWorkflow: (async (
    _parent: unknown,
    args: { id: string },
    context: GraphQLContext
  ): Promise<GqlWorkflow> => {
    logger.info('Mutation: startWorkflow', { id: args.id, requestId: context.requestId });

    const workflow = workflowStore.get(args.id);
    if (!workflow) {
      throwError(GRAPHQL_ERROR_CODES.NOT_FOUND, `Workflow not found: ${args.id}`);
    }

    if (workflow.status === 'RUNNING') {
      throwError(GRAPHQL_ERROR_CODES.CONFLICT, 'Workflow is already running');
    }

    const updatedWorkflow: GqlWorkflow = {
      ...workflow,
      status: 'RUNNING' as GqlWorkflowStatus,
      startedAt: new Date(),
      updatedAt: new Date(),
    };

    workflowStore.set(args.id, updatedWorkflow);
    logger.info('Workflow started', { workflowId: args.id });

    return updatedWorkflow;
  }) as ResolverFn<GqlWorkflow>,

  stopWorkflow: (async (
    _parent: unknown,
    args: { id: string },
    context: GraphQLContext
  ): Promise<GqlWorkflow> => {
    logger.info('Mutation: stopWorkflow', { id: args.id, requestId: context.requestId });

    const workflow = workflowStore.get(args.id);
    if (!workflow) {
      throwError(GRAPHQL_ERROR_CODES.NOT_FOUND, `Workflow not found: ${args.id}`);
    }

    const updatedWorkflow: GqlWorkflow = {
      ...workflow,
      status: 'CANCELLED' as GqlWorkflowStatus,
      completedAt: new Date(),
      updatedAt: new Date(),
    };

    workflowStore.set(args.id, updatedWorkflow);
    logger.info('Workflow stopped', { workflowId: args.id });

    return updatedWorkflow;
  }) as ResolverFn<GqlWorkflow>,

  pauseWorkflow: (async (
    _parent: unknown,
    args: { id: string },
    context: GraphQLContext
  ): Promise<GqlWorkflow> => {
    logger.info('Mutation: pauseWorkflow', { id: args.id, requestId: context.requestId });

    const workflow = workflowStore.get(args.id);
    if (!workflow) {
      throwError(GRAPHQL_ERROR_CODES.NOT_FOUND, `Workflow not found: ${args.id}`);
    }

    if (workflow.status !== 'RUNNING') {
      throwError(GRAPHQL_ERROR_CODES.CONFLICT, 'Workflow is not running');
    }

    const updatedWorkflow: GqlWorkflow = {
      ...workflow,
      status: 'PAUSED' as GqlWorkflowStatus,
      updatedAt: new Date(),
    };

    workflowStore.set(args.id, updatedWorkflow);
    logger.info('Workflow paused', { workflowId: args.id });

    return updatedWorkflow;
  }) as ResolverFn<GqlWorkflow>,

  resumeWorkflow: (async (
    _parent: unknown,
    args: { id: string },
    context: GraphQLContext
  ): Promise<GqlWorkflow> => {
    logger.info('Mutation: resumeWorkflow', { id: args.id, requestId: context.requestId });

    const workflow = workflowStore.get(args.id);
    if (!workflow) {
      throwError(GRAPHQL_ERROR_CODES.NOT_FOUND, `Workflow not found: ${args.id}`);
    }

    if (workflow.status !== 'PAUSED') {
      throwError(GRAPHQL_ERROR_CODES.CONFLICT, 'Workflow is not paused');
    }

    const updatedWorkflow: GqlWorkflow = {
      ...workflow,
      status: 'RUNNING' as GqlWorkflowStatus,
      updatedAt: new Date(),
    };

    workflowStore.set(args.id, updatedWorkflow);
    logger.info('Workflow resumed', { workflowId: args.id });

    return updatedWorkflow;
  }) as ResolverFn<GqlWorkflow>,

  retryWorkflow: (async (
    _parent: unknown,
    args: { id: string },
    context: GraphQLContext
  ): Promise<GqlWorkflow> => {
    logger.info('Mutation: retryWorkflow', { id: args.id, requestId: context.requestId });

    const workflow = workflowStore.get(args.id);
    if (!workflow) {
      throwError(GRAPHQL_ERROR_CODES.NOT_FOUND, `Workflow not found: ${args.id}`);
    }

    if (workflow.status !== 'FAILED') {
      throwError(GRAPHQL_ERROR_CODES.CONFLICT, 'Can only retry failed workflows');
    }

    const updatedWorkflow: GqlWorkflow = {
      ...workflow,
      status: 'RUNNING' as GqlWorkflowStatus,
      error: undefined,
      startedAt: new Date(),
      completedAt: undefined,
      updatedAt: new Date(),
    };

    workflowStore.set(args.id, updatedWorkflow);
    logger.info('Workflow retried', { workflowId: args.id });

    return updatedWorkflow;
  }) as ResolverFn<GqlWorkflow>,

  // ==================== Task Mutations ====================

  createTask: (async (
    _parent: unknown,
    args: { input: { name: string; workflowId?: string; agentId?: string; input?: Record<string, unknown> } },
    context: GraphQLContext
  ): Promise<GqlTask> => {
    logger.info('Mutation: createTask', { input: args.input, requestId: context.requestId });

    const task: GqlTask = {
      id: uuidv4(),
      name: args.input.name,
      status: 'PENDING' as GqlTaskStatus,
      workflow: args.input.workflowId ? workflowStore.get(args.input.workflowId) : undefined,
      agent: args.input.agentId ? agentStore.get(args.input.agentId) : undefined,
      input: args.input.input,
      progress: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    taskStore.set(task.id, task);
    logger.info('Task created', { taskId: task.id, name: task.name });

    return task;
  }) as ResolverFn<GqlTask>,

  cancelTask: (async (
    _parent: unknown,
    args: { id: string },
    context: GraphQLContext
  ): Promise<GqlTask> => {
    logger.info('Mutation: cancelTask', { id: args.id, requestId: context.requestId });

    const task = taskStore.get(args.id);
    if (!task) {
      throwError(GRAPHQL_ERROR_CODES.NOT_FOUND, `Task not found: ${args.id}`);
    }

    if (task.status === 'COMPLETED' || task.status === 'CANCELLED') {
      throwError(GRAPHQL_ERROR_CODES.CONFLICT, 'Task already completed or cancelled');
    }

    const updatedTask: GqlTask = {
      ...task,
      status: 'CANCELLED' as GqlTaskStatus,
      completedAt: new Date(),
      updatedAt: new Date(),
    };

    taskStore.set(args.id, updatedTask);
    logger.info('Task cancelled', { taskId: args.id });

    return updatedTask;
  }) as ResolverFn<GqlTask>,

  retryTask: (async (
    _parent: unknown,
    args: { id: string },
    context: GraphQLContext
  ): Promise<GqlTask> => {
    logger.info('Mutation: retryTask', { id: args.id, requestId: context.requestId });

    const task = taskStore.get(args.id);
    if (!task) {
      throwError(GRAPHQL_ERROR_CODES.NOT_FOUND, `Task not found: ${args.id}`);
    }

    if (task.status !== 'FAILED') {
      throwError(GRAPHQL_ERROR_CODES.CONFLICT, 'Can only retry failed tasks');
    }

    const updatedTask: GqlTask = {
      ...task,
      status: 'PENDING' as GqlTaskStatus,
      error: undefined,
      progress: 0,
      startedAt: undefined,
      completedAt: undefined,
      updatedAt: new Date(),
    };

    taskStore.set(args.id, updatedTask);
    logger.info('Task retried', { taskId: args.id });

    return updatedTask;
  }) as ResolverFn<GqlTask>,

  // ==================== Tool Mutations ====================

  executeTool: (async (
    _parent: unknown,
    args: { input: ExecuteToolInput },
    context: GraphQLContext
  ): Promise<GqlToolResult> => {
    logger.info('Mutation: executeTool', { input: args.input, requestId: context.requestId });

    const startTime = Date.now();

    // Simulate tool execution
    await new Promise(resolve => setTimeout(resolve, 100));

    const result: GqlToolResult = {
      success: true,
      result: { executed: true, toolId: args.input.toolId, params: args.input.params },
      executionTime: Date.now() - startTime,
      timestamp: new Date(),
    };

    logger.info('Tool executed', { toolId: args.input.toolId, executionTime: result.executionTime });

    return result;
  }) as ResolverFn<GqlToolResult>,

  enableTool: (async (
    _parent: unknown,
    args: { id: string },
    context: GraphQLContext
  ): Promise<GqlTool> => {
    logger.info('Mutation: enableTool', { id: args.id, requestId: context.requestId });

    // Return mock enabled tool
    return {
      id: args.id,
      name: 'mock_tool',
      type: 'BUILTIN' as GqlToolType,
      enabled: true,
      executionCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }) as ResolverFn<GqlTool>,

  disableTool: (async (
    _parent: unknown,
    args: { id: string },
    context: GraphQLContext
  ): Promise<GqlTool> => {
    logger.info('Mutation: disableTool', { id: args.id, requestId: context.requestId });

    // Return mock disabled tool
    return {
      id: args.id,
      name: 'mock_tool',
      type: 'BUILTIN' as GqlToolType,
      enabled: false,
      executionCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }) as ResolverFn<GqlTool>,

  // ==================== Hook Mutations ====================

  createHook: (async (
    _parent: unknown,
    args: { input: CreateHookInput },
    context: GraphQLContext
  ): Promise<GqlHook> => {
    logger.info('Mutation: createHook', { input: args.input, requestId: context.requestId });

    const hook: GqlHook = {
      id: uuidv4(),
      name: args.input.name,
      trigger: args.input.trigger,
      targetType: args.input.targetType,
      targetId: args.input.targetId,
      handler: args.input.handler,
      config: args.input.config,
      enabled: args.input.enabled ?? true,
      executionCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    hookStore.set(hook.id, hook);
    logger.info('Hook created', { hookId: hook.id, name: hook.name });

    return hook;
  }) as ResolverFn<GqlHook>,

  updateHook: (async (
    _parent: unknown,
    args: { id: string; input: UpdateHookInput },
    context: GraphQLContext
  ): Promise<GqlHook> => {
    logger.info('Mutation: updateHook', { id: args.id, input: args.input, requestId: context.requestId });

    const hook = hookStore.get(args.id);
    if (!hook) {
      throwError(GRAPHQL_ERROR_CODES.NOT_FOUND, `Hook not found: ${args.id}`);
    }

    const updatedHook: GqlHook = {
      ...hook,
      name: args.input.name ?? hook.name,
      handler: args.input.handler ?? hook.handler,
      config: args.input.config ?? hook.config,
      enabled: args.input.enabled ?? hook.enabled,
      updatedAt: new Date(),
    };

    hookStore.set(args.id, updatedHook);
    logger.info('Hook updated', { hookId: args.id });

    return updatedHook;
  }) as ResolverFn<GqlHook>,

  deleteHook: (async (
    _parent: unknown,
    args: { id: string },
    context: GraphQLContext
  ): Promise<{ success: boolean; message?: string }> => {
    logger.info('Mutation: deleteHook', { id: args.id, requestId: context.requestId });

    const hook = hookStore.get(args.id);
    if (!hook) {
      throwError(GRAPHQL_ERROR_CODES.NOT_FOUND, `Hook not found: ${args.id}`);
    }

    hookStore.delete(args.id);
    logger.info('Hook deleted', { hookId: args.id });

    return { success: true, message: `Hook ${args.id} deleted` };
  }) as ResolverFn<{ success: boolean; message?: string }>,

  enableHook: (async (
    _parent: unknown,
    args: { id: string },
    context: GraphQLContext
  ): Promise<GqlHook> => {
    logger.info('Mutation: enableHook', { id: args.id, requestId: context.requestId });

    const hook = hookStore.get(args.id);
    if (!hook) {
      throwError(GRAPHQL_ERROR_CODES.NOT_FOUND, `Hook not found: ${args.id}`);
    }

    const updatedHook: GqlHook = {
      ...hook,
      enabled: true,
      updatedAt: new Date(),
    };

    hookStore.set(args.id, updatedHook);
    logger.info('Hook enabled', { hookId: args.id });

    return updatedHook;
  }) as ResolverFn<GqlHook>,

  disableHook: (async (
    _parent: unknown,
    args: { id: string },
    context: GraphQLContext
  ): Promise<GqlHook> => {
    logger.info('Mutation: disableHook', { id: args.id, requestId: context.requestId });

    const hook = hookStore.get(args.id);
    if (!hook) {
      throwError(GRAPHQL_ERROR_CODES.NOT_FOUND, `Hook not found: ${args.id}`);
    }

    const updatedHook: GqlHook = {
      ...hook,
      enabled: false,
      updatedAt: new Date(),
    };

    hookStore.set(args.id, updatedHook);
    logger.info('Hook disabled', { hookId: args.id });

    return updatedHook;
  }) as ResolverFn<GqlHook>,

  triggerHook: (async (
    _parent: unknown,
    args: { id: string; payload?: Record<string, unknown> },
    context: GraphQLContext
  ): Promise<{ success: boolean; message?: string }> => {
    logger.info('Mutation: triggerHook', { id: args.id, requestId: context.requestId });

    const hook = hookStore.get(args.id);
    if (!hook) {
      throwError(GRAPHQL_ERROR_CODES.NOT_FOUND, `Hook not found: ${args.id}`);
    }

    if (!hook.enabled) {
      throwError(GRAPHQL_ERROR_CODES.CONFLICT, 'Hook is disabled');
    }

    // Simulate hook execution
    logger.info('Hook triggered', { hookId: args.id, handler: hook.handler });

    return { success: true, message: `Hook ${args.id} triggered successfully` };
  }) as ResolverFn<{ success: boolean; message?: string }>,
};

// Export stores for testing
export { agentStore, workflowStore, taskStore, hookStore };
