/**
 * RBAC Middleware Unit Tests
 *
 * Feature: F4.4 - API Authentication
 *
 * @module tests/unit/api/auth/middlewares/rbac.middleware
 */

import {
  InMemoryRbacService,
  createRbacMiddleware,
  createRbacService,
  rbac,
} from '../../../../../src/api/auth/middlewares/rbac.middleware';
import {
  ResourceType,
  PermissionScope,
  SYSTEM_ROLES,
  formatPermission,
} from '../../../../../src/api/auth/interfaces/auth.interface';
import { ForbiddenException } from '../../../../../src/api/middleware/error.middleware';

// Mock Fastify request and reply
function createMockRequest(overrides: Record<string, unknown> = {}): unknown {
  return {
    headers: {},
    url: '/test',
    method: 'GET',
    ip: '127.0.0.1',
    params: {},
    query: {},
    ...overrides,
  };
}

function createMockReply(): unknown {
  return {};
}

describe('InMemoryRbacService', () => {
  let rbacService: InMemoryRbacService;

  beforeEach(() => {
    rbacService = new InMemoryRbacService();
  });

  describe('system roles initialization', () => {
    it('should initialize with system roles', async () => {
      const roles = await rbacService.listRoles();
      expect(roles.length).toBe(4);

      const roleIds = roles.map((r) => r.id);
      expect(roleIds).toContain(SYSTEM_ROLES.ADMIN);
      expect(roleIds).toContain(SYSTEM_ROLES.USER);
      expect(roleIds).toContain(SYSTEM_ROLES.SERVICE);
      expect(roleIds).toContain(SYSTEM_ROLES.READONLY);
    });

    it('should have admin role with all permissions', async () => {
      const adminRole = await rbacService.getRole(SYSTEM_ROLES.ADMIN);
      expect(adminRole).toBeDefined();
      expect(adminRole?.permissions.length).toBeGreaterThan(0);
      expect(adminRole?.isSystem).toBe(true);
    });

    it('should have user role with limited permissions', async () => {
      const userRole = await rbacService.getRole(SYSTEM_ROLES.USER);
      expect(userRole).toBeDefined();
      expect(userRole?.permissions.some((p) => p.resource === ResourceType.AGENT)).toBe(true);
      expect(userRole?.isSystem).toBe(true);
    });

    it('should have readonly role with only read permissions', async () => {
      const readonlyRole = await rbacService.getRole(SYSTEM_ROLES.READONLY);
      expect(readonlyRole).toBeDefined();
      expect(readonlyRole?.permissions.every((p) => p.scope === PermissionScope.READ)).toBe(true);
    });
  });

  describe('role management', () => {
    it('should create a new role', async () => {
      const role = await rbacService.createRole({
        name: 'Custom Role',
        description: 'A custom role',
        isSystem: false,
        permissions: [
          { id: 'agent:read', resource: ResourceType.AGENT, scope: PermissionScope.READ },
        ],
      });

      expect(role.id).toBe('custom-role');
      expect(role.name).toBe('Custom Role');
      expect(role.permissions.length).toBe(1);
    });

    it('should update a non-system role', async () => {
      const role = await rbacService.createRole({
        name: 'Updatable Role',
        description: 'Can be updated',
        isSystem: false,
        permissions: [],
      });

      const updated = await rbacService.updateRole(role.id, {
        description: 'Updated description',
      });

      expect(updated.description).toBe('Updated description');
    });

    it('should throw when updating system role', async () => {
      await expect(
        rbacService.updateRole(SYSTEM_ROLES.ADMIN, { description: 'Modified' })
      ).rejects.toThrow('Cannot modify system roles');
    });

    it('should delete a non-system role', async () => {
      const role = await rbacService.createRole({
        name: 'Deletable Role',
        description: 'Can be deleted',
        isSystem: false,
        permissions: [],
      });

      await rbacService.deleteRole(role.id);
      expect(await rbacService.getRole(role.id)).toBeNull();
    });

    it('should throw when deleting system role', async () => {
      await expect(rbacService.deleteRole(SYSTEM_ROLES.ADMIN)).rejects.toThrow(
        'Cannot delete system roles'
      );
    });

    it('should throw when updating non-existent role', async () => {
      await expect(rbacService.updateRole('non-existent', {})).rejects.toThrow(
        "Role 'non-existent' not found"
      );
    });

    it('should throw when deleting non-existent role', async () => {
      await expect(rbacService.deleteRole('non-existent')).rejects.toThrow(
        "Role 'non-existent' not found"
      );
    });
  });

  describe('user role assignment', () => {
    it('should assign role to user', async () => {
      await rbacService.assignRole('user-123', SYSTEM_ROLES.USER, 'admin');
      const roles = await rbacService.getUserRoles('user-123');

      expect(roles.length).toBe(1);
      expect(roles[0].id).toBe(SYSTEM_ROLES.USER);
    });

    it('should not duplicate role assignment', async () => {
      await rbacService.assignRole('user-123', SYSTEM_ROLES.USER, 'admin');
      await rbacService.assignRole('user-123', SYSTEM_ROLES.USER, 'admin');

      const roles = await rbacService.getUserRoles('user-123');
      expect(roles.length).toBe(1);
    });

    it('should assign multiple roles to user', async () => {
      await rbacService.assignRole('user-123', SYSTEM_ROLES.USER, 'admin');
      await rbacService.assignRole('user-123', SYSTEM_ROLES.READONLY, 'admin');

      const roles = await rbacService.getUserRoles('user-123');
      expect(roles.length).toBe(2);
    });

    it('should remove role from user', async () => {
      await rbacService.assignRole('user-123', SYSTEM_ROLES.USER, 'admin');
      await rbacService.assignRole('user-123', SYSTEM_ROLES.READONLY, 'admin');
      await rbacService.removeRole('user-123', SYSTEM_ROLES.USER);

      const roles = await rbacService.getUserRoles('user-123');
      expect(roles.length).toBe(1);
      expect(roles[0].id).toBe(SYSTEM_ROLES.READONLY);
    });

    it('should throw when assigning non-existent role', async () => {
      await expect(
        rbacService.assignRole('user-123', 'non-existent-role', 'admin')
      ).rejects.toThrow("Role 'non-existent-role' not found");
    });

    it('should handle role expiration', async () => {
      const expiresAt = new Date(Date.now() - 1000); // Expired 1 second ago
      await rbacService.assignRole('user-123', SYSTEM_ROLES.USER, 'admin', expiresAt);

      const roles = await rbacService.getUserRoles('user-123');
      expect(roles.length).toBe(0);
    });

    it('should remove role assignments when role is deleted', async () => {
      const role = await rbacService.createRole({
        name: 'Temp Role',
        description: 'Temporary',
        isSystem: false,
        permissions: [],
      });

      await rbacService.assignRole('user-123', role.id, 'admin');
      await rbacService.deleteRole(role.id);

      const roles = await rbacService.getUserRoles('user-123');
      expect(roles.find((r) => r.id === role.id)).toBeUndefined();
    });
  });

  describe('permission checking', () => {
    beforeEach(async () => {
      await rbacService.assignRole('user-123', SYSTEM_ROLES.USER, 'admin');
      await rbacService.assignRole('admin-user', SYSTEM_ROLES.ADMIN, 'system');
    });

    it('should allow action when user has permission', async () => {
      const result = await rbacService.checkPermission({
        subject: 'user-123',
        resource: ResourceType.AGENT,
        action: PermissionScope.READ,
      });

      expect(result.allowed).toBe(true);
      expect(result.matchedPermission).toBeDefined();
    });

    it('should deny action when user lacks permission', async () => {
      const result = await rbacService.checkPermission({
        subject: 'user-123',
        resource: ResourceType.CONFIG,
        action: PermissionScope.ADMIN,
      });

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('No permission found');
    });

    it('should allow admin user full access when bypass enabled', async () => {
      const result = await rbacService.checkPermission({
        subject: 'admin-user',
        resource: ResourceType.CONFIG,
        action: PermissionScope.ADMIN,
      });

      expect(result.allowed).toBe(true);
      expect(result.reason).toBe('Admin bypass enabled');
    });

    it('should check multiple permissions', async () => {
      const results = await rbacService.checkPermissions('user-123', [
        { resource: ResourceType.AGENT, action: PermissionScope.READ },
        { resource: ResourceType.CONFIG, action: PermissionScope.ADMIN },
      ]);

      expect(results.get('agent:read')?.allowed).toBe(true);
      expect(results.get('config:admin')?.allowed).toBe(false);
    });

    it('should return empty permissions for user with no roles', async () => {
      const permissions = await rbacService.getUserPermissions('no-roles-user');
      expect(permissions).toEqual([]);
    });

    it('should return combined permissions from multiple roles', async () => {
      await rbacService.assignRole('multi-role-user', SYSTEM_ROLES.USER, 'admin');
      await rbacService.assignRole('multi-role-user', SYSTEM_ROLES.READONLY, 'admin');

      const permissions = await rbacService.getUserPermissions('multi-role-user');
      expect(permissions.length).toBeGreaterThan(0);
    });

    it('should check resource pattern when specified', async () => {
      // Create a role with resource pattern restriction
      const role = await rbacService.createRole({
        name: 'Pattern Role',
        description: 'Role with pattern restriction',
        isSystem: false,
        permissions: [
          {
            id: 'agent:read:owned',
            resource: ResourceType.AGENT,
            scope: PermissionScope.READ,
            resourcePattern: '^user-123-.*$',
          },
        ],
      });

      await rbacService.assignRole('pattern-user', role.id, 'admin');

      // Should allow matching resource ID
      const allowedResult = await rbacService.checkPermission({
        subject: 'pattern-user',
        resource: ResourceType.AGENT,
        action: PermissionScope.READ,
        resourceId: 'user-123-agent-1',
      });
      expect(allowedResult.allowed).toBe(true);

      // Should deny non-matching resource ID
      const deniedResult = await rbacService.checkPermission({
        subject: 'pattern-user',
        resource: ResourceType.AGENT,
        action: PermissionScope.READ,
        resourceId: 'other-user-agent-1',
      });
      expect(deniedResult.allowed).toBe(false);
    });

    it('should evaluate permission conditions', async () => {
      // Create a role with conditions
      const role = await rbacService.createRole({
        name: 'Conditional Role',
        description: 'Role with conditions',
        isSystem: false,
        permissions: [
          {
            id: 'agent:write:conditions',
            resource: ResourceType.AGENT,
            scope: PermissionScope.WRITE,
            conditions: [
              { field: 'status', operator: 'eq', value: 'draft' },
            ],
          },
        ],
      });

      await rbacService.assignRole('conditional-user', role.id, 'admin');

      // Should allow when condition matches
      const allowedResult = await rbacService.checkPermission({
        subject: 'conditional-user',
        resource: ResourceType.AGENT,
        action: PermissionScope.WRITE,
        context: { status: 'draft' },
      });
      expect(allowedResult.allowed).toBe(true);

      // Should deny when condition doesn't match
      const deniedResult = await rbacService.checkPermission({
        subject: 'conditional-user',
        resource: ResourceType.AGENT,
        action: PermissionScope.WRITE,
        context: { status: 'published' },
      });
      expect(deniedResult.allowed).toBe(false);
    });
  });

  describe('condition operators', () => {
    it('should evaluate "ne" (not equal) condition', async () => {
      const role = await rbacService.createRole({
        name: 'NE Test',
        description: 'Test not equal',
        isSystem: false,
        permissions: [
          {
            id: 'agent:read:ne',
            resource: ResourceType.AGENT,
            scope: PermissionScope.READ,
            conditions: [{ field: 'status', operator: 'ne', value: 'deleted' }],
          },
        ],
      });

      await rbacService.assignRole('ne-user', role.id, 'admin');

      const allowed = await rbacService.checkPermission({
        subject: 'ne-user',
        resource: ResourceType.AGENT,
        action: PermissionScope.READ,
        context: { status: 'active' },
      });
      expect(allowed.allowed).toBe(true);

      const denied = await rbacService.checkPermission({
        subject: 'ne-user',
        resource: ResourceType.AGENT,
        action: PermissionScope.READ,
        context: { status: 'deleted' },
      });
      expect(denied.allowed).toBe(false);
    });

    it('should evaluate "in" (array contains) condition', async () => {
      const role = await rbacService.createRole({
        name: 'IN Test',
        description: 'Test in array',
        isSystem: false,
        permissions: [
          {
            id: 'agent:read:in',
            resource: ResourceType.AGENT,
            scope: PermissionScope.READ,
            conditions: [{ field: 'type', operator: 'in', value: ['chat', 'assistant'] }],
          },
        ],
      });

      await rbacService.assignRole('in-user', role.id, 'admin');

      const allowed = await rbacService.checkPermission({
        subject: 'in-user',
        resource: ResourceType.AGENT,
        action: PermissionScope.READ,
        context: { type: 'chat' },
      });
      expect(allowed.allowed).toBe(true);

      const denied = await rbacService.checkPermission({
        subject: 'in-user',
        resource: ResourceType.AGENT,
        action: PermissionScope.READ,
        context: { type: 'workflow' },
      });
      expect(denied.allowed).toBe(false);
    });

    it('should evaluate numeric comparison conditions', async () => {
      const role = await rbacService.createRole({
        name: 'Numeric Test',
        description: 'Test numeric comparisons',
        isSystem: false,
        permissions: [
          {
            id: 'agent:write:numeric',
            resource: ResourceType.AGENT,
            scope: PermissionScope.WRITE,
            conditions: [
              { field: 'priority', operator: 'gte', value: 5 },
              { field: 'priority', operator: 'lte', value: 10 },
            ],
          },
        ],
      });

      await rbacService.assignRole('numeric-user', role.id, 'admin');

      const allowed = await rbacService.checkPermission({
        subject: 'numeric-user',
        resource: ResourceType.AGENT,
        action: PermissionScope.WRITE,
        context: { priority: 7 },
      });
      expect(allowed.allowed).toBe(true);

      const deniedLow = await rbacService.checkPermission({
        subject: 'numeric-user',
        resource: ResourceType.AGENT,
        action: PermissionScope.WRITE,
        context: { priority: 3 },
      });
      expect(deniedLow.allowed).toBe(false);
    });

    it('should evaluate "contains" condition', async () => {
      const role = await rbacService.createRole({
        name: 'Contains Test',
        description: 'Test string contains',
        isSystem: false,
        permissions: [
          {
            id: 'agent:read:contains',
            resource: ResourceType.AGENT,
            scope: PermissionScope.READ,
            conditions: [{ field: 'name', operator: 'contains', value: 'test' }],
          },
        ],
      });

      await rbacService.assignRole('contains-user', role.id, 'admin');

      const allowed = await rbacService.checkPermission({
        subject: 'contains-user',
        resource: ResourceType.AGENT,
        action: PermissionScope.READ,
        context: { name: 'my-test-agent' },
      });
      expect(allowed.allowed).toBe(true);

      const denied = await rbacService.checkPermission({
        subject: 'contains-user',
        resource: ResourceType.AGENT,
        action: PermissionScope.READ,
        context: { name: 'production-agent' },
      });
      expect(denied.allowed).toBe(false);
    });
  });

  describe('admin bypass', () => {
    it('should allow disabling admin bypass', async () => {
      const strictService = new InMemoryRbacService({ adminBypassEnabled: false });
      await strictService.assignRole('admin-user', SYSTEM_ROLES.ADMIN, 'system');

      // Admin should still have permissions via role, but not via bypass
      const result = await strictService.checkPermission({
        subject: 'admin-user',
        resource: ResourceType.AGENT,
        action: PermissionScope.READ,
      });

      expect(result.allowed).toBe(true);
      expect(result.reason).not.toBe('Admin bypass enabled');
      expect(result.matchedPermission).toBeDefined();
    });
  });
});

