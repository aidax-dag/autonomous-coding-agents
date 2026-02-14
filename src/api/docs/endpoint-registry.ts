/**
 * Endpoint Registry
 *
 * Central registry for API endpoint metadata used to generate
 * OpenAPI documentation. Endpoints are registered declaratively
 * and can be queried by tag or path.
 *
 * @module api/docs/endpoint-registry
 */

import type { APIEndpointDoc } from './types';

/**
 * Registry that stores API endpoint documentation metadata.
 * Provides query methods for filtering by tag or path.
 */
export class EndpointRegistry {
  private endpoints: APIEndpointDoc[] = [];

  /** Register a single endpoint. */
  register(endpoint: APIEndpointDoc): void {
    this.endpoints.push(endpoint);
  }

  /** Return all registered endpoints. */
  getAll(): APIEndpointDoc[] {
    return [...this.endpoints];
  }

  /** Return endpoints matching a specific tag. */
  getByTag(tag: string): APIEndpointDoc[] {
    return this.endpoints.filter((ep) => ep.tags.includes(tag));
  }

  /** Return endpoints matching a specific path (exact match). */
  getByPath(path: string): APIEndpointDoc[] {
    return this.endpoints.filter((ep) => ep.path === path);
  }

  /** Remove all registered endpoints. */
  clear(): void {
    this.endpoints = [];
  }
}

/**
 * Register all known API endpoints from the ACA system.
 * This captures every route defined in DashboardAPI and login-handler.
 */
