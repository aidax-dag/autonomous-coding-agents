/**
 * Permission Module
 *
 * Permission and approval workflow for controlling agent access to
 * files, commands, and operations. Implements the Codex approval pattern
 * with three modes: suggest, auto-edit, full-auto.
 *
 * - PermissionResolver: Rule matching engine
 * - PermissionManager: Central rule management with default deny rules
 * - ApprovalWorkflow: Mode-based approval control
 *
 * @module core/permission
 */

// ============================================================================
// Interfaces
// ============================================================================

export type {
  PermissionAction,
  PermissionScope,
  ApprovalMode,
  PermissionRule,
  PermissionCheckResult,
  PermissionRequest,
  IPermissionResolver,
  IPermissionManager,
  IApprovalWorkflow,
} from './interfaces/permission.interface';

// ============================================================================
// Pattern Matching Utilities
// ============================================================================

export {
  matchPattern,
  patternSpecificity,
  sortByPriority,
} from './permission-rules';

// ============================================================================
// Implementation
// ============================================================================

export {
  PermissionResolver,
  createPermissionResolver,
} from './permission-resolver';

export {
  PermissionManager,
  createPermissionManager,
  type PermissionManagerOptions,
} from './permission-manager';

export {
  ApprovalWorkflow,
  createApprovalWorkflow,
  type ApprovalWorkflowOptions,
} from './approval-workflow';
