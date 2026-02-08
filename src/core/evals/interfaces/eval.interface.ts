/**
 * Behavioral Evaluation Interfaces
 *
 * Defines types for behavioral evaluation of agent quality.
 * Two-tier severity: ALWAYS_PASSES (100% CI gate) / USUALLY_PASSES (80%+ nightly).
 *
 * @module core/evals/interfaces
 */

// ============================================================================
// Eval Severity & Category
// ============================================================================

/**
 * Eval severity determines CI behavior:
 * - ALWAYS_PASSES: Must pass 100% — blocks PR on failure
 * - USUALLY_PASSES: Target 80%+ — runs nightly, warns on failure
 */
export type EvalSeverity = 'ALWAYS_PASSES' | 'USUALLY_PASSES';

/**
 * Eval categories for organizing test suites
 */
export type EvalCategory =
  | 'code_quality'
  | 'task_completion'
  | 'tool_usage'
  | 'error_handling'
  | 'hallucination';

// ============================================================================
// Eval Definition (YAML-loadable)
// ============================================================================

/**
 * Describes a single behavioral evaluation case
 */
export interface EvalDefinition {
  /** Unique identifier */
  id: string;
  /** Human-readable name */
  name: string;
  /** Eval category */
  category: EvalCategory;
  /** Severity level */
  severity: EvalSeverity;
  /** Input to the agent */
  input: EvalInput;
  /** Expected agent behavior */
  expectedBehavior: ExpectedBehavior;
  /** Execution timeout in ms (default: 30000) */
  timeout: number;
  /** Optional tags for filtering */
  tags?: string[];
}

/**
 * Eval input — describes what to feed the agent
 */
export interface EvalInput {
  /** Task description / user prompt */
  prompt: string;
  /** Initial files to set up in workspace */
  files?: Record<string, string>;
  /** Agent type to target */
  agentType?: string;
  /** Additional context */
  context?: Record<string, unknown>;
}

/**
 * Expected behavior — describes what the agent should do
 */
export interface ExpectedBehavior {
  /** Patterns that must appear in output (regex strings) */
  outputContains?: string[];
  /** Patterns that must NOT appear in output */
  outputExcludes?: string[];
  /** Tools that should be called */
  toolsCalled?: string[];
  /** Tools that should NOT be called */
  toolsNotCalled?: string[];
  /** Files that should be created or modified */
  filesModified?: string[];
  /** Minimum quality score (0-1) */
  minScore?: number;
  /** Custom assertion function name */
  customAssertion?: string;
}

// ============================================================================
// Eval Results
// ============================================================================

/**
 * Result of a single eval execution
 */
export interface EvalResult {
  /** Eval definition ID */
  evalId: string;
  /** Whether the eval passed */
  passed: boolean;
  /** Severity of this eval */
  severity: EvalSeverity;
  /** Score from 0-1 */
  score: number;
  /** Human-readable details */
  details: string;
  /** Execution duration in ms */
  duration: number;
  /** Individual assertion results */
  assertions: AssertionResult[];
  /** Error if eval crashed */
  error?: string;
}

/**
 * Result of a single assertion within an eval
 */
export interface AssertionResult {
  /** What was checked */
  check: string;
  /** Whether it passed */
  passed: boolean;
  /** Expected value */
  expected?: string;
  /** Actual value */
  actual?: string;
}

/**
 * Result of running an entire eval suite
 */
export interface EvalSuiteResult {
  /** Suite name */
  suiteName: string;
  /** Total evals run */
  totalEvals: number;
  /** Number passed */
  passed: number;
  /** Number failed */
  failed: number;
  /** ALWAYS_PASSES pass rate (target: 100%) */
  alwaysPassRate: number;
  /** USUALLY_PASSES pass rate (target: 80%+) */
  usuallyPassRate: number;
  /** Failed evals that are regressions */
  regressions: EvalResult[];
  /** All individual results */
  results: EvalResult[];
  /** Total execution time in ms */
  duration: number;
}

// ============================================================================
// Evaluator Interface
// ============================================================================

/**
 * Context provided to evaluators when scoring
 */
export interface EvalContext {
  /** The eval definition being run */
  definition: EvalDefinition;
  /** Agent output text */
  output: string;
  /** Tool calls made during execution */
  toolCalls: ToolCallRecord[];
  /** Files modified during execution */
  filesModified: string[];
  /** Execution duration in ms */
  duration: number;
  /** Workspace directory */
  workspaceDir: string;
}

/**
 * Record of a tool call made by the agent
 */
export interface ToolCallRecord {
  /** Tool name */
  name: string;
  /** Tool arguments */
  args: Record<string, unknown>;
  /** Tool result */
  result?: string;
  /** Timestamp */
  timestamp: number;
}

/**
 * Interface for pluggable evaluators
 */
export interface IEvaluator {
  /** Evaluator name */
  readonly name: string;
  /** Categories this evaluator handles */
  readonly categories: EvalCategory[];
  /** Evaluate agent behavior against expected behavior */
  evaluate(context: EvalContext): Promise<EvalResult>;
}

// ============================================================================
// EvalRunner Interface
// ============================================================================

/**
 * Behavioral eval runner — loads definitions and executes eval suites
 */
export interface IEvalRunner {
  /** Load eval definitions from a directory or file */
  loadDefinitions(path: string): Promise<EvalDefinition[]>;
  /** Run a single eval */
  runEval(definition: EvalDefinition): Promise<EvalResult>;
  /** Run all evals in a named suite */
  runSuite(suiteName: string): Promise<EvalSuiteResult>;
  /** Run all loaded evals */
  runAll(): Promise<EvalSuiteResult>;
  /** Register a custom evaluator */
  registerEvaluator(evaluator: IEvaluator): void;
}

// ============================================================================
// EvalReporter Interface
// ============================================================================

/**
 * Report format
 */
export type ReportFormat = 'console' | 'json' | 'markdown';

/**
 * Reporter for eval results
 */
export interface IEvalReporter {
  /** Report a single eval result */
  reportResult(result: EvalResult): string;
  /** Report a suite result */
  reportSuite(result: EvalSuiteResult): string;
  /** Set output format */
  setFormat(format: ReportFormat): void;
}

// ============================================================================
// Configuration
// ============================================================================

/**
 * EvalRunner configuration
 */
export interface EvalRunnerConfig {
  /** Directory containing eval definitions */
  definitionsDir: string;
  /** Workspace directory for running evals */
  workspaceDir: string;
  /** Default timeout in ms (default: 30000) */
  defaultTimeout?: number;
  /** Only run evals matching these categories */
  categories?: EvalCategory[];
  /** Only run evals matching these severities */
  severities?: EvalSeverity[];
  /** Only run evals matching these tags */
  tags?: string[];
  /** Enable verbose logging */
  verbose?: boolean;
}

/**
 * Default configuration values
 */
export const DEFAULT_EVAL_CONFIG: Required<
  Omit<EvalRunnerConfig, 'definitionsDir' | 'workspaceDir' | 'categories' | 'severities' | 'tags'>
> = {
  defaultTimeout: 30000,
  verbose: false,
};
