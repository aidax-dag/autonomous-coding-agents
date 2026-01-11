/**
 * Permission Manager Implementation
 *
 * Feature: F5.3 - Permission System
 * RBAC-based permission management with policy support
 *
 * @module core/security/permission
 */

import { createLogger } from '../../services/logger.js';
import type {
  IPermissionManager,
  Permission,
  PermissionFilter,
  Role,
  RoleFilter,
  Subject,
  SubjectFilter,
  Policy,
  PolicyFilter,
  AccessRequest,
  AccessDecision,
  AccessContext,
  PermissionCondition,
  PermissionChangeEvent,
  PermissionStatistics,
  PermissionExportOptions,
  PermissionExportData,
  PermissionImportOptions,
  PermissionImportResult,
  ResourceType,
  PermissionAction,
} from './permission.interface.js';
import { SYSTEM_PERMISSIONS, SYSTEM_ROLES } from './permission.interface.js';

const logger = createLogger('PermissionManager');

/**
 * Permission Manager implementation
 */
export class PermissionManager implements IPermissionManager {
  private permissions: Map<string, Permission> = new Map();
  private roles: Map<string, Role> = new Map();
  private subjects: Map<string, Subject> = new Map();
  private policies: Map<string, Policy> = new Map();
  private changeHandlers: Set<(event: PermissionChangeEvent) => void> = new Set();
  private statistics = {
    accessChecks: 0,
    accessGrants: 0,
    accessDenials: 0,
    totalEvaluationTime: 0,
  };
  private disposed = false;

  constructor() {
    this.initializeSystemDefaults();
    logger.info('PermissionManager initialized');
  }

  /**
   * Initialize system permissions and roles
   */
  private initializeSystemDefaults(): void {
    // Register system permissions
    for (const permission of SYSTEM_PERMISSIONS) {
      this.permissions.set(permission.id, permission);
    }

    // Create system roles
    for (const roleData of SYSTEM_ROLES) {
      const role: Role = {
        ...roleData,
        createdAt: new Date(),
      };
      this.roles.set(role.id, role);
    }

    logger.debug('System defaults initialized', {
      permissions: SYSTEM_PERMISSIONS.length,
      roles: SYSTEM_ROLES.length,
    });
  }

  // ==================== Permission Management ====================

  registerPermission(permission: Permission): void {
    if (this.permissions.has(permission.id)) {
      logger.warn('Permission already exists', { permissionId: permission.id });
      return;
    }
    this.permissions.set(permission.id, permission);
    logger.info('Permission registered', { permissionId: permission.id });
  }

  unregisterPermission(permissionId: string): void {
    const permission = this.permissions.get(permissionId);
    if (!permission) {
      return;
    }
    if (permission.isSystem) {
      logger.warn('Cannot unregister system permission', { permissionId });
      return;
    }
    this.permissions.delete(permissionId);
    logger.info('Permission unregistered', { permissionId });
  }

  getPermission(permissionId: string): Permission | undefined {
    return this.permissions.get(permissionId);
  }

  getPermissions(filter?: PermissionFilter): Permission[] {
    let permissions = Array.from(this.permissions.values());

    if (filter) {
      if (filter.resource) {
        permissions = permissions.filter((p) => p.resource === filter.resource);
      }
      if (filter.scope) {
        permissions = permissions.filter((p) => p.scope === filter.scope);
      }
      if (filter.isSystem !== undefined) {
        permissions = permissions.filter((p) => p.isSystem === filter.isSystem);
      }
    }

    return permissions;
  }

  // ==================== Role Management ====================

  createRole(roleData: Omit<Role, 'createdAt'>): Role {
    if (this.roles.has(roleData.id)) {
      throw new Error(`Role already exists: ${roleData.id}`);
    }

    const role: Role = {
      ...roleData,
      createdAt: new Date(),
    };

    this.roles.set(role.id, role);
    logger.info('Role created', { roleId: role.id, name: role.name });
    return role;
  }

