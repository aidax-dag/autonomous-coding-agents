/**
 * GraphQL Query Resolver Unit Tests
 *
 * Feature: F4.3 - GraphQL API
 *
 * @module tests/unit/api/graphql/resolvers/query
 */

import { QueryResolvers } from '../../../../../src/api/graphql/resolvers/query.resolver';
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

describe('GraphQL Query Resolvers', () => {
  describe('agent', () => {
    it('should return agent by id', async () => {
      const context = createMockContext();
      const result = await QueryResolvers.agent(
        {},
        { id: 'agent-1' },
        context,
        {}
      );

      expect(result).toBeDefined();
      expect(result?.id).toBe('agent-1');
      expect(result?.name).toBe('CodeReviewer');
    });

    it('should return null for non-existent agent', async () => {
      const context = createMockContext();
      const result = await QueryResolvers.agent(
        {},
        { id: 'non-existent' },
        context,
        {}
      );

      expect(result).toBeNull();
    });
  });

  describe('agents', () => {
    it('should return paginated list of agents', async () => {
      const context = createMockContext();
      const result = await QueryResolvers.agents(
        {},
        { pagination: { page: 1, limit: 10 } },
        context,
        {}
      );

      expect(result).toBeDefined();
      expect(result.edges).toBeDefined();
      expect(result.pageInfo).toBeDefined();
      expect(result.totalCount).toBeGreaterThan(0);
    });

    it('should filter agents by status', async () => {
      const context = createMockContext();
      const result = await QueryResolvers.agents(
        {},
        {
          filter: { status: ['RUNNING'] },
          pagination: { page: 1, limit: 10 },
        },
        context,
        {}
      );

      expect(result.edges.every(e => e.node.status === 'RUNNING')).toBe(true);
    });

    it('should filter agents by search term', async () => {
      const context = createMockContext();
      const result = await QueryResolvers.agents(
        {},
        {
          filter: { search: 'Code' },
          pagination: { page: 1, limit: 10 },
        },
        context,
        {}
      );

      expect(result.edges.length).toBeGreaterThan(0);
      expect(result.edges.some(e =>
        e.node.name.toLowerCase().includes('code') ||
        e.node.description?.toLowerCase().includes('code')
      )).toBe(true);
    });

    it('should sort agents', async () => {
      const context = createMockContext();
      const result = await QueryResolvers.agents(
        {},
        {
          sort: { field: 'name', order: 'ASC' },
          pagination: { page: 1, limit: 10 },
        },
        context,
        {}
      );

      expect(result.edges).toBeDefined();
      // Verify sorting if there are multiple agents
      if (result.edges.length > 1) {
        const names = result.edges.map(e => e.node.name);
        const sortedNames = [...names].sort();
        expect(names).toEqual(sortedNames);
      }
    });
  });

  describe('agentByName', () => {
    it('should return agent by name', async () => {
      const context = createMockContext();
      const result = await QueryResolvers.agentByName(
        {},
        { name: 'CodeReviewer' },
        context,
        {}
      );

      expect(result).toBeDefined();
      expect(result?.name).toBe('CodeReviewer');
    });

    it('should return null for non-existent name', async () => {
      const context = createMockContext();
      const result = await QueryResolvers.agentByName(
        {},
        { name: 'NonExistent' },
        context,
        {}
      );

      expect(result).toBeNull();
    });
  });

  describe('workflow', () => {
    it('should return workflow by id', async () => {
      const context = createMockContext();
      const result = await QueryResolvers.workflow(
        {},
        { id: 'workflow-1' },
        context,
        {}
      );

      expect(result).toBeDefined();
      expect(result?.id).toBe('workflow-1');
    });

    it('should return null for non-existent workflow', async () => {
      const context = createMockContext();
      const result = await QueryResolvers.workflow(
        {},
        { id: 'non-existent' },
        context,
        {}
      );

      expect(result).toBeNull();
    });
  });

  describe('workflows', () => {
    it('should return paginated list of workflows', async () => {
      const context = createMockContext();
      const result = await QueryResolvers.workflows(
        {},
        { pagination: { page: 1, limit: 10 } },
        context,
        {}
      );

      expect(result).toBeDefined();
      expect(result.edges).toBeDefined();
      expect(result.pageInfo).toBeDefined();
    });

    it('should filter workflows by status', async () => {
      const context = createMockContext();
      const result = await QueryResolvers.workflows(
        {},
        {
          filter: { status: ['RUNNING'] },
          pagination: { page: 1, limit: 10 },
        },
        context,
        {}
      );

      expect(result.edges.every(e => e.node.status === 'RUNNING')).toBe(true);
    });
  });

  describe('task', () => {
    it('should return task by id', async () => {
      const context = createMockContext();
      const result = await QueryResolvers.task(
        {},
        { id: 'task-1' },
        context,
        {}
      );

      expect(result).toBeDefined();
      expect(result?.id).toBe('task-1');
    });
  });

  describe('tasks', () => {
    it('should return paginated list of tasks', async () => {
      const context = createMockContext();
      const result = await QueryResolvers.tasks(
        {},
        { pagination: { page: 1, limit: 10 } },
        context,
        {}
      );

      expect(result).toBeDefined();
      expect(result.edges).toBeDefined();
    });

    it('should filter tasks by status', async () => {
      const context = createMockContext();
      const result = await QueryResolvers.tasks(
        {},
        {
          filter: { status: ['COMPLETED'] },
          pagination: { page: 1, limit: 10 },
        },
        context,
        {}
      );

      expect(result.edges.every(e => e.node.status === 'COMPLETED')).toBe(true);
    });
  });

  describe('tool', () => {
    it('should return tool by id', async () => {
      const context = createMockContext();
      const result = await QueryResolvers.tool(
        {},
        { id: 'tool-1' },
        context,
        {}
      );

      expect(result).toBeDefined();
      expect(result?.id).toBe('tool-1');
    });
  });

  describe('tools', () => {
    it('should return paginated list of tools', async () => {
      const context = createMockContext();
      const result = await QueryResolvers.tools(
        {},
        { pagination: { page: 1, limit: 10 } },
        context,
        {}
      );

      expect(result).toBeDefined();
      expect(result.edges).toBeDefined();
    });

    it('should filter tools by enabled status', async () => {
      const context = createMockContext();
      const result = await QueryResolvers.tools(
        {},
        {
          filter: { enabled: true },
          pagination: { page: 1, limit: 10 },
        },
        context,
        {}
      );

      expect(result.edges.every(e => e.node.enabled === true)).toBe(true);
    });
  });

  describe('hook', () => {
    it('should return hook by id', async () => {
      const context = createMockContext();
      const result = await QueryResolvers.hook(
        {},
        { id: 'hook-1' },
        context,
        {}
      );

      expect(result).toBeDefined();
      expect(result?.id).toBe('hook-1');
    });
  });

  describe('hooks', () => {
    it('should return paginated list of hooks', async () => {
      const context = createMockContext();
      const result = await QueryResolvers.hooks(
        {},
        { pagination: { page: 1, limit: 10 } },
        context,
        {}
      );

      expect(result).toBeDefined();
      expect(result.edges).toBeDefined();
    });
  });

  describe('metrics', () => {
    it('should return system metrics', async () => {
      const context = createMockContext();
      const result = await QueryResolvers.metrics(
        {},
        {},
        context,
        {}
      );

      expect(result).toBeDefined();
      expect(result.agents).toBeDefined();
      expect(result.workflows).toBeDefined();
      expect(result.tasks).toBeDefined();
      expect(result.tools).toBeDefined();
      expect(result.hooks).toBeDefined();
      expect(result.system).toBeDefined();
      expect(result.system.uptime).toBeGreaterThan(0);
    });
  });

  describe('health', () => {
    it('should return health status', async () => {
      const context = createMockContext();
      const result = await QueryResolvers.health(
        {},
        {},
        context,
        {}
      );

      expect(result).toBeDefined();
      expect(result.status).toBe('healthy');
      expect(result.version).toBeDefined();
      expect(result.uptime).toBeGreaterThan(0);
      expect(result.services).toBeInstanceOf(Array);
    });
  });

  describe('pagination', () => {
    it('should handle default pagination values', async () => {
      const context = createMockContext();
      const result = await QueryResolvers.agents(
        {},
        {},
        context,
        {}
      );

      expect(result.pageInfo.currentPage).toBe(1);
    });

    it('should create correct page info', async () => {
      const context = createMockContext();
      const result = await QueryResolvers.agents(
        {},
        { pagination: { page: 1, limit: 1 } },
        context,
        {}
      );

      expect(result.pageInfo).toBeDefined();
      expect(result.pageInfo.totalCount).toBeGreaterThan(0);
      expect(result.pageInfo.currentPage).toBe(1);
      if (result.totalCount > 1) {
        expect(result.pageInfo.hasNextPage).toBe(true);
      }
    });

    it('should handle cursor-based pagination', async () => {
      const context = createMockContext();
      const result = await QueryResolvers.agents(
        {},
        { pagination: { page: 1, limit: 10 } },
        context,
        {}
      );

      if (result.edges.length > 0) {
        expect(result.edges[0].cursor).toBeDefined();
        expect(typeof result.edges[0].cursor).toBe('string');
      }
    });
  });
});
