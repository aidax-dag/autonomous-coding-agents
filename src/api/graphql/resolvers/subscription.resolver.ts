/**
 * GraphQL Subscription Resolvers
 *
 * Feature: F4.3 - GraphQL API
 *
 * Implements subscription resolvers for real-time events using
 * async iterators and pub/sub pattern.
 *
 * @module api/graphql/resolvers/subscription
 */

import { EventEmitter } from 'events';
import { createLogger } from '../../../core/services/logger.js';
import type {
  GraphQLContext,
  GqlAgent,
  GqlWorkflow,
  GqlTask,
  GqlTool,
  GqlHook,
  GqlSystemMetrics,
  GqlToolResult,
  GqlAgentStatus,
} from '../interfaces/graphql.interface.js';

const logger = createLogger('GraphQL:SubscriptionResolver');

// ==================== PubSub Implementation ====================

/**
 * Simple PubSub implementation using EventEmitter
 * In production, use Redis PubSub or similar for scalability
 */
class PubSub {
  private emitter: EventEmitter;
  private subscriptionId: number = 0;

  constructor() {
    this.emitter = new EventEmitter();
    this.emitter.setMaxListeners(100);
  }

  /**
   * Publish an event
   */
  publish<T>(event: string, payload: T): void {
    logger.debug('PubSub: publish', { event });
    this.emitter.emit(event, payload);
  }

  /**
   * Subscribe to an event
   */
  async *subscribe<T>(event: string): AsyncIterableIterator<T> {
    const id = ++this.subscriptionId;
    logger.debug('PubSub: subscribe', { event, subscriptionId: id });

    const queue: T[] = [];
    let resolveNext: ((value: IteratorResult<T>) => void) | null = null;
    let done = false;

    const listener = (payload: T) => {
      if (resolveNext) {
        resolveNext({ value: payload, done: false });
        resolveNext = null;
      } else {
        queue.push(payload);
      }
    };

    this.emitter.on(event, listener);

    try {
      while (!done) {
        if (queue.length > 0) {
          yield queue.shift()!;
        } else {
          yield await new Promise<T>((resolve) => {
            resolveNext = (result) => {
              if (!result.done) {
                resolve(result.value);
              }
            };
          });
        }
      }
    } finally {
      this.emitter.off(event, listener);
      logger.debug('PubSub: unsubscribe', { event, subscriptionId: id });
    }
  }
}

// Global PubSub instance
export const pubsub = new PubSub();

// ==================== Event Names ====================

export const SUBSCRIPTION_EVENTS = {
  // Agent events
  AGENT_CREATED: 'AGENT_CREATED',
  AGENT_UPDATED: 'AGENT_UPDATED',
  AGENT_DELETED: 'AGENT_DELETED',
  AGENT_STATUS_CHANGED: 'AGENT_STATUS_CHANGED',

  // Workflow events
  WORKFLOW_CREATED: 'WORKFLOW_CREATED',
  WORKFLOW_UPDATED: 'WORKFLOW_UPDATED',
  WORKFLOW_COMPLETED: 'WORKFLOW_COMPLETED',
  WORKFLOW_FAILED: 'WORKFLOW_FAILED',
  WORKFLOW_PROGRESS: 'WORKFLOW_PROGRESS',

  // Task events
  TASK_CREATED: 'TASK_CREATED',
  TASK_UPDATED: 'TASK_UPDATED',
  TASK_COMPLETED: 'TASK_COMPLETED',
  TASK_FAILED: 'TASK_FAILED',
  TASK_PROGRESS: 'TASK_PROGRESS',

  // Tool events
  TOOL_EXECUTED: 'TOOL_EXECUTED',

  // Hook events
  HOOK_TRIGGERED: 'HOOK_TRIGGERED',

  // System events
  METRICS_UPDATED: 'METRICS_UPDATED',
} as const;

// ==================== Subscription Payload Types ====================

export interface AgentStatusChangePayload {
  agent: GqlAgent;
  previousStatus: GqlAgentStatus;
  newStatus: GqlAgentStatus;
  timestamp: Date;
}

export interface WorkflowProgressPayload {
  workflow: GqlWorkflow;
  progress: number;
  currentStep?: { id: string; name: string; type: string; status: string };
  timestamp: Date;
}

export interface TaskProgressPayload {
  task: GqlTask;
  progress: number;
  message?: string;
  timestamp: Date;
}

export interface ToolExecutionPayload {
  tool: GqlTool;
  result: GqlToolResult;
  agentId?: string;
  timestamp: Date;
}