  updateRole(roleId: string, updates: Partial<Role>): Role | undefined {
    const role = this.roles.get(roleId);
    if (!role) {
      return undefined;
    }

    if (role.isSystem && updates.isSystem === false) {
      logger.warn('Cannot modify system status of system role', { roleId });
      delete updates.isSystem;
    }

    const updatedRole: Role = {
      ...role,
      ...updates,
      id: role.id, // Prevent ID change
      createdAt: role.createdAt, // Preserve creation date
      modifiedAt: new Date(),
    };

    this.roles.set(roleId, updatedRole);
    logger.info('Role updated', { roleId });
    return updatedRole;
  }

  deleteRole(roleId: string): boolean {
    const role = this.roles.get(roleId);
    if (!role) {
      return false;
    }

    if (role.isSystem) {
      logger.warn('Cannot delete system role', { roleId });
      return false;
    }

    // Remove role from all subjects
    for (const subject of this.subjects.values()) {
      const index = subject.roles.indexOf(roleId);
      if (index !== -1) {
        subject.roles.splice(index, 1);
      }
    }

    this.roles.delete(roleId);
    logger.info('Role deleted', { roleId });
    return true;
  }

  getRole(roleId: string): Role | undefined {
    return this.roles.get(roleId);
  }

  getRoles(filter?: RoleFilter): Role[] {
    let roles = Array.from(this.roles.values());

    if (filter) {
      if (filter.isSystem !== undefined) {
        roles = roles.filter((r) => r.isSystem === filter.isSystem);
      }
      if (filter.namePattern) {
        const pattern = new RegExp(filter.namePattern, 'i');
        roles = roles.filter((r) => pattern.test(r.name));
      }
    }

    return roles.sort((a, b) => b.priority - a.priority);
  }

  addPermissionToRole(roleId: string, permissionId: string): boolean {
    const role = this.roles.get(roleId);
    if (!role) {
      return false;
    }

    if (!this.permissions.has(permissionId)) {
      logger.warn('Permission does not exist', { permissionId });
      return false;
    }

    if (role.permissions.includes(permissionId)) {
      return true; // Already has permission
    }

    role.permissions.push(permissionId);
    role.modifiedAt = new Date();
    logger.info('Permission added to role', { roleId, permissionId });
    return true;
  }

  removePermissionFromRole(roleId: string, permissionId: string): boolean {
    const role = this.roles.get(roleId);
    if (!role) {
      return false;
    }

    const index = role.permissions.indexOf(permissionId);
    if (index === -1) {
      return false;
    }

    role.permissions.splice(index, 1);
    role.modifiedAt = new Date();
    logger.info('Permission removed from role', { roleId, permissionId });
    return true;
  }

  getEffectiveRolePermissions(roleId: string): Permission[] {
    const role = this.roles.get(roleId);
    if (!role) {
      return [];
    }

    const permissionIds = new Set<string>();

    // Add direct permissions
    for (const permId of role.permissions) {
      permissionIds.add(permId);
    }

    // Add inherited permissions
    if (role.inherits) {
      for (const parentRoleId of role.inherits) {
        const parentPermissions = this.getEffectiveRolePermissions(parentRoleId);
        for (const perm of parentPermissions) {
          permissionIds.add(perm.id);
        }
      }
    }

    return Array.from(permissionIds)
      .map((id) => this.permissions.get(id))
      .filter((p): p is Permission => p !== undefined);
  }

  // ==================== Subject Management ====================

  registerSubject(subjectData: Omit<Subject, 'createdAt'>): Subject {
    if (this.subjects.has(subjectData.id)) {
      throw new Error(`Subject already exists: ${subjectData.id}`);
    }

    const subject: Subject = {
      ...subjectData,
      createdAt: new Date(),
    };

    this.subjects.set(subject.id, subject);
    logger.info('Subject registered', { subjectId: subject.id, type: subject.type });
    return subject;
  }

