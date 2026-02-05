/**
 * Validation Module Interfaces
 *
 * Provides pre-execution and post-execution validation systems.
 *
 * @module core/validation/interfaces
 */

// ============================================================================
// Confidence Checker Interfaces
// ============================================================================

/**
 * Task context for confidence checking
 */
export interface TaskContext {
  taskId: string;
  taskType: string;
  description: string;
  files?: string[];
  dependencies?: string[];
  complexity?: 'simple' | 'moderate' | 'complex';
}

/**
 * Individual confidence check item
 */
export interface ConfidenceCheckItem {
  /** Unique identifier for the check */
  name: string;
  /** Weight in final score (0-1) */
  weight: number;
  /** Check function */
  check: (context: TaskContext) => Promise<boolean>;
  /** Description for logging */
  description?: string;
}

/**
 * Result of confidence check
 */
export interface ConfidenceCheckResult {
  /** Overall confidence score (0-100) */
  score: number;
  /** Whether check passed threshold */
  passed: boolean;
  /** Threshold used */
  threshold: number;
  /** Individual check results */
  items: {
    name: string;
    passed: boolean;
    weight: number;
  }[];
  /** Recommended action */
  recommendation: 'proceed' | 'alternatives' | 'stop';
  /** Explanation for recommendation */
  explanation?: string;
}

/**
 * Confidence checker interface
 */
export interface IConfidenceChecker {
  /**
   * Run confidence check before task execution
   * @param context Task context
   * @returns Confidence check result
   */
  check(context: TaskContext): Promise<ConfidenceCheckResult>;

  /**
   * Configure check items
   */
  setCheckItems(items: ConfidenceCheckItem[]): void;

  /**
   * Set thresholds
   * @param proceed Threshold to proceed immediately (default: 90)
   * @param alternatives Threshold to suggest alternatives (default: 70)
   */
  setThresholds(proceed: number, alternatives: number): void;
}

// ============================================================================
// Self Check Protocol Interfaces
// ============================================================================

/**
 * Evidence for self-check validation
 */
export interface Evidence {
  testOutput?: string;
  testsPassed?: boolean;
  requirementsList?: { requirement: string; met: boolean }[];
  assumptions?: { assumption: string; verified: boolean; source?: string }[];
  evidence?: { type: string; content: string }[];
  codeChanges?: { file: string; diff: string }[];
}

/**
 * Self-check question definition
 */
export interface SelfCheckQuestion {
  /** Unique identifier */
  id: string;
  /** Question text */
  question: string;
  /** Validator function */
  validator: (evidence: Evidence) => Promise<boolean>;
  /** Whether this check is required */
  required: boolean;
}

/**
 * Danger signal pattern
 */
export interface DangerSignal {
  /** Pattern to match */
  pattern: RegExp;
  /** Severity level */
  severity: 'warning' | 'error';
  /** Human-readable message */
  message: string;
}

/**
 * Result of self-check
 */
export interface SelfCheckResult {
  /** Overall pass/fail */
  passed: boolean;
  /** Individual question results */
  questions: {
    id: string;
    passed: boolean;
    evidence?: string;
  }[];
  /** Detected danger signals */
  dangerSignals: {
    signal: string;
    found: boolean;
    context?: string;
  }[];
  /** Goal verification result */
  goalVerification?: GoalBackwardResult;
}

/**
 * Self-check protocol interface
 */
export interface ISelfCheckProtocol {
  /**
   * Run self-check after task execution
   * @param evidence Evidence from execution
   * @returns Self-check result
   */
  check(evidence: Evidence): Promise<SelfCheckResult>;

  /**
   * Scan text for danger signals
   * @param text Text to scan
   * @returns Found danger signals
   */
  scanForDangerSignals(text: string): { signal: string; context: string }[];

  /**
   * Configure questions
   */
  setQuestions(questions: SelfCheckQuestion[]): void;

  /**
   * Configure danger signals
   */
  setDangerSignals(signals: DangerSignal[]): void;
}

// ============================================================================
// Goal Backward Verifier Interfaces
// ============================================================================

/**
 * Verification stages
 */
export enum VerificationStage {
  /** Stage 1: File exists at expected path */
  EXISTS = 'exists',
  /** Stage 2: Implementation is substantive, not placeholder */
  SUBSTANTIVE = 'substantive',
  /** Stage 3: Connected to system (imports, routing, etc.) */
  WIRED = 'wired',
}

/**
 * Goal definition for verification
 */
export interface GoalDefinition {
  /** Goal description */
  description: string;
  /** Expected files/paths */
  expectedPaths: string[];
  /** Expected imports/connections */
  expectedConnections?: string[];
  /** Expected test coverage */
  expectedTests?: string[];
}

/**
 * Result of goal-backward verification
 */
export interface GoalBackwardResult {
  /** Overall pass/fail */
  passed: boolean;
  /** Stage-by-stage results */
  stages: {
    stage: VerificationStage;
    passed: boolean;
    details: string;
    checkedPaths?: string[];
  }[];
}

/**
 * Goal backward verifier interface
 */
export interface IGoalBackwardVerifier {
  /**
   * Stage 1: Verify files exist at expected paths
   */
  verifyExists(paths: string[]): Promise<boolean>;

  /**
   * Stage 2: Verify implementation is substantive
   * - No TODO/placeholder
   * - Actual logic present
   */
  verifySubstantive(paths: string[]): Promise<boolean>;

  /**
   * Stage 3: Verify connected to system
   * - Import tracking
   * - Route verification
   * - Test coverage
   */
  verifyWired(paths: string[]): Promise<boolean>;

  /**
   * Run all 3 stages
   */
  verify(goal: GoalDefinition): Promise<GoalBackwardResult>;
}