export function registerAllEndpoints(registry: EndpointRegistry): void {
  // ── Health ──────────────────────────────────────────────────────
  registry.register({
    path: '/api/health',
    method: 'GET',
    summary: 'Health check',
    description: 'Returns system health status and overall health score.',
    tags: ['system'],
    auth: false,
    responses: {
      '200': {
        description: 'Health status',
        schema: { type: 'object', properties: { status: { type: 'string' }, health: { type: 'number' } } },
      },
    },
  });

  // ── Auth ────────────────────────────────────────────────────────
  registry.register({
    path: '/api/login',
    method: 'POST',
    summary: 'Login',
    description: 'Authenticate with email and password to receive JWT access and refresh tokens.',
    tags: ['auth'],
    auth: false,
    requestBody: {
      contentType: 'application/json',
      schema: {
        type: 'object',
        properties: { email: { type: 'string' }, password: { type: 'string' } },
        required: ['email', 'password'],
      },
      required: true,
    },
    responses: {
      '200': {
        description: 'JWT tokens',
        schema: {
          type: 'object',
          properties: {
            accessToken: { type: 'string' },
            refreshToken: { type: 'string' },
            expiresIn: { type: 'number' },
          },
        },
      },
      '400': { description: 'Missing email or password' },
      '401': { description: 'Invalid credentials' },
      '503': { description: 'Authentication not configured' },
    },
  });

  registry.register({
    path: '/api/auth/refresh',
    method: 'POST',
    summary: 'Refresh token',
    description: 'Exchange a valid refresh token for a new access token.',
    tags: ['auth'],
    auth: false,
    requestBody: {
      contentType: 'application/json',
      schema: {
        type: 'object',
        properties: { refreshToken: { type: 'string' } },
        required: ['refreshToken'],
      },
      required: true,
    },
    responses: {
      '200': {
        description: 'New access token',
        schema: {
          type: 'object',
          properties: { accessToken: { type: 'string' }, expiresIn: { type: 'number' } },
        },
      },
      '400': { description: 'Missing refresh token' },
      '401': { description: 'Invalid or expired refresh token' },
    },
  });

  // ── Dashboard ───────────────────────────────────────────────────
  registry.register({
    path: '/api/snapshot',
    method: 'GET',
    summary: 'Dashboard snapshot',
    description: 'Returns the full HUD dashboard snapshot including agents, metrics, and system health.',
    tags: ['dashboard'],
    auth: true,
    responses: {
      '200': { description: 'Dashboard snapshot object' },
      '503': { description: 'Dashboard not configured' },
    },
  });

  registry.register({
    path: '/api/agents',
    method: 'GET',
    summary: 'List agents',
    description: 'Returns the list of all active and recent agents from the dashboard.',
    tags: ['agents'],
    auth: true,
    responses: {
      '200': {
        description: 'Agent list',
        schema: { type: 'object', properties: { agents: { type: 'array' } } },
      },
      '503': { description: 'Dashboard not configured' },
    },
  });

  registry.register({
    path: '/api/agents/:agentId',
    method: 'GET',
    summary: 'Get agent by ID',
    description: 'Returns details for a specific agent identified by agentId.',
    tags: ['agents'],
    auth: true,
    parameters: [
      { name: 'agentId', in: 'path', required: true, schema: { type: 'string' }, description: 'Agent identifier' },
    ],
    responses: {
      '200': { description: 'Agent details' },
      '404': { description: 'Agent not found' },
      '503': { description: 'Dashboard not configured' },
    },
  });

  // ── Tasks ───────────────────────────────────────────────────────
  registry.register({
    path: '/api/tasks',
    method: 'POST',
    summary: 'Submit task',
    description: 'Submit a new task to the orchestrator via the ACP message bus.',
    tags: ['tasks'],
    auth: true,
    requestBody: {
      contentType: 'application/json',
      schema: {
        type: 'object',
        properties: { name: { type: 'string' }, description: { type: 'string' } },
        required: ['name'],
      },
      required: true,
    },
    responses: {
      '202': {
        description: 'Task accepted',
        schema: { type: 'object', properties: { taskId: { type: 'string' }, status: { type: 'string' } } },
      },
      '400': { description: 'Task name is required' },
      '503': { description: 'Message bus not configured' },
    },
  });

  // ── SSE ─────────────────────────────────────────────────────────
  registry.register({
    path: '/api/sse/clients',
    method: 'GET',
    summary: 'SSE client count',
    description: 'Returns the number of currently connected SSE (Server-Sent Events) clients.',
    tags: ['sse'],
    auth: true,
    responses: {
      '200': {
        description: 'Client count',
        schema: { type: 'object', properties: { clients: { type: 'number' } } },
      },
    },
  });

  // ── MCP ─────────────────────────────────────────────────────────
  registry.register({
    path: '/api/mcp/servers',
    method: 'GET',
    summary: 'MCP servers',
    description: 'Returns the status of all configured MCP (Model Context Protocol) servers and available tools.',
    tags: ['mcp'],
    auth: true,
    responses: {
      '200': {
        description: 'MCP server status',
        schema: {
          type: 'object',
          properties: { enabled: { type: 'boolean' }, servers: { type: 'array' }, totalTools: { type: 'number' } },
        },
      },
    },
  });

  // ── Pool ────────────────────────────────────────────────────────
  registry.register({
    path: '/api/pool/stats',
    method: 'GET',
    summary: 'Agent pool stats',
    description: 'Returns agent pool statistics including pool size, utilization, and background task count.',
    tags: ['pool'],
    auth: true,
    responses: {
      '200': {
        description: 'Pool statistics',
        schema: {
          type: 'object',
          properties: { enabled: { type: 'boolean' }, backgroundTasks: { type: 'number' } },
        },
      },
    },
  });

  // ── Instincts ───────────────────────────────────────────────────
  registry.register({
    path: '/api/instincts',
    method: 'GET',
    summary: 'List instincts',
    description: 'Returns all learned instincts from the instinct store.',
    tags: ['instincts'],
    auth: true,
    responses: {
      '200': {
        description: 'Instinct list',
        schema: {
          type: 'object',
          properties: { enabled: { type: 'boolean' }, count: { type: 'number' }, instincts: { type: 'array' } },
        },
      },
    },
  });

  registry.register({
    path: '/api/instincts/export',
    method: 'POST',
    summary: 'Export instincts',
    description: 'Export instincts as a portable bundle with optional filtering options.',
    tags: ['instincts'],
    auth: true,
    requestBody: {
      contentType: 'application/json',
      schema: {
        type: 'object',
        properties: {
          domain: { type: 'string' },
          minConfidence: { type: 'number' },
        },
      },
    },
    responses: {
      '200': { description: 'Exported instinct bundle' },
      '503': { description: 'Instinct store not configured' },
    },
  });

  registry.register({
    path: '/api/instincts/import',
    method: 'POST',
    summary: 'Import instincts',
    description: 'Import an instinct bundle into the local instinct store.',
    tags: ['instincts'],
    auth: true,
    requestBody: {
      contentType: 'application/json',
      schema: {
        type: 'object',
        properties: {
          bundle: { type: 'object' },
          options: { type: 'object' },
        },
        required: ['bundle'],
      },
      required: true,
    },
    responses: {
      '200': { description: 'Import result' },
      '400': { description: 'Bundle is required in request body' },
      '503': { description: 'Instinct store not configured' },
    },
  });

  // ── Analytics ───────────────────────────────────────────────────
  registry.register({
    path: '/api/analytics/summary',
    method: 'GET',
    summary: 'Analytics summary',
    description: 'Returns a usage analytics summary with optional date range filtering.',
    tags: ['analytics'],
    auth: true,
    parameters: [
      { name: 'since', in: 'query', required: false, schema: { type: 'string', format: 'date-time' }, description: 'Start date filter (ISO 8601)' },
      { name: 'until', in: 'query', required: false, schema: { type: 'string', format: 'date-time' }, description: 'End date filter (ISO 8601)' },
    ],
    responses: {
      '200': { description: 'Analytics summary' },
    },
  });

  registry.register({
    path: '/api/analytics/cost-report',
    method: 'GET',
    summary: 'Cost report',
    description: 'Returns a cost analysis report with optional date range filtering.',
    tags: ['analytics'],
    auth: true,
    parameters: [
      { name: 'since', in: 'query', required: false, schema: { type: 'string', format: 'date-time' }, description: 'Start date filter (ISO 8601)' },
      { name: 'until', in: 'query', required: false, schema: { type: 'string', format: 'date-time' }, description: 'End date filter (ISO 8601)' },
    ],
    responses: {
      '200': { description: 'Cost report' },
    },
  });

  // ── Collaboration ───────────────────────────────────────────────
  registry.register({
    path: '/api/collaboration/sessions',
    method: 'GET',
    summary: 'List collaboration sessions',
    description: 'Returns all active and recent collaboration sessions.',
    tags: ['collaboration'],
    auth: true,
    responses: {
      '200': {
        description: 'Session list',
        schema: { type: 'object', properties: { enabled: { type: 'boolean' }, sessions: { type: 'array' } } },
      },
    },
  });

  registry.register({
    path: '/api/collaboration/sessions',
    method: 'POST',
    summary: 'Create collaboration session',
    description: 'Create a new collaboration session with an id, name, and creator.',
    tags: ['collaboration'],
    auth: true,
    requestBody: {
      contentType: 'application/json',
      schema: {
        type: 'object',
        properties: { id: { type: 'string' }, name: { type: 'string' }, createdBy: { type: 'string' } },
        required: ['id', 'name', 'createdBy'],
      },
      required: true,
    },
    responses: {
      '201': { description: 'Created session' },
      '400': { description: 'Missing required fields' },
      '503': { description: 'Collaboration not configured' },
    },
  });

  registry.register({
    path: '/api/collaboration/sessions/:id/join',
    method: 'POST',
    summary: 'Join collaboration session',
    description: 'Join an existing collaboration session by providing a userId.',
    tags: ['collaboration'],
    auth: true,
    parameters: [
      { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'Session identifier' },
    ],
    requestBody: {
      contentType: 'application/json',
      schema: { type: 'object', properties: { userId: { type: 'string' } }, required: ['userId'] },
      required: true,
    },
    responses: {
      '200': { description: 'Joined session' },
      '400': { description: 'userId is required' },
      '404': { description: 'Session not found or inactive' },
      '503': { description: 'Collaboration not configured' },
    },
  });

  registry.register({
    path: '/api/collaboration/sessions/:id/leave',
    method: 'POST',
    summary: 'Leave collaboration session',
    description: 'Leave a collaboration session.',
    tags: ['collaboration'],
    auth: true,
    parameters: [
      { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'Session identifier' },
    ],
    requestBody: {
      contentType: 'application/json',
      schema: { type: 'object', properties: { userId: { type: 'string' } }, required: ['userId'] },
      required: true,
    },
    responses: {
      '200': { description: 'Left session successfully' },
      '400': { description: 'userId is required' },
      '404': { description: 'Session not found' },
      '503': { description: 'Collaboration not configured' },
    },
  });

  registry.register({
    path: '/api/collaboration/sessions/:id/messages',
    method: 'POST',
    summary: 'Send collaboration message',
    description: 'Send a message (chat, cursor, edit, status, etc.) to a collaboration session.',
    tags: ['collaboration'],
    auth: true,
    parameters: [
      { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'Session identifier' },
    ],
    requestBody: {
      contentType: 'application/json',
      schema: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['cursor', 'edit', 'chat', 'status', 'task-update', 'agent-event'] },
          senderId: { type: 'string' },
          payload: {},
        },
        required: ['type', 'senderId'],
      },
      required: true,
    },
    responses: {
      '202': { description: 'Message sent' },
      '400': { description: 'type and senderId are required' },
      '503': { description: 'Collaboration not configured' },
    },
  });

  registry.register({
    path: '/api/collaboration/sessions/:id/messages',
    method: 'GET',
    summary: 'Get collaboration messages',
    description: 'Retrieve the message history for a specific collaboration session.',
    tags: ['collaboration'],
    auth: true,
    parameters: [
      { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'Session identifier' },
    ],
    responses: {
      '200': {
        description: 'Message history',
        schema: { type: 'object', properties: { enabled: { type: 'boolean' }, messages: { type: 'array' } } },
      },
    },
  });
}
