/**
 * Security Module
 *
 * Provides security features for the Agent OS kernel including:
 * - Permission management and access control
 * - Sandboxing for task isolation
 * - Audit logging for security events
 * - Capability-based security model
 *
 * Feature: Agent OS Kernel
 */

import { EventEmitter } from 'events';
import { z } from 'zod';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Permission types
 */
export enum Permission {
  // File system permissions
  FILE_READ = 'file:read',
  FILE_WRITE = 'file:write',
  FILE_DELETE = 'file:delete',
  FILE_EXECUTE = 'file:execute',

  // Network permissions
  NETWORK_OUTBOUND = 'network:outbound',
  NETWORK_INBOUND = 'network:inbound',

  // Tool permissions
  TOOL_EXECUTE = 'tool:execute',
  TOOL_INSTALL = 'tool:install',

  // LLM permissions
  LLM_QUERY = 'llm:query',
  LLM_FINE_TUNE = 'llm:fine_tune',

  // System permissions
  SYSTEM_CONFIG = 'system:config',
  SYSTEM_ADMIN = 'system:admin',

  // Process permissions
  PROCESS_SPAWN = 'process:spawn',
  PROCESS_KILL = 'process:kill',

  // Memory permissions
  MEMORY_ALLOCATE = 'memory:allocate',
  MEMORY_SHARED = 'memory:shared',
}

/**
 * Security level
 */
export enum SecurityLevel {
  UNRESTRICTED = 'unrestricted',
  TRUSTED = 'trusted',
  STANDARD = 'standard',
  RESTRICTED = 'restricted',
  SANDBOXED = 'sandboxed',
}

/**
 * Audit event type
 */
export enum AuditEventType {
  ACCESS_GRANTED = 'access_granted',
  ACCESS_DENIED = 'access_denied',
  PERMISSION_CHANGED = 'permission_changed',
  SANDBOX_CREATED = 'sandbox_created',
  SANDBOX_DESTROYED = 'sandbox_destroyed',
  SECURITY_VIOLATION = 'security_violation',
  CAPABILITY_GRANTED = 'capability_granted',
  CAPABILITY_REVOKED = 'capability_revoked',
  POLICY_UPDATED = 'policy_updated',
  AUTHENTICATION = 'authentication',
}

/**
 * Capability definition
 */
export interface Capability {
  id: string;
  name: string;
  permissions: Permission[];
  scope?: string[];
  expiresAt?: Date;
  constraints?: CapabilityConstraints;
}

/**
 * Capability constraints
 */
export interface CapabilityConstraints {
  maxUses?: number;
  currentUses?: number;
  allowedPaths?: string[];
  deniedPaths?: string[];
  timeWindowStart?: Date;
  timeWindowEnd?: Date;
  rateLimit?: number;
  rateLimitWindowMs?: number;
}

/**
 * Security principal (task, agent, or user)
 */
