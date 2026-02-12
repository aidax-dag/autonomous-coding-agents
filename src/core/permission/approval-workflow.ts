/**
 * Approval Workflow
 *
 * Three approval modes following the Codex pattern:
 * - suggest: All operations need human approval
 * - auto-edit: File read/write auto-allowed, shell execute needs approval
 * - full-auto: Everything allowed except deny-listed patterns
 *
 * Integrates with PermissionManager for deny-list enforcement.
 *
 * @module core/permission/approval-workflow
 */

import type {
  ApprovalMode,
  PermissionRequest,
  PermissionCheckResult,
  IApprovalWorkflow,
} from './interfaces/permission.interface';
import { PermissionManager, createPermissionManager } from './permission-manager';
import type { PermissionManagerOptions } from './permission-manager';

// ============================================================================
// Options
// ============================================================================

/**
 * Options for creating an ApprovalWorkflow instance
 */
export interface ApprovalWorkflowOptions {
  /** Initial approval mode. Default: 'suggest' */
  mode?: ApprovalMode;
  /** Permission manager for deny-list checks */
  permissionManager?: PermissionManager;
  /** Permission manager options (if not providing an instance) */
  permissionManagerOptions?: PermissionManagerOptions;
}

// ============================================================================
// Implementation
// ============================================================================

/**
 * ApprovalWorkflow
 *
 * Controls how agent operations are approved based on the current mode.
 *
 * Modes:
 * - **suggest**: All file changes and shell commands need human approval (always 'ask').
 * - **auto-edit**: File read/write auto-allowed; shell execute needs approval.
 * - **full-auto**: Everything allowed except deny-listed patterns from PermissionManager.
 *
 * In all modes, deny-listed patterns from the PermissionManager are enforced.
 */
export class ApprovalWorkflow implements IApprovalWorkflow {
  private mode: ApprovalMode;
  private readonly permissionManager: PermissionManager;

  constructor(options: ApprovalWorkflowOptions = {}) {
    this.mode = options.mode ?? 'suggest';
    this.permissionManager =
      options.permissionManager ??
      createPermissionManager(options.permissionManagerOptions);
  }

  /**
   * Get the current approval mode.
   */
  getMode(): ApprovalMode {
    return this.mode;
  }

  /**
   * Set the approval mode.
   */
  setMode(mode: ApprovalMode): void {
    this.mode = mode;
  }

  /**
   * Get the underlying permission manager (for adding custom rules).
   */
  getPermissionManager(): PermissionManager {
    return this.permissionManager;
  }

  /**
   * Determine whether an operation should be approved.
   *
   * Logic:
   * 1. Always check the deny list first (all modes).
   * 2. Apply mode-specific logic for non-denied requests.
   *
   * @param request - The permission request to evaluate
   * @returns The resolved permission check result
   */
  shouldApprove(request: PermissionRequest): PermissionCheckResult {
    // Step 1: Check deny list from PermissionManager
    const denyCheck = this.permissionManager.check(request);
    if (denyCheck.action === 'deny') {
      return denyCheck;
    }

    // Step 2: Apply mode-specific logic
    switch (this.mode) {
      case 'suggest':
        return this.handleSuggestMode(request);
      case 'auto-edit':
        return this.handleAutoEditMode(request);
      case 'full-auto':
        return this.handleFullAutoMode(request, denyCheck);
    }
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Suggest mode: all operations need approval.
   */
  private handleSuggestMode(_request: PermissionRequest): PermissionCheckResult {
    return {
      action: 'ask',
      reason: 'Suggest mode: all operations require approval',
    };
  }

  /**
   * Auto-edit mode: file read/write auto-allowed, execute needs approval.
   */
  private handleAutoEditMode(request: PermissionRequest): PermissionCheckResult {
    if (request.scope === 'read' || request.scope === 'write') {
      return {
        action: 'allow',
        reason: 'Auto-edit mode: file read/write auto-allowed',
      };
    }

    // Execute and 'all' scope need approval
    return {
      action: 'ask',
      reason: 'Auto-edit mode: shell execution requires approval',
    };
  }

  /**
   * Full-auto mode: everything allowed unless deny-listed.
   * The deny check already happened in shouldApprove, so if we reach here
   * the request was not denied and we trust the PermissionManager result.
   */
  private handleFullAutoMode(
    _request: PermissionRequest,
    managerResult: PermissionCheckResult,
  ): PermissionCheckResult {
    // If the manager returned 'ask', respect it in full-auto (custom rules)
    if (managerResult.action === 'ask') {
      return managerResult;
    }

    return {
      action: 'allow',
      reason: 'Full-auto mode: operation allowed',
    };
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create an ApprovalWorkflow instance
 *
 * @example
 * ```typescript
 * // Default suggest mode
 * const workflow = createApprovalWorkflow();
 *
 * // Full-auto mode
 * const workflow = createApprovalWorkflow({ mode: 'full-auto' });
 *
 * // Check approval
 * const result = workflow.shouldApprove({ path: 'src/app.ts', scope: 'write' });
 * ```
 */
export function createApprovalWorkflow(
  options: ApprovalWorkflowOptions = {},
): ApprovalWorkflow {
  return new ApprovalWorkflow(options);
}

export default ApprovalWorkflow;