  updateSubject(subjectId: string, updates: Partial<Subject>): Subject | undefined {
    const subject = this.subjects.get(subjectId);
    if (!subject) {
      return undefined;
    }

    const updatedSubject: Subject = {
      ...subject,
      ...updates,
      id: subject.id, // Prevent ID change
      createdAt: subject.createdAt, // Preserve creation date
    };

    this.subjects.set(subjectId, updatedSubject);
    logger.info('Subject updated', { subjectId });
    return updatedSubject;
  }

  unregisterSubject(subjectId: string): boolean {
    if (!this.subjects.has(subjectId)) {
      return false;
    }

    this.subjects.delete(subjectId);
    logger.info('Subject unregistered', { subjectId });
    return true;
  }

  getSubject(subjectId: string): Subject | undefined {
    return this.subjects.get(subjectId);
  }

  getSubjects(filter?: SubjectFilter): Subject[] {
    let subjects = Array.from(this.subjects.values());

    if (filter) {
      if (filter.type) {
        subjects = subjects.filter((s) => s.type === filter.type);
      }
      if (filter.isActive !== undefined) {
        subjects = subjects.filter((s) => s.isActive === filter.isActive);
      }
      if (filter.hasRole) {
        subjects = subjects.filter((s) => s.roles.includes(filter.hasRole!));
      }
    }

    return subjects;
  }

  assignRole(subjectId: string, roleId: string): boolean {
    const subject = this.subjects.get(subjectId);
    if (!subject) {
      return false;
    }

    if (!this.roles.has(roleId)) {
      logger.warn('Role does not exist', { roleId });
      return false;
    }

    if (subject.roles.includes(roleId)) {
      return true; // Already has role
    }

    subject.roles.push(roleId);
    this.emitChange({
      type: 'role_assigned',
      subjectId,
      targetId: roleId,
      timestamp: new Date(),
    });
    logger.info('Role assigned to subject', { subjectId, roleId });
    return true;
  }

  removeRole(subjectId: string, roleId: string): boolean {
    const subject = this.subjects.get(subjectId);
    if (!subject) {
      return false;
    }

    const index = subject.roles.indexOf(roleId);
    if (index === -1) {
      return false;
    }

    subject.roles.splice(index, 1);
    this.emitChange({
      type: 'role_removed',
      subjectId,
      targetId: roleId,
      timestamp: new Date(),
    });
    logger.info('Role removed from subject', { subjectId, roleId });
    return true;
  }

  grantPermission(subjectId: string, permissionId: string): boolean {
    const subject = this.subjects.get(subjectId);
    if (!subject) {
      return false;
    }

    if (!this.permissions.has(permissionId)) {
      logger.warn('Permission does not exist', { permissionId });
      return false;
    }

    if (!subject.directPermissions) {
      subject.directPermissions = [];
    }

    if (subject.directPermissions.includes(permissionId)) {
      return true; // Already has permission
    }

    subject.directPermissions.push(permissionId);
    this.emitChange({
      type: 'permission_granted',
      subjectId,
      targetId: permissionId,
      timestamp: new Date(),
    });
    logger.info('Permission granted to subject', { subjectId, permissionId });
    return true;
  }

  revokePermission(subjectId: string, permissionId: string): boolean {
    const subject = this.subjects.get(subjectId);
    if (!subject || !subject.directPermissions) {
      return false;
    }

    const index = subject.directPermissions.indexOf(permissionId);
    if (index === -1) {
      return false;
    }

    subject.directPermissions.splice(index, 1);
    this.emitChange({
      type: 'permission_revoked',
      subjectId,
      targetId: permissionId,
      timestamp: new Date(),
    });
    logger.info('Permission revoked from subject', { subjectId, permissionId });
    return true;
  }

  getEffectivePermissions(subjectId: string): Permission[] {
    const subject = this.subjects.get(subjectId);
    if (!subject) {
      return [];
    }

    const permissionIds = new Set<string>();

    // Add direct permissions
    if (subject.directPermissions) {
      for (const permId of subject.directPermissions) {
        permissionIds.add(permId);
      }
    }

    // Add permissions from roles
    for (const roleId of subject.roles) {
      const rolePermissions = this.getEffectiveRolePermissions(roleId);
      for (const perm of rolePermissions) {
        permissionIds.add(perm.id);
      }
    }

    return Array.from(permissionIds)
      .map((id) => this.permissions.get(id))
      .filter((p): p is Permission => p !== undefined);
  }

