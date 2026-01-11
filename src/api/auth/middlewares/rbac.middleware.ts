/**
 * RBAC (Role-Based Access Control) Middleware
 *
 * Feature: F4.4 - API Authentication
 *
 * Provides fine-grained permission checking based on roles and resources.
 *
 * SOLID Principles:
 * - S: Single responsibility - permission checking only
 * - O: Open for extension via custom conditions
 * - D: Depends on IRbacService abstraction
 *
 * @module api/auth/middlewares/rbac
 */

import type { FastifyRequest, FastifyReply, preHandlerHookHandler } from 'fastify';
import { ILogger, createLogger } from '../../../core/services/logger.js';
import { ForbiddenException } from '../../middleware/error.middleware.js';
import {
  IRbacService,
  ResourceType,
  PermissionScope,
  Permission,
  Role,
  PermissionCheckRequest,
  PermissionCheckResult,
  PermissionCondition,
  UserRoleAssignment,
  SYSTEM_ROLES,
  formatPermission,
} from '../interfaces/auth.interface.js';

/**
 * RBAC configuration
 */
export interface RbacConfig {
  /**
   * External RBAC service (optional, uses in-memory if not provided)
   */
  rbacService?: IRbacService;

  /**
   * Default permissions for anonymous users
   */
  anonymousPermissions?: string[];

  /**
   * Whether to allow all permissions for admin role
   */
  adminBypassEnabled?: boolean;
}

/**
 * In-memory RBAC service implementation
 */
export class InMemoryRbacService implements IRbacService {
  private readonly logger: ILogger;
  private readonly roles: Map<string, Role>;
  private readonly userRoles: Map<string, UserRoleAssignment[]>;
  private readonly adminBypassEnabled: boolean;

  constructor(options: { adminBypassEnabled?: boolean } = {}) {
    this.logger = createLogger('RbacService');
    this.roles = new Map();
    this.userRoles = new Map();
    this.adminBypassEnabled = options.adminBypassEnabled ?? true;

    // Initialize system roles
    this.initializeSystemRoles();
  }

