/**
 * F001-ConfidenceChecker: Pre-execution Confidence Checking System
 *
 * ROI: 25-250x (prevents implementation waste through early validation)
 *
 * Core functionality:
 * - Validates readiness before task execution
 * - Configurable check items with weighted scoring
 * - Threshold-based recommendations (proceed/alternatives/stop)
 */

// ============================================================================
// Interfaces
// ============================================================================

/**
 * Context information about the task being checked
 */
export interface TaskContext {
  /** Unique identifier for the task */
  taskId: string;
  /** Type of task (implementation, bug-fix, refactor, etc.) */
  taskType: string;
  /** Human-readable description of the task */
  description: string;
  /** Optional list of files involved in the task */
  files?: string[];
  /** Optional list of dependencies required */
  dependencies?: string[];
  /** Optional complexity assessment */
  complexity?: 'simple' | 'moderate' | 'complex';
}

/**
 * A single check item with its configuration
 */
export interface ConfidenceCheckItem {
  /** Unique name for this check */
  name: string;
  /** Weight of this check (0-1, all weights should sum to 1.0) */
  weight: number;
  /** Async function that performs the check */
  check: (context: TaskContext) => Promise<boolean>;
  /** Optional description of what this check validates */
  description?: string;
}

/**
 * Individual check result within the overall result
 */
export interface CheckItemResult {
  /** Name of the check */
  name: string;
  /** Whether this check passed */
  passed: boolean;
  /** Weight of this check */
  weight: number;
}

/**
 * Result of a confidence check operation
 */
export interface ConfidenceCheckResult {
  /** Overall score (0-100) */
  score: number;
  /** Whether the overall check passed (score >= proceedThreshold) */
  passed: boolean;
  /** The threshold that was used for pass determination */
  threshold: number;
  /** Individual check results */
  items: CheckItemResult[];
  /** Recommendation based on score thresholds */
  recommendation: 'proceed' | 'alternatives' | 'stop';
  /** Optional explanation when score is below threshold */
  explanation?: string;
}

/**
 * Interface for ConfidenceChecker implementations
 */
export interface IConfidenceChecker {
  /** Perform a confidence check against the given context */
  check(context: TaskContext): Promise<ConfidenceCheckResult>;
  /** Set custom check items (replaces existing items) */
  setCheckItems(items: ConfidenceCheckItem[]): void;
  /** Set custom thresholds */
  setThresholds(proceedThreshold: number, alternativesThreshold: number): void;
}

/**
 * Options for creating a ConfidenceChecker
 */
export interface ConfidenceCheckerOptions {
  /** Custom check items (defaults to DEFAULT_CHECK_ITEMS) */
  checkItems?: ConfidenceCheckItem[];
  /** Score threshold for "proceed" recommendation (default: 90) */
  proceedThreshold?: number;
  /** Score threshold for "alternatives" recommendation (default: 70) */
  alternativesThreshold?: number;
}

// ============================================================================
// Default Check Items
// ============================================================================

/**
 * Default check items following the F001 specification
 *
 * Weights:
 * - duplicate_check_complete: 0.25
 * - architecture_check_complete: 0.25
 * - official_docs_verified: 0.20
 * - oss_reference_complete: 0.15
 * - root_cause_identified: 0.15
 * Total: 1.0
 */
export const DEFAULT_CHECK_ITEMS: ConfidenceCheckItem[] = [
  {
    name: 'duplicate_check_complete',
    weight: 0.25,
    check: async (_context: TaskContext): Promise<boolean> => {
      // Default implementation: always returns true
      // In real usage, this would check if duplicates have been analyzed
      return true;
    },
    description: 'Verify duplicate/similar implementations have been checked',
  },
  {
    name: 'architecture_check_complete',
    weight: 0.25,
    check: async (_context: TaskContext): Promise<boolean> => {
      // Default implementation: always returns true
      // In real usage, this would validate architecture compliance
      return true;
    },
    description: 'Verify architecture patterns and compliance have been reviewed',
  },
  {
    name: 'official_docs_verified',
    weight: 0.20,
    check: async (_context: TaskContext): Promise<boolean> => {
      // Default implementation: always returns true
      // In real usage, this would verify official documentation was consulted
      return true;
    },
    description: 'Verify official documentation has been consulted',
  },
  {
    name: 'oss_reference_complete',
    weight: 0.15,
    check: async (_context: TaskContext): Promise<boolean> => {
      // Default implementation: always returns true
      // In real usage, this would verify OSS references have been checked
      return true;
    },
    description: 'Verify open source references have been reviewed',
  },
  {
    name: 'root_cause_identified',
    weight: 0.15,
    check: async (_context: TaskContext): Promise<boolean> => {
      // Default implementation: always returns true
      // In real usage, this would verify root cause analysis is complete
      return true;
    },
    description: 'Verify root cause has been identified for bug fixes',
  },
];

// ============================================================================
// Implementation
// ============================================================================

/**
 * ConfidenceChecker implementation
 *
 * Validates task readiness through configurable check items with weighted scoring.
 */
export class ConfidenceChecker implements IConfidenceChecker {
  private checkItems: ConfidenceCheckItem[];
  private proceedThreshold: number;
  private alternativesThreshold: number;

