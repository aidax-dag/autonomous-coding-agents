/**
 * OpenAPI Spec Generator
 *
 * Transforms registered endpoint metadata into a complete
 * OpenAPI 3.0 specification document. Supports JSON and
 * simplified YAML output formats.
 *
 * @module api/docs/openapi-generator
 */

import type { EndpointRegistry } from './endpoint-registry';
import type { APIEndpointDoc, OpenAPISpec } from './types';

/** Configuration for spec generation. */
export interface OpenAPIGeneratorConfig {
  title?: string;
  version?: string;
  description?: string;
  serverUrl?: string;
  serverDescription?: string;
}

/** Tag descriptions used in the generated specification. */
const TAG_DESCRIPTIONS: Record<string, string> = {
  system: 'System health and status endpoints',
  auth: 'Authentication and token management',
  dashboard: 'HUD dashboard data endpoints',
  agents: 'Agent management and monitoring',
  tasks: 'Task submission and tracking',
  tickets: 'Ticket-based work cycle management',
  features: 'Reusable feature catalog management',
  sse: 'Server-Sent Events management',
  mcp: 'Model Context Protocol server management',
  pool: 'Agent pool statistics and management',
  instincts: 'Learned instinct management and transfer',
  analytics: 'Usage analytics and cost reporting',
  collaboration: 'Real-time collaboration session management',
};

/**
 * Generates an OpenAPI 3.0 specification from the endpoint registry.
 */
export class OpenAPIGenerator {
  private readonly registry: EndpointRegistry;
  private readonly config: Required<OpenAPIGeneratorConfig>;

  constructor(registry: EndpointRegistry, config?: OpenAPIGeneratorConfig) {
    this.registry = registry;
    this.config = {
      title: config?.title ?? 'ACA API',
      version: config?.version ?? '0.1.0',
      description: config?.description ?? 'Autonomous Coding Agents REST API',
      serverUrl: config?.serverUrl ?? 'http://localhost:3000',
      serverDescription: config?.serverDescription ?? 'Local development server',
    };
  }

  /** Generate a complete OpenAPI 3.0 specification object. */
  generate(): OpenAPISpec {
    return {
      openapi: '3.0.3',
      info: {
        title: this.config.title,
        version: this.config.version,
        description: this.config.description,
      },
      servers: [
        {
          url: this.config.serverUrl,
          description: this.config.serverDescription,
        },
      ],
      paths: this.buildPaths(),
      components: {
        securitySchemes: this.buildSecuritySchemes(),
        schemas: {},
      },
      tags: this.buildTags(),
    };
  }

  /** Serialize the spec to a JSON string. */
  toJSON(): string {
    return JSON.stringify(this.generate(), null, 2);
  }

  /** Serialize the spec to a simplified YAML-like string. */
  toYAML(): string {
    return toSimpleYAML(this.generate());
  }

  // ── Private helpers ──────────────────────────────────────────────

  private buildPaths(): Record<string, Record<string, unknown>> {
    const paths: Record<string, Record<string, unknown>> = {};
    const endpoints = this.registry.getAll();

    for (const endpoint of endpoints) {
      const openAPIPath = expressPathToOpenAPI(endpoint.path);
      if (!paths[openAPIPath]) {
        paths[openAPIPath] = {};
      }
      const method = endpoint.method.toLowerCase();
      paths[openAPIPath][method] = this.endpointToOperation(endpoint);
    }

    return paths;
  }

