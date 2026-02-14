/**
 * Autonomous Debugging Loop - Type Definitions
 *
 * Provides interfaces for the debugging loop system that detects errors,
 * analyzes root causes, generates hypotheses, tests fixes, and learns
 * from outcomes.
 *
 * @module core/debugging/types
 */

// ============================================================================
// Debugging Context
// ============================================================================

/**
 * Full context for a debugging session, including the error, its
 * classification, and any previous attempts to resolve it.
 */
export interface DebuggingContext {
  /** Task identifier that triggered the debugging session */
  taskId: string;
  /** The original error to diagnose */
  error: Error;
  /** Classification from the ErrorEscalator */
  errorClassification: {
    severity: string;
    action: string;
    category: string;
  };
  /** Raw stack trace string */
  stackTrace: string;
  /** Files related to the error (extracted from stack trace or context) */
  relatedFiles: string[];
  /** Previous debugging attempts for this error */
  previousAttempts: DebuggingAttempt[];
}

// ============================================================================
// Debugging Attempt
// ============================================================================

/**
 * Record of a single hypothesis test during a debugging session.
 */
export interface DebuggingAttempt {
  /** The hypothesis that was tested */
  hypothesis: string;
  /** The action taken to test the hypothesis */
  action: string;
  /** Outcome of the test */
  result: 'success' | 'failure' | 'inconclusive';
  /** Evidence gathered during the test */
  evidence: string[];
  /** Duration of the test in milliseconds */
  duration: number;
}

// ============================================================================
// Hypothesis
// ============================================================================

/** Categories of error hypotheses */
export type HypothesisCategory =
  | 'code-error'
  | 'config-error'
  | 'dependency-error'
  | 'runtime-error'
  | 'logic-error';

/**
 * A hypothesis about the root cause of an error, including a suggested
 * fix and a strategy for validating the hypothesis.
 */
export interface Hypothesis {
  /** Unique identifier for this hypothesis */
  id: string;
  /** Human-readable description of what might be wrong */
  description: string;
  /** Confidence score from 0 to 1 */
  confidence: number;
  /** Category of the hypothesized error */
  category: HypothesisCategory;
  /** Suggested fix to apply */
  suggestedFix: string;
  /** Files related to this hypothesis */
  relatedFiles: string[];
  /** Strategy for testing whether this hypothesis is correct */
  testStrategy: string;
}

// ============================================================================
// Debugging Result
// ============================================================================

/**
 * Final result of a debugging loop session, summarizing all attempts
 * and whether a root cause was identified and fixed.
 */
export interface DebuggingResult {
  /** Task identifier for this debugging session */
  taskId: string;
  /** Identified root cause, or null if diagnosis failed */
  rootCause: string | null;
  /** Total number of hypotheses tested */
  hypothesesTested: number;
  /** The hypothesis that led to a successful fix, or null */
  successfulFix: Hypothesis | null;
  /** All debugging attempts made during the session */
  attempts: DebuggingAttempt[];
  /** Total duration of the debugging session in milliseconds */
  totalDuration: number;
  /** Whether the outcome was recorded in the learning system */
  learned: boolean;
}

// ============================================================================
// Configuration
// ============================================================================

/**
 * Configuration for the debugging loop.
 */
export interface DebuggingLoopConfig {
  /** Maximum number of hypotheses to test per session (default: 3) */
  maxDepth: number;
  /** Maximum time in milliseconds before the loop times out (default: 30000) */
  timeoutMs: number;
  /** Minimum confidence threshold for a hypothesis to be tested (default: 0.5) */
  minConfidence: number;
  /** Whether to automatically record outcomes in the learning system (default: true) */
  autoLearn: boolean;
}

/**
 * Default debugging loop configuration.
 */
export const DEFAULT_DEBUGGING_CONFIG: DebuggingLoopConfig = {
  maxDepth: 3,
  timeoutMs: 30000,
  minConfidence: 0.5,
  autoLearn: true,
};
