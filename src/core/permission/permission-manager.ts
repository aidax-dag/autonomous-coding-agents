/**
 * Permission Manager
 *
 * Main permission engine that manages rules and delegates checks
 * to the PermissionResolver. Includes default deny rules for
 * sensitive files and dangerous commands.
 *
 * @module core/permission/permission-manager
 */

import type {
  PermissionRule,
  PermissionRequest,
  PermissionCheckResult,
  IPermissionManager,
} from './interfaces/permission.interface';
import { PermissionResolver, createPermissionResolver } from './permission-resolver';

// ============================================================================
// Default Rules
// ============================================================================

/**
 * Default deny rules for sensitive files and dangerous commands.
 * These are loaded on construction and can be cleared if needed.
 */
const DEFAULT_RULES: PermissionRule[] = [
  // Deny sensitive file access
  {
    pattern: '*.env',
    action: 'deny',
    scope: 'all',
    priority: 100,
    description: 'Block access to environment files',
  },
  {
    pattern: '*.key',
    action: 'deny',
    scope: 'all',
    priority: 100,
    description: 'Block access to key files',
  },
  {
    pattern: '*.pem',
    action: 'deny',
    scope: 'all',
    priority: 100,
    description: 'Block access to certificate files',
  },
  // Ask for dangerous commands
  {
    pattern: 'rm ',
    action: 'ask',
    scope: 'execute',
    priority: 90,
    description: 'Confirm before removing files',
  },
  {
    pattern: 'git push',
    action: 'ask',
    scope: 'execute',
    priority: 90,
    description: 'Confirm before pushing to remote',
  },
];

// ============================================================================
// Options
// ============================================================================

/**
 * Options for creating a PermissionManager instance
 */
export interface PermissionManagerOptions {
  /** Whether to include default deny rules. Default: true */
  includeDefaults?: boolean;
  /** Custom resolver instance (for testing) */
  resolver?: PermissionResolver;
}

// ============================================================================
// Implementation
// ============================================================================

/**
 * PermissionManager
 *
 * Central permission engine managing a rule set and delegating
 * checks to PermissionResolver. Ships with default deny rules
 * for sensitive files (*.env, *.key, *.pem) and dangerous commands
 * (rm, git push).
 */
export class PermissionManager implements IPermissionManager {
  private rules: PermissionRule[] = [];
  private readonly resolver: PermissionResolver;

  constructor(options: PermissionManagerOptions = {}) {
    const { includeDefaults = true, resolver } = options;
    this.resolver = resolver ?? createPermissionResolver();

    if (includeDefaults) {
      this.rules = [...DEFAULT_RULES];
    }
  }

  /**
   * Add a permission rule.
   * Rules are not deduplicated; multiple rules with the same pattern
   * are allowed and resolved by priority.
   */
  addRule(rule: PermissionRule): void {
    this.rules.push(rule);
  }

  /**
   * Remove the first rule matching the given pattern.
   * @returns true if a rule was removed
   */
  removeRule(pattern: string): boolean {
    const idx = this.rules.findIndex(r => r.pattern === pattern);
    if (idx >= 0) {
      this.rules.splice(idx, 1);
      return true;
    }
    return false;
  }

  /**
   * Get a copy of all current rules.
   */
  getRules(): PermissionRule[] {
    return [...this.rules];
  }

  /**
   * Check a permission request against all rules.
   */
  check(request: PermissionRequest): PermissionCheckResult {
    return this.resolver.resolve(request, this.rules);
  }

  /**
   * Remove all rules (including defaults).
   */
  clearRules(): void {
    this.rules = [];
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a PermissionManager instance
 *
 * @example
 * ```typescript
 * // With default deny rules
 * const manager = createPermissionManager();
 *
 * // Without defaults
 * const manager = createPermissionManager({ includeDefaults: false });
 *
 * // Check a permission
 * const result = manager.check({ path: 'config.env', scope: 'read' });
 * // result.action === 'deny'
 * ```
 */
export function createPermissionManager(
  options: PermissionManagerOptions = {},
): PermissionManager {
  return new PermissionManager(options);
}

export default PermissionManager;
