/**
 * GraphQL Subscription Resolver Unit Tests
 *
 * Feature: F4.3 - GraphQL API
 *
 * @module tests/unit/api/graphql/resolvers/subscription
 */

import {
  SubscriptionResolvers,
  publishers,
  pubsub,
  SUBSCRIPTION_EVENTS,
} from '../../../../../src/api/graphql/resolvers/subscription.resolver';
import type { GraphQLContext, GqlAgent, GqlAgentStatus } from '../../../../../src/api/graphql/interfaces/graphql.interface';
import type { FastifyRequest, FastifyReply } from 'fastify';

// Mock context helper
function createMockContext(overrides: Partial<GraphQLContext> = {}): GraphQLContext {
  return {
    request: {} as FastifyRequest,
    reply: {} as FastifyReply,
    requestId: 'test-request-id',
    timestamp: new Date(),
    auth: {
      authenticated: true,
      userId: 'test-user',
      permissions: ['read', 'write'],
    },
    ...overrides,
  } as GraphQLContext;
}

// Helper to collect async iterator values
async function collectAsyncIterator<T>(
  iterator: AsyncIterableIterator<T>,
  count: number
): Promise<T[]> {
  const results: T[] = [];
  for await (const value of iterator) {
    results.push(value);
    if (results.length >= count) break;
  }
  return results;
}

