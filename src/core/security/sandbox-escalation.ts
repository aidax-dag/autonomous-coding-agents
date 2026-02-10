/**
 * Progressive Sandbox Escalation Implementation
 *
 * 4-stage sandbox system where agent permissions escalate
 * based on confidence scores and task history.
 *
 * Levels: RESTRICTED -> MONITORED -> STANDARD -> ELEVATED
 *
 * @module core/security/sandbox-escalation
 */

import {
  SandboxLevel,
  SANDBOX_LEVEL_ORDER,
  ToolCategory,
  type SandboxPermissions,
  type EscalationContext,
  type EscalationResult,
  type SecurityViolation,
  type EscalationThresholds,
  type ISandboxEscalation,
  type SandboxEscalationOptions,
  DEFAULT_ESCALATION_THRESHOLDS,
} from './interfaces/escalation.interface.js';

// ============================================================================
// Default Permission Sets
// ============================================================================

const DEFAULT_PERMISSIONS: Record<SandboxLevel, SandboxPermissions> = {
  [SandboxLevel.RESTRICTED]: {
    allowedToolCategories: [ToolCategory.READ],
    allowedPaths: ['**/*.ts', '**/*.js', '**/*.json', '**/*.md', '**/*.yaml', '**/*.yml'],
    deniedPaths: ['**/node_modules/**', '**/.env*', '**/secrets/**', '**/.git/**'],
    maxConcurrentOps: 1,
    monitored: true,
    maxExecutionTime: 30_000,
  },
  [SandboxLevel.MONITORED]: {
    allowedToolCategories: [ToolCategory.READ, ToolCategory.WRITE],
    allowedPaths: ['src/**', 'tests/**', 'docs/**', '*.json', '*.md'],
    deniedPaths: ['**/node_modules/**', '**/.env*', '**/secrets/**', '**/.git/**', '**/dist/**'],
    maxConcurrentOps: 3,
    monitored: true,
    maxExecutionTime: 60_000,
  },
  [SandboxLevel.STANDARD]: {
    allowedToolCategories: [ToolCategory.READ, ToolCategory.WRITE, ToolCategory.EXECUTE, ToolCategory.NETWORK],
    allowedPaths: ['**'],
    deniedPaths: ['**/.env*', '**/secrets/**'],
    maxConcurrentOps: 5,
    monitored: false,
    maxExecutionTime: 120_000,
  },
  [SandboxLevel.ELEVATED]: {
    allowedToolCategories: [ToolCategory.READ, ToolCategory.WRITE, ToolCategory.EXECUTE, ToolCategory.NETWORK, ToolCategory.SYSTEM],
    allowedPaths: ['**'],
    deniedPaths: [],
    maxConcurrentOps: 10,
    monitored: false,
    maxExecutionTime: 300_000,
  },
};

// ============================================================================
// Glob Matching Utility
// ============================================================================

/**
 * Simple glob pattern matching (supports *, **, ?)
 * Avoids external dependency on minimatch.
 */
