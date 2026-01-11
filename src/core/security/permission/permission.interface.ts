/**
 * Permission System Interfaces
 *
 * Feature: F5.3 - Permission System
 * Provides RBAC-based permission management with fine-grained access control
 *
 * @module core/security/permission
 */

import type { IDisposable } from '../../di/interfaces/container.interface.js';

/**
 * Permission action types
 */
export type PermissionAction = 'create' | 'read' | 'update' | 'delete' | 'execute' | 'manage' | '*';

/**
 * Resource types that can be protected
 */
export type ResourceType =
  | 'agent'
  | 'plugin'
  | 'tool'
  | 'workflow'
  | 'task'
  | 'file'
  | 'directory'
  | 'secret'
  | 'config'
  | 'log'
  | 'mcp-server'
  | 'hook'
  | 'api'
  | 'system';

/**
 * Permission scope
 */
export type PermissionScope = 'global' | 'project' | 'workspace' | 'user' | 'session';

/**
 * Permission definition
 */
export interface Permission {
  /** Permission identifier */
  id: string;
  /** Resource type */
  resource: ResourceType;
  /** Allowed actions */
  actions: PermissionAction[];
  /** Permission scope */
  scope: PermissionScope;
  /** Resource pattern (glob-style) */
  resourcePattern?: string;
  /** Conditions for permission */
  conditions?: PermissionCondition[];
  /** Permission description */
  description?: string;
  /** Whether permission is system-defined */
  isSystem?: boolean;
}

/**
 * Permission condition
 */
export interface PermissionCondition {
  /** Condition type */
  type: 'time' | 'ip' | 'attribute' | 'context' | 'custom';
  /** Condition operator */
  operator: 'eq' | 'ne' | 'gt' | 'lt' | 'in' | 'contains' | 'matches';
  /** Condition field */
  field: string;
  /** Expected value */
  value: unknown;
  /** Condition description */
  description?: string;
}

/**
 * Role definition
 */
export interface Role {
  /** Role identifier */
  id: string;
  /** Role name */
  name: string;
  /** Role description */
  description?: string;
  /** Permissions assigned to role */
  permissions: string[];
  /** Parent roles (inheritance) */
  inherits?: string[];
  /** Role priority (higher = more important) */
  priority: number;
  /** Whether role is system-defined */
  isSystem?: boolean;
  /** Role metadata */
  metadata?: Record<string, unknown>;
  /** When role was created */
  createdAt: Date;
  /** When role was last modified */
  modifiedAt?: Date;
}

/**
 * Subject that can be granted permissions
 */
export interface Subject {
  /** Subject identifier */
  id: string;
  /** Subject type */
  type: 'user' | 'agent' | 'plugin' | 'service' | 'system';
  /** Subject name */
  name: string;
  /** Assigned roles */
  roles: string[];
  /** Direct permissions (not from roles) */
  directPermissions?: string[];
  /** Subject attributes for ABAC */
  attributes?: Record<string, unknown>;
  /** When subject was created */
  createdAt: Date;
  /** Whether subject is active */
  isActive: boolean;
}

/**
 * Access request for permission check
 */
export interface AccessRequest {
  /** Requesting subject */
  subject: Subject | string;
  /** Target resource type */
  resource: ResourceType;
  /** Resource identifier or pattern */
  resourceId?: string;
  /** Requested action */
  action: PermissionAction;
  /** Request context */
  context?: AccessContext;
}

/**
 * Access context for conditional checks
 */
export interface AccessContext {
  /** Request timestamp */
  timestamp?: Date;
  /** Request source IP */
  sourceIp?: string;
  /** Session identifier */
  sessionId?: string;
  /** Project context */
  projectId?: string;
  /** Workspace context */
  workspaceId?: string;
  /** Additional context attributes */
  attributes?: Record<string, unknown>;
}

/**
 * Access decision result
 */