describe('createRbacMiddleware', () => {
  // Helper to call middleware (handling Fastify's async hook signature)
  async function callMiddleware(
    middleware: ReturnType<typeof createRbacMiddleware>,
    request: unknown
  ): Promise<void> {
    // Fastify preHandler hooks can be async (no done callback needed)
    return (middleware as (req: unknown, reply: unknown) => Promise<void>)(
      request,
      createMockReply()
    );
  }

  it('should throw ForbiddenException when not authenticated', async () => {
    const middleware = createRbacMiddleware(ResourceType.AGENT, PermissionScope.READ, {});
    const request = createMockRequest() as Record<string, unknown>;
    request.auth = { authenticated: false };

    await expect(callMiddleware(middleware, request)).rejects.toThrow(ForbiddenException);
  });

  it('should allow anonymous access when configured', async () => {
    const middleware = createRbacMiddleware(ResourceType.AGENT, PermissionScope.READ, {
      anonymousPermissions: [formatPermission(ResourceType.AGENT, PermissionScope.READ)],
    });
    const request = createMockRequest() as Record<string, unknown>;
    request.auth = { authenticated: false };

    await expect(callMiddleware(middleware, request)).resolves.not.toThrow();
  });

  it('should allow access when user has permission', async () => {
    const rbacService = new InMemoryRbacService();
    await rbacService.assignRole('user-123', SYSTEM_ROLES.USER, 'admin');

    const middleware = createRbacMiddleware(ResourceType.AGENT, PermissionScope.READ, {
      rbacService,
    });

    const request = createMockRequest() as Record<string, unknown>;
    request.auth = {
      authenticated: true,
      userId: 'user-123',
    };

    await expect(callMiddleware(middleware, request)).resolves.not.toThrow();
  });

  it('should deny access when user lacks permission', async () => {
    const rbacService = new InMemoryRbacService();
    await rbacService.assignRole('user-123', SYSTEM_ROLES.READONLY, 'admin');

    const middleware = createRbacMiddleware(ResourceType.AGENT, PermissionScope.DELETE, {
      rbacService,
    });

    const request = createMockRequest() as Record<string, unknown>;
    request.auth = {
      authenticated: true,
      userId: 'user-123',
    };

    await expect(callMiddleware(middleware, request)).rejects.toThrow(ForbiddenException);
  });

  it('should extract resourceId from request params', async () => {
    const rbacService = new InMemoryRbacService();
    await rbacService.assignRole('user-123', SYSTEM_ROLES.USER, 'admin');

    const middleware = createRbacMiddleware(ResourceType.AGENT, PermissionScope.READ, {
      rbacService,
    });

    const request = createMockRequest({
      params: { id: 'agent-456' },
    }) as Record<string, unknown>;
    request.auth = {
      authenticated: true,
      userId: 'user-123',
    };

    await expect(callMiddleware(middleware, request)).resolves.not.toThrow();
  });
});