  constructor(options: ConfidenceCheckerOptions = {}) {
    this.checkItems = options.checkItems ?? [...DEFAULT_CHECK_ITEMS];
    this.proceedThreshold = options.proceedThreshold ?? 90;
    this.alternativesThreshold = options.alternativesThreshold ?? 70;

    // Validate initial configuration
    if (options.checkItems) {
      this.validateCheckItems(options.checkItems);
    }
    if (options.proceedThreshold !== undefined || options.alternativesThreshold !== undefined) {
      this.validateThresholds(this.proceedThreshold, this.alternativesThreshold);
    }
  }

  /**
   * Perform a confidence check against the given context
   */
  async check(context: TaskContext): Promise<ConfidenceCheckResult> {
    // Execute all checks in parallel
    const checkPromises = this.checkItems.map(async (item): Promise<CheckItemResult> => {
      let passed = false;
      try {
        passed = await item.check(context);
      } catch {
        // Errors are treated as failed checks
        passed = false;
      }
      return {
        name: item.name,
        passed,
        weight: item.weight,
      };
    });

    const items = await Promise.all(checkPromises);

    // Calculate weighted score
    const score = this.calculateScore(items);

    // Determine recommendation
    const recommendation = this.determineRecommendation(score);

    // Determine if passed
    const passed = score >= this.proceedThreshold;

    // Generate explanation if not passed
    const explanation = passed ? undefined : this.generateExplanation(items, score);

    return {
      score,
      passed,
      threshold: this.proceedThreshold,
      items,
      recommendation,
      explanation,
    };
  }

  /**
   * Set custom check items (replaces existing items)
   */
  setCheckItems(items: ConfidenceCheckItem[]): void {
    this.validateCheckItems(items);
    this.checkItems = [...items];
  }

  /**
   * Set custom thresholds
   */
  setThresholds(proceedThreshold: number, alternativesThreshold: number): void {
    this.validateThresholds(proceedThreshold, alternativesThreshold);
    this.proceedThreshold = proceedThreshold;
    this.alternativesThreshold = alternativesThreshold;
  }

  /**
   * Calculate weighted score from check results
   */
  private calculateScore(items: CheckItemResult[]): number {
    const passedWeight = items
      .filter(item => item.passed)
      .reduce((sum, item) => sum + item.weight, 0);

    return Math.round(passedWeight * 100);
  }

  /**
   * Determine recommendation based on score
   */
  private determineRecommendation(score: number): 'proceed' | 'alternatives' | 'stop' {
    if (score >= this.proceedThreshold) {
      return 'proceed';
    }
    if (score >= this.alternativesThreshold) {
      return 'alternatives';
    }
    return 'stop';
  }

  /**
   * Generate explanation for failed checks
   */
  private generateExplanation(items: CheckItemResult[], score: number): string {
    const failedItems = items.filter(item => !item.passed);
    const failedNames = failedItems.map(item => item.name).join(', ');

    return `Score ${score}% is below the ${this.proceedThreshold}% threshold. ` +
      `Failed checks: ${failedNames}`;
  }

  /**
   * Validate check items configuration
   */
  private validateCheckItems(items: ConfidenceCheckItem[]): void {
    // Validate individual weights
    for (const item of items) {
      if (item.weight < 0 || item.weight > 1) {
        throw new Error(
          `Invalid weight ${item.weight} for check item "${item.name}". ` +
          `Weights must be between 0 and 1.`
        );
      }
    }

    // Validate total weight sums to approximately 1.0
    const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
    if (Math.abs(totalWeight - 1.0) > 0.001) {
      throw new Error(
        `Check item weights must sum to 1.0, but got ${totalWeight.toFixed(3)}. ` +
        `Current items: ${items.map(i => `${i.name}(${i.weight})`).join(', ')}`
      );
    }
  }

  /**
   * Validate threshold configuration
   */
  private validateThresholds(proceedThreshold: number, alternativesThreshold: number): void {
    if (proceedThreshold < 0 || proceedThreshold > 100) {
      throw new Error(
        `Proceed threshold must be between 0 and 100, got ${proceedThreshold}`
      );
    }
    if (alternativesThreshold < 0 || alternativesThreshold > 100) {
      throw new Error(
        `Alternatives threshold must be between 0 and 100, got ${alternativesThreshold}`
      );
    }
    if (proceedThreshold <= alternativesThreshold) {
      throw new Error(
        `Proceed threshold (${proceedThreshold}) must be greater than ` +
        `alternatives threshold (${alternativesThreshold})`
      );
    }
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Factory function to create a ConfidenceChecker instance
 *
 * @example
 * ```typescript
 * // Create with defaults
 * const checker = createConfidenceChecker();
 *
 * // Create with custom items
 * const checker = createConfidenceChecker({
 *   checkItems: [
 *     { name: 'custom', weight: 1.0, check: async () => true }
 *   ]
 * });
 *
 * // Create with custom thresholds
 * const checker = createConfidenceChecker({
 *   proceedThreshold: 85,
 *   alternativesThreshold: 65
 * });
 * ```
 */
export function createConfidenceChecker(
  options: ConfidenceCheckerOptions = {}
): ConfidenceChecker {
  return new ConfidenceChecker(options);
}

// ============================================================================
// Barrel Export
// ============================================================================

export default ConfidenceChecker;
