/**
 * GraphQL Mutation Resolver Unit Tests
 *
 * Feature: F4.3 - GraphQL API
 *
 * @module tests/unit/api/graphql/resolvers/mutation
 */

import {
  MutationResolvers,
  agentStore,
  workflowStore,
  taskStore,
  hookStore,
} from '../../../../../src/api/graphql/resolvers/mutation.resolver';
import type { GraphQLContext } from '../../../../../src/api/graphql/interfaces/graphql.interface';
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

describe('GraphQL Mutation Resolvers', () => {
  // Clear stores before each test
  beforeEach(() => {
    agentStore.clear();
    workflowStore.clear();
    taskStore.clear();
    hookStore.clear();
  });

  describe('Agent Mutations', () => {
    describe('createAgent', () => {
      it('should create a new agent', async () => {
        const context = createMockContext();
        const input = {
          name: 'TestAgent',
          type: 'reviewer',
          description: 'A test agent',
          config: { maxTokens: 2048 },
        };

        const result = await MutationResolvers.createAgent(
          {},
          { input },
          context,
          {}
        );

        expect(result).toBeDefined();
        expect(result.id).toBeDefined();
        expect(result.name).toBe('TestAgent');
        expect(result.type).toBe('reviewer');
        expect(result.status).toBe('IDLE');
        expect(agentStore.has(result.id)).toBe(true);
      });
    });

    describe('updateAgent', () => {
      it('should update an existing agent', async () => {
        const context = createMockContext();

        // Create agent first
        const created = await MutationResolvers.createAgent(
          {},
          { input: { name: 'Agent1', type: 'reviewer' } },
          context,
          {}
        );

        // Update agent
        const result = await MutationResolvers.updateAgent(
          {},
          { id: created.id, input: { name: 'UpdatedAgent', description: 'Updated' } },
          context,
          {}
        );

        expect(result.name).toBe('UpdatedAgent');
        expect(result.description).toBe('Updated');
      });

      it('should throw error for non-existent agent', async () => {
        const context = createMockContext();

        await expect(
          MutationResolvers.updateAgent(
            {},
            { id: 'non-existent', input: { name: 'Test' } },
            context,
            {}
          )
        ).rejects.toThrow();
      });
    });

    describe('deleteAgent', () => {
      it('should delete an existing agent', async () => {
        const context = createMockContext();

        // Create agent first
        const created = await MutationResolvers.createAgent(
          {},
          { input: { name: 'ToDelete', type: 'reviewer' } },
          context,
          {}
        );

        // Delete agent
        const result = await MutationResolvers.deleteAgent(
          {},
          { id: created.id },
          context,
          {}
        );

        expect(result.success).toBe(true);
        expect(agentStore.has(created.id)).toBe(false);
      });

      it('should not delete running agent', async () => {
        const context = createMockContext();

        // Create and start agent
        const created = await MutationResolvers.createAgent(
          {},
          { input: { name: 'Running', type: 'reviewer' } },
          context,
          {}
        );
        await MutationResolvers.startAgent({}, { id: created.id }, context, {});

        // Try to delete running agent
        await expect(
          MutationResolvers.deleteAgent({}, { id: created.id }, context, {})
        ).rejects.toThrow();
      });
    });

    describe('startAgent', () => {
      it('should start an idle agent', async () => {
        const context = createMockContext();

        const created = await MutationResolvers.createAgent(
          {},
          { input: { name: 'ToStart', type: 'reviewer' } },
          context,
          {}
        );

        const result = await MutationResolvers.startAgent(
          {},
          { id: created.id },
          context,
          {}
        );

        expect(result.status).toBe('RUNNING');
      });

      it('should throw error for already running agent', async () => {
        const context = createMockContext();

        const created = await MutationResolvers.createAgent(
          {},
          { input: { name: 'Running', type: 'reviewer' } },
          context,
          {}
        );
        await MutationResolvers.startAgent({}, { id: created.id }, context, {});

        await expect(
          MutationResolvers.startAgent({}, { id: created.id }, context, {})
        ).rejects.toThrow();
      });
    });

    describe('stopAgent', () => {
      it('should stop a running agent', async () => {
        const context = createMockContext();

        const created = await MutationResolvers.createAgent(
          {},
          { input: { name: 'ToStop', type: 'reviewer' } },
          context,
          {}
        );
        await MutationResolvers.startAgent({}, { id: created.id }, context, {});

        const result = await MutationResolvers.stopAgent(
          {},
          { id: created.id },
          context,
          {}
        );

        expect(result.status).toBe('STOPPED');
      });
    });

    describe('pauseAgent', () => {
      it('should pause a running agent', async () => {
        const context = createMockContext();

        const created = await MutationResolvers.createAgent(
          {},
          { input: { name: 'ToPause', type: 'reviewer' } },
          context,
          {}
        );
        await MutationResolvers.startAgent({}, { id: created.id }, context, {});

        const result = await MutationResolvers.pauseAgent(
          {},
          { id: created.id },
          context,
          {}
        );

        expect(result.status).toBe('PAUSED');
      });

      it('should throw error for non-running agent', async () => {
        const context = createMockContext();

        const created = await MutationResolvers.createAgent(
          {},
          { input: { name: 'Idle', type: 'reviewer' } },
          context,
          {}
        );

        await expect(
          MutationResolvers.pauseAgent({}, { id: created.id }, context, {})
        ).rejects.toThrow();
      });
    });

    describe('resumeAgent', () => {
      it('should resume a paused agent', async () => {
        const context = createMockContext();

        const created = await MutationResolvers.createAgent(
          {},
          { input: { name: 'ToResume', type: 'reviewer' } },
          context,
          {}
        );
        await MutationResolvers.startAgent({}, { id: created.id }, context, {});
        await MutationResolvers.pauseAgent({}, { id: created.id }, context, {});

        const result = await MutationResolvers.resumeAgent(
          {},
          { id: created.id },
          context,
          {}
        );

        expect(result.status).toBe('RUNNING');
      });
    });
  });

  describe('Workflow Mutations', () => {
    let agentId: string;

    beforeEach(async () => {
      const context = createMockContext();
      const agent = await MutationResolvers.createAgent(
        {},
        { input: { name: 'WorkflowAgent', type: 'workflow' } },
        context,
        {}
      );
      agentId = agent.id;
    });

    describe('createWorkflow', () => {
      it('should create a new workflow', async () => {
        const context = createMockContext();
        const input = {
          name: 'TestWorkflow',
          description: 'A test workflow',
          agentId,
          steps: [
            { name: 'Step1', type: 'action' },
            { name: 'Step2', type: 'action', dependencies: ['Step1'] },
          ],
        };

        const result = await MutationResolvers.createWorkflow(
          {},
          { input },
          context,
          {}
        );

        expect(result).toBeDefined();
        expect(result.name).toBe('TestWorkflow');
        expect(result.status).toBe('PENDING');
        expect(result.steps).toHaveLength(2);
      });

      it('should throw error for non-existent agent', async () => {
        const context = createMockContext();
        const input = {
          name: 'TestWorkflow',
          agentId: 'non-existent',
          steps: [],
        };

        await expect(
          MutationResolvers.createWorkflow({}, { input }, context, {})
        ).rejects.toThrow();
      });
    });

    describe('startWorkflow', () => {
      it('should start a pending workflow', async () => {
        const context = createMockContext();

        const workflow = await MutationResolvers.createWorkflow(
          {},
          {
            input: {
              name: 'ToStart',
              agentId,
              steps: [{ name: 'Step1', type: 'action' }],
            },
          },
          context,
          {}
        );

        const result = await MutationResolvers.startWorkflow(
          {},
          { id: workflow.id },
          context,
          {}
        );

        expect(result.status).toBe('RUNNING');
        expect(result.startedAt).toBeDefined();
      });
    });

    describe('pauseWorkflow', () => {
      it('should pause a running workflow', async () => {
        const context = createMockContext();

        const workflow = await MutationResolvers.createWorkflow(
          {},
          {
            input: {
              name: 'ToPause',
              agentId,
              steps: [{ name: 'Step1', type: 'action' }],
            },
          },
          context,
          {}
        );
        await MutationResolvers.startWorkflow({}, { id: workflow.id }, context, {});

        const result = await MutationResolvers.pauseWorkflow(
          {},
          { id: workflow.id },
          context,
          {}
        );

        expect(result.status).toBe('PAUSED');
      });
    });
  });

  describe('Task Mutations', () => {
    describe('createTask', () => {
      it('should create a new task', async () => {
        const context = createMockContext();
        const input = {
          name: 'TestTask',
          input: { data: 'test' },
        };

        const result = await MutationResolvers.createTask(
          {},
          { input },
          context,
          {}
        );

        expect(result).toBeDefined();
        expect(result.name).toBe('TestTask');
        expect(result.status).toBe('PENDING');
      });
    });

    describe('cancelTask', () => {
      it('should cancel a pending task', async () => {
        const context = createMockContext();

        const task = await MutationResolvers.createTask(
          {},
          { input: { name: 'ToCancel' } },
          context,
          {}
        );

        const result = await MutationResolvers.cancelTask(
          {},
          { id: task.id },
          context,
          {}
        );

        expect(result.status).toBe('CANCELLED');
      });
    });
  });

  describe('Tool Mutations', () => {
    describe('executeTool', () => {
      it('should execute a tool and return result', async () => {
        const context = createMockContext();
        const input = {
          toolId: 'tool-1',
          params: { query: 'test' },
        };

        const result = await MutationResolvers.executeTool(
          {},
          { input },
          context,
          {}
        );

        expect(result).toBeDefined();
        expect(result.success).toBe(true);
        expect(result.executionTime).toBeGreaterThanOrEqual(0);
        expect(result.timestamp).toBeDefined();
      });
    });

    describe('enableTool', () => {
      it('should enable a tool', async () => {
        const context = createMockContext();

        const result = await MutationResolvers.enableTool(
          {},
          { id: 'tool-1' },
          context,
          {}
        );

        expect(result.enabled).toBe(true);
      });
    });

    describe('disableTool', () => {
      it('should disable a tool', async () => {
        const context = createMockContext();

        const result = await MutationResolvers.disableTool(
          {},
          { id: 'tool-1' },
          context,
          {}
        );

        expect(result.enabled).toBe(false);
      });
    });
  });

  describe('Hook Mutations', () => {
    describe('createHook', () => {
      it('should create a new hook', async () => {
        const context = createMockContext();
        const input = {
          name: 'TestHook',
          trigger: 'BEFORE' as const,
          targetType: 'workflow',
          handler: 'validateInput',
        };

        const result = await MutationResolvers.createHook(
          {},
          { input },
          context,
          {}
        );

        expect(result).toBeDefined();
        expect(result.name).toBe('TestHook');
        expect(result.enabled).toBe(true);
      });
    });

    describe('updateHook', () => {
      it('should update an existing hook', async () => {
        const context = createMockContext();

        const created = await MutationResolvers.createHook(
          {},
          {
            input: {
              name: 'Hook1',
              trigger: 'BEFORE' as const,
              targetType: 'workflow',
              handler: 'validate',
            },
          },
          context,
          {}
        );

        const result = await MutationResolvers.updateHook(
          {},
          { id: created.id, input: { name: 'UpdatedHook' } },
          context,
          {}
        );

        expect(result.name).toBe('UpdatedHook');
      });
    });

    describe('enableHook / disableHook', () => {
      it('should toggle hook enabled state', async () => {
        const context = createMockContext();

        const created = await MutationResolvers.createHook(
          {},
          {
            input: {
              name: 'ToggleHook',
              trigger: 'AFTER' as const,
              targetType: 'task',
              handler: 'notify',
            },
          },
          context,
          {}
        );

        const disabled = await MutationResolvers.disableHook(
          {},
          { id: created.id },
          context,
          {}
        );
        expect(disabled.enabled).toBe(false);

        const enabled = await MutationResolvers.enableHook(
          {},
          { id: created.id },
          context,
          {}
        );
        expect(enabled.enabled).toBe(true);
      });
    });

    describe('triggerHook', () => {
      it('should trigger an enabled hook', async () => {
        const context = createMockContext();

        const created = await MutationResolvers.createHook(
          {},
          {
            input: {
              name: 'TriggerHook',
              trigger: 'AFTER' as const,
              targetType: 'task',
              handler: 'notify',
            },
          },
          context,
          {}
        );

        const result = await MutationResolvers.triggerHook(
          {},
          { id: created.id, payload: { data: 'test' } },
          context,
          {}
        );

        expect(result.success).toBe(true);
      });

      it('should fail for disabled hook', async () => {
        const context = createMockContext();

        const created = await MutationResolvers.createHook(
          {},
          {
            input: {
              name: 'DisabledHook',
              trigger: 'AFTER' as const,
              targetType: 'task',
              handler: 'notify',
              enabled: false,
            },
          },
          context,
          {}
        );

        await expect(
          MutationResolvers.triggerHook(
            {},
            { id: created.id },
            context,
            {}
          )
        ).rejects.toThrow();
      });
    });
  });
});