  // ==================== Policy Management ====================

  createPolicy(policyData: Omit<Policy, 'createdAt'>): Policy {
    if (this.policies.has(policyData.id)) {
      throw new Error(`Policy already exists: ${policyData.id}`);
    }

    const policy: Policy = {
      ...policyData,
      createdAt: new Date(),
    };

    this.policies.set(policy.id, policy);
    logger.info('Policy created', { policyId: policy.id, name: policy.name });
    return policy;
  }

  updatePolicy(policyId: string, updates: Partial<Policy>): Policy | undefined {
    const policy = this.policies.get(policyId);
    if (!policy) {
      return undefined;
    }

    const updatedPolicy: Policy = {
      ...policy,
      ...updates,
      id: policy.id, // Prevent ID change
      createdAt: policy.createdAt, // Preserve creation date
    };

    this.policies.set(policyId, updatedPolicy);
    this.emitChange({
      type: 'policy_changed',
      subjectId: '*',
      targetId: policyId,
      timestamp: new Date(),
    });
    logger.info('Policy updated', { policyId });
    return updatedPolicy;
  }

  deletePolicy(policyId: string): boolean {
    if (!this.policies.has(policyId)) {
      return false;
    }

    this.policies.delete(policyId);
    logger.info('Policy deleted', { policyId });
    return true;
  }

  getPolicy(policyId: string): Policy | undefined {
    return this.policies.get(policyId);
  }

  getPolicies(filter?: PolicyFilter): Policy[] {
    let policies = Array.from(this.policies.values());

    if (filter) {
      if (filter.enabled !== undefined) {
        policies = policies.filter((p) => p.enabled === filter.enabled);
      }
      if (filter.effect) {
        policies = policies.filter((p) => p.effect === filter.effect);
      }
    }

    return policies.sort((a, b) => b.priority - a.priority);
  }

  enablePolicy(policyId: string): boolean {
    const policy = this.policies.get(policyId);
    if (!policy) {
      return false;
    }

    policy.enabled = true;
    logger.info('Policy enabled', { policyId });
    return true;
  }

  disablePolicy(policyId: string): boolean {
    const policy = this.policies.get(policyId);
    if (!policy) {
      return false;
    }

    policy.enabled = false;
    logger.info('Policy disabled', { policyId });
    return true;
  }

  // ==================== Access Control ====================

  checkAccess(request: AccessRequest): AccessDecision {
    const startTime = Date.now();
    this.statistics.accessChecks++;

    // Get subject
    const subject = typeof request.subject === 'string' ? this.subjects.get(request.subject) : request.subject;

    if (!subject) {
      const decision: AccessDecision = {
        granted: false,
        reason: 'Subject not found',
        timestamp: new Date(),
        evaluationTime: Date.now() - startTime,
      };
      this.statistics.accessDenials++;
      this.statistics.totalEvaluationTime += decision.evaluationTime;
      return decision;
    }

    if (!subject.isActive) {
      const decision: AccessDecision = {
        granted: false,
        reason: 'Subject is not active',
        timestamp: new Date(),
        evaluationTime: Date.now() - startTime,
      };
      this.statistics.accessDenials++;
      this.statistics.totalEvaluationTime += decision.evaluationTime;
      return decision;
    }

    // Check policies first (explicit deny takes precedence)
    const policyDecision = this.evaluatePolicies(subject, request);
    if (policyDecision !== null) {
      this.statistics.totalEvaluationTime += policyDecision.evaluationTime;
      if (policyDecision.granted) {
        this.statistics.accessGrants++;
      } else {
        this.statistics.accessDenials++;
      }
      return policyDecision;
    }

    // Check effective permissions
    const effectivePermissions = this.getEffectivePermissions(subject.id);
    const matchedPermissions: Permission[] = [];
    const matchedRoles: Role[] = [];

    for (const permission of effectivePermissions) {
      if (this.permissionMatches(permission, request)) {
        // Check conditions
        const failedConditions = this.evaluateConditions(permission.conditions || [], request.context);
        if (failedConditions.length === 0) {
          matchedPermissions.push(permission);
        }
      }
    }

    // Collect matched roles
    for (const roleId of subject.roles) {
      const role = this.roles.get(roleId);
      if (role) {
        matchedRoles.push(role);
      }
    }

    const granted = matchedPermissions.length > 0;
    const evaluationTime = Date.now() - startTime;
    this.statistics.totalEvaluationTime += evaluationTime;

    if (granted) {
      this.statistics.accessGrants++;
    } else {
      this.statistics.accessDenials++;
    }

    return {
      granted,
      reason: granted ? 'Access granted by permission' : 'No matching permission found',
      matchedPermissions: granted ? matchedPermissions : undefined,
      matchedRoles: granted ? matchedRoles : undefined,
      timestamp: new Date(),
      evaluationTime,
    };
  }