export interface SecurityPrincipal {
  id: string;
  type: 'task' | 'agent' | 'user' | 'system';
  capabilities: Map<string, Capability>;
  securityLevel: SecurityLevel;
  sandboxId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Sandbox configuration
 */
export interface SandboxConfig {
  id: string;
  name: string;
  allowedPaths: string[];
  deniedPaths: string[];
  allowedTools: string[];
  deniedTools: string[];
  networkAccess: boolean;
  maxMemory: number;
  maxCpuTime: number;
  maxFileSize: number;
  environmentVariables: Record<string, string>;
}

/**
 * Security policy
 */
export interface SecurityPolicy {
  id: string;
  name: string;
  rules: SecurityRule[];
  priority: number;
  enabled: boolean;
}

/**
 * Security rule
 */
export interface SecurityRule {
  id: string;
  action: 'allow' | 'deny' | 'audit';
  permissions: Permission[];
  conditions?: SecurityCondition[];
  priority: number;
}

/**
 * Security condition
 */
export interface SecurityCondition {
  type: 'principal_type' | 'security_level' | 'time_window' | 'path_match' | 'rate_limit';
  operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'greater' | 'less';
  value: string | number | string[];
}

/**
 * Audit log entry
 */
export interface AuditLogEntry {
  id: string;
  timestamp: Date;
  eventType: AuditEventType;
  principalId: string;
  principalType: string;
  permission?: Permission;
  resource?: string;
  action: string;
  result: 'success' | 'failure' | 'denied';
  details?: Record<string, unknown>;
  sandboxId?: string;
}

/**
 * Access request
 */
export interface AccessRequest {
  principalId: string;
  permission: Permission;
  resource?: string;
  context?: Record<string, unknown>;
}

/**
 * Access decision
 */
export interface AccessDecision {
  allowed: boolean;
  reason: string;
  matchedRule?: SecurityRule;
  auditLogId: string;
}

/**
 * Security module configuration
 */
export interface SecurityModuleConfig {
  defaultSecurityLevel: SecurityLevel;
  enableAuditLogging: boolean;
  auditLogRetentionDays: number;
  maxAuditLogEntries: number;
  enableSandboxing: boolean;
  enableRateLimiting: boolean;
  defaultRateLimit: number;
  defaultRateLimitWindowMs: number;
}

/**
 * Security module events
 */
export interface SecurityModuleEvents {
  'access:granted': { principalId: string; permission: Permission; resource?: string };
  'access:denied': { principalId: string; permission: Permission; resource?: string; reason: string };
  'capability:granted': { principalId: string; capability: Capability };
  'capability:revoked': { principalId: string; capabilityId: string };
  'sandbox:created': SandboxConfig;
  'sandbox:destroyed': { sandboxId: string };
  'security:violation': { principalId: string; violation: string; severity: 'low' | 'medium' | 'high' | 'critical' };
  'policy:updated': SecurityPolicy;
  'audit:logged': AuditLogEntry;
}

// ============================================================================
// Configuration Schema
// ============================================================================

export const SecurityModuleConfigSchema = z.object({
  defaultSecurityLevel: z.nativeEnum(SecurityLevel).default(SecurityLevel.STANDARD),
  enableAuditLogging: z.boolean().default(true),
  auditLogRetentionDays: z.number().min(1).default(30),
  maxAuditLogEntries: z.number().min(100).default(10000),
  enableSandboxing: z.boolean().default(true),
  enableRateLimiting: z.boolean().default(true),
  defaultRateLimit: z.number().min(1).default(100),
  defaultRateLimitWindowMs: z.number().min(1000).default(60000),
});

// ============================================================================
// Default Configuration
// ============================================================================

export const DEFAULT_SECURITY_MODULE_CONFIG: SecurityModuleConfig = {
  defaultSecurityLevel: SecurityLevel.STANDARD,
  enableAuditLogging: true,
  auditLogRetentionDays: 30,
  maxAuditLogEntries: 10000,
  enableSandboxing: true,
  enableRateLimiting: true,
  defaultRateLimit: 100,
  defaultRateLimitWindowMs: 60000,
};

// ============================================================================
// Default Capabilities by Security Level
// ============================================================================

export const DEFAULT_CAPABILITIES: Record<SecurityLevel, Permission[]> = {
  [SecurityLevel.UNRESTRICTED]: Object.values(Permission),
  [SecurityLevel.TRUSTED]: [
    Permission.FILE_READ,
    Permission.FILE_WRITE,
    Permission.FILE_EXECUTE,
    Permission.NETWORK_OUTBOUND,
    Permission.TOOL_EXECUTE,
    Permission.LLM_QUERY,
    Permission.PROCESS_SPAWN,
    Permission.MEMORY_ALLOCATE,
  ],
  [SecurityLevel.STANDARD]: [
    Permission.FILE_READ,
    Permission.FILE_WRITE,
    Permission.TOOL_EXECUTE,
    Permission.LLM_QUERY,
    Permission.MEMORY_ALLOCATE,
  ],
  [SecurityLevel.RESTRICTED]: [
    Permission.FILE_READ,
    Permission.LLM_QUERY,
  ],
  [SecurityLevel.SANDBOXED]: [
    Permission.LLM_QUERY,
  ],
};

// ============================================================================
// Security Module Implementation
// ============================================================================

/**
 * Security Module
 *
 * Manages security, permissions, and sandboxing for the Agent OS.
 */
export class SecurityModule extends EventEmitter {
  private config: SecurityModuleConfig;
  private principals: Map<string, SecurityPrincipal>;
  private sandboxes: Map<string, SandboxConfig>;
  private policies: Map<string, SecurityPolicy>;
  private auditLog: AuditLogEntry[];
  private rateLimitCounters: Map<string, { count: number; windowStart: Date }>;

