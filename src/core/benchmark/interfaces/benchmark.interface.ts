/**
 * Benchmark Integration Interfaces
 *
 * Defines abstractions for running SWE-bench and other
 * benchmarks to measure agent quality objectively.
 *
 * @module core/benchmark/interfaces
 */

/**
 * Benchmark task definition
 */
export interface BenchmarkTask {
  /** Task ID (e.g., SWE-bench instance ID) */
  id: string;
  /** Repository reference */
  repo: string;
  /** Issue description */
  description: string;
  /** Expected patch or solution pattern */
  expectedPatch?: string;
  /** Test commands to validate */
  testCommands: string[];
  /** Difficulty rating */
  difficulty: 'easy' | 'medium' | 'hard';
  /** Category tags */
  tags: string[];
}

/**
 * Benchmark run result for a single task
 */
export interface BenchmarkResult {
  /** Task ID */
  taskId: string;
  /** Whether the solution passed tests */
  passed: boolean;
  /** Number of tests passed / total */
  testsPassedRatio: number;
  /** Agent-generated patch */
  generatedPatch: string;
  /** Tokens consumed */
  tokensUsed: number;
  /** Time taken in ms */
  durationMs: number;
  /** Number of LLM calls */
  llmCalls: number;
  /** Error if failed */
  error?: string;
}

/**
 * Benchmark suite result
 */
export interface BenchmarkSuiteResult {
  /** Suite name */
  suiteName: string;
  /** Run timestamp */
  runAt: string;
  /** Individual results */
  results: BenchmarkResult[];
  /** Pass rate (0-1) */
  passRate: number;
  /** Average tokens per task */
  avgTokensPerTask: number;
  /** Average duration per task in ms */
  avgDurationMs: number;
  /** Total cost estimate */
  totalCostEstimate: number;
}

/**
 * Benchmark runner interface
 */
export interface IBenchmarkRunner {
  /** Load benchmark tasks from a suite */
  loadSuite(suiteName: string): Promise<BenchmarkTask[]>;

  /** Run a single benchmark task */
  runTask(task: BenchmarkTask): Promise<BenchmarkResult>;

  /** Run an entire suite */
  runSuite(suiteName: string): Promise<BenchmarkSuiteResult>;

  /** Get available suites */
  listSuites(): Promise<string[]>;
}