// Helper to create mock agent
function createMockAgent(overrides: Partial<GqlAgent> = {}): GqlAgent {
  return {
    id: 'agent-1',
    name: 'TestAgent',
    type: 'reviewer',
    status: 'IDLE' as GqlAgentStatus,
    tools: [],
    hooks: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('GraphQL Subscription Resolvers', () => {
  describe('PubSub', () => {
    it('should publish and receive events', async () => {
      const testEvent = 'TEST_EVENT';
      const testPayload = { message: 'hello' };

      // Create subscription
      const iterator = pubsub.subscribe<{ message: string }>(testEvent);

      // Publish after a short delay
      setTimeout(() => {
        pubsub.publish(testEvent, testPayload);
      }, 10);

      // Collect the first result
      const results = await collectAsyncIterator(iterator, 1);

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual(testPayload);
    });

    it('should handle multiple subscribers', async () => {
      const testEvent = 'MULTI_TEST';
      const testPayload = { data: 'test' };

      // Create multiple subscriptions
      const iterator1 = pubsub.subscribe<{ data: string }>(testEvent);
      const iterator2 = pubsub.subscribe<{ data: string }>(testEvent);

      // Publish event
      setTimeout(() => {
        pubsub.publish(testEvent, testPayload);
      }, 10);

      // Both subscribers should receive the event
      const [results1, results2] = await Promise.all([
        collectAsyncIterator(iterator1, 1),
        collectAsyncIterator(iterator2, 1),
      ]);

      expect(results1[0]).toEqual(testPayload);
      expect(results2[0]).toEqual(testPayload);
    });
  });

  describe('SUBSCRIPTION_EVENTS', () => {
    it('should have all expected event types', () => {
      expect(SUBSCRIPTION_EVENTS.AGENT_CREATED).toBe('AGENT_CREATED');
      expect(SUBSCRIPTION_EVENTS.AGENT_UPDATED).toBe('AGENT_UPDATED');
      expect(SUBSCRIPTION_EVENTS.AGENT_DELETED).toBe('AGENT_DELETED');
      expect(SUBSCRIPTION_EVENTS.AGENT_STATUS_CHANGED).toBe('AGENT_STATUS_CHANGED');
      expect(SUBSCRIPTION_EVENTS.WORKFLOW_CREATED).toBe('WORKFLOW_CREATED');
      expect(SUBSCRIPTION_EVENTS.WORKFLOW_PROGRESS).toBe('WORKFLOW_PROGRESS');
      expect(SUBSCRIPTION_EVENTS.TASK_CREATED).toBe('TASK_CREATED');
      expect(SUBSCRIPTION_EVENTS.TASK_COMPLETED).toBe('TASK_COMPLETED');
      expect(SUBSCRIPTION_EVENTS.TOOL_EXECUTED).toBe('TOOL_EXECUTED');
      expect(SUBSCRIPTION_EVENTS.HOOK_TRIGGERED).toBe('HOOK_TRIGGERED');
      expect(SUBSCRIPTION_EVENTS.METRICS_UPDATED).toBe('METRICS_UPDATED');
    });
  });

  describe('Agent Subscriptions', () => {
    describe('agentCreated', () => {
      it('should return subscription iterator', () => {
        const context = createMockContext();
        const iterator = SubscriptionResolvers.agentCreated.subscribe(
          {},
          {},
          context
        );

        expect(iterator).toBeDefined();
        expect(iterator[Symbol.asyncIterator]).toBeDefined();
      });

      it('should receive created agent events', async () => {
        const context = createMockContext();
        const iterator = SubscriptionResolvers.agentCreated.subscribe(
          {},
          {},
          context
        );

        const mockAgent = createMockAgent({ id: 'new-agent' });

        // Publish event
        setTimeout(() => {
          publishers.agentCreated(mockAgent);
        }, 10);

        // Collect result
        const results = await collectAsyncIterator(iterator, 1);

        expect(results[0]).toEqual(mockAgent);
      });

      it('should resolve payload correctly', () => {
        const mockAgent = createMockAgent();
        const resolved = SubscriptionResolvers.agentCreated.resolve(mockAgent);
        expect(resolved).toBe(mockAgent);
      });
    });

    describe('agentUpdated', () => {
      it('should filter by agent id when provided', async () => {
        const context = createMockContext();
        const targetAgentId = 'target-agent';

        const iterator = SubscriptionResolvers.agentUpdated.subscribe(
          {},
          { id: targetAgentId },
          context
        );

        const targetAgent = createMockAgent({ id: targetAgentId });
        const otherAgent = createMockAgent({ id: 'other-agent' });

        // Publish events
        setTimeout(() => {
          publishers.agentUpdated(otherAgent); // Should be filtered out
          publishers.agentUpdated(targetAgent); // Should pass through
        }, 10);

        const results = await collectAsyncIterator(iterator, 1);

        expect(results[0].id).toBe(targetAgentId);
      });
    });

    describe('agentStatusChanged', () => {
      it('should publish status change events', async () => {
        const context = createMockContext();
        const iterator = SubscriptionResolvers.agentStatusChanged.subscribe(
          {},
          {},
          context
        );

        const agent = createMockAgent({ status: 'RUNNING' as GqlAgentStatus });

        // Publish event
        setTimeout(() => {
          publishers.agentStatusChanged(agent, 'IDLE' as GqlAgentStatus, 'RUNNING' as GqlAgentStatus);
        }, 10);

        const results = await collectAsyncIterator(iterator, 1);

        expect(results[0].agent).toEqual(agent);
        expect(results[0].previousStatus).toBe('IDLE');
        expect(results[0].newStatus).toBe('RUNNING');
        expect(results[0].timestamp).toBeDefined();
      });
    });
  });

  describe('Publishers', () => {
    it('should have all publisher functions', () => {
      expect(typeof publishers.agentCreated).toBe('function');
      expect(typeof publishers.agentUpdated).toBe('function');
      expect(typeof publishers.agentDeleted).toBe('function');
      expect(typeof publishers.agentStatusChanged).toBe('function');
      expect(typeof publishers.workflowCreated).toBe('function');
      expect(typeof publishers.workflowUpdated).toBe('function');
      expect(typeof publishers.workflowCompleted).toBe('function');
      expect(typeof publishers.workflowFailed).toBe('function');
      expect(typeof publishers.workflowProgress).toBe('function');
      expect(typeof publishers.taskCreated).toBe('function');
      expect(typeof publishers.taskUpdated).toBe('function');
      expect(typeof publishers.taskCompleted).toBe('function');
      expect(typeof publishers.taskFailed).toBe('function');
      expect(typeof publishers.taskProgress).toBe('function');
      expect(typeof publishers.toolExecuted).toBe('function');
      expect(typeof publishers.hookTriggered).toBe('function');
      expect(typeof publishers.metricsUpdated).toBe('function');
    });

    it('should publish workflow events', async () => {
      const context = createMockContext();
      const iterator = SubscriptionResolvers.workflowCreated.subscribe(
        {},
        {},
        context
      );

      const mockWorkflow = {
        id: 'workflow-1',
        name: 'TestWorkflow',
        status: 'PENDING',
        agent: createMockAgent(),
        steps: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      setTimeout(() => {
        publishers.workflowCreated(mockWorkflow as never);
      }, 10);

      const results = await collectAsyncIterator(iterator, 1);

      expect(results[0].id).toBe('workflow-1');
    });

    it('should publish task events', async () => {
      const context = createMockContext();
      const iterator = SubscriptionResolvers.taskCreated.subscribe(
        {},
        {},
        context
      );

      const mockTask = {
        id: 'task-1',
        name: 'TestTask',
        status: 'PENDING',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      setTimeout(() => {
        publishers.taskCreated(mockTask as never);
      }, 10);

      const results = await collectAsyncIterator(iterator, 1);

      expect(results[0].id).toBe('task-1');
    });

    it('should publish tool execution events', async () => {
      const context = createMockContext();
      const iterator = SubscriptionResolvers.toolExecuted.subscribe(
        {},
        {},
        context
      );

      const mockPayload = {
        tool: {
          id: 'tool-1',
          name: 'file_read',
          type: 'BUILTIN',
          enabled: true,
          executionCount: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        result: {
          success: true,
          executionTime: 100,
          timestamp: new Date(),
        },
        timestamp: new Date(),
      };

      setTimeout(() => {
        publishers.toolExecuted(mockPayload as never);
      }, 10);

      const results = await collectAsyncIterator(iterator, 1);

      expect(results[0].tool.id).toBe('tool-1');
    });

    it('should publish metrics updates', async () => {
      const context = createMockContext();
      const iterator = SubscriptionResolvers.metricsUpdated.subscribe(
        {},
        {},
        context
      );

      const mockMetrics = {
        agents: { total: 10, active: 5 },
        workflows: { total: 20, active: 8, completed: 10, failed: 2 },
        tasks: { total: 100, active: 15, completed: 80, failed: 5 },
        tools: { total: 15, active: 12 },
        hooks: { total: 8, active: 6 },
        system: {
          uptime: 3600000,
          memoryUsage: 256,
          cpuUsage: 0.3,
          requestsPerSecond: 50,
          averageResponseTime: 25,
        },
      };

      setTimeout(() => {
        publishers.metricsUpdated(mockMetrics as never);
      }, 10);

      const results = await collectAsyncIterator(iterator, 1);

      expect(results[0].agents.total).toBe(10);
      expect(results[0].system.uptime).toBe(3600000);
    });
  });

  describe('Filtering', () => {
    it('should filter workflow events by agentId', async () => {
      const context = createMockContext();
      const targetAgentId = 'target-agent';

      const iterator = SubscriptionResolvers.workflowCreated.subscribe(
        {},
        { agentId: targetAgentId },
        context
      );

      const targetWorkflow = {
        id: 'workflow-1',
        name: 'Target',
        status: 'PENDING',
        agent: createMockAgent({ id: targetAgentId }),
        steps: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const otherWorkflow = {
        id: 'workflow-2',
        name: 'Other',
        status: 'PENDING',
        agent: createMockAgent({ id: 'other-agent' }),
        steps: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      setTimeout(() => {
        publishers.workflowCreated(otherWorkflow as never);
        publishers.workflowCreated(targetWorkflow as never);
      }, 10);

      const results = await collectAsyncIterator(iterator, 1);

      expect(results[0].agent.id).toBe(targetAgentId);
    });

    it('should filter task events by workflowId', async () => {
      const context = createMockContext();
      const targetWorkflowId = 'target-workflow';

      const iterator = SubscriptionResolvers.taskCreated.subscribe(
        {},
        { workflowId: targetWorkflowId },
        context
      );

      const targetTask = {
        id: 'task-1',
        name: 'Target',
        status: 'PENDING',
        workflow: { id: targetWorkflowId },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const otherTask = {
        id: 'task-2',
        name: 'Other',
        status: 'PENDING',
        workflow: { id: 'other-workflow' },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      setTimeout(() => {
        publishers.taskCreated(otherTask as never);
        publishers.taskCreated(targetTask as never);
      }, 10);

      const results = await collectAsyncIterator(iterator, 1);

      expect(results[0].workflow?.id).toBe(targetWorkflowId);
    });

    it('should filter hook events by targetType', async () => {
      const context = createMockContext();
      const targetType = 'workflow';

      const iterator = SubscriptionResolvers.hookTriggered.subscribe(
        {},
        { targetType },
        context
      );

      const targetPayload = {
        hook: {
          id: 'hook-1',
          name: 'TargetHook',
          trigger: 'BEFORE',
          targetType: 'workflow',
          handler: 'validate',
          enabled: true,
          executionCount: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        success: true,
        timestamp: new Date(),
      };

      const otherPayload = {
        hook: {
          id: 'hook-2',
          name: 'OtherHook',
          trigger: 'AFTER',
          targetType: 'task',
          handler: 'notify',
          enabled: true,
          executionCount: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        success: true,
        timestamp: new Date(),
      };

      setTimeout(() => {
        publishers.hookTriggered(otherPayload as never);
        publishers.hookTriggered(targetPayload as never);
      }, 10);

      const results = await collectAsyncIterator(iterator, 1);

      expect(results[0].hook.targetType).toBe(targetType);
    });
  });
});
