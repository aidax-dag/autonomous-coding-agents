/**
 * Swagger/OpenAPI Plugin
 *
 * Feature: F4.1 - REST API Documentation
 *
 * @module api/plugins/swagger
 */

import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import type { FastifyInstance } from 'fastify';
import type { SwaggerConfig } from '../interfaces/api.interface.js';

/**
 * OpenAPI document configuration
 */
export interface OpenApiConfig extends SwaggerConfig {
  servers?: Array<{
    url: string;
    description?: string;
  }>;
  contact?: {
    name?: string;
    email?: string;
    url?: string;
  };
  license?: {
    name: string;
    url?: string;
  };
  externalDocs?: {
    description?: string;
    url: string;
  };
}

/**
 * Default OpenAPI configuration
 */
export const DEFAULT_OPENAPI_CONFIG: OpenApiConfig = {
  enabled: true,
  title: 'Autonomous Coding Agents API',
  description: `
## Overview

The Autonomous Coding Agents API provides programmatic access to manage AI-powered coding agents,
workflows, tools, and hooks for automated software development tasks.

## Authentication

The API supports two authentication methods:

- **API Key**: Pass your API key in the \`X-API-Key\` header
- **Bearer Token**: Pass a JWT token in the \`Authorization: Bearer <token>\` header

## Rate Limiting

API requests are rate-limited to prevent abuse:
- Default: 100 requests per minute per IP
- Authenticated: 1000 requests per minute per API key

## Errors

The API uses standard HTTP status codes and returns errors in a consistent format:

\`\`\`json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": []
  },
  "meta": {
    "requestId": "uuid",
    "timestamp": "ISO-8601"
  }
}
\`\`\`
  `.trim(),
  version: '1.0.0',
  basePath: '/api/v1',
  tags: [
    { name: 'Health', description: 'Health check and system status endpoints' },
    { name: 'Agents', description: 'Agent management and task execution' },
    { name: 'Workflows', description: 'Workflow definition and orchestration' },
    { name: 'Tools', description: 'Tool registration and execution' },
    { name: 'Hooks', description: 'Hook management and triggering' },
    { name: 'Auth', description: 'Authentication and authorization' },
  ],
  servers: [
    { url: 'http://localhost:3000', description: 'Development server' },
    { url: 'https://api.example.com', description: 'Production server' },
  ],
  contact: {
    name: 'API Support',
    email: 'support@example.com',
  },
  license: {
    name: 'MIT',
    url: 'https://opensource.org/licenses/MIT',
  },
};

/**
 * Register Swagger/OpenAPI plugins
 */
