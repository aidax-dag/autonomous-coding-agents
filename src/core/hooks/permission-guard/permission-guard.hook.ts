/**
 * Permission Guard Hook
 *
 * Pre-execution hook that checks file/command permissions before
 * a task runs. Uses PermissionManager to evaluate access rules.
 *
 * - 'allow' → continues
 * - 'deny'  → aborts task
 * - 'ask'   → continues with metadata flag for upstream approval
 *
 * @module core/hooks/permission-guard
 */

import { BaseHook } from '../base-hook';
import {
  HookEvent,
  HookAction,
  HookContext,
  HookResult,
  HookConfig,
} from '../../interfaces/hook.interface';
import type {
  PermissionCheckResult,
  PermissionScope,
} from '../../permission/interfaces/permission.interface';
import type { PermissionManager } from '../../permission/permission-manager';

/**
 * Context data for permission guard hook
 */
export interface PermissionGuardContext {
  /** File path being accessed (optional) */
  path?: string;
  /** Shell command being executed (optional) */
  command?: string;
  /** Permission scope */
  scope: PermissionScope;
  /** Agent making the request */
  agent?: string;
}

/**
 * PermissionGuardHook
 *
 * Runs before task execution (TASK_BEFORE) to check permissions.
 * - 'allow' → CONTINUE
 * - 'deny'  → ABORT with reason
 * - 'ask'   → CONTINUE with requiresApproval metadata
 */
export class PermissionGuardHook extends BaseHook<PermissionGuardContext, PermissionCheckResult> {
  readonly name = 'permission-guard';
  readonly description = 'Pre-execution permission check';
  readonly event = HookEvent.TASK_BEFORE;

  private readonly permissionManager: PermissionManager;

  constructor(
    permissionManager: PermissionManager,
    config?: Partial<HookConfig>,
  ) {
    // Priority 250: runs before confidence-check (200) to block early
    super({ priority: 250, ...config });
    this.permissionManager = permissionManager;
  }

  async execute(
    context: HookContext<PermissionGuardContext>,
  ): Promise<HookResult<PermissionCheckResult>> {
    try {
      const { path, command, scope, agent } = context.data;

      // Skip if no path or command to check
      if (!path && !command) {
        return this.continue(undefined, 'No path or command to check');
      }

      const result = this.permissionManager.check({ path, command, scope, agent });

      switch (result.action) {
        case 'allow':
          return this.continue(result);

        case 'deny':
          return {
            action: HookAction.ABORT,
            data: result,
            message: `Permission denied: ${result.reason}`,
          };

        case 'ask':
          return this.continue(result, `Requires approval: ${result.reason}`);

        default:
          return this.continue(result);
      }
    } catch {
      // Graceful degradation: allow on error
      return this.continue(undefined, 'Permission check skipped due to error');
    }
  }
}
