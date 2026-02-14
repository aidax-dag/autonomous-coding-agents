/**
 * API Documentation Tests
 *
 * Validates the full documentation pipeline: endpoint registration,
 * OpenAPI spec generation, and output serialization.
 */

import { EndpointRegistry, registerAllEndpoints } from '../../../../src/api/docs/endpoint-registry';
import { OpenAPIGenerator } from '../../../../src/api/docs/openapi-generator';
import type { APIEndpointDoc, OpenAPISpec } from '../../../../src/api/docs/types';

// ── Helpers ──────────────────────────────────────────────────────

function makeEndpoint(overrides: Partial<APIEndpointDoc> = {}): APIEndpointDoc {
  return {
    path: '/api/test',
    method: 'GET',
    summary: 'Test endpoint',
    description: 'A test endpoint for unit testing.',
    tags: ['test'],
    auth: false,
    responses: { '200': { description: 'OK' } },
    ...overrides,
  };
}

// ── EndpointRegistry ─────────────────────────────────────────────

describe('EndpointRegistry', () => {
  let registry: EndpointRegistry;

  beforeEach(() => {
    registry = new EndpointRegistry();
  });

  describe('register()', () => {
    it('should add an endpoint', () => {
      registry.register(makeEndpoint());
      expect(registry.getAll()).toHaveLength(1);
    });

    it('should add multiple endpoints', () => {
      registry.register(makeEndpoint({ path: '/api/a' }));
      registry.register(makeEndpoint({ path: '/api/b' }));
      registry.register(makeEndpoint({ path: '/api/c' }));
      expect(registry.getAll()).toHaveLength(3);
    });

    it('should preserve endpoint properties', () => {
      const ep = makeEndpoint({
        path: '/api/custom',
        method: 'POST',
        summary: 'Custom',
        auth: true,
        tags: ['custom'],
      });
      registry.register(ep);
      const stored = registry.getAll()[0];
      expect(stored.path).toBe('/api/custom');
      expect(stored.method).toBe('POST');
      expect(stored.summary).toBe('Custom');
      expect(stored.auth).toBe(true);
      expect(stored.tags).toEqual(['custom']);
    });
  });

  describe('getAll()', () => {
    it('should return empty array when no endpoints registered', () => {
      expect(registry.getAll()).toEqual([]);
    });

    it('should return all registered endpoints', () => {
      registry.register(makeEndpoint({ path: '/api/one' }));
      registry.register(makeEndpoint({ path: '/api/two' }));
      const all = registry.getAll();
      expect(all).toHaveLength(2);
      expect(all.map((e) => e.path)).toEqual(['/api/one', '/api/two']);
    });

    it('should return a copy (not mutate internal state)', () => {
      registry.register(makeEndpoint());
      const first = registry.getAll();
      first.push(makeEndpoint({ path: '/api/injected' }));
      expect(registry.getAll()).toHaveLength(1);
    });
  });

  describe('getByTag()', () => {
    it('should filter endpoints by tag', () => {
      registry.register(makeEndpoint({ path: '/api/a', tags: ['alpha'] }));
      registry.register(makeEndpoint({ path: '/api/b', tags: ['beta'] }));
      registry.register(makeEndpoint({ path: '/api/c', tags: ['alpha', 'beta'] }));

      const alphas = registry.getByTag('alpha');
      expect(alphas).toHaveLength(2);
      expect(alphas.map((e) => e.path)).toEqual(['/api/a', '/api/c']);
    });

    it('should return empty array for unknown tag', () => {
      registry.register(makeEndpoint({ tags: ['known'] }));
      expect(registry.getByTag('unknown')).toEqual([]);
    });
  });

  describe('getByPath()', () => {
    it('should find endpoints by exact path', () => {
      registry.register(makeEndpoint({ path: '/api/users' }));
      registry.register(makeEndpoint({ path: '/api/tasks' }));

      const found = registry.getByPath('/api/users');
      expect(found).toHaveLength(1);
      expect(found[0].path).toBe('/api/users');
    });

    it('should return multiple endpoints for the same path (different methods)', () => {
      registry.register(makeEndpoint({ path: '/api/items', method: 'GET' }));
      registry.register(makeEndpoint({ path: '/api/items', method: 'POST' }));

      expect(registry.getByPath('/api/items')).toHaveLength(2);
    });

    it('should return empty array for unknown path', () => {
      registry.register(makeEndpoint({ path: '/api/known' }));
      expect(registry.getByPath('/api/missing')).toEqual([]);
    });
  });

  describe('clear()', () => {
    it('should remove all registered endpoints', () => {
      registry.register(makeEndpoint({ path: '/api/a' }));
      registry.register(makeEndpoint({ path: '/api/b' }));
      expect(registry.getAll()).toHaveLength(2);

      registry.clear();
      expect(registry.getAll()).toHaveLength(0);
    });

    it('should allow re-registration after clear', () => {
      registry.register(makeEndpoint());
      registry.clear();
      registry.register(makeEndpoint({ path: '/api/new' }));
      expect(registry.getAll()).toHaveLength(1);
      expect(registry.getAll()[0].path).toBe('/api/new');
    });
  });

  describe('registerAllEndpoints()', () => {
    it('should register all known endpoints (at least 15)', () => {
      registerAllEndpoints(registry);
      const all = registry.getAll();
      expect(all.length).toBeGreaterThanOrEqual(15);
    });

    it('should register the current endpoint set defined in source code', () => {
      registerAllEndpoints(registry);
      expect(registry.getAll()).toHaveLength(44);
    });

    it('should include health endpoint', () => {
      registerAllEndpoints(registry);
      const health = registry.getByPath('/api/health');
      expect(health).toHaveLength(1);
      expect(health[0].method).toBe('GET');
      expect(health[0].auth).toBe(false);
    });

    it('should include login endpoint', () => {
      registerAllEndpoints(registry);
      const login = registry.getByPath('/api/login');
      expect(login).toHaveLength(1);
      expect(login[0].method).toBe('POST');
      expect(login[0].auth).toBe(false);
    });

    it('should include auth refresh endpoint', () => {
      registerAllEndpoints(registry);
      const refresh = registry.getByPath('/api/auth/refresh');
      expect(refresh).toHaveLength(1);
      expect(refresh[0].method).toBe('POST');
    });

    it('should include all collaboration endpoints', () => {
      registerAllEndpoints(registry);
      const collab = registry.getByTag('collaboration');
      expect(collab.length).toBeGreaterThanOrEqual(6);
    });

    it('should include analytics endpoints', () => {
      registerAllEndpoints(registry);
      const analytics = registry.getByTag('analytics');
      expect(analytics).toHaveLength(2);
    });

    it('should include instinct endpoints', () => {
      registerAllEndpoints(registry);
      const instincts = registry.getByTag('instincts');
      expect(instincts).toHaveLength(3);
    });
  });
});