  constructor(config: Partial<SecurityModuleConfig> = {}) {
    super();
    this.config = { ...DEFAULT_SECURITY_MODULE_CONFIG, ...config };
    this.principals = new Map();
    this.sandboxes = new Map();
    this.policies = new Map();
    this.auditLog = [];
    this.rateLimitCounters = new Map();

    this.initializeDefaultPolicies();
  }

  // ==========================================================================
  // Initialization
  // ==========================================================================

  /**
   * Initialize default security policies
   */
  private initializeDefaultPolicies(): void {
    // Default deny policy for system admin
    this.addPolicy({
      id: 'default-deny-admin',
      name: 'Default Deny Admin',
      rules: [
        {
          id: 'deny-system-admin',
          action: 'deny',
          permissions: [Permission.SYSTEM_ADMIN, Permission.SYSTEM_CONFIG],
          conditions: [
            { type: 'security_level', operator: 'not_equals', value: SecurityLevel.UNRESTRICTED },
          ],
          priority: 1000,
        },
      ],
      priority: 1000,
      enabled: true,
    });

    // Default audit policy
    this.addPolicy({
      id: 'default-audit',
      name: 'Default Audit',
      rules: [
        {
          id: 'audit-all-writes',
          action: 'audit',
          permissions: [Permission.FILE_WRITE, Permission.FILE_DELETE],
          priority: 500,
        },
        {
          id: 'audit-network',
          action: 'audit',
          permissions: [Permission.NETWORK_OUTBOUND, Permission.NETWORK_INBOUND],
          priority: 500,
        },
      ],
      priority: 500,
      enabled: true,
    });
  }

  // ==========================================================================
  // Principal Management
  // ==========================================================================

  /**
   * Register a security principal
   */
  registerPrincipal(
    id: string,
    type: SecurityPrincipal['type'],
    securityLevel: SecurityLevel = this.config.defaultSecurityLevel
  ): SecurityPrincipal {
    const principal: SecurityPrincipal = {
      id,
      type,
      capabilities: new Map(),
      securityLevel,
    };

    // Grant default capabilities based on security level
    const defaultPerms = DEFAULT_CAPABILITIES[securityLevel];
    const defaultCapability: Capability = {
      id: `default-${securityLevel}`,
      name: `Default ${securityLevel} capabilities`,
      permissions: defaultPerms,
    };
    principal.capabilities.set(defaultCapability.id, defaultCapability);

    this.principals.set(id, principal);
    return principal;
  }

  /**
   * Get a security principal
   */
  getPrincipal(id: string): SecurityPrincipal | undefined {
    return this.principals.get(id);
  }

  /**
   * Update principal security level
   */
  updateSecurityLevel(principalId: string, level: SecurityLevel): boolean {
    const principal = this.principals.get(principalId);
    if (!principal) {
      return false;
    }

    principal.securityLevel = level;

    // Update default capability
    const defaultPerms = DEFAULT_CAPABILITIES[level];
    const defaultCapability: Capability = {
      id: `default-${level}`,
      name: `Default ${level} capabilities`,
      permissions: defaultPerms,
    };
    principal.capabilities.set(defaultCapability.id, defaultCapability);

    this.logAudit({
      eventType: AuditEventType.PERMISSION_CHANGED,
      principalId,
      principalType: principal.type,
      action: `Security level changed to ${level}`,
      result: 'success',
    });

    return true;
  }

  /**
   * Remove a principal
   */
  removePrincipal(id: string): boolean {
    return this.principals.delete(id);
  }

  // ==========================================================================
  // Capability Management
  // ==========================================================================

  /**
   * Grant a capability to a principal
   */
  grantCapability(principalId: string, capability: Capability): boolean {
    const principal = this.principals.get(principalId);
    if (!principal) {
      return false;
    }

    principal.capabilities.set(capability.id, capability);

    this.logAudit({
      eventType: AuditEventType.CAPABILITY_GRANTED,
      principalId,
      principalType: principal.type,
      action: `Capability granted: ${capability.name}`,
      result: 'success',
      details: { capabilityId: capability.id, permissions: capability.permissions },
    });

    this.emit('capability:granted', { principalId, capability });
    return true;
  }

