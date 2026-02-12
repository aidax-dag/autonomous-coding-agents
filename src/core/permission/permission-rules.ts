/**
 * Permission Rules Engine
 *
 * Pattern matching utilities and rule sorting for the permission system.
 * Supports glob-like patterns without external dependencies.
 *
 * @module core/permission/permission-rules
 */

import type { PermissionRule, PermissionAction } from './interfaces/permission.interface';

// ============================================================================
// Action Priority (for sorting)
// ============================================================================

const ACTION_PRIORITY: Record<PermissionAction, number> = {
  deny: 3,
  ask: 2,
  allow: 1,
};

// ============================================================================
// Pattern Matching
// ============================================================================

/**
 * Match a value against a glob-like pattern.
 *
 * Supports:
 * - `*` matches any characters except `/`
 * - `**` matches any characters including `/`
 * - `*.ext` matches files with the given extension
 * - Exact string matching
 * - Command prefix matching (pattern is prefix of value)
 *
 * @param pattern - Glob-like pattern
 * @param value - Value to test (file path or command)
 * @returns true if pattern matches value
 */
export function matchPattern(pattern: string, value: string): boolean {
  if (!pattern || !value) {
    return false;
  }

  // Exact match
  if (pattern === value) {
    return true;
  }

  // Command prefix match: "rm -rf" matches "rm -rf /foo"
  if (!pattern.includes('*') && !pattern.includes('?')) {
    return value.startsWith(pattern);
  }

  // Convert glob pattern to regex
  let regexStr = pattern
    // Replace ** with placeholder before processing *
    .replace(/\*\*\//g, '\0GLOBSTAR_SLASH\0')
    .replace(/\*\*/g, '\0GLOBSTAR\0');

  // Escape regex special chars (except * and ?)
  regexStr = regexStr.replace(/[.+^${}()|[\]\\]/g, '\\$&');

  // Replace single * (match anything except /)
  regexStr = regexStr.replace(/\*/g, '[^/]*');

  // Replace ? (match single char except /)
  regexStr = regexStr.replace(/\?/g, '[^/]');

  // Restore globstar patterns
  regexStr = regexStr
    .replace(/\0GLOBSTAR_SLASH\0/g, '(.+/)?')
    .replace(/\0GLOBSTAR\0/g, '.*');

  return new RegExp(`^${regexStr}$`).test(value);
}

/**
 * Calculate pattern specificity (more specific = higher score).
 *
 * Exact patterns > extension patterns > single wildcard > double wildcard.
 *
 * @param pattern - Glob pattern
 * @returns Specificity score (higher = more specific)
 */
export function patternSpecificity(pattern: string): number {
  let score = 0;

  // Longer patterns are generally more specific
  score += pattern.length;

  // Penalize wildcards (less specific)
  if (pattern.includes('**')) {
    score -= 20;
  }
  if (pattern.includes('*') && !pattern.includes('**')) {
    score -= 10;
  }

  // Exact patterns (no wildcards) are most specific
  if (!pattern.includes('*') && !pattern.includes('?')) {
    score += 50;
  }

  return score;
}

// ============================================================================
// Rule Sorting
// ============================================================================

/**
 * Sort permission rules by priority.
 *
 * Sorting order:
 * 1. Higher explicit priority first
 * 2. At same priority: deny > ask > allow
 * 3. At same priority and action: more specific pattern first
 *
 * @param rules - Array of permission rules
 * @returns New sorted array (does not mutate input)
 */
export function sortByPriority(rules: PermissionRule[]): PermissionRule[] {
  return [...rules].sort((a, b) => {
    // 1. Explicit priority (higher first)
    const priorityA = a.priority ?? 0;
    const priorityB = b.priority ?? 0;
    if (priorityA !== priorityB) {
      return priorityB - priorityA;
    }

    // 2. Action priority (deny > ask > allow)
    const actionA = ACTION_PRIORITY[a.action];
    const actionB = ACTION_PRIORITY[b.action];
    if (actionA !== actionB) {
      return actionB - actionA;
    }

    // 3. Pattern specificity (more specific first)
    return patternSpecificity(b.pattern) - patternSpecificity(a.pattern);
  });
}