  /**
   * Evaluate policies for access request
   */
  private evaluatePolicies(subject: Subject, request: AccessRequest): AccessDecision | null {
    const startTime = Date.now();
    const enabledPolicies = this.getPolicies({ enabled: true });

    // Sort by priority (higher first)
    const sortedPolicies = enabledPolicies.sort((a, b) => b.priority - a.priority);

    for (const policy of sortedPolicies) {
      // Check if policy applies to subject
      const subjectMatches = policy.subjects.some((ps) => {
        if (ps.type === '*') return true;
        if (ps.type === 'role') return subject.roles.includes(ps.identifier);
        return ps.type === subject.type && (ps.identifier === '*' || ps.identifier === subject.id);
      });

      if (!subjectMatches) continue;

      // Check if policy applies to resource
      const resourceMatches = policy.resources.some((pr) => {
        if (pr.type === '*' || pr.type === request.resource) {
          if (pr.pattern === '*') return true;
          if (request.resourceId) {
            return this.patternMatches(pr.pattern, request.resourceId);
          }
          return true;
        }
        return false;
      });

      if (!resourceMatches) continue;

      // Check if action matches
      const actionMatches = policy.actions.includes('*') || policy.actions.includes(request.action);
      if (!actionMatches) continue;

      // Check conditions
      const failedConditions = this.evaluateConditions(policy.conditions || [], request.context);

      if (failedConditions.length === 0) {
        // Policy matches
        return {
          granted: policy.effect === 'allow',
          reason: `Policy ${policy.id}: ${policy.effect}`,
          timestamp: new Date(),
          evaluationTime: Date.now() - startTime,
        };
      }
    }

    return null; // No policy matched
  }

