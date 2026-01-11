/**
 * Swagger Plugin Tests
 *
 * Feature: F4.1 - REST API Documentation
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import Fastify, { FastifyInstance } from 'fastify';
import {
  registerSwaggerPlugin,
  DEFAULT_OPENAPI_CONFIG,
  commonSchemas,
} from '../../../../src/api/plugins/swagger.plugin.js';

describe('Swagger Plugin', () => {
  let fastify: FastifyInstance;

  beforeEach(() => {
    fastify = Fastify({ logger: false });
  });

  afterEach(async () => {
    await fastify.close();
  });

  describe('registerSwaggerPlugin', () => {
    it('should register swagger plugin when enabled', async () => {
      await registerSwaggerPlugin(fastify, {
        enabled: true,
        title: 'Test API',
        version: '1.0.0',
      });

      await fastify.ready();

      // Check that /docs/json route is accessible
      const response = await fastify.inject({
        method: 'GET',
        url: '/docs/json',
      });
      expect(response.statusCode).toBe(200);
    });

    it('should not register swagger plugin when disabled', async () => {
      await registerSwaggerPlugin(fastify, {
        enabled: false,
      });

      await fastify.ready();

      // Check that /docs route is not registered
      const routes = fastify.printRoutes();
      expect(routes).not.toContain('/docs');
    });

    it('should use default config values', async () => {
      expect(DEFAULT_OPENAPI_CONFIG.title).toBe('Autonomous Coding Agents API');
      expect(DEFAULT_OPENAPI_CONFIG.version).toBe('1.0.0');
      expect(DEFAULT_OPENAPI_CONFIG.enabled).toBe(true);
      expect(DEFAULT_OPENAPI_CONFIG.tags?.length).toBeGreaterThan(0);
    });

    it('should expose OpenAPI JSON endpoint', async () => {
      await registerSwaggerPlugin(fastify, {
        enabled: true,
        title: 'Test API',
        version: '2.0.0',
      });

      // Add a test route with schema
      fastify.get(
        '/test',
        {
          schema: {
            tags: ['Test'],
            summary: 'Test endpoint',
            response: {
              200: {
                type: 'object',
                properties: {
                  message: { type: 'string' },
                },
              },
            },
          },
        },
        async () => ({ message: 'hello' })
      );

      await fastify.ready();

      // Request OpenAPI spec
      const response = await fastify.inject({
        method: 'GET',
        url: '/docs/json',
      });

      expect(response.statusCode).toBe(200);

      const spec = JSON.parse(response.payload);
      expect(spec.openapi).toBe('3.1.0');
      expect(spec.info.title).toBe('Test API');
      expect(spec.info.version).toBe('2.0.0');
    });

    it('should include custom tags', async () => {
      await registerSwaggerPlugin(fastify, {
        enabled: true,
        title: 'Test API',
        version: '1.0.0',
        tags: [
          { name: 'Custom', description: 'Custom tag' },
        ],
      });

      await fastify.ready();

      const response = await fastify.inject({
        method: 'GET',
        url: '/docs/json',
      });

      const spec = JSON.parse(response.payload);
      expect(spec.tags).toContainEqual({
        name: 'Custom',
        description: 'Custom tag',
      });
    });

    it('should include security schemes', async () => {
      await registerSwaggerPlugin(fastify, {
        enabled: true,
        title: 'Test API',
        version: '1.0.0',
      });

      await fastify.ready();

      const response = await fastify.inject({
        method: 'GET',
        url: '/docs/json',
      });

      const spec = JSON.parse(response.payload);
      expect(spec.components.securitySchemes).toBeDefined();
      expect(spec.components.securitySchemes.apiKey).toBeDefined();
      expect(spec.components.securitySchemes.bearerAuth).toBeDefined();
    });

    it('should include common schemas', async () => {
      await registerSwaggerPlugin(fastify, {
        enabled: true,
        title: 'Test API',
        version: '1.0.0',
      });

      await fastify.ready();

      const response = await fastify.inject({
        method: 'GET',
        url: '/docs/json',
      });

      const spec = JSON.parse(response.payload);
      expect(spec.components.schemas.ApiResponse).toBeDefined();
      expect(spec.components.schemas.ApiError).toBeDefined();
      expect(spec.components.schemas.ApiMeta).toBeDefined();
      expect(spec.components.schemas.Pagination).toBeDefined();
      expect(spec.components.schemas.HealthStatus).toBeDefined();
      expect(spec.components.schemas.Agent).toBeDefined();
      expect(spec.components.schemas.Workflow).toBeDefined();
      expect(spec.components.schemas.Tool).toBeDefined();
      expect(spec.components.schemas.Hook).toBeDefined();
    });

    it('should serve Swagger UI at /docs', async () => {
      await registerSwaggerPlugin(fastify, {
        enabled: true,
        title: 'Test API',
        version: '1.0.0',
      });

      await fastify.ready();

      const response = await fastify.inject({
        method: 'GET',
        url: '/docs',
      });

      // Should redirect or return HTML
      expect([200, 302]).toContain(response.statusCode);
    });

    it('should include server URLs', async () => {
      await registerSwaggerPlugin(fastify, {
        enabled: true,
        title: 'Test API',
        version: '1.0.0',
        servers: [
          { url: 'http://localhost:3000', description: 'Local' },
          { url: 'https://api.prod.com', description: 'Production' },
        ],
      });

      await fastify.ready();

      const response = await fastify.inject({
        method: 'GET',
        url: '/docs/json',
      });

      const spec = JSON.parse(response.payload);
      expect(spec.servers).toHaveLength(2);
      expect(spec.servers[0].url).toBe('http://localhost:3000');
      expect(spec.servers[1].url).toBe('https://api.prod.com');
    });
  });

  describe('commonSchemas', () => {
    it('should provide pagination query schema', () => {
      expect(commonSchemas.paginationQuery).toBeDefined();
      expect(commonSchemas.paginationQuery.properties?.page).toBeDefined();
      expect(commonSchemas.paginationQuery.properties?.limit).toBeDefined();
    });

    it('should provide sort query schema', () => {
      expect(commonSchemas.sortQuery).toBeDefined();
      expect(commonSchemas.sortQuery.properties?.sortBy).toBeDefined();
      expect(commonSchemas.sortQuery.properties?.sortOrder).toBeDefined();
    });

    it('should provide id param schema', () => {
      expect(commonSchemas.idParam).toBeDefined();
      expect(commonSchemas.idParam.properties?.id.format).toBe('uuid');
    });

    it('should provide name param schema', () => {
      expect(commonSchemas.nameParam).toBeDefined();
      expect(commonSchemas.nameParam.properties?.name).toBeDefined();
    });

    it('should provide success response helper', () => {
      const dataSchema = { type: 'object', properties: { id: { type: 'string' } } };
      const response = commonSchemas.successResponse(dataSchema);

      expect(response.properties?.success.const).toBe(true);
      expect(response.properties?.data).toBe(dataSchema);
    });

    it('should provide error response schema', () => {
      expect(commonSchemas.errorResponse).toBeDefined();
      expect(commonSchemas.errorResponse.properties?.success.const).toBe(false);
      expect(commonSchemas.errorResponse.properties?.error).toBeDefined();
    });

    it('should provide list response helper', () => {
      const itemSchema = { $ref: '#/components/schemas/Agent' };
      const response = commonSchemas.listResponse(itemSchema);

      expect(response.properties?.data.type).toBe('array');
      expect(response.properties?.data.items).toBe(itemSchema);
    });
  });
});

describe('API Server with Swagger', () => {
  let fastify: FastifyInstance;

  beforeEach(() => {
    fastify = Fastify({ logger: false });
  });

  afterEach(async () => {
    await fastify.close();
  });

  it('should document routes with schemas', async () => {
    await registerSwaggerPlugin(fastify, {
      enabled: true,
      title: 'Test API',
      version: '1.0.0',
    });

    // Register a route with inline schema (avoid $ref issues in tests)
    fastify.get(
      '/api/v1/agents',
      {
        schema: {
          tags: ['Agents'],
          summary: 'List all agents',
          description: 'Returns a paginated list of all agents',
          querystring: commonSchemas.paginationQuery,
          response: {
            200: {
              type: 'object',
              properties: {
                success: { type: 'boolean' },
                data: {
                  type: 'array',
                  items: { type: 'object' },
                },
              },
            },
          },
        },
      },
      async () => ({
        success: true,
        data: [],
        meta: { requestId: 'test', timestamp: new Date().toISOString() },
      })
    );

    await fastify.ready();

    const response = await fastify.inject({
      method: 'GET',
      url: '/docs/json',
    });

    const spec = JSON.parse(response.payload);
    expect(spec.paths['/api/v1/agents']).toBeDefined();
    expect(spec.paths['/api/v1/agents'].get.tags).toContain('Agents');
    expect(spec.paths['/api/v1/agents'].get.summary).toBe('List all agents');
  });

  it('should document request body schemas', async () => {
    await registerSwaggerPlugin(fastify, {
      enabled: true,
      title: 'Test API',
      version: '1.0.0',
    });

    fastify.post(
      '/api/v1/agents',
      {
        schema: {
          tags: ['Agents'],
          summary: 'Create an agent',
          body: {
            type: 'object',
            properties: {
              type: { type: 'string' },
              name: { type: 'string' },
            },
            required: ['type', 'name'],
          },
          response: {
            201: {
              type: 'object',
              properties: {
                success: { type: 'boolean' },
                data: { type: 'object' },
              },
            },
          },
        },
      },
      async () => ({
        success: true,
        data: { id: 'test' },
      })
    );

    await fastify.ready();

    const response = await fastify.inject({
      method: 'GET',
      url: '/docs/json',
    });

    const spec = JSON.parse(response.payload);
    expect(spec.paths['/api/v1/agents'].post).toBeDefined();
    expect(spec.paths['/api/v1/agents'].post.requestBody).toBeDefined();
  });

  it('should document path parameters', async () => {
    await registerSwaggerPlugin(fastify, {
      enabled: true,
      title: 'Test API',
      version: '1.0.0',
    });

    fastify.get(
      '/api/v1/agents/:id',
      {
        schema: {
          tags: ['Agents'],
          summary: 'Get agent by ID',
          params: commonSchemas.idParam,
          response: {
            200: {
              type: 'object',
              properties: {
                success: { type: 'boolean' },
                data: { type: 'object' },
              },
            },
          },
        },
      },
      async () => ({
        success: true,
        data: { id: 'test' },
      })
    );

    await fastify.ready();

    const response = await fastify.inject({
      method: 'GET',
      url: '/docs/json',
    });

    const spec = JSON.parse(response.payload);
    expect(spec.paths['/api/v1/agents/{id}']).toBeDefined();
    expect(spec.paths['/api/v1/agents/{id}'].get.parameters).toBeDefined();
  });
});
