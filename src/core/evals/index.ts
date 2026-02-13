/**
 * Evals Module
 *
 * Behavioral evaluation framework for measuring agent quality.
 * Based on gemini-cli's Behavioral Evals pattern, adapted for ACA.
 *
 * @module core/evals
 */

export type {
  EvalSeverity,
  EvalCategory,
  EvalInput,
  ExpectedBehavior,
  EvalDefinition,
  EvalCheck,
  EvalResult,
  EvalSuiteResult,
  EvalExecutionResult,
  EvalExecutor,
  IEvalRunner,
  IEvalReporter,
} from './interfaces/eval.interface';

export { EvalRunner, createEvalRunner } from './eval-runner';
export { EvalReporter, createEvalReporter } from './eval-reporter';

export {
  CODE_QUALITY_EVAL,
  TASK_COMPLETION_EVAL,
  TOOL_USAGE_EVAL,
  ALL_EVAL_DEFINITIONS,
} from './definitions/index';