// ── OpenAPIGenerator ─────────────────────────────────────────────

describe('OpenAPIGenerator', () => {
  let registry: EndpointRegistry;
  let generator: OpenAPIGenerator;

  beforeEach(() => {
    registry = new EndpointRegistry();
    registerAllEndpoints(registry);
    generator = new OpenAPIGenerator(registry);
  });

  describe('generate()', () => {
    it('should return a valid OpenAPI 3.0 structure', () => {
      const spec = generator.generate();
      expect(spec.openapi).toBe('3.0.3');
      expect(spec.info).toBeDefined();
      expect(spec.paths).toBeDefined();
      expect(spec.components).toBeDefined();
      expect(spec.tags).toBeDefined();
      expect(spec.servers).toBeDefined();
    });

    it('should have info section with correct defaults', () => {
      const spec = generator.generate();
      expect(spec.info.title).toBe('ACA API');
      expect(spec.info.version).toBe('0.1.0');
      expect(spec.info.description).toBeDefined();
    });

    it('should accept custom title and version', () => {
      const custom = new OpenAPIGenerator(registry, {
        title: 'Custom API',
        version: '2.0.0',
      });
      const spec = custom.generate();
      expect(spec.info.title).toBe('Custom API');
      expect(spec.info.version).toBe('2.0.0');
    });

    it('should include server configuration', () => {
      const spec = generator.generate();
      expect(spec.servers).toHaveLength(1);
      expect(spec.servers[0].url).toBe('http://localhost:3000');
      expect(spec.servers[0].description).toBeDefined();
    });

    it('should accept custom server URL', () => {
      const custom = new OpenAPIGenerator(registry, { serverUrl: 'https://api.example.com' });
      const spec = custom.generate();
      expect(spec.servers[0].url).toBe('https://api.example.com');
    });
  });

  describe('paths', () => {
    it('should include all registered endpoints in paths', () => {
      const spec = generator.generate();
      const endpoints = registry.getAll();
      for (const ep of endpoints) {
        const openAPIPath = ep.path.replace(/:(\w+)/g, '{$1}');
        expect(spec.paths[openAPIPath]).toBeDefined();
        const method = ep.method.toLowerCase();
        expect(spec.paths[openAPIPath][method]).toBeDefined();
      }
    });

    it('should convert Express path params to OpenAPI format', () => {
      const spec = generator.generate();
      expect(spec.paths['/api/agents/{agentId}']).toBeDefined();
      expect(spec.paths['/api/collaboration/sessions/{id}/join']).toBeDefined();
    });

    it('should include summary and description in operations', () => {
      const spec = generator.generate();
      const healthOp = spec.paths['/api/health']?.['get'] as Record<string, unknown>;
      expect(healthOp.summary).toBe('Health check');
      expect(healthOp.description).toBeDefined();
    });

    it('should include tags in operations', () => {
      const spec = generator.generate();
      const healthOp = spec.paths['/api/health']?.['get'] as Record<string, unknown>;
      expect(healthOp.tags).toEqual(['system']);
    });

    it('should include operationId in operations', () => {
      const spec = generator.generate();
      const healthOp = spec.paths['/api/health']?.['get'] as Record<string, unknown>;
      expect(healthOp.operationId).toBeDefined();
      expect(typeof healthOp.operationId).toBe('string');
    });
  });

  describe('security', () => {
    it('should add security requirement to auth endpoints', () => {
      const spec = generator.generate();
      const snapshotOp = spec.paths['/api/snapshot']?.['get'] as Record<string, unknown>;
      expect(snapshotOp.security).toBeDefined();
      expect(snapshotOp.security).toEqual([{ bearerAuth: [] }]);
    });

    it('should not add security to non-auth endpoints', () => {
      const spec = generator.generate();
      const healthOp = spec.paths['/api/health']?.['get'] as Record<string, unknown>;
      expect(healthOp.security).toBeUndefined();
    });

    it('should not add security to login endpoint', () => {
      const spec = generator.generate();
      const loginOp = spec.paths['/api/login']?.['post'] as Record<string, unknown>;
      expect(loginOp.security).toBeUndefined();
    });

    it('should include Bearer JWT in security schemes', () => {
      const spec = generator.generate();
      const schemes = spec.components.securitySchemes;
      expect(schemes.bearerAuth).toBeDefined();
      const bearer = schemes.bearerAuth as Record<string, unknown>;
      expect(bearer.type).toBe('http');
      expect(bearer.scheme).toBe('bearer');
      expect(bearer.bearerFormat).toBe('JWT');
    });
  });

  describe('request bodies', () => {
    it('should include request body schema for POST endpoints', () => {
      const spec = generator.generate();
      const loginOp = spec.paths['/api/login']?.['post'] as Record<string, unknown>;
      expect(loginOp.requestBody).toBeDefined();
      const reqBody = loginOp.requestBody as Record<string, unknown>;
      expect(reqBody.content).toBeDefined();
      const content = reqBody.content as Record<string, unknown>;
      expect(content['application/json']).toBeDefined();
    });

    it('should mark required request bodies', () => {
      const spec = generator.generate();
      const loginOp = spec.paths['/api/login']?.['post'] as Record<string, unknown>;
      const reqBody = loginOp.requestBody as Record<string, unknown>;
      expect(reqBody.required).toBe(true);
    });

    it('should not include request body for GET endpoints', () => {
      const spec = generator.generate();
      const healthOp = spec.paths['/api/health']?.['get'] as Record<string, unknown>;
      expect(healthOp.requestBody).toBeUndefined();
    });
  });

  describe('parameters', () => {
    it('should extract path parameters from :id patterns', () => {
      const spec = generator.generate();
      const agentOp = spec.paths['/api/agents/{agentId}']?.['get'] as Record<string, unknown>;
      expect(agentOp.parameters).toBeDefined();
      const params = agentOp.parameters as Array<Record<string, unknown>>;
      const agentIdParam = params.find((p) => p.name === 'agentId');
      expect(agentIdParam).toBeDefined();
      expect(agentIdParam?.in).toBe('path');
      expect(agentIdParam?.required).toBe(true);
    });

    it('should include query parameters', () => {
      const spec = generator.generate();
      const summaryOp = spec.paths['/api/analytics/summary']?.['get'] as Record<string, unknown>;
      expect(summaryOp.parameters).toBeDefined();
      const params = summaryOp.parameters as Array<Record<string, unknown>>;
      const sinceParam = params.find((p) => p.name === 'since');
      expect(sinceParam).toBeDefined();
      expect(sinceParam?.in).toBe('query');
      expect(sinceParam?.required).toBe(false);
    });

    it('should not include parameters for simple GET endpoints', () => {
      const spec = generator.generate();
      const healthOp = spec.paths['/api/health']?.['get'] as Record<string, unknown>;
      expect(healthOp.parameters).toBeUndefined();
    });
  });

  describe('tags', () => {
    it('should generate tags from endpoint tags', () => {
      const spec = generator.generate();
      expect(spec.tags.length).toBeGreaterThanOrEqual(5);
    });

    it('should include tag descriptions', () => {
      const spec = generator.generate();
      for (const tag of spec.tags) {
        expect(tag.name).toBeDefined();
        expect(tag.description).toBeDefined();
        expect(tag.description.length).toBeGreaterThan(0);
      }
    });

    it('should include known tags', () => {
      const spec = generator.generate();
      const tagNames = spec.tags.map((t) => t.name);
      expect(tagNames).toContain('system');
      expect(tagNames).toContain('auth');
      expect(tagNames).toContain('agents');
      expect(tagNames).toContain('collaboration');
    });

    it('should sort tags alphabetically', () => {
      const spec = generator.generate();
      const names = spec.tags.map((t) => t.name);
      const sorted = [...names].sort();
      expect(names).toEqual(sorted);
    });
  });

  describe('responses', () => {
    it('should include response definitions', () => {
      const spec = generator.generate();
      const healthOp = spec.paths['/api/health']?.['get'] as Record<string, unknown>;
      const responses = healthOp.responses as Record<string, Record<string, unknown>>;
      expect(responses['200']).toBeDefined();
      expect(responses['200'].description).toBeDefined();
    });

    it('should include response schemas when defined', () => {
      const spec = generator.generate();
      const healthOp = spec.paths['/api/health']?.['get'] as Record<string, unknown>;
      const responses = healthOp.responses as Record<string, Record<string, unknown>>;
      expect(responses['200'].content).toBeDefined();
    });

    it('should include error responses', () => {
      const spec = generator.generate();
      const loginOp = spec.paths['/api/login']?.['post'] as Record<string, unknown>;
      const responses = loginOp.responses as Record<string, Record<string, unknown>>;
      expect(responses['400']).toBeDefined();
      expect(responses['401']).toBeDefined();
    });
  });

  describe('toJSON()', () => {
    it('should return a valid JSON string', () => {
      const json = generator.toJSON();
      expect(typeof json).toBe('string');
      const parsed = JSON.parse(json);
      expect(parsed.openapi).toBe('3.0.3');
    });

    it('should be pretty-printed', () => {
      const json = generator.toJSON();
      expect(json).toContain('\n');
      expect(json).toContain('  ');
    });
  });

  describe('toYAML()', () => {
    it('should return a YAML-like string', () => {
      const yaml = generator.toYAML();
      expect(typeof yaml).toBe('string');
      expect(yaml).toContain('openapi:');
      expect(yaml).toContain('info:');
      expect(yaml).toContain('paths:');
    });

    it('should contain key structural elements', () => {
      const yaml = generator.toYAML();
      expect(yaml).toContain('title:');
      expect(yaml).toContain('version:');
      expect(yaml).toContain('servers:');
      expect(yaml).toContain('components:');
    });
  });
});