export interface AccessDecision {
  /** Whether access is granted */
  granted: boolean;
  /** Reason for decision */
  reason: string;
  /** Matching permissions */
  matchedPermissions?: Permission[];
  /** Matching roles */
  matchedRoles?: Role[];
  /** Failed conditions */
  failedConditions?: PermissionCondition[];
  /** Decision timestamp */
  timestamp: Date;
  /** Time taken to evaluate in ms */
  evaluationTime: number;
}

/**
 * Policy definition for complex access rules
 */
export interface Policy {
  /** Policy identifier */
  id: string;
  /** Policy name */
  name: string;
  /** Policy description */
  description?: string;
  /** Policy effect */
  effect: 'allow' | 'deny';
  /** Subjects this policy applies to */
  subjects: PolicySubject[];
  /** Resources this policy applies to */
  resources: PolicyResource[];
  /** Actions this policy covers */
  actions: PermissionAction[];
  /** Conditions for policy */
  conditions?: PermissionCondition[];
  /** Policy priority */
  priority: number;
  /** Whether policy is enabled */
  enabled: boolean;
  /** When policy was created */
  createdAt: Date;
}

/**
 * Policy subject specification
 */
export interface PolicySubject {
  /** Subject type */
  type: 'user' | 'agent' | 'plugin' | 'service' | 'system' | 'role' | '*';
  /** Subject identifier or pattern */
  identifier: string;
}

/**
 * Policy resource specification
 */
export interface PolicyResource {
  /** Resource type */
  type: ResourceType | '*';
  /** Resource identifier or pattern */
  pattern: string;
}

/**
 * Permission change event
 */
export interface PermissionChangeEvent {
  /** Event type */
  type: 'permission_granted' | 'permission_revoked' | 'role_assigned' | 'role_removed' | 'policy_changed';
  /** Subject affected */
  subjectId: string;
  /** Permission or role involved */
  targetId: string;
  /** Event timestamp */
  timestamp: Date;
  /** Who made the change */
  changedBy?: string;
  /** Change reason */
  reason?: string;
}

/**
 * Permission statistics
 */
export interface PermissionStatistics {
  /** Total permissions */
  totalPermissions: number;
  /** Total roles */
  totalRoles: number;
  /** Total subjects */
  totalSubjects: number;
  /** Total policies */
  totalPolicies: number;
  /** Access checks performed */
  accessChecks: number;
  /** Access grants */
  accessGrants: number;
  /** Access denials */
  accessDenials: number;
  /** Average evaluation time in ms */
  avgEvaluationTime: number;
  /** Last updated */
  lastUpdated: Date;
}

/**
 * Permission Manager interface
 */
export interface IPermissionManager extends IDisposable {
  // ==================== Permission Management ====================

  /**
   * Register a permission
   * @param permission Permission to register
   */
  registerPermission(permission: Permission): void;

  /**
   * Unregister a permission
   * @param permissionId Permission identifier
   */
  unregisterPermission(permissionId: string): void;

  /**
   * Get a permission by ID
   * @param permissionId Permission identifier
   */
  getPermission(permissionId: string): Permission | undefined;

  /**
   * Get all permissions
   * @param filter Optional filter
   */
  getPermissions(filter?: PermissionFilter): Permission[];

  // ==================== Role Management ====================

  /**
   * Create a role
   * @param role Role to create
   */
  createRole(role: Omit<Role, 'createdAt'>): Role;

  /**
   * Update a role
   * @param roleId Role identifier
   * @param updates Role updates
   */
  updateRole(roleId: string, updates: Partial<Role>): Role | undefined;

  /**
   * Delete a role
   * @param roleId Role identifier
   */
  deleteRole(roleId: string): boolean;

  /**
   * Get a role by ID
   * @param roleId Role identifier
   */
  getRole(roleId: string): Role | undefined;

  /**
   * Get all roles
   * @param filter Optional filter
   */
  getRoles(filter?: RoleFilter): Role[];