describe('createRbacService factory', () => {
  it('should create InMemoryRbacService instance', () => {
    const service = createRbacService();
    expect(service).toBeInstanceOf(InMemoryRbacService);
  });

  it('should pass options to service', async () => {
    const service = createRbacService({ adminBypassEnabled: false });
    await service.assignRole('admin-user', SYSTEM_ROLES.ADMIN, 'system');

    const result = await service.checkPermission({
      subject: 'admin-user',
      resource: ResourceType.AGENT,
      action: PermissionScope.READ,
    });

    expect(result.reason).not.toBe('Admin bypass enabled');
  });
});

describe('rbac helper functions', () => {
  it('should create read middleware', () => {
    const middleware = rbac.read(ResourceType.AGENT);
    expect(middleware).toBeInstanceOf(Function);
  });

  it('should create write middleware', () => {
    const middleware = rbac.write(ResourceType.WORKFLOW);
    expect(middleware).toBeInstanceOf(Function);
  });

  it('should create delete middleware', () => {
    const middleware = rbac.delete(ResourceType.TOOL);
    expect(middleware).toBeInstanceOf(Function);
  });

  it('should create admin middleware', () => {
    const middleware = rbac.admin(ResourceType.CONFIG);
    expect(middleware).toBeInstanceOf(Function);
  });
});