// ── Integration ──────────────────────────────────────────────────

describe('API Documentation Integration', () => {
  it('should produce valid spec through full pipeline: register -> generate -> validate', () => {
    const registry = new EndpointRegistry();
    registerAllEndpoints(registry);
    const generator = new OpenAPIGenerator(registry, {
      title: 'Integration Test API',
      version: '1.0.0',
    });

    const spec = generator.generate();

    // Valid OpenAPI structure
    expect(spec.openapi).toMatch(/^3\.0\.\d+$/);
    expect(spec.info.title).toBe('Integration Test API');
    expect(spec.info.version).toBe('1.0.0');
    expect(Object.keys(spec.paths).length).toBeGreaterThan(0);
    expect(spec.components.securitySchemes).toBeDefined();
    expect(spec.tags.length).toBeGreaterThan(0);

    // JSON round-trip integrity
    const json = generator.toJSON();
    const reparsed = JSON.parse(json) as OpenAPISpec;
    expect(reparsed.openapi).toBe(spec.openapi);
    expect(Object.keys(reparsed.paths).length).toBe(Object.keys(spec.paths).length);
  });

  it('should document all API endpoints (no missing endpoints)', () => {
    const registry = new EndpointRegistry();
    registerAllEndpoints(registry);
    const spec = new OpenAPIGenerator(registry).generate();

    // Expected paths from API route modules and docs registry
    const expectedPaths = [
      '/api/health',
      '/api/login',
      '/api/auth/refresh',
      '/api/snapshot',
      '/api/agents',
      '/api/agents/{agentId}',
      '/api/tasks',
      '/api/tickets',
      '/api/tickets/{ticketId}',
      '/api/tickets/{ticketId}/start',
      '/api/tickets/{ticketId}/status',
      '/api/tickets/{ticketId}/artifacts',
      '/api/tickets/{ticketId}/issues',
      '/api/tickets/{ticketId}/reviews',
      '/api/tickets/{ticketId}/complete',
      '/api/tickets/{ticketId}/register-feature',
      '/api/features',
      '/api/features/labels',
      '/api/features/management/summary',
      '/api/features/{featureId}',
      '/api/features/{featureId}/versions',
      '/api/features/{featureId}/labels',
      '/api/features/{featureId}/use',
      '/api/features/{featureId}/rollback',
      '/api/features/{featureId}/status',
      '/api/features/{featureId}/reviews',
      '/api/sse/clients',
      '/api/mcp/servers',
      '/api/pool/stats',
      '/api/instincts',
      '/api/instincts/export',
      '/api/instincts/import',
      '/api/analytics/summary',
      '/api/analytics/cost-report',
      '/api/collaboration/sessions',
      '/api/collaboration/sessions/{id}/join',
      '/api/collaboration/sessions/{id}/leave',
      '/api/collaboration/sessions/{id}/messages',
    ];

    for (const path of expectedPaths) {
      expect(spec.paths[path]).toBeDefined();
    }
  });

  it('should have correct method assignments for shared paths', () => {
    const registry = new EndpointRegistry();
    registerAllEndpoints(registry);
    const spec = new OpenAPIGenerator(registry).generate();

    // /api/collaboration/sessions has both GET and POST
    const sessions = spec.paths['/api/collaboration/sessions'];
    expect(sessions?.['get']).toBeDefined();
    expect(sessions?.['post']).toBeDefined();

    // /api/collaboration/sessions/{id}/messages has both GET and POST
    const messages = spec.paths['/api/collaboration/sessions/{id}/messages'];
    expect(messages?.['get']).toBeDefined();
    expect(messages?.['post']).toBeDefined();
  });

  it('should correctly classify auth vs non-auth endpoints', () => {
    const registry = new EndpointRegistry();
    registerAllEndpoints(registry);
    const spec = new OpenAPIGenerator(registry).generate();

    // Non-auth endpoints (no security)
    const nonAuthPaths = ['/api/health', '/api/login', '/api/auth/refresh'];
    for (const path of nonAuthPaths) {
      const methods = spec.paths[path];
      for (const method of Object.values(methods as Record<string, Record<string, unknown>>)) {
        expect(method.security).toBeUndefined();
      }
    }

    // Auth endpoints (have security)
    const authPaths = ['/api/snapshot', '/api/agents', '/api/tasks'];
    for (const path of authPaths) {
      const methods = spec.paths[path];
      for (const method of Object.values(methods as Record<string, Record<string, unknown>>)) {
        expect(method.security).toBeDefined();
        expect(method.security).toEqual([{ bearerAuth: [] }]);
      }
    }
  });

  it('should produce consistent output across multiple generations', () => {
    const registry = new EndpointRegistry();
    registerAllEndpoints(registry);
    const generator = new OpenAPIGenerator(registry);

    const json1 = generator.toJSON();
    const json2 = generator.toJSON();
    expect(json1).toBe(json2);
  });
});