  private buildSecuritySchemes(): Record<string, unknown> {
    return {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT access token obtained from POST /api/login',
      },
    };
  }

  private buildTags(): Array<{ name: string; description: string }> {
    const endpoints = this.registry.getAll();
    const tagSet = new Set<string>();
    for (const ep of endpoints) {
      for (const tag of ep.tags) {
        tagSet.add(tag);
      }
    }
    return Array.from(tagSet)
      .sort()
      .map((name) => ({
        name,
        description: TAG_DESCRIPTIONS[name] ?? name,
      }));
  }

  private endpointToOperation(endpoint: APIEndpointDoc): Record<string, unknown> {
    const operation: Record<string, unknown> = {
      summary: endpoint.summary,
      description: endpoint.description,
      tags: endpoint.tags,
      operationId: generateOperationId(endpoint),
      responses: this.buildResponses(endpoint),
    };

    // Security requirement
    if (endpoint.auth) {
      operation.security = [{ bearerAuth: [] }];
    }

    // Parameters (explicit + extracted path params)
    const params = this.buildParameters(endpoint);
    if (params.length > 0) {
      operation.parameters = params;
    }

    // Request body
    if (endpoint.requestBody) {
      operation.requestBody = {
        required: endpoint.requestBody.required ?? false,
        content: {
          [endpoint.requestBody.contentType]: {
            schema: endpoint.requestBody.schema,
          },
        },
      };
    }

    return operation;
  }

  private buildParameters(endpoint: APIEndpointDoc): Array<Record<string, unknown>> {
    const params: Array<Record<string, unknown>> = [];

    // Extract path parameters from the route pattern (e.g. :agentId, :id)
    const pathParamNames = extractPathParams(endpoint.path);
    const explicitParamNames = new Set(
      (endpoint.parameters ?? []).filter((p) => p.in === 'path').map((p) => p.name),
    );

    // Add auto-detected path params not already declared
    for (const name of pathParamNames) {
      if (!explicitParamNames.has(name)) {
        params.push({
          name,
          in: 'path',
          required: true,
          schema: { type: 'string' },
        });
      }
    }

    // Add explicitly declared parameters
    if (endpoint.parameters) {
      for (const param of endpoint.parameters) {
        params.push({
          name: param.name,
          in: param.in,
          required: param.required,
          schema: param.schema,
          ...(param.description ? { description: param.description } : {}),
        });
      }
    }

    return params;
  }

  private buildResponses(endpoint: APIEndpointDoc): Record<string, unknown> {
    const responses: Record<string, unknown> = {};
    for (const [code, resp] of Object.entries(endpoint.responses)) {
      const entry: Record<string, unknown> = { description: resp.description };
      if (resp.schema) {
        entry.content = {
          'application/json': { schema: resp.schema },
        };
      }
      responses[code] = entry;
    }
    return responses;
  }
}

// ── Utility functions ────────────────────────────────────────────────

/**
 * Convert Express-style path params (:id) to OpenAPI-style ({id}).
 */
function expressPathToOpenAPI(path: string): string {
  return path.replace(/:(\w+)/g, '{$1}');
}

/**
 * Extract parameter names from an Express-style path.
 */
function extractPathParams(path: string): string[] {
  const matches: string[] = [];
  const regex = /:(\w+)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(path)) !== null) {
    matches.push(match[1]);
  }
  return matches;
}

/**
 * Generate an operationId from the endpoint method and path.
 * E.g. GET /api/agents/:agentId -> getAgentsByAgentId
 */
function generateOperationId(endpoint: APIEndpointDoc): string {
  const method = endpoint.method.toLowerCase();
  const segments = endpoint.path
    .replace(/^\/api\//, '')
    .split('/')
    .filter(Boolean)
    .map((seg) => {
      if (seg.startsWith(':')) {
        return 'By' + capitalize(seg.slice(1));
      }
      return capitalize(seg);
    });
  return method + segments.join('');
}

function capitalize(str: string): string {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Minimal YAML-like serializer for OpenAPI specs.
 * Produces indented key-value pairs without requiring a YAML library.
 */
function toSimpleYAML(obj: unknown, indent: number = 0): string {
  const prefix = '  '.repeat(indent);

  if (obj === null || obj === undefined) {
    return 'null';
  }
  if (typeof obj === 'string') {
    // Quote strings that contain special YAML characters
    if (/[:{}[\],&*#?|>!%@`]/.test(obj) || obj === '' || obj === 'true' || obj === 'false') {
      return `'${obj.replace(/'/g, "''")}'`;
    }
    return obj;
  }
  if (typeof obj === 'number' || typeof obj === 'boolean') {
    return String(obj);
  }
  if (Array.isArray(obj)) {
    if (obj.length === 0) return '[]';
    const lines: string[] = [];
    for (const item of obj) {
      if (typeof item === 'object' && item !== null) {
        const inner = toSimpleYAML(item, indent + 1);
        lines.push(`${prefix}- \n${inner}`);
      } else {
        lines.push(`${prefix}- ${toSimpleYAML(item, 0)}`);
      }
    }
    return lines.join('\n');
  }
  if (typeof obj === 'object') {
    const entries = Object.entries(obj as Record<string, unknown>);
    if (entries.length === 0) return '{}';
    const lines: string[] = [];
    for (const [key, value] of entries) {
      if (typeof value === 'object' && value !== null) {
        lines.push(`${prefix}${key}:`);
        lines.push(toSimpleYAML(value, indent + 1));
      } else {
        lines.push(`${prefix}${key}: ${toSimpleYAML(value, 0)}`);
      }
    }
    return lines.join('\n');
  }
  return String(obj);
}
