/**
 * Validation Module
 *
 * Pre-execution and post-execution validation utilities.
 *
 * - ConfidenceChecker (F001): Pre-execution confidence checking
 * - SelfCheckProtocol (F002): Post-execution self-check system
 */

// ============================================================================
// F001: ConfidenceChecker
// ============================================================================

export {
  // Class
  ConfidenceChecker,
  // Factory
  createConfidenceChecker,
  // Constants
  DEFAULT_CHECK_ITEMS,
  // Types
  type TaskContext,
  type ConfidenceCheckItem,
  type CheckItemResult,
  type ConfidenceCheckResult,
  type IConfidenceChecker,
  type ConfidenceCheckerOptions,
} from './confidence-checker';

export {
  DEFAULT_PROCEED_THRESHOLD,
  DEFAULT_ALTERNATIVES_THRESHOLD,
  DANGER_SIGNAL_CONTEXT_CHARS,
} from './constants';

// ============================================================================
// F002: SelfCheckProtocol
// ============================================================================

export {
  // Class
  SelfCheckProtocol,
  // Factory
  createSelfCheckProtocol,
  createDefaultSelfCheckProtocol,
  // Constants
  SELF_CHECK_QUESTIONS,
  DANGER_SIGNALS,
  EXTENDED_DANGER_SIGNALS,
  // Types
  type SelfCheckProtocolOptions,
} from './self-check-protocol';

// ============================================================================
// Shared Interfaces (from validation.interface.ts)
// ============================================================================

export type {
  Evidence,
  SelfCheckQuestion,
  DangerSignal,
  SelfCheckResult,
  ISelfCheckProtocol,
  GoalDefinition,
  GoalBackwardResult,
  IGoalBackwardVerifier,
} from './interfaces/validation.interface';

export { VerificationStage } from './interfaces/validation.interface';

// ============================================================================
// F003: GoalBackwardVerifier
// ============================================================================

// ============================================================================
// P1-2: Enhanced Verification
// ============================================================================

export type {
  StubSeverity,
  StubDetection,
  StubDetectionResult,
  StubDetectionReport,
  FileVerificationReport,
  StageReport,
  VerificationReport,
  VerificationHook,
  IVerificationPipeline,
} from './interfaces/verification-report.interface';

export {
  StubDetector,
  createStubDetector,
  detectStubs,
  STUB_PATTERNS,
  type StubPattern,
  type DetectStubsOptions,
} from './stub-detector';

export {
  VerificationReportBuilder,
  createVerificationReportBuilder,
} from './verification-report';

export {
  VerificationPipeline,
  createVerificationPipeline,
} from './verification-pipeline';

// ============================================================================
// F003: GoalBackwardVerifier
// ============================================================================

export {
  // Class
  GoalBackwardVerifier,
  // Factory
  createGoalBackwardVerifier,
  // Constants
  PLACEHOLDER_PATTERNS,
  MIN_COMPLEXITY_THRESHOLDS,
  // Types
  type GoalBackwardVerifierOptions,
  type ComplexityThresholds,
} from './goal-backward-verifier';