  /**
   * Add permission to role
   * @param roleId Role identifier
   * @param permissionId Permission identifier
   */
  addPermissionToRole(roleId: string, permissionId: string): boolean;

  /**
   * Remove permission from role
   * @param roleId Role identifier
   * @param permissionId Permission identifier
   */
  removePermissionFromRole(roleId: string, permissionId: string): boolean;

  /**
   * Get effective permissions for a role (including inherited)
   * @param roleId Role identifier
   */
  getEffectiveRolePermissions(roleId: string): Permission[];

  // ==================== Subject Management ====================

  /**
   * Register a subject
   * @param subject Subject to register
   */
  registerSubject(subject: Omit<Subject, 'createdAt'>): Subject;

  /**
   * Update a subject
   * @param subjectId Subject identifier
   * @param updates Subject updates
   */
  updateSubject(subjectId: string, updates: Partial<Subject>): Subject | undefined;

  /**
   * Unregister a subject
   * @param subjectId Subject identifier
   */
  unregisterSubject(subjectId: string): boolean;

  /**
   * Get a subject by ID
   * @param subjectId Subject identifier
   */
  getSubject(subjectId: string): Subject | undefined;

  /**
   * Get all subjects
   * @param filter Optional filter
   */
  getSubjects(filter?: SubjectFilter): Subject[];

  /**
   * Assign role to subject
   * @param subjectId Subject identifier
   * @param roleId Role identifier
   */
  assignRole(subjectId: string, roleId: string): boolean;

  /**
   * Remove role from subject
   * @param subjectId Subject identifier
   * @param roleId Role identifier
   */
  removeRole(subjectId: string, roleId: string): boolean;

  /**
   * Grant direct permission to subject
   * @param subjectId Subject identifier
   * @param permissionId Permission identifier
   */
  grantPermission(subjectId: string, permissionId: string): boolean;

  /**
   * Revoke direct permission from subject
   * @param subjectId Subject identifier
   * @param permissionId Permission identifier
   */
  revokePermission(subjectId: string, permissionId: string): boolean;

  /**
   * Get effective permissions for a subject
   * @param subjectId Subject identifier
   */
  getEffectivePermissions(subjectId: string): Permission[];

  // ==================== Policy Management ====================

  /**
   * Create a policy
   * @param policy Policy to create
   */
  createPolicy(policy: Omit<Policy, 'createdAt'>): Policy;

  /**
   * Update a policy
   * @param policyId Policy identifier
   * @param updates Policy updates
   */
  updatePolicy(policyId: string, updates: Partial<Policy>): Policy | undefined;

  /**
   * Delete a policy
   * @param policyId Policy identifier
   */
  deletePolicy(policyId: string): boolean;

  /**
   * Get a policy by ID
   * @param policyId Policy identifier
   */
  getPolicy(policyId: string): Policy | undefined;

  /**
   * Get all policies
   * @param filter Optional filter
   */
  getPolicies(filter?: PolicyFilter): Policy[];

  /**
   * Enable a policy
   * @param policyId Policy identifier
   */
  enablePolicy(policyId: string): boolean;

  /**
   * Disable a policy
   * @param policyId Policy identifier
   */
  disablePolicy(policyId: string): boolean;

  // ==================== Access Control ====================

  /**
   * Check if access is allowed
   * @param request Access request
   */
  checkAccess(request: AccessRequest): AccessDecision;

  /**
   * Check if subject has permission
   * @param subjectId Subject identifier
   * @param permissionId Permission identifier
   */
  hasPermission(subjectId: string, permissionId: string): boolean;

  /**
   * Check if subject has role
   * @param subjectId Subject identifier
   * @param roleId Role identifier
   */
  hasRole(subjectId: string, roleId: string): boolean;

  /**
   * Check if subject can perform action on resource
   * @param subjectId Subject identifier
   * @param resource Resource type
   * @param action Action to perform
   * @param resourceId Optional resource identifier
   */
  can(subjectId: string, resource: ResourceType, action: PermissionAction, resourceId?: string): boolean;

