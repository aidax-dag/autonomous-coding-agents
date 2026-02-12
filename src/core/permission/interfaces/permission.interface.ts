/**
 * Permission Module Interfaces
 *
 * Defines the permission and approval workflow types for controlling
 * agent access to files, commands, and operations.
 *
 * @module core/permission/interfaces/permission
 */

// ============================================================================
// Core Types
// ============================================================================

/** Action to take for a permission check */
export type PermissionAction = 'allow' | 'deny' | 'ask';

/** Scope of the permission request */
export type PermissionScope = 'read' | 'write' | 'execute' | 'all';

/** Approval mode (Codex pattern) */
export type ApprovalMode = 'suggest' | 'auto-edit' | 'full-auto';

// ============================================================================
// Permission Rules
// ============================================================================

/**
 * A single permission rule matching a pattern to an action
 */
export interface PermissionRule {
  /** Glob-like pattern to match (file path or command) */
  pattern: string;
  /** Action to take when pattern matches */
  action: PermissionAction;
  /** Scope this rule applies to */
  scope: PermissionScope;
  /** Priority (higher wins). Default: 0 */
  priority?: number;
  /** Human-readable description */
  description?: string;
}

// ============================================================================
// Permission Check
// ============================================================================

/**
 * Result of checking a permission request against rules
 */
export interface PermissionCheckResult {
  /** Resolved action */
  action: PermissionAction;
  /** The rule that matched (undefined if default) */
  rule?: PermissionRule;
  /** Explanation of why this action was chosen */
  reason: string;
}

/**
 * A request to check permissions for an operation
 */
export interface PermissionRequest {
  /** File path being accessed */
  path?: string;
  /** Shell command being executed */
  command?: string;
  /** Scope of the operation */
  scope: PermissionScope;
  /** Agent making the request */
  agent?: string;
}

// ============================================================================
// Core Interfaces
// ============================================================================

/**
 * Resolves which permission rule applies to a given request
 */
export interface IPermissionResolver {
  /**
   * Resolve a permission request against a set of rules
   */
  resolve(request: PermissionRequest, rules: PermissionRule[]): PermissionCheckResult;
}

/**
 * Manages permission rules and checks requests against them
 */
export interface IPermissionManager {
  /** Add a permission rule */
  addRule(rule: PermissionRule): void;
  /** Remove a rule by its pattern */
  removeRule(pattern: string): boolean;
  /** Get all current rules */
  getRules(): PermissionRule[];
  /** Check a permission request against all rules */
  check(request: PermissionRequest): PermissionCheckResult;
  /** Remove all rules */
  clearRules(): void;
}

/**
 * Approval workflow controlling how operations are approved
 */
export interface IApprovalWorkflow {
  /** Get current approval mode */
  getMode(): ApprovalMode;
  /** Set approval mode */
  setMode(mode: ApprovalMode): void;
  /** Determine whether an operation should be approved */
  shouldApprove(request: PermissionRequest): PermissionCheckResult;
}