export interface HookExecutionPayload {
  hook: GqlHook;
  success: boolean;
  error?: string;
  payload?: Record<string, unknown>;
  timestamp: Date;
}

// ==================== Helper Functions ====================

/**
 * Create filtered async iterator
 */
async function* withFilter<T>(
  asyncIterator: AsyncIterableIterator<T>,
  filterFn: (payload: T) => boolean | Promise<boolean>
): AsyncIterableIterator<T> {
  for await (const payload of asyncIterator) {
    if (await filterFn(payload)) {
      yield payload;
    }
  }
}

// ==================== Subscription Resolvers ====================

/**
 * Subscription resolvers
 */
export const SubscriptionResolvers = {
  // ==================== Agent Subscriptions ====================

  agentCreated: {
    subscribe: (_parent: unknown, _args: unknown, context: GraphQLContext) => {
      logger.debug('Subscription: agentCreated', { requestId: context.requestId });
      return pubsub.subscribe<GqlAgent>(SUBSCRIPTION_EVENTS.AGENT_CREATED);
    },
    resolve: (payload: GqlAgent) => payload,
  },

  agentUpdated: {
    subscribe: (_parent: unknown, args: { id?: string }, context: GraphQLContext) => {
      logger.debug('Subscription: agentUpdated', { id: args.id, requestId: context.requestId });
      const iterator = pubsub.subscribe<GqlAgent>(SUBSCRIPTION_EVENTS.AGENT_UPDATED);

      if (args.id) {
        return withFilter(iterator, (agent) => agent.id === args.id);
      }
      return iterator;
    },
    resolve: (payload: GqlAgent) => payload,
  },

  agentDeleted: {
    subscribe: (_parent: unknown, _args: unknown, context: GraphQLContext) => {
      logger.debug('Subscription: agentDeleted', { requestId: context.requestId });
      return pubsub.subscribe<string>(SUBSCRIPTION_EVENTS.AGENT_DELETED);
    },
    resolve: (payload: string) => payload,
  },

  agentStatusChanged: {
    subscribe: (_parent: unknown, args: { id?: string }, context: GraphQLContext) => {
      logger.debug('Subscription: agentStatusChanged', { id: args.id, requestId: context.requestId });
      const iterator = pubsub.subscribe<AgentStatusChangePayload>(SUBSCRIPTION_EVENTS.AGENT_STATUS_CHANGED);

      if (args.id) {
        return withFilter(iterator, (payload) => payload.agent.id === args.id);
      }
      return iterator;
    },
    resolve: (payload: AgentStatusChangePayload) => payload,
  },

  // ==================== Workflow Subscriptions ====================

  workflowCreated: {
    subscribe: (_parent: unknown, args: { agentId?: string }, context: GraphQLContext) => {
      logger.debug('Subscription: workflowCreated', { agentId: args.agentId, requestId: context.requestId });
      const iterator = pubsub.subscribe<GqlWorkflow>(SUBSCRIPTION_EVENTS.WORKFLOW_CREATED);

      if (args.agentId) {
        return withFilter(iterator, (workflow) => workflow.agent.id === args.agentId);
      }
      return iterator;
    },
    resolve: (payload: GqlWorkflow) => payload,
  },

  workflowUpdated: {
    subscribe: (_parent: unknown, args: { id?: string }, context: GraphQLContext) => {
      logger.debug('Subscription: workflowUpdated', { id: args.id, requestId: context.requestId });
      const iterator = pubsub.subscribe<GqlWorkflow>(SUBSCRIPTION_EVENTS.WORKFLOW_UPDATED);

      if (args.id) {
        return withFilter(iterator, (workflow) => workflow.id === args.id);
      }
      return iterator;
    },
    resolve: (payload: GqlWorkflow) => payload,
  },

  workflowCompleted: {
    subscribe: (_parent: unknown, args: { id?: string }, context: GraphQLContext) => {
      logger.debug('Subscription: workflowCompleted', { id: args.id, requestId: context.requestId });
      const iterator = pubsub.subscribe<GqlWorkflow>(SUBSCRIPTION_EVENTS.WORKFLOW_COMPLETED);

      if (args.id) {
        return withFilter(iterator, (workflow) => workflow.id === args.id);
      }
      return iterator;
    },
    resolve: (payload: GqlWorkflow) => payload,
  },

  workflowFailed: {
    subscribe: (_parent: unknown, args: { id?: string }, context: GraphQLContext) => {
      logger.debug('Subscription: workflowFailed', { id: args.id, requestId: context.requestId });
      const iterator = pubsub.subscribe<GqlWorkflow>(SUBSCRIPTION_EVENTS.WORKFLOW_FAILED);

      if (args.id) {
        return withFilter(iterator, (workflow) => workflow.id === args.id);
      }
      return iterator;
    },
    resolve: (payload: GqlWorkflow) => payload,
  },

  workflowProgress: {
    subscribe: (_parent: unknown, args: { id: string }, context: GraphQLContext) => {
      logger.debug('Subscription: workflowProgress', { id: args.id, requestId: context.requestId });
      const iterator = pubsub.subscribe<WorkflowProgressPayload>(SUBSCRIPTION_EVENTS.WORKFLOW_PROGRESS);
      return withFilter(iterator, (payload) => payload.workflow.id === args.id);
    },
    resolve: (payload: WorkflowProgressPayload) => payload,
  },

  // ==================== Task Subscriptions ====================

  taskCreated: {
    subscribe: (
      _parent: unknown,
      args: { workflowId?: string; agentId?: string },
      context: GraphQLContext
    ) => {
      logger.debug('Subscription: taskCreated', { args, requestId: context.requestId });
      const iterator = pubsub.subscribe<GqlTask>(SUBSCRIPTION_EVENTS.TASK_CREATED);

      if (args.workflowId || args.agentId) {
        return withFilter(iterator, (task) => {
          if (args.workflowId && task.workflow?.id !== args.workflowId) return false;
          if (args.agentId && task.agent?.id !== args.agentId) return false;
          return true;
        });
      }
      return iterator;
    },
    resolve: (payload: GqlTask) => payload,
  },

  taskUpdated: {
    subscribe: (_parent: unknown, args: { id?: string }, context: GraphQLContext) => {
      logger.debug('Subscription: taskUpdated', { id: args.id, requestId: context.requestId });
      const iterator = pubsub.subscribe<GqlTask>(SUBSCRIPTION_EVENTS.TASK_UPDATED);

      if (args.id) {
        return withFilter(iterator, (task) => task.id === args.id);
      }
      return iterator;
    },
    resolve: (payload: GqlTask) => payload,
  },

  taskCompleted: {
    subscribe: (_parent: unknown, args: { id?: string }, context: GraphQLContext) => {
      logger.debug('Subscription: taskCompleted', { id: args.id, requestId: context.requestId });
      const iterator = pubsub.subscribe<GqlTask>(SUBSCRIPTION_EVENTS.TASK_COMPLETED);

      if (args.id) {
        return withFilter(iterator, (task) => task.id === args.id);
      }
      return iterator;
    },
    resolve: (payload: GqlTask) => payload,
  },

  taskFailed: {
    subscribe: (_parent: unknown, args: { id?: string }, context: GraphQLContext) => {
      logger.debug('Subscription: taskFailed', { id: args.id, requestId: context.requestId });
      const iterator = pubsub.subscribe<GqlTask>(SUBSCRIPTION_EVENTS.TASK_FAILED);

      if (args.id) {
        return withFilter(iterator, (task) => task.id === args.id);
      }
      return iterator;
    },
    resolve: (payload: GqlTask) => payload,
  },

  taskProgress: {
    subscribe: (_parent: unknown, args: { id: string }, context: GraphQLContext) => {
      logger.debug('Subscription: taskProgress', { id: args.id, requestId: context.requestId });
      const iterator = pubsub.subscribe<TaskProgressPayload>(SUBSCRIPTION_EVENTS.TASK_PROGRESS);
      return withFilter(iterator, (payload) => payload.task.id === args.id);
    },
    resolve: (payload: TaskProgressPayload) => payload,
  },

  // ==================== Tool Subscriptions ====================

  toolExecuted: {
    subscribe: (_parent: unknown, args: { id?: string }, context: GraphQLContext) => {
      logger.debug('Subscription: toolExecuted', { id: args.id, requestId: context.requestId });
      const iterator = pubsub.subscribe<ToolExecutionPayload>(SUBSCRIPTION_EVENTS.TOOL_EXECUTED);

      if (args.id) {
        return withFilter(iterator, (payload) => payload.tool.id === args.id);
      }
      return iterator;
    },
    resolve: (payload: ToolExecutionPayload) => payload,
  },

  // ==================== Hook Subscriptions ====================

  hookTriggered: {
    subscribe: (
      _parent: unknown,
      args: { id?: string; targetType?: string },
      context: GraphQLContext
    ) => {
      logger.debug('Subscription: hookTriggered', { args, requestId: context.requestId });
      const iterator = pubsub.subscribe<HookExecutionPayload>(SUBSCRIPTION_EVENTS.HOOK_TRIGGERED);

      if (args.id || args.targetType) {
        return withFilter(iterator, (payload) => {
          if (args.id && payload.hook.id !== args.id) return false;
          if (args.targetType && payload.hook.targetType !== args.targetType) return false;
          return true;
        });
      }
      return iterator;
    },
    resolve: (payload: HookExecutionPayload) => payload,
  },

  // ==================== System Subscriptions ====================

  metricsUpdated: {
    subscribe: (_parent: unknown, _args: unknown, context: GraphQLContext) => {
      logger.debug('Subscription: metricsUpdated', { requestId: context.requestId });
      return pubsub.subscribe<GqlSystemMetrics>(SUBSCRIPTION_EVENTS.METRICS_UPDATED);
    },
    resolve: (payload: GqlSystemMetrics) => payload,
  },
};