export async function registerSwaggerPlugin(
  fastify: FastifyInstance,
  config: OpenApiConfig = DEFAULT_OPENAPI_CONFIG
): Promise<void> {
  if (!config.enabled) {
    return;
  }

  // Register @fastify/swagger for OpenAPI spec generation
  await fastify.register(swagger, {
    openapi: {
      openapi: '3.1.0',
      info: {
        title: config.title || 'API Documentation',
        description: config.description || '',
        version: config.version || '1.0.0',
        contact: config.contact,
        license: config.license,
      },
      servers: config.servers || [{ url: 'http://localhost:3000' }],
      tags: config.tags?.map((tag) => ({
        name: tag.name,
        description: tag.description,
      })),
      externalDocs: config.externalDocs,
      components: {
        securitySchemes: {
          apiKey: {
            type: 'apiKey',
            name: 'X-API-Key',
            in: 'header',
            description: 'API key for authentication',
          },
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
            description: 'JWT token for authentication',
          },
        },
        schemas: {
          // Common response schemas
          ApiResponse: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: { type: 'object' },
              error: { $ref: '#/components/schemas/ApiError' },
              meta: { $ref: '#/components/schemas/ApiMeta' },
            },
            required: ['success'],
          },
          ApiError: {
            type: 'object',
            properties: {
              code: { type: 'string', example: 'VALIDATION_ERROR' },
              message: { type: 'string', example: 'Invalid request parameters' },
              details: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    field: { type: 'string' },
                    message: { type: 'string' },
                    code: { type: 'string' },
                  },
                },
              },
            },
            required: ['code', 'message'],
          },
          ApiMeta: {
            type: 'object',
            properties: {
              requestId: { type: 'string', format: 'uuid' },
              timestamp: { type: 'string', format: 'date-time' },
              duration: { type: 'number', description: 'Request duration in ms' },
              pagination: { $ref: '#/components/schemas/Pagination' },
            },
          },
          Pagination: {
            type: 'object',
            properties: {
              page: { type: 'integer', minimum: 1 },
              limit: { type: 'integer', minimum: 1, maximum: 100 },
              total: { type: 'integer' },
              totalPages: { type: 'integer' },
              hasNext: { type: 'boolean' },
              hasPrev: { type: 'boolean' },
            },
          },
          HealthStatus: {
            type: 'object',
            properties: {
              status: {
                type: 'string',
                enum: ['healthy', 'degraded', 'unhealthy'],
              },
              uptime: { type: 'number', description: 'Uptime in milliseconds' },
              startedAt: { type: 'string', format: 'date-time' },
              requestsServed: { type: 'integer' },
              activeConnections: { type: 'integer' },
              details: { type: 'object' },
            },
          },
          // Agent schemas
          Agent: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              type: {
                type: 'string',
                enum: ['architect', 'coder', 'reviewer', 'tester', 'docwriter', 'explorer', 'librarian'],
              },
              name: { type: 'string' },
              status: {
                type: 'string',
                enum: ['idle', 'busy', 'error', 'stopped'],
              },
              capabilities: {
                type: 'array',
                items: { type: 'string' },
              },
              config: { type: 'object' },
              createdAt: { type: 'string', format: 'date-time' },
              updatedAt: { type: 'string', format: 'date-time' },
            },
          },
          CreateAgentRequest: {
            type: 'object',
            properties: {
              type: {
                type: 'string',
                enum: ['architect', 'coder', 'reviewer', 'tester', 'docwriter', 'explorer', 'librarian'],
              },
              name: { type: 'string', minLength: 1, maxLength: 100 },
              config: { type: 'object' },
            },
            required: ['type', 'name'],
          },
          // Workflow schemas
          Workflow: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              name: { type: 'string' },
              description: { type: 'string' },
              status: {
                type: 'string',
                enum: ['pending', 'running', 'paused', 'completed', 'failed', 'cancelled'],
              },
              steps: {
                type: 'array',
                items: { $ref: '#/components/schemas/WorkflowStep' },
              },
              createdAt: { type: 'string', format: 'date-time' },
              updatedAt: { type: 'string', format: 'date-time' },
            },
          },
          WorkflowStep: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              type: { type: 'string' },
              status: { type: 'string' },
              config: { type: 'object' },
            },
          },
          CreateWorkflowRequest: {
            type: 'object',
            properties: {
              name: { type: 'string', minLength: 1, maxLength: 100 },
              description: { type: 'string' },
              steps: {
                type: 'array',
                items: { $ref: '#/components/schemas/WorkflowStep' },
              },
            },
            required: ['name', 'steps'],
          },
          // Tool schemas
          Tool: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              description: { type: 'string' },
              category: { type: 'string' },
              schema: { type: 'object' },
              enabled: { type: 'boolean' },
            },
          },
          ExecuteToolRequest: {
            type: 'object',
            properties: {
              params: { type: 'object' },
              context: { type: 'object' },
            },
            required: ['params'],
          },
          ToolExecutionResult: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              output: { type: 'object' },
              duration: { type: 'number' },
              error: { type: 'string' },
            },
          },
          // Hook schemas
          Hook: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              name: { type: 'string' },
              event: { type: 'string' },
              priority: { type: 'integer' },
              enabled: { type: 'boolean' },
              config: { type: 'object' },
            },
          },
          CreateHookRequest: {
            type: 'object',
            properties: {
              name: { type: 'string', minLength: 1, maxLength: 100 },
              event: { type: 'string' },
              priority: { type: 'integer', minimum: 0, maximum: 1000 },
              config: { type: 'object' },
            },
            required: ['name', 'event'],
          },
        },
      },
    },
  });

  // Register @fastify/swagger-ui for interactive documentation
  await fastify.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
      displayRequestDuration: true,
      filter: true,
      showExtensions: true,
      showCommonExtensions: true,
      syntaxHighlight: {
        activate: true,
        theme: 'monokai',
      },
    },
    uiHooks: {
      onRequest: function (_request, _reply, next) {
        next();
      },
      preHandler: function (_request, _reply, next) {
        next();
      },
    },
    staticCSP: true,
    transformStaticCSP: (header) => header,
    transformSpecification: (swaggerObject) => swaggerObject,
    transformSpecificationClone: true,
  });
}

/**
 * Common schema definitions for route handlers
 */
export const commonSchemas = {
  // Query parameters
  paginationQuery: {
    type: 'object',
    properties: {
      page: { type: 'integer', minimum: 1, default: 1 },
      limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
    },
  },
  sortQuery: {
    type: 'object',
    properties: {
      sortBy: { type: 'string' },
      sortOrder: { type: 'string', enum: ['asc', 'desc'], default: 'asc' },
    },
  },
  // Path parameters
  idParam: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
    },
    required: ['id'],
  },
  nameParam: {
    type: 'object',
    properties: {
      name: { type: 'string', minLength: 1 },
    },
    required: ['name'],
  },
  // Response wrappers
  successResponse: (dataSchema: object) => ({
    type: 'object',
    properties: {
      success: { type: 'boolean', const: true },
      data: dataSchema,
      meta: { $ref: '#/components/schemas/ApiMeta' },
    },
  }),
  errorResponse: {
    type: 'object',
    properties: {
      success: { type: 'boolean', const: false },
      error: { $ref: '#/components/schemas/ApiError' },
      meta: { $ref: '#/components/schemas/ApiMeta' },
    },
  },
  listResponse: (itemSchema: object) => ({
    type: 'object',
    properties: {
      success: { type: 'boolean', const: true },
      data: {
        type: 'array',
        items: itemSchema,
      },
      meta: { $ref: '#/components/schemas/ApiMeta' },
    },
  }),
};

export default registerSwaggerPlugin;