function globMatch(path: string, pattern: string): boolean {
  // Step 1: Replace ** with placeholder BEFORE escaping
  let s = pattern
    .replace(/\*\*\//g, '\0GLOBSTAR_SLASH\0')
    .replace(/\*\*/g, '\0GLOBSTAR\0');

  // Step 2: Escape regex special chars (except * and ?)
  s = s.replace(/[.+^${}()|[\]\\]/g, '\\$&');

  // Step 3: Replace remaining glob chars
  s = s
    .replace(/\*/g, '[^/]*')
    .replace(/\?/g, '[^/]');

  // Step 4: Restore globstar patterns
  s = s
    .replace(/\0GLOBSTAR_SLASH\0/g, '(.+/)?')
    .replace(/\0GLOBSTAR\0/g, '.*');

  return new RegExp(`^${s}$`).test(path);
}

// ============================================================================
// Implementation
// ============================================================================

/**
 * SandboxEscalation
 *
 * Manages progressive sandbox levels based on confidence scores, task success
 * history, and security violation records.
 */
export class SandboxEscalation implements ISandboxEscalation {
  private currentLevel: SandboxLevel;
  private thresholds: EscalationThresholds;
  private violations: SecurityViolation[] = [];
  private permissions: Record<SandboxLevel, SandboxPermissions>;

  constructor(options: SandboxEscalationOptions = {}) {
    this.currentLevel = options.initialLevel ?? SandboxLevel.RESTRICTED;
    this.thresholds = {
      ...DEFAULT_ESCALATION_THRESHOLDS,
      ...options.thresholds,
    };
    this.permissions = this.buildPermissions(options.permissionOverrides);
  }

  getCurrentLevel(): SandboxLevel {
    return this.currentLevel;
  }

  getPermissions(): SandboxPermissions {
    return { ...this.permissions[this.currentLevel] };
  }

  getPermissionsForLevel(level: SandboxLevel): SandboxPermissions {
    return { ...this.permissions[level] };
  }

  evaluate(context: EscalationContext): EscalationResult {
    const previousLevel = this.currentLevel;

    // Check for demotion first (safety priority)
    const demotionResult = this.checkDemotion(context);
    if (demotionResult) {
      this.currentLevel = demotionResult.newLevel;
      return demotionResult;
    }

    // Check for promotion
    const promotionResult = this.checkPromotion(context);
    if (promotionResult) {
      this.currentLevel = promotionResult.newLevel;
      return promotionResult;
    }

    // No change
    return {
      previousLevel,
      newLevel: previousLevel,
      changed: false,
      direction: 'unchanged',
      reason: 'No level change warranted by current context',
      permissions: this.getPermissions(),
    };
  }

  recordViolation(violation: SecurityViolation): EscalationResult {
    this.violations.push(violation);

    const previousLevel = this.currentLevel;

    // Critical violations may trigger immediate demotion
    if (violation.severity === 'critical') {
      const criticalCount = this.violations.filter(v => v.severity === 'critical').length;
      if (criticalCount >= this.thresholds.maxCriticalViolations) {
        const newLevel = this.demoteLevel(this.currentLevel);
        this.currentLevel = newLevel;
        return {
          previousLevel,
          newLevel,
          changed: newLevel !== previousLevel,
          direction: newLevel !== previousLevel ? 'demoted' : 'unchanged',
          reason: `Critical violation threshold reached (${criticalCount}/${this.thresholds.maxCriticalViolations}): ${violation.description}`,
          permissions: this.getPermissions(),
        };
      }
    }

    return {
      previousLevel,
      newLevel: previousLevel,
      changed: false,
      direction: 'unchanged',
      reason: `Violation recorded: ${violation.description}`,
      permissions: this.getPermissions(),
    };
  }

  isAllowed(toolCategory: ToolCategory, path?: string): boolean {
    const perms = this.permissions[this.currentLevel];

    // Check tool category
    if (!perms.allowedToolCategories.includes(toolCategory)) {
      return false;
    }

    // Check path if provided
    if (path) {
      // Check denied paths first (deny takes precedence)
      for (const denied of perms.deniedPaths) {
        if (globMatch(path, denied)) {
          return false;
        }
      }

      // Check allowed paths
      let pathAllowed = false;
      for (const allowed of perms.allowedPaths) {
        if (globMatch(path, allowed)) {
          pathAllowed = true;
          break;
        }
      }
      if (!pathAllowed) {
        return false;
      }
    }

    return true;
  }

  setLevel(level: SandboxLevel, reason: string): EscalationResult {
    const previousLevel = this.currentLevel;
    this.currentLevel = level;

    const previousOrder = SANDBOX_LEVEL_ORDER[previousLevel];
    const newOrder = SANDBOX_LEVEL_ORDER[level];

    return {
      previousLevel,
      newLevel: level,
      changed: level !== previousLevel,
      direction: newOrder > previousOrder ? 'promoted' : newOrder < previousOrder ? 'demoted' : 'unchanged',
      reason: `Manual override: ${reason}`,
      permissions: this.getPermissions(),
    };
  }

  reset(): void {
    this.currentLevel = SandboxLevel.RESTRICTED;
    this.violations = [];
  }

  getViolations(): SecurityViolation[] {
    return [...this.violations];
  }

  setThresholds(thresholds: Partial<EscalationThresholds>): void {
    this.thresholds = { ...this.thresholds, ...thresholds };
    this.validateThresholds();
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private checkDemotion(context: EscalationContext): EscalationResult | null {
    const { confidenceScore, successfulTasks, failedTasks } = context;
    const totalTasks = successfulTasks + failedTasks;

    // Check error rate
    if (totalTasks > 0) {
      const errorRate = failedTasks / totalTasks;
      if (errorRate > this.thresholds.maxErrorRate) {
        const newLevel = this.demoteLevel(this.currentLevel);
        if (newLevel !== this.currentLevel) {
          return {
            previousLevel: this.currentLevel,
            newLevel,
            changed: true,
            direction: 'demoted',
            reason: `Error rate ${(errorRate * 100).toFixed(0)}% exceeds threshold ${(this.thresholds.maxErrorRate * 100).toFixed(0)}%`,
            permissions: this.permissions[newLevel],
          };
        }
      }
    }

    // Check if confidence dropped below current level's threshold
    const demotionThreshold = this.getDemotionThreshold(this.currentLevel);
    if (demotionThreshold !== null && confidenceScore < demotionThreshold) {
      const newLevel = this.demoteLevel(this.currentLevel);
      if (newLevel !== this.currentLevel) {
        return {
          previousLevel: this.currentLevel,
          newLevel,
          changed: true,
          direction: 'demoted',
          reason: `Confidence ${confidenceScore}% below demotion threshold ${demotionThreshold}%`,
          permissions: this.permissions[newLevel],
        };
      }
    }

    return null;
  }

  private checkPromotion(context: EscalationContext): EscalationResult | null {
    const { confidenceScore, successfulTasks } = context;

    // Must have minimum successful tasks
    if (successfulTasks < this.thresholds.minSuccessfulTasks) {
      return null;
    }

    const promotionThreshold = this.getPromotionThreshold(this.currentLevel);
    if (promotionThreshold === null) {
      return null; // Already at max level
    }

    if (confidenceScore >= promotionThreshold) {
      const newLevel = this.promoteLevel(this.currentLevel);
      if (newLevel !== this.currentLevel) {
        return {
          previousLevel: this.currentLevel,
          newLevel,
          changed: true,
          direction: 'promoted',
          reason: `Confidence ${confidenceScore}% meets promotion threshold ${promotionThreshold}% with ${successfulTasks} successful tasks`,
          permissions: this.permissions[newLevel],
        };
      }
    }

    return null;
  }

  private getPromotionThreshold(level: SandboxLevel): number | null {
    switch (level) {
      case SandboxLevel.RESTRICTED:
        return this.thresholds.restrictedToMonitored;
      case SandboxLevel.MONITORED:
        return this.thresholds.monitoredToStandard;
      case SandboxLevel.STANDARD:
        return this.thresholds.standardToElevated;
      case SandboxLevel.ELEVATED:
        return null; // Already at max
    }
  }

  private getDemotionThreshold(level: SandboxLevel): number | null {
    switch (level) {
      case SandboxLevel.RESTRICTED:
        return null; // Already at min
      case SandboxLevel.MONITORED:
        return this.thresholds.restrictedToMonitored - 10;
      case SandboxLevel.STANDARD:
        return this.thresholds.monitoredToStandard - 10;
      case SandboxLevel.ELEVATED:
        return this.thresholds.standardToElevated - 10;
    }
  }

  private promoteLevel(level: SandboxLevel): SandboxLevel {
    switch (level) {
      case SandboxLevel.RESTRICTED:
        return SandboxLevel.MONITORED;
      case SandboxLevel.MONITORED:
        return SandboxLevel.STANDARD;
      case SandboxLevel.STANDARD:
        return SandboxLevel.ELEVATED;
      case SandboxLevel.ELEVATED:
        return SandboxLevel.ELEVATED;
    }
  }

  private demoteLevel(level: SandboxLevel): SandboxLevel {
    switch (level) {
      case SandboxLevel.RESTRICTED:
        return SandboxLevel.RESTRICTED;
      case SandboxLevel.MONITORED:
        return SandboxLevel.RESTRICTED;
      case SandboxLevel.STANDARD:
        return SandboxLevel.MONITORED;
      case SandboxLevel.ELEVATED:
        return SandboxLevel.STANDARD;
    }
  }

  private buildPermissions(
    overrides?: Partial<Record<SandboxLevel, Partial<SandboxPermissions>>>,
  ): Record<SandboxLevel, SandboxPermissions> {
    const result = {} as Record<SandboxLevel, SandboxPermissions>;

    for (const level of Object.values(SandboxLevel)) {
      result[level] = {
        ...DEFAULT_PERMISSIONS[level],
        ...overrides?.[level],
      };
    }

    return result;
  }

  private validateThresholds(): void {
    const { restrictedToMonitored, monitoredToStandard, standardToElevated } = this.thresholds;

    if (restrictedToMonitored >= monitoredToStandard) {
      throw new Error(
        `restrictedToMonitored (${restrictedToMonitored}) must be less than monitoredToStandard (${monitoredToStandard})`,
      );
    }
    if (monitoredToStandard >= standardToElevated) {
      throw new Error(
        `monitoredToStandard (${monitoredToStandard}) must be less than standardToElevated (${standardToElevated})`,
      );
    }
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a SandboxEscalation instance
 *
 * @example
 * ```typescript
 * // Create with defaults (starts at RESTRICTED)
 * const sandbox = createSandboxEscalation();
 *
 * // Create with custom initial level
 * const sandbox = createSandboxEscalation({ initialLevel: SandboxLevel.MONITORED });
 *
 * // Create with custom thresholds
 * const sandbox = createSandboxEscalation({
 *   thresholds: { restrictedToMonitored: 50, monitoredToStandard: 70 }
 * });
 * ```
 */
export function createSandboxEscalation(
  options: SandboxEscalationOptions = {},
): SandboxEscalation {
  return new SandboxEscalation(options);
}

export default SandboxEscalation;