  /**
   * Initialize default system roles
   */
  private initializeSystemRoles(): void {
    // Admin role - full access
    const adminRole: Role = {
      id: SYSTEM_ROLES.ADMIN,
      name: 'Administrator',
      description: 'Full system access',
      permissions: Object.values(ResourceType).flatMap((resource) =>
        Object.values(PermissionScope).map((scope) => ({
          id: formatPermission(resource, scope),
          resource,
          scope,
        }))
      ),
      isSystem: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.roles.set(SYSTEM_ROLES.ADMIN, adminRole);

    // User role - standard access
    const userRole: Role = {
      id: SYSTEM_ROLES.USER,
      name: 'User',
      description: 'Standard user access',
      permissions: [
        { id: 'agent:read', resource: ResourceType.AGENT, scope: PermissionScope.READ },
        { id: 'agent:write', resource: ResourceType.AGENT, scope: PermissionScope.WRITE },
        { id: 'workflow:read', resource: ResourceType.WORKFLOW, scope: PermissionScope.READ },
        { id: 'workflow:write', resource: ResourceType.WORKFLOW, scope: PermissionScope.WRITE },
        { id: 'tool:read', resource: ResourceType.TOOL, scope: PermissionScope.READ },
        { id: 'task:read', resource: ResourceType.TASK, scope: PermissionScope.READ },
        { id: 'task:write', resource: ResourceType.TASK, scope: PermissionScope.WRITE },
      ],
      isSystem: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.roles.set(SYSTEM_ROLES.USER, userRole);

    // Service role - for internal services
    const serviceRole: Role = {
      id: SYSTEM_ROLES.SERVICE,
      name: 'Service',
      description: 'Internal service access',
      permissions: Object.values(ResourceType).flatMap((resource) =>
        Object.values(PermissionScope).map((scope) => ({
          id: formatPermission(resource, scope),
          resource,
          scope,
        }))
      ),
      isSystem: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.roles.set(SYSTEM_ROLES.SERVICE, serviceRole);

    // Readonly role - view only
    const readonlyRole: Role = {
      id: SYSTEM_ROLES.READONLY,
      name: 'Readonly',
      description: 'View-only access',
      permissions: Object.values(ResourceType).map((resource) => ({
        id: formatPermission(resource, PermissionScope.READ),
        resource,
        scope: PermissionScope.READ,
      })),
      isSystem: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.roles.set(SYSTEM_ROLES.READONLY, readonlyRole);

    this.logger.debug('System roles initialized', {
      roles: [SYSTEM_ROLES.ADMIN, SYSTEM_ROLES.USER, SYSTEM_ROLES.SERVICE, SYSTEM_ROLES.READONLY],
    });
  }

  /**
   * Check if subject has permission
   */
  async checkPermission(request: PermissionCheckRequest): Promise<PermissionCheckResult> {
    const { subject, resource, action, resourceId, context } = request;

    // Get user roles
    const userRoles = await this.getUserRoles(subject);

    // Admin bypass check
    if (this.adminBypassEnabled && userRoles.some((r) => r.id === SYSTEM_ROLES.ADMIN)) {
      return {
        allowed: true,
        reason: 'Admin bypass enabled',
      };
    }

    // Get all permissions from all roles
    const allPermissions = await this.getUserPermissions(subject);

    // Check for matching permission
    for (const permission of allPermissions) {
      if (this.permissionMatches(permission, resource, action, resourceId, context)) {
        return {
          allowed: true,
          matchedPermission: permission,
        };
      }
    }

    return {
      allowed: false,
      reason: `No permission found for ${action} on ${resource}`,
    };
  }

  /**
   * Check multiple permissions at once
   */
  async checkPermissions(
    subject: string,
    permissions: Array<{ resource: ResourceType; action: PermissionScope; resourceId?: string }>
  ): Promise<Map<string, PermissionCheckResult>> {
    const results = new Map<string, PermissionCheckResult>();

    for (const perm of permissions) {
      const key = `${perm.resource}:${perm.action}${perm.resourceId ? `:${perm.resourceId}` : ''}`;
      const result = await this.checkPermission({
        subject,
        resource: perm.resource,
        action: perm.action,
        resourceId: perm.resourceId,
      });
      results.set(key, result);
    }

    return results;
  }

  /**
   * Get all permissions for a user
   */
  async getUserPermissions(userId: string): Promise<Permission[]> {
    const userRoles = await this.getUserRoles(userId);
    const permissions: Permission[] = [];
    const seen = new Set<string>();

    for (const role of userRoles) {
      for (const permission of role.permissions) {
        if (!seen.has(permission.id)) {
          seen.add(permission.id);
          permissions.push(permission);
        }
      }
    }

    return permissions;
  }

  /**
   * Get all roles for a user
   */
  async getUserRoles(userId: string): Promise<Role[]> {
    const assignments = this.userRoles.get(userId) || [];
    const now = new Date();
    const roles: Role[] = [];

    for (const assignment of assignments) {
      // Check if assignment is still valid
      if (assignment.expiresAt && assignment.expiresAt < now) {
        continue;
      }

      const role = this.roles.get(assignment.roleId);
      if (role) {
        roles.push(role);

        // Include parent role if exists
        if (role.parentRole) {
          const parentRole = this.roles.get(role.parentRole);
          if (parentRole && !roles.find((r) => r.id === parentRole.id)) {
            roles.push(parentRole);
          }
        }
      }
    }

    return roles;
  }

  /**
   * Assign role to user
   */
  async assignRole(userId: string, roleId: string, assignedBy: string, expiresAt?: Date): Promise<void> {
    const role = this.roles.get(roleId);
    if (!role) {
      throw new Error(`Role '${roleId}' not found`);
    }

    const assignments = this.userRoles.get(userId) || [];

    // Check if already assigned
    if (assignments.some((a) => a.roleId === roleId)) {
      return;
    }

    assignments.push({
      userId,
      roleId,
      assignedAt: new Date(),
      assignedBy,
      expiresAt,
    });

    this.userRoles.set(userId, assignments);
    this.logger.info('Role assigned to user', { userId, roleId, assignedBy, expiresAt });
  }

  /**
   * Remove role from user
   */
  async removeRole(userId: string, roleId: string): Promise<void> {
    const assignments = this.userRoles.get(userId) || [];
    const filtered = assignments.filter((a) => a.roleId !== roleId);
    this.userRoles.set(userId, filtered);
    this.logger.info('Role removed from user', { userId, roleId });
  }

  /**
   * Create a new role
   */
  async createRole(role: Omit<Role, 'id' | 'createdAt' | 'updatedAt'>): Promise<Role> {
    const id = role.name.toLowerCase().replace(/\s+/g, '-');
    const now = new Date();

    const newRole: Role = {
      ...role,
      id,
      createdAt: now,
      updatedAt: now,
    };

    this.roles.set(id, newRole);
    this.logger.info('Role created', { id, name: role.name });

    return newRole;
  }

  /**
   * Update a role
   */
  async updateRole(id: string, updates: Partial<Role>): Promise<Role> {
    const role = this.roles.get(id);
    if (!role) {
      throw new Error(`Role '${id}' not found`);
    }

    if (role.isSystem) {
      throw new Error('Cannot modify system roles');
    }

    const updatedRole: Role = {
      ...role,
      ...updates,
      id: role.id, // Prevent ID change
      isSystem: role.isSystem, // Prevent system flag change
      updatedAt: new Date(),
    };

    this.roles.set(id, updatedRole);
    this.logger.info('Role updated', { id });

    return updatedRole;
  }

  /**
   * Delete a role
   */
  async deleteRole(id: string): Promise<void> {
    const role = this.roles.get(id);
    if (!role) {
      throw new Error(`Role '${id}' not found`);
    }

    if (role.isSystem) {
      throw new Error('Cannot delete system roles');
    }

    this.roles.delete(id);

    // Remove role from all users
    for (const [userId, assignments] of this.userRoles.entries()) {
      const filtered = assignments.filter((a) => a.roleId !== id);
      this.userRoles.set(userId, filtered);
    }

    this.logger.info('Role deleted', { id });
  }

  /**
   * Get role by ID
   */
  async getRole(id: string): Promise<Role | null> {
    return this.roles.get(id) || null;
  }

  /**
   * List all roles
   */
  async listRoles(): Promise<Role[]> {
    return Array.from(this.roles.values());
  }

  /**
   * Check if permission matches the request
   */
  private permissionMatches(
    permission: Permission,
    resource: ResourceType,
    scope: PermissionScope,
    resourceId?: string,
    context?: Record<string, unknown>
  ): boolean {
    // Check resource type
    if (permission.resource !== resource) {
      return false;
    }

    // Check scope (admin scope includes all)
    if (permission.scope !== scope && permission.scope !== PermissionScope.ADMIN) {
      return false;
    }

    // Check resource pattern if specified
    if (permission.resourcePattern && resourceId) {
      const pattern = new RegExp(permission.resourcePattern);
      if (!pattern.test(resourceId)) {
        return false;
      }
    }

    // Check conditions if specified
    if (permission.conditions && permission.conditions.length > 0 && context) {
      for (const condition of permission.conditions) {
        if (!this.evaluateCondition(condition, context)) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Evaluate a permission condition
   */
  private evaluateCondition(condition: PermissionCondition, context: Record<string, unknown>): boolean {
    const value = context[condition.field];

    switch (condition.operator) {
      case 'eq':
        return value === condition.value;
      case 'ne':
        return value !== condition.value;
      case 'in':
        return Array.isArray(condition.value) && condition.value.includes(value);
      case 'nin':
        return Array.isArray(condition.value) && !condition.value.includes(value);
      case 'gt':
        return typeof value === 'number' && typeof condition.value === 'number' && value > condition.value;
      case 'gte':
        return typeof value === 'number' && typeof condition.value === 'number' && value >= condition.value;
      case 'lt':
        return typeof value === 'number' && typeof condition.value === 'number' && value < condition.value;
      case 'lte':
        return typeof value === 'number' && typeof condition.value === 'number' && value <= condition.value;
      case 'contains':
        return typeof value === 'string' && typeof condition.value === 'string' && value.includes(condition.value);
      default:
        return false;
    }
  }
}

/**
 * Create RBAC middleware for route-level permission checking
 */
export function createRbacMiddleware(
  resource: ResourceType,
  scope: PermissionScope,
  config: RbacConfig
): preHandlerHookHandler {
  const logger = createLogger('RbacMiddleware');
  const rbacService = config.rbacService || new InMemoryRbacService({
    adminBypassEnabled: config.adminBypassEnabled,
  });

  return async function rbacMiddleware(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
    const auth = request.auth;

    // If not authenticated, check anonymous permissions
    if (!auth?.authenticated) {
      const requiredPermission = formatPermission(resource, scope);
      if (config.anonymousPermissions?.includes(requiredPermission)) {
        return;
      }
      throw new ForbiddenException(`Permission denied: ${requiredPermission}`);
    }

    // Get resource ID from params if available
    const resourceId = (request.params as Record<string, string>)?.id ||
                       (request.params as Record<string, string>)?.agentId ||
                       (request.params as Record<string, string>)?.workflowId;

    // Check permission
    const result = await rbacService.checkPermission({
      subject: auth.userId!,
      resource,
      action: scope,
      resourceId,
      context: {
        ...request.query as Record<string, unknown>,
        method: request.method,
        path: request.url,
      },
    });

    if (!result.allowed) {
      logger.debug('Permission denied', {
        userId: auth.userId,
        resource,
        scope,
        resourceId,
        reason: result.reason,
      });
      throw new ForbiddenException(result.reason || 'Permission denied');
    }

    logger.debug('Permission granted', {
      userId: auth.userId,
      resource,
      scope,
      resourceId,
    });
  };
}

/**
 * Factory function to create RBAC service
 */
export function createRbacService(options: { adminBypassEnabled?: boolean } = {}): IRbacService {
  return new InMemoryRbacService(options);
}

/**
 * Helper to create permission check middleware for common operations
 */
export const rbac = {
  read: (resource: ResourceType, config: RbacConfig = {}) =>
    createRbacMiddleware(resource, PermissionScope.READ, config),
  write: (resource: ResourceType, config: RbacConfig = {}) =>
    createRbacMiddleware(resource, PermissionScope.WRITE, config),
  delete: (resource: ResourceType, config: RbacConfig = {}) =>
    createRbacMiddleware(resource, PermissionScope.DELETE, config),
  admin: (resource: ResourceType, config: RbacConfig = {}) =>
    createRbacMiddleware(resource, PermissionScope.ADMIN, config),
};
