/**
 * Eval Module Interfaces
 *
 * Defines abstractions for behavioral evaluation of agent quality.
 * Inspired by gemini-cli's Behavioral Evals pattern, adapted
 * for the ACA multi-agent system.
 *
 * @module core/evals/interfaces
 */

/**
 * Eval severity levels
 * ALWAYS_PASSES: Must pass 100% -- CI blocker
 * USUALLY_PASSES: Expected 80%+ pass rate -- warning only
 */
export type EvalSeverity = 'ALWAYS_PASSES' | 'USUALLY_PASSES';

/**
 * Eval category for grouping and filtering
 */
export type EvalCategory = 'code_quality' | 'tool_usage' | 'error_handling' | 'task_completion';

/**
 * Input provided to the agent under evaluation
 */
export interface EvalInput {
  /** Task description to give the agent */
  taskDescription: string;
  /** Optional context/codebase snippet */
  context?: string;
  /** Expected files to modify */
  expectedFiles?: string[];
}

/**
 * Expected behavior the agent should exhibit
 */
export interface ExpectedBehavior {
  /** Should task succeed? */
  shouldSucceed: boolean;
  /** Required output patterns (regex) */
  outputPatterns?: string[];
  /** Max execution time in ms */
  maxDuration?: number;
  /** Should specific tools be used? */
  expectedToolUsage?: string[];
  /** Min quality score (0-1) */
  minQualityScore?: number;
}

/**
 * A single eval definition -- describes one evaluation scenario
 */
export interface EvalDefinition {
  /** Unique identifier */
  id: string;
  /** Human-readable name */
  name: string;
  /** What this eval verifies */
  description: string;
  /** Grouping category */
  category: EvalCategory;
  /** Pass rate expectation */
  severity: EvalSeverity;
  /** Input to provide the agent */
  input: EvalInput;
  /** Expected behavior to check against */
  expectedBehavior: ExpectedBehavior;
  /** Timeout in ms */
  timeout: number;
  /** Optional tags for filtering */
  tags?: string[];
}

/**
 * A single check within an eval result
 */
export interface EvalCheck {
  /** Check name (e.g. "success_check", "output_pattern: /email/") */
  name: string;
  /** Whether this check passed */
  passed: boolean;
  /** Human-readable explanation */
  message: string;
}

/**
 * Result of running a single eval
 */
export interface EvalResult {
  /** The eval definition ID */
  evalId: string;
  /** The eval definition name */
  evalName: string;
  /** Overall pass/fail */
  passed: boolean;
  /** Severity from the definition */
  severity: EvalSeverity;
  /** Score from 0-1 (ratio of passed checks) */
  score: number;
  /** Human-readable details */
  details: string;
  /** Wall-clock duration in ms */
  duration: number;
  /** Individual checks performed */
  checks: EvalCheck[];
}

/**
 * Aggregated result of running an entire eval suite
 */
export interface EvalSuiteResult {
  /** Suite name */
  suiteName: string;
  /** ISO timestamp of the run */
  timestamp: string;
  /** Total number of evals executed */
  totalEvals: number;
  /** Number that passed */
  passed: number;
  /** Number that failed */
  failed: number;
  /** Number that were skipped */
  skipped: number;
  /** Pass rate for ALWAYS_PASSES evals (target: 100%) */
  alwaysPassRate: number;
  /** Pass rate for USUALLY_PASSES evals (target: 80%+) */
  usuallyPassRate: number;
  /** Individual eval results */
  results: EvalResult[];
  /** Previously passing evals that now fail */
  regressions: EvalResult[];
  /** Total wall-clock duration in ms */
  duration: number;
}

/**
 * Result returned by an EvalExecutor after running a task
 */
export interface EvalExecutionResult {
  /** Whether the task completed successfully */
  success: boolean;
  /** Agent output text */
  output?: string;
  /** Error message if failed */
  error?: string;
  /** Execution duration in ms */
  duration: number;
  /** Tools the agent invoked */
  toolsUsed?: string[];
  /** Files the agent modified */
  filesModified?: string[];
  /** Quality score from 0-1 */
  qualityScore?: number;
}

/**
 * Abstraction for running a task and getting a result.
 * Decouples the eval framework from any specific agent implementation.
 */
export interface EvalExecutor {
  execute(input: EvalInput): Promise<EvalExecutionResult>;
}

/**
 * Eval runner interface
 */
export interface IEvalRunner {
  /** Load eval definitions into the runner */
  loadDefinitions(definitions: EvalDefinition[]): void;
  /** Run a single eval against an executor */
  runEval(definition: EvalDefinition, executor: EvalExecutor): Promise<EvalResult>;
  /** Run all loaded definitions as a suite */
  runSuite(suiteName: string, executor: EvalExecutor): Promise<EvalSuiteResult>;
  /** Get currently loaded definitions */
  getDefinitions(): EvalDefinition[];
}

/**
 * Eval reporter interface
 */
export interface IEvalReporter {
  /** Generate human-readable text report */
  report(result: EvalSuiteResult): string;
  /** Generate JSON report */
  reportJSON(result: EvalSuiteResult): string;
}