  /**
   * Revoke a capability from a principal
   */
  revokeCapability(principalId: string, capabilityId: string): boolean {
    const principal = this.principals.get(principalId);
    if (!principal) {
      return false;
    }

    const capability = principal.capabilities.get(capabilityId);
    if (!capability) {
      return false;
    }

    principal.capabilities.delete(capabilityId);

    this.logAudit({
      eventType: AuditEventType.CAPABILITY_REVOKED,
      principalId,
      principalType: principal.type,
      action: `Capability revoked: ${capability.name}`,
      result: 'success',
      details: { capabilityId },
    });

    this.emit('capability:revoked', { principalId, capabilityId });
    return true;
  }

  /**
   * Check if principal has specific permission
   */
  hasPermission(principalId: string, permission: Permission): boolean {
    const principal = this.principals.get(principalId);
    if (!principal) {
      return false;
    }

    for (const capability of principal.capabilities.values()) {
      if (this.isCapabilityValid(capability) && capability.permissions.includes(permission)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if capability is valid (not expired, within constraints)
   */
  private isCapabilityValid(capability: Capability): boolean {
    // Check expiration
    if (capability.expiresAt && new Date() > capability.expiresAt) {
      return false;
    }

    // Check constraints
    if (capability.constraints) {
      const constraints = capability.constraints;

      // Check max uses
      if (
        constraints.maxUses !== undefined &&
        constraints.currentUses !== undefined &&
        constraints.currentUses >= constraints.maxUses
      ) {
        return false;
      }

      // Check time window
      const now = new Date();
      if (constraints.timeWindowStart && now < constraints.timeWindowStart) {
        return false;
      }
      if (constraints.timeWindowEnd && now > constraints.timeWindowEnd) {
        return false;
      }
    }

    return true;
  }

  // ==========================================================================
  // Access Control
  // ==========================================================================

  /**
   * Check access for a request
   */
  checkAccess(request: AccessRequest): AccessDecision {
    const principal = this.principals.get(request.principalId);

    if (!principal) {
      const auditId = this.logAudit({
        eventType: AuditEventType.ACCESS_DENIED,
        principalId: request.principalId,
        principalType: 'unknown',
        permission: request.permission,
        resource: request.resource,
        action: 'Access check',
        result: 'denied',
        details: { reason: 'Principal not found' },
      });

      return {
        allowed: false,
        reason: 'Principal not found',
        auditLogId: auditId,
      };
    }

    // Check rate limiting
    if (this.config.enableRateLimiting && !this.checkRateLimit(request.principalId)) {
      const auditId = this.logAudit({
        eventType: AuditEventType.ACCESS_DENIED,
        principalId: request.principalId,
        principalType: principal.type,
        permission: request.permission,
        resource: request.resource,
        action: 'Access check',
        result: 'denied',
        details: { reason: 'Rate limit exceeded' },
      });

      this.emit('access:denied', {
        principalId: request.principalId,
        permission: request.permission,
        resource: request.resource,
        reason: 'Rate limit exceeded',
      });

      return {
        allowed: false,
        reason: 'Rate limit exceeded',
        auditLogId: auditId,
      };
    }

    // Check policies
    const policyDecision = this.evaluatePolicies(request, principal);
    if (policyDecision !== null) {
      return policyDecision;
    }

    // Check capabilities
    if (!this.hasPermission(request.principalId, request.permission)) {
      const auditId = this.logAudit({
        eventType: AuditEventType.ACCESS_DENIED,
        principalId: request.principalId,
        principalType: principal.type,
        permission: request.permission,
        resource: request.resource,
        action: 'Access check',
        result: 'denied',
        details: { reason: 'Permission not granted' },
      });

      this.emit('access:denied', {
        principalId: request.principalId,
        permission: request.permission,
        resource: request.resource,
        reason: 'Permission not granted',
      });

      return {
        allowed: false,
        reason: 'Permission not granted',
        auditLogId: auditId,
      };
    }

    // Check sandbox constraints
    if (principal.sandboxId) {
      const sandbox = this.sandboxes.get(principal.sandboxId);
      if (sandbox && !this.checkSandboxConstraints(sandbox, request)) {
        const auditId = this.logAudit({
          eventType: AuditEventType.ACCESS_DENIED,
          principalId: request.principalId,
          principalType: principal.type,
          permission: request.permission,
          resource: request.resource,
          action: 'Access check',
          result: 'denied',
          sandboxId: principal.sandboxId,
          details: { reason: 'Sandbox constraint violation' },
        });

        this.emit('access:denied', {
          principalId: request.principalId,
          permission: request.permission,
          resource: request.resource,
          reason: 'Sandbox constraint violation',
        });

        return {
          allowed: false,
          reason: 'Sandbox constraint violation',
          auditLogId: auditId,
        };
      }
    }

    // Access granted
    const auditId = this.logAudit({
      eventType: AuditEventType.ACCESS_GRANTED,
      principalId: request.principalId,
      principalType: principal.type,
      permission: request.permission,
      resource: request.resource,
      action: 'Access check',
      result: 'success',
      sandboxId: principal.sandboxId,
    });

    this.emit('access:granted', {
      principalId: request.principalId,
      permission: request.permission,
      resource: request.resource,
    });

    return {
      allowed: true,
      reason: 'Access granted',
      auditLogId: auditId,
    };
  }

  /**
   * Evaluate security policies
   */
  private evaluatePolicies(
    request: AccessRequest,
    principal: SecurityPrincipal
  ): AccessDecision | null {
    // Sort policies by priority (higher first)
    const sortedPolicies = Array.from(this.policies.values())
      .filter((p) => p.enabled)
      .sort((a, b) => b.priority - a.priority);

    for (const policy of sortedPolicies) {
      // Sort rules by priority
      const sortedRules = [...policy.rules].sort((a, b) => b.priority - a.priority);

      for (const rule of sortedRules) {
        if (!rule.permissions.includes(request.permission)) {
          continue;
        }

        // Check conditions
        if (rule.conditions && !this.evaluateConditions(rule.conditions, principal, request)) {
          continue;
        }

        // Rule matches
        if (rule.action === 'deny') {
          const auditId = this.logAudit({
            eventType: AuditEventType.ACCESS_DENIED,
            principalId: request.principalId,
            principalType: principal.type,
            permission: request.permission,
            resource: request.resource,
            action: 'Policy evaluation',
            result: 'denied',
            details: { policyId: policy.id, ruleId: rule.id },
          });

          this.emit('access:denied', {
            principalId: request.principalId,
            permission: request.permission,
            resource: request.resource,
            reason: `Denied by policy: ${policy.name}`,
          });

          return {
            allowed: false,
            reason: `Denied by policy: ${policy.name}`,
            matchedRule: rule,
            auditLogId: auditId,
          };
        }

        if (rule.action === 'allow') {
          const auditId = this.logAudit({
            eventType: AuditEventType.ACCESS_GRANTED,
            principalId: request.principalId,
            principalType: principal.type,
            permission: request.permission,
            resource: request.resource,
            action: 'Policy evaluation',
            result: 'success',
            details: { policyId: policy.id, ruleId: rule.id },
          });

          this.emit('access:granted', {
            principalId: request.principalId,
            permission: request.permission,
            resource: request.resource,
          });

          return {
            allowed: true,
            reason: `Allowed by policy: ${policy.name}`,
            matchedRule: rule,
            auditLogId: auditId,
          };
        }

        // Audit action - log but continue evaluation
        if (rule.action === 'audit') {
          this.logAudit({
            eventType: AuditEventType.ACCESS_GRANTED,
            principalId: request.principalId,
            principalType: principal.type,
            permission: request.permission,
            resource: request.resource,
            action: 'Audit policy match',
            result: 'success',
            details: { policyId: policy.id, ruleId: rule.id },
          });
        }
      }
    }

    return null; // No policy matched, continue with capability check
  }

  /**
   * Evaluate security conditions
   */
  private evaluateConditions(
    conditions: SecurityCondition[],
    principal: SecurityPrincipal,
    request: AccessRequest
  ): boolean {
    for (const condition of conditions) {
      let value: unknown;

      switch (condition.type) {
        case 'principal_type':
          value = principal.type;
          break;
        case 'security_level':
          value = principal.securityLevel;
          break;
        case 'path_match':
          value = request.resource;
          break;
        default:
          continue;
      }

      if (!this.evaluateCondition(condition, value)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Evaluate a single condition
   */
  private evaluateCondition(condition: SecurityCondition, value: unknown): boolean {
    switch (condition.operator) {
      case 'equals':
        return value === condition.value;
      case 'not_equals':
        return value !== condition.value;
      case 'contains':
        if (Array.isArray(condition.value)) {
          return condition.value.includes(value as string);
        }
        return String(value).includes(String(condition.value));
      case 'not_contains':
        if (Array.isArray(condition.value)) {
          return !condition.value.includes(value as string);
        }
        return !String(value).includes(String(condition.value));
      case 'greater':
        return Number(value) > Number(condition.value);
      case 'less':
        return Number(value) < Number(condition.value);
      default:
        return false;
    }
  }

  // ==========================================================================
  // Rate Limiting
  // ==========================================================================

  /**
   * Check rate limit for principal
   */
  private checkRateLimit(principalId: string): boolean {
    const counter = this.rateLimitCounters.get(principalId);
    const now = new Date();

    if (!counter) {
      this.rateLimitCounters.set(principalId, { count: 1, windowStart: now });
      return true;
    }

    const elapsed = now.getTime() - counter.windowStart.getTime();
    if (elapsed > this.config.defaultRateLimitWindowMs) {
      // Reset window
      counter.count = 1;
      counter.windowStart = now;
      return true;
    }

    if (counter.count >= this.config.defaultRateLimit) {
      return false;
    }

    counter.count++;
    return true;
  }

  // ==========================================================================
  // Sandbox Management
  // ==========================================================================

  /**
   * Create a sandbox
   */
  createSandbox(config: Omit<SandboxConfig, 'id'>): SandboxConfig {
    const id = `sandbox_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const sandbox: SandboxConfig = { id, ...config };

    this.sandboxes.set(id, sandbox);

    this.logAudit({
      eventType: AuditEventType.SANDBOX_CREATED,
      principalId: 'system',
      principalType: 'system',
      action: `Sandbox created: ${sandbox.name}`,
      result: 'success',
      sandboxId: id,
      details: { config: sandbox },
    });

    this.emit('sandbox:created', sandbox);
    return sandbox;
  }

  /**
   * Assign principal to sandbox
   */
  assignToSandbox(principalId: string, sandboxId: string): boolean {
    const principal = this.principals.get(principalId);
    const sandbox = this.sandboxes.get(sandboxId);

    if (!principal || !sandbox) {
      return false;
    }

    principal.sandboxId = sandboxId;
    principal.securityLevel = SecurityLevel.SANDBOXED;

    this.logAudit({
      eventType: AuditEventType.PERMISSION_CHANGED,
      principalId,
      principalType: principal.type,
      action: `Assigned to sandbox: ${sandbox.name}`,
      result: 'success',
      sandboxId,
    });

    return true;
  }

  /**
   * Check sandbox constraints
   */
  private checkSandboxConstraints(sandbox: SandboxConfig, request: AccessRequest): boolean {
    // Check path constraints
    if (request.resource) {
      // Check denied paths
      for (const deniedPath of sandbox.deniedPaths) {
        if (request.resource.startsWith(deniedPath)) {
          return false;
        }
      }

      // Check allowed paths (if specified)
      if (sandbox.allowedPaths.length > 0) {
        let allowed = false;
        for (const allowedPath of sandbox.allowedPaths) {
          if (request.resource.startsWith(allowedPath)) {
            allowed = true;
            break;
          }
        }
        if (!allowed) {
          return false;
        }
      }
    }

    // Check network access
    if (
      !sandbox.networkAccess &&
      (request.permission === Permission.NETWORK_OUTBOUND ||
        request.permission === Permission.NETWORK_INBOUND)
    ) {
      return false;
    }

    return true;
  }

  /**
   * Get sandbox
   */
  getSandbox(id: string): SandboxConfig | undefined {
    return this.sandboxes.get(id);
  }

  /**
   * Destroy sandbox
   */
  destroySandbox(id: string): boolean {
    const sandbox = this.sandboxes.get(id);
    if (!sandbox) {
      return false;
    }

    // Remove principals from sandbox
    for (const principal of this.principals.values()) {
      if (principal.sandboxId === id) {
        principal.sandboxId = undefined;
      }
    }

    this.sandboxes.delete(id);

    this.logAudit({
      eventType: AuditEventType.SANDBOX_DESTROYED,
      principalId: 'system',
      principalType: 'system',
      action: `Sandbox destroyed: ${sandbox.name}`,
      result: 'success',
      sandboxId: id,
    });

    this.emit('sandbox:destroyed', { sandboxId: id });
    return true;
  }

  // ==========================================================================
  // Policy Management
  // ==========================================================================

  /**
   * Add a security policy
   */
  addPolicy(policy: SecurityPolicy): void {
    this.policies.set(policy.id, policy);

    this.logAudit({
      eventType: AuditEventType.POLICY_UPDATED,
      principalId: 'system',
      principalType: 'system',
      action: `Policy added: ${policy.name}`,
      result: 'success',
      details: { policyId: policy.id },
    });

    this.emit('policy:updated', policy);
  }

  /**
   * Remove a security policy
   */
  removePolicy(id: string): boolean {
    return this.policies.delete(id);
  }

  /**
   * Get a policy
   */
  getPolicy(id: string): SecurityPolicy | undefined {
    return this.policies.get(id);
  }

  /**
   * Get all policies
   */
  getAllPolicies(): SecurityPolicy[] {
    return Array.from(this.policies.values());
  }

  // ==========================================================================
  // Audit Logging
  // ==========================================================================

  /**
   * Log an audit event
   */
  private logAudit(
    entry: Omit<AuditLogEntry, 'id' | 'timestamp'>
  ): string {
    if (!this.config.enableAuditLogging) {
      return '';
    }

    const id = `audit_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const logEntry: AuditLogEntry = {
      id,
      timestamp: new Date(),
      ...entry,
    };

    this.auditLog.push(logEntry);

    // Trim log if exceeds max entries
    if (this.auditLog.length > this.config.maxAuditLogEntries) {
      this.auditLog = this.auditLog.slice(-this.config.maxAuditLogEntries);
    }

    this.emit('audit:logged', logEntry);
    return id;
  }

  /**
   * Get audit log entries
   */
  getAuditLog(options?: {
    principalId?: string;
    eventType?: AuditEventType;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): AuditLogEntry[] {
    let entries = [...this.auditLog];

    if (options?.principalId) {
      entries = entries.filter((e) => e.principalId === options.principalId);
    }

    if (options?.eventType) {
      entries = entries.filter((e) => e.eventType === options.eventType);
    }

    if (options?.startDate) {
      entries = entries.filter((e) => e.timestamp >= options.startDate!);
    }

    if (options?.endDate) {
      entries = entries.filter((e) => e.timestamp <= options.endDate!);
    }

    if (options?.limit) {
      entries = entries.slice(-options.limit);
    }

    return entries;
  }

  /**
   * Clear audit log
   */
  clearAuditLog(): void {
    this.auditLog = [];
  }

  // ==========================================================================
  // Security Violation Reporting
  // ==========================================================================

  /**
   * Report a security violation
   */
  reportViolation(
    principalId: string,
    violation: string,
    severity: 'low' | 'medium' | 'high' | 'critical'
  ): void {
    const principal = this.principals.get(principalId);

    this.logAudit({
      eventType: AuditEventType.SECURITY_VIOLATION,
      principalId,
      principalType: principal?.type ?? 'unknown',
      action: violation,
      result: 'failure',
      details: { severity },
    });

    this.emit('security:violation', { principalId, violation, severity });

    // Auto-escalate for critical violations
    if (severity === 'critical' && principal) {
      this.updateSecurityLevel(principalId, SecurityLevel.SANDBOXED);
    }
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  /**
   * Get security module statistics
   */
  getStats(): {
    principals: number;
    sandboxes: number;
    policies: number;
    auditLogEntries: number;
    accessGranted: number;
    accessDenied: number;
  } {
    const accessGranted = this.auditLog.filter(
      (e) => e.eventType === AuditEventType.ACCESS_GRANTED
    ).length;
    const accessDenied = this.auditLog.filter(
      (e) => e.eventType === AuditEventType.ACCESS_DENIED
    ).length;

    return {
      principals: this.principals.size,
      sandboxes: this.sandboxes.size,
      policies: this.policies.size,
      auditLogEntries: this.auditLog.length,
      accessGranted,
      accessDenied,
    };
  }

  /**
   * Reset security module state
   */
  reset(): void {
    this.principals.clear();
    this.sandboxes.clear();
    this.policies.clear();
    this.auditLog = [];
    this.rateLimitCounters.clear();
    this.initializeDefaultPolicies();
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a security module instance
 */
export function createSecurityModule(
  config: Partial<SecurityModuleConfig> = {}
): SecurityModule {
  return new SecurityModule(config);
}