  // ==================== Events & Statistics ====================

  /**
   * Subscribe to permission changes
   * @param handler Change handler
   */
  onPermissionChange(handler: (event: PermissionChangeEvent) => void): () => void;

  /**
   * Get permission statistics
   */
  getStatistics(): PermissionStatistics;

  // ==================== Import/Export ====================

  /**
   * Export permission data
   * @param options Export options
   */
  exportPermissionData(options?: PermissionExportOptions): PermissionExportData;

  /**
   * Import permission data
   * @param data Data to import
   * @param options Import options
   */
  importPermissionData(data: PermissionExportData, options?: PermissionImportOptions): PermissionImportResult;
}

/**
 * Permission filter
 */
export interface PermissionFilter {
  /** Filter by resource type */
  resource?: ResourceType;
  /** Filter by scope */
  scope?: PermissionScope;
  /** Filter by system-defined */
  isSystem?: boolean;
}

/**
 * Role filter
 */
export interface RoleFilter {
  /** Filter by system-defined */
  isSystem?: boolean;
  /** Filter by name pattern */
  namePattern?: string;
}

/**
 * Subject filter
 */
export interface SubjectFilter {
  /** Filter by type */
  type?: Subject['type'];
  /** Filter by active status */
  isActive?: boolean;
  /** Filter by role */
  hasRole?: string;
}

/**
 * Policy filter
 */
export interface PolicyFilter {
  /** Filter by enabled status */
  enabled?: boolean;
  /** Filter by effect */
  effect?: 'allow' | 'deny';
}

/**
 * Permission export options
 */
export interface PermissionExportOptions {
  /** Include permissions */
  includePermissions?: boolean;
  /** Include roles */
  includeRoles?: boolean;
  /** Include subjects */
  includeSubjects?: boolean;
  /** Include policies */
  includePolicies?: boolean;
}

/**
 * Permission export data
 */
export interface PermissionExportData {
  /** Export version */
  version: string;
  /** Export timestamp */
  exportedAt: Date;
  /** Permissions */
  permissions?: Permission[];
  /** Roles */
  roles?: Role[];
  /** Subjects */
  subjects?: Subject[];
  /** Policies */
  policies?: Policy[];
}

/**
 * Permission import options
 */
export interface PermissionImportOptions {
  /** Merge with existing data */
  merge?: boolean;
  /** Override existing entries */
  override?: boolean;
  /** Import permissions */
  importPermissions?: boolean;
  /** Import roles */
  importRoles?: boolean;
  /** Import subjects */
  importSubjects?: boolean;
  /** Import policies */
  importPolicies?: boolean;
}

/**
 * Permission import result
 */
export interface PermissionImportResult {
  /** Whether import was successful */
  success: boolean;
  /** Permissions imported */
  permissionsImported: number;
  /** Roles imported */
  rolesImported: number;
  /** Subjects imported */
  subjectsImported: number;
  /** Policies imported */
  policiesImported: number;
  /** Errors encountered */
  errors: string[];
  /** Import timestamp */
  timestamp: Date;
}

/**
 * Default system permissions
 */