// ==================== Publisher Functions ====================

/**
 * Publisher functions for emitting subscription events
 */
export const publishers = {
  // Agent publishers
  agentCreated: (agent: GqlAgent) => {
    pubsub.publish(SUBSCRIPTION_EVENTS.AGENT_CREATED, agent);
  },

  agentUpdated: (agent: GqlAgent) => {
    pubsub.publish(SUBSCRIPTION_EVENTS.AGENT_UPDATED, agent);
  },

  agentDeleted: (agentId: string) => {
    pubsub.publish(SUBSCRIPTION_EVENTS.AGENT_DELETED, agentId);
  },

  agentStatusChanged: (
    agent: GqlAgent,
    previousStatus: GqlAgentStatus,
    newStatus: GqlAgentStatus
  ) => {
    pubsub.publish(SUBSCRIPTION_EVENTS.AGENT_STATUS_CHANGED, {
      agent,
      previousStatus,
      newStatus,
      timestamp: new Date(),
    });
  },

  // Workflow publishers
  workflowCreated: (workflow: GqlWorkflow) => {
    pubsub.publish(SUBSCRIPTION_EVENTS.WORKFLOW_CREATED, workflow);
  },

  workflowUpdated: (workflow: GqlWorkflow) => {
    pubsub.publish(SUBSCRIPTION_EVENTS.WORKFLOW_UPDATED, workflow);
  },

  workflowCompleted: (workflow: GqlWorkflow) => {
    pubsub.publish(SUBSCRIPTION_EVENTS.WORKFLOW_COMPLETED, workflow);
  },

  workflowFailed: (workflow: GqlWorkflow) => {
    pubsub.publish(SUBSCRIPTION_EVENTS.WORKFLOW_FAILED, workflow);
  },

  workflowProgress: (payload: WorkflowProgressPayload) => {
    pubsub.publish(SUBSCRIPTION_EVENTS.WORKFLOW_PROGRESS, payload);
  },

  // Task publishers
  taskCreated: (task: GqlTask) => {
    pubsub.publish(SUBSCRIPTION_EVENTS.TASK_CREATED, task);
  },

  taskUpdated: (task: GqlTask) => {
    pubsub.publish(SUBSCRIPTION_EVENTS.TASK_UPDATED, task);
  },

  taskCompleted: (task: GqlTask) => {
    pubsub.publish(SUBSCRIPTION_EVENTS.TASK_COMPLETED, task);
  },

  taskFailed: (task: GqlTask) => {
    pubsub.publish(SUBSCRIPTION_EVENTS.TASK_FAILED, task);
  },

  taskProgress: (payload: TaskProgressPayload) => {
    pubsub.publish(SUBSCRIPTION_EVENTS.TASK_PROGRESS, payload);
  },

  // Tool publishers
  toolExecuted: (payload: ToolExecutionPayload) => {
    pubsub.publish(SUBSCRIPTION_EVENTS.TOOL_EXECUTED, payload);
  },

  // Hook publishers
  hookTriggered: (payload: HookExecutionPayload) => {
    pubsub.publish(SUBSCRIPTION_EVENTS.HOOK_TRIGGERED, payload);
  },

  // System publishers
  metricsUpdated: (metrics: GqlSystemMetrics) => {
    pubsub.publish(SUBSCRIPTION_EVENTS.METRICS_UPDATED, metrics);
  },
};
