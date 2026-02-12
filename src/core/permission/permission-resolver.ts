/**
 * Permission Resolver
 *
 * Resolves which permission rule applies to a given request by matching
 * request path/command against rule patterns with priority ordering.
 *
 * @module core/permission/permission-resolver
 */

import type {
  PermissionRequest,
  PermissionRule,
  PermissionCheckResult,
  IPermissionResolver,
} from './interfaces/permission.interface';
import { matchPattern, sortByPriority } from './permission-rules';

// ============================================================================
// Implementation
// ============================================================================

/**
 * PermissionResolver
 *
 * Evaluates a permission request against a set of rules.
 * Rules are sorted by priority, then by action severity (deny > ask > allow),
 * then by pattern specificity. The first matching rule wins.
 */
export class PermissionResolver implements IPermissionResolver {
  /**
   * Resolve a permission request against a set of rules.
   *
   * Matching logic:
   * 1. Sort rules by priority (highest first), then deny > ask > allow
   * 2. For each rule, check if scope matches (rule scope 'all' matches everything)
   * 3. Match request path or command against rule pattern
   * 4. First matching rule wins
   * 5. If no rule matches, default to allow
   *
   * @param request - The permission request to evaluate
   * @param rules - The set of rules to check against
   * @returns The resolved permission check result
   */
  resolve(request: PermissionRequest, rules: PermissionRule[]): PermissionCheckResult {
    const sorted = sortByPriority(rules);

    for (const rule of sorted) {
      // Check scope compatibility
      if (!this.scopeMatches(rule.scope, request.scope)) {
        continue;
      }

      // Check pattern match against path or command
      if (this.ruleMatches(rule, request)) {
        return {
          action: rule.action,
          rule,
          reason: `Matched rule: "${rule.pattern}" (${rule.description ?? rule.action})`,
        };
      }
    }

    // No matching rule - default allow
    return {
      action: 'allow',
      reason: 'No matching rule found; default allow',
    };
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Check if a rule's scope is compatible with a request's scope.
   * A rule with scope 'all' matches any request scope.
   * Otherwise the scopes must match exactly.
   */
  private scopeMatches(ruleScope: string, requestScope: string): boolean {
    if (ruleScope === 'all' || requestScope === 'all') {
      return true;
    }
    return ruleScope === requestScope;
  }

  /**
   * Check if a rule's pattern matches the request's path or command.
   */
  private ruleMatches(rule: PermissionRule, request: PermissionRequest): boolean {
    // Try matching against path
    if (request.path && matchPattern(rule.pattern, request.path)) {
      return true;
    }

    // Try matching against command
    if (request.command && matchPattern(rule.pattern, request.command)) {
      return true;
    }

    return false;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a PermissionResolver instance
 *
 * @example
 * ```typescript
 * const resolver = createPermissionResolver();
 * const result = resolver.resolve(
 *   { path: '.env', scope: 'read' },
 *   [{ pattern: '*.env', action: 'deny', scope: 'all' }]
 * );
 * ```
 */
export function createPermissionResolver(): PermissionResolver {
  return new PermissionResolver();
}