  /**
   * Check if permission matches request
   */
  private permissionMatches(permission: Permission, request: AccessRequest): boolean {
    // Check resource type
    if (permission.resource !== request.resource) {
      return false;
    }

    // Check action
    if (!permission.actions.includes('*') && !permission.actions.includes(request.action)) {
      return false;
    }

    // Check resource pattern
    if (permission.resourcePattern && request.resourceId) {
      if (!this.patternMatches(permission.resourcePattern, request.resourceId)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Check if pattern matches value (glob-style)
   */
  private patternMatches(pattern: string, value: string): boolean {
    if (pattern === '*') return true;

    // Convert glob to regex
    const regexPattern = pattern.replace(/\*/g, '.*').replace(/\?/g, '.');

    try {
      const regex = new RegExp(`^${regexPattern}$`);
      return regex.test(value);
    } catch {
      return pattern === value;
    }
  }

  /**
   * Evaluate conditions
   */
  private evaluateConditions(
    conditions: PermissionCondition[],
    context?: AccessContext
  ): PermissionCondition[] {
    const failedConditions: PermissionCondition[] = [];

    for (const condition of conditions) {
      if (!this.evaluateCondition(condition, context)) {
        failedConditions.push(condition);
      }
    }

    return failedConditions;
  }

  /**
   * Evaluate single condition
   */
  private evaluateCondition(condition: PermissionCondition, context?: AccessContext): boolean {
    if (!context) return false;

    let fieldValue: unknown;

    // Get field value from context
    switch (condition.field) {
      case 'timestamp':
        fieldValue = context.timestamp;
        break;
      case 'sourceIp':
        fieldValue = context.sourceIp;
        break;
      case 'sessionId':
        fieldValue = context.sessionId;
        break;
      case 'projectId':
        fieldValue = context.projectId;
        break;
      case 'workspaceId':
        fieldValue = context.workspaceId;
        break;
      default:
        fieldValue = context.attributes?.[condition.field];
    }

    // Evaluate operator
    switch (condition.operator) {
      case 'eq':
        return fieldValue === condition.value;
      case 'ne':
        return fieldValue !== condition.value;
      case 'gt':
        return (fieldValue as number) > (condition.value as number);
      case 'lt':
        return (fieldValue as number) < (condition.value as number);
      case 'in':
        return Array.isArray(condition.value) && condition.value.includes(fieldValue);
      case 'contains':
        return typeof fieldValue === 'string' && fieldValue.includes(condition.value as string);
      case 'matches':
        try {
          const regex = new RegExp(condition.value as string);
          return typeof fieldValue === 'string' && regex.test(fieldValue);
        } catch {
          return false;
        }
      default:
        return false;
    }
  }

  hasPermission(subjectId: string, permissionId: string): boolean {
    const permissions = this.getEffectivePermissions(subjectId);
    return permissions.some((p) => p.id === permissionId);
  }

  hasRole(subjectId: string, roleId: string): boolean {
    const subject = this.subjects.get(subjectId);
    if (!subject) return false;

    // Direct role check
    if (subject.roles.includes(roleId)) return true;

    // Check inherited roles
    for (const assignedRoleId of subject.roles) {
      if (this.roleInheritsFrom(assignedRoleId, roleId)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if role inherits from another role
   */
  private roleInheritsFrom(roleId: string, targetRoleId: string, visited: Set<string> = new Set()): boolean {
    if (visited.has(roleId)) return false; // Prevent circular inheritance
    visited.add(roleId);

    const role = this.roles.get(roleId);
    if (!role || !role.inherits) return false;

    if (role.inherits.includes(targetRoleId)) return true;

    for (const parentRoleId of role.inherits) {
      if (this.roleInheritsFrom(parentRoleId, targetRoleId, visited)) {
        return true;
      }
    }

    return false;
  }

  can(subjectId: string, resource: ResourceType, action: PermissionAction, resourceId?: string): boolean {
    const decision = this.checkAccess({
      subject: subjectId,
      resource,
      action,
      resourceId,
    });
    return decision.granted;
  }

  // ==================== Events & Statistics ====================

  onPermissionChange(handler: (event: PermissionChangeEvent) => void): () => void {
    this.changeHandlers.add(handler);
    return () => {
      this.changeHandlers.delete(handler);
    };
  }

  private emitChange(event: PermissionChangeEvent): void {
    for (const handler of this.changeHandlers) {
      try {
        handler(event);
      } catch (error) {
        logger.error('Error in permission change handler', { error });
      }
    }
  }

  getStatistics(): PermissionStatistics {
    const avgEvaluationTime =
      this.statistics.accessChecks > 0
        ? this.statistics.totalEvaluationTime / this.statistics.accessChecks
        : 0;

    return {
      totalPermissions: this.permissions.size,
      totalRoles: this.roles.size,
      totalSubjects: this.subjects.size,
      totalPolicies: this.policies.size,
      accessChecks: this.statistics.accessChecks,
      accessGrants: this.statistics.accessGrants,
      accessDenials: this.statistics.accessDenials,
      avgEvaluationTime,
      lastUpdated: new Date(),
    };
  }

  // ==================== Import/Export ====================

  exportPermissionData(options: PermissionExportOptions = {}): PermissionExportData {
    const {
      includePermissions = true,
      includeRoles = true,
      includeSubjects = true,
      includePolicies = true,
    } = options;

    const data: PermissionExportData = {
      version: '1.0.0',
      exportedAt: new Date(),
    };

    if (includePermissions) {
      data.permissions = this.getPermissions({ isSystem: false });
    }

    if (includeRoles) {
      data.roles = this.getRoles({ isSystem: false });
    }

    if (includeSubjects) {
      data.subjects = this.getSubjects();
    }

    if (includePolicies) {
      data.policies = this.getPolicies();
    }

    logger.info('Permission data exported', {
      permissions: data.permissions?.length ?? 0,
      roles: data.roles?.length ?? 0,
      subjects: data.subjects?.length ?? 0,
      policies: data.policies?.length ?? 0,
    });

    return data;
  }

  importPermissionData(
    data: PermissionExportData,
    options: PermissionImportOptions = {}
  ): PermissionImportResult {
    const {
      merge = true,
      override = false,
      importPermissions = true,
      importRoles = true,
      importSubjects = true,
      importPolicies = true,
    } = options;

    const result: PermissionImportResult = {
      success: true,
      permissionsImported: 0,
      rolesImported: 0,
      subjectsImported: 0,
      policiesImported: 0,
      errors: [],
      timestamp: new Date(),
    };

    try {
      // Import permissions
      if (importPermissions && data.permissions) {
        for (const permission of data.permissions) {
          if (permission.isSystem) continue; // Skip system permissions

          if (this.permissions.has(permission.id)) {
            if (override) {
              this.permissions.set(permission.id, permission);
              result.permissionsImported++;
            } else if (!merge) {
              result.errors.push(`Permission exists: ${permission.id}`);
            }
          } else {
            this.permissions.set(permission.id, permission);
            result.permissionsImported++;
          }
        }
      }

      // Import roles
      if (importRoles && data.roles) {
        for (const role of data.roles) {
          if (role.isSystem) continue; // Skip system roles

          if (this.roles.has(role.id)) {
            if (override) {
              this.roles.set(role.id, role);
              result.rolesImported++;
            } else if (!merge) {
              result.errors.push(`Role exists: ${role.id}`);
            }
          } else {
            this.roles.set(role.id, role);
            result.rolesImported++;
          }
        }
      }

      // Import subjects
      if (importSubjects && data.subjects) {
        for (const subject of data.subjects) {
          if (this.subjects.has(subject.id)) {
            if (override) {
              this.subjects.set(subject.id, subject);
              result.subjectsImported++;
            } else if (!merge) {
              result.errors.push(`Subject exists: ${subject.id}`);
            }
          } else {
            this.subjects.set(subject.id, subject);
            result.subjectsImported++;
          }
        }
      }

      // Import policies
      if (importPolicies && data.policies) {
        for (const policy of data.policies) {
          if (this.policies.has(policy.id)) {
            if (override) {
              this.policies.set(policy.id, policy);
              result.policiesImported++;
            } else if (!merge) {
              result.errors.push(`Policy exists: ${policy.id}`);
            }
          } else {
            this.policies.set(policy.id, policy);
            result.policiesImported++;
          }
        }
      }

      logger.info('Permission data imported', {
        permissions: result.permissionsImported,
        roles: result.rolesImported,
        subjects: result.subjectsImported,
        policies: result.policiesImported,
        errors: result.errors.length,
      });
    } catch (error) {
      result.success = false;
      result.errors.push(`Import error: ${error instanceof Error ? error.message : String(error)}`);
      logger.error('Permission import failed', { error });
    }

    return result;
  }

  // ==================== Lifecycle ====================

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    this.permissions.clear();
    this.roles.clear();
    this.subjects.clear();
    this.policies.clear();
    this.changeHandlers.clear();

    logger.info('PermissionManager disposed');
  }
}