export const SYSTEM_PERMISSIONS: Permission[] = [
  // Agent permissions
  {
    id: 'agent:create',
    resource: 'agent',
    actions: ['create'],
    scope: 'global',
    description: 'Create new agents',
    isSystem: true,
  },
  {
    id: 'agent:read',
    resource: 'agent',
    actions: ['read'],
    scope: 'global',
    description: 'Read agent information',
    isSystem: true,
  },
  {
    id: 'agent:execute',
    resource: 'agent',
    actions: ['execute'],
    scope: 'global',
    description: 'Execute agents',
    isSystem: true,
  },
  {
    id: 'agent:manage',
    resource: 'agent',
    actions: ['*'],
    scope: 'global',
    description: 'Full agent management',
    isSystem: true,
  },

  // Plugin permissions
  {
    id: 'plugin:install',
    resource: 'plugin',
    actions: ['create'],
    scope: 'global',
    description: 'Install plugins',
    isSystem: true,
  },
  {
    id: 'plugin:read',
    resource: 'plugin',
    actions: ['read'],
    scope: 'global',
    description: 'Read plugin information',
    isSystem: true,
  },
  {
    id: 'plugin:execute',
    resource: 'plugin',
    actions: ['execute'],
    scope: 'global',
    description: 'Execute plugins',
    isSystem: true,
  },
  {
    id: 'plugin:manage',
    resource: 'plugin',
    actions: ['*'],
    scope: 'global',
    description: 'Full plugin management',
    isSystem: true,
  },

  // Tool permissions
  {
    id: 'tool:read',
    resource: 'tool',
    actions: ['read'],
    scope: 'global',
    description: 'Read tool information',
    isSystem: true,
  },
  {
    id: 'tool:execute',
    resource: 'tool',
    actions: ['execute'],
    scope: 'global',
    description: 'Execute tools',
    isSystem: true,
  },
  {
    id: 'tool:manage',
    resource: 'tool',
    actions: ['*'],
    scope: 'global',
    description: 'Full tool management',
    isSystem: true,
  },

  // File permissions
  {
    id: 'file:read',
    resource: 'file',
    actions: ['read'],
    scope: 'project',
    description: 'Read files',
    isSystem: true,
  },
  {
    id: 'file:write',
    resource: 'file',
    actions: ['create', 'update'],
    scope: 'project',
    description: 'Write files',
    isSystem: true,
  },
  {
    id: 'file:delete',
    resource: 'file',
    actions: ['delete'],
    scope: 'project',
    description: 'Delete files',
    isSystem: true,
  },
  {
    id: 'file:manage',
    resource: 'file',
    actions: ['*'],
    scope: 'project',
    description: 'Full file management',
    isSystem: true,
  },

  // Secret permissions
  {
    id: 'secret:read',
    resource: 'secret',
    actions: ['read'],
    scope: 'global',
    description: 'Read secrets',
    isSystem: true,
  },
  {
    id: 'secret:write',
    resource: 'secret',
    actions: ['create', 'update'],
    scope: 'global',
    description: 'Write secrets',
    isSystem: true,
  },
  {
    id: 'secret:manage',
    resource: 'secret',
    actions: ['*'],
    scope: 'global',
    description: 'Full secret management',
    isSystem: true,
  },

  // System permissions
  {
    id: 'system:admin',
    resource: 'system',
    actions: ['*'],
    scope: 'global',
    description: 'Full system administration',
    isSystem: true,
  },
  {
    id: 'system:config',
    resource: 'config',
    actions: ['read', 'update'],
    scope: 'global',
    description: 'System configuration access',
    isSystem: true,
  },
];

/**
 * Default system roles
 */
export const SYSTEM_ROLES: Omit<Role, 'createdAt'>[] = [
  {
    id: 'admin',
    name: 'Administrator',
    description: 'Full system access',
    permissions: ['system:admin'],
    priority: 100,
    isSystem: true,
  },
  {
    id: 'developer',
    name: 'Developer',
    description: 'Development access',
    permissions: [
      'agent:create',
      'agent:read',
      'agent:execute',
      'plugin:read',
      'plugin:execute',
      'tool:read',
      'tool:execute',
      'file:manage',
      'secret:read',
    ],
    priority: 50,
    isSystem: true,
  },
  {
    id: 'operator',
    name: 'Operator',
    description: 'Operational access',
    permissions: ['agent:read', 'agent:execute', 'plugin:read', 'tool:read', 'tool:execute', 'file:read'],
    priority: 30,
    isSystem: true,
  },
  {
    id: 'viewer',
    name: 'Viewer',
    description: 'Read-only access',
    permissions: ['agent:read', 'plugin:read', 'tool:read', 'file:read'],
    priority: 10,
    isSystem: true,
  },
];
