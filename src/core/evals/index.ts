/**
 * Behavioral Evaluation Module
 *
 * Provides agent quality measurement through behavioral evals.
 * Two-tier severity: ALWAYS_PASSES (CI gate) / USUALLY_PASSES (nightly).
 *
 * @module core/evals
 */

// ============================================================================
// Interfaces
// ============================================================================

export type {
  EvalSeverity,
  EvalCategory,
  EvalDefinition,
  EvalInput,
  ExpectedBehavior,
  EvalResult,
  AssertionResult,
  EvalSuiteResult,
  EvalContext,
  ToolCallRecord,
  IEvaluator,
  IEvalRunner,
  IEvalReporter,
  ReportFormat,
  EvalRunnerConfig,
} from './interfaces/eval.interface.js';

export { DEFAULT_EVAL_CONFIG } from './interfaces/eval.interface.js';

// ============================================================================
// EvalRunner
// ============================================================================

export {
  EvalRunner,
  createEvalRunner,
  type EvalRunnerOptions,
  type EvalExecutor,
} from './eval-runner.js';

// ============================================================================
// EvalReporter
// ============================================================================

export { EvalReporter, createEvalReporter } from './eval-reporter.js';

// ============================================================================
// Evaluators
// ============================================================================

export {
  CodeQualityEvaluator,
  createCodeQualityEvaluator,
  TaskCompletionEvaluator,
  createTaskCompletionEvaluator,
  ToolUsageEvaluator,
  createToolUsageEvaluator,
} from './evaluators/index.js';
