/**
 * Benchmark Runner
 *
 * Executes benchmark tasks (SWE-bench style) and collects results.
 * Uses pluggable task executor and suite loader.
 *
 * @module core/benchmark
 */

import type {
  IBenchmarkRunner,
  BenchmarkTask,
  BenchmarkResult,
  BenchmarkSuiteResult,
} from './interfaces/benchmark.interface';

/**
 * Task executor — pluggable function for running a benchmark task
 */
export type TaskExecutor = (task: BenchmarkTask) => Promise<BenchmarkResult>;

/**
 * Suite loader — pluggable function for loading benchmark suites
 */
export type SuiteLoader = (suiteName: string) => Promise<BenchmarkTask[]>;

/**
 * Benchmark runner config
 */
export interface BenchmarkRunnerConfig {
  /** Custom task executor */
  executor?: TaskExecutor;
  /** Custom suite loader */
  loader?: SuiteLoader;
  /** Available suite names */
  suites?: string[];
  /** Cost per 1K tokens (for estimation) */
  costPer1KTokens?: number;
}

/**
 * Benchmark runner implementation
 */
export class BenchmarkRunner implements IBenchmarkRunner {
  private readonly executor?: TaskExecutor;
  private readonly loader?: SuiteLoader;
  private readonly suites: string[];
  private readonly costPer1KTokens: number;

  constructor(config: BenchmarkRunnerConfig = {}) {
    this.executor = config.executor;
    this.loader = config.loader;
    this.suites = config.suites ?? ['swe-bench-lite'];
    this.costPer1KTokens = config.costPer1KTokens ?? 0.003;
  }

  async loadSuite(suiteName: string): Promise<BenchmarkTask[]> {
    if (this.loader) {
      return this.loader(suiteName);
    }

    // Default stub — returns empty task list
    return [];
  }

  async runTask(task: BenchmarkTask): Promise<BenchmarkResult> {
    if (this.executor) {
      return this.executor(task);
    }

    // Default stub — reports failure (no actual execution)
    return {
      taskId: task.id,
      passed: false,
      testsPassedRatio: 0,
      generatedPatch: '',
      tokensUsed: 0,
      durationMs: 0,
      llmCalls: 0,
      error: 'No executor configured',
    };
  }

  async runSuite(suiteName: string): Promise<BenchmarkSuiteResult> {
    const tasks = await this.loadSuite(suiteName);
    const results: BenchmarkResult[] = [];

    for (const task of tasks) {
      const result = await this.runTask(task);
      results.push(result);
    }

    const passed = results.filter((r) => r.passed).length;
    const totalTokens = results.reduce((sum, r) => sum + r.tokensUsed, 0);
    const totalDuration = results.reduce((sum, r) => sum + r.durationMs, 0);

    return {
      suiteName,
      runAt: new Date().toISOString(),
      results,
      passRate: results.length > 0 ? passed / results.length : 0,
      avgTokensPerTask: results.length > 0 ? totalTokens / results.length : 0,
      avgDurationMs: results.length > 0 ? totalDuration / results.length : 0,
      totalCostEstimate: (totalTokens / 1000) * this.costPer1KTokens,
    };
  }

  async listSuites(): Promise<string[]> {
    return [...this.suites];
  }
}

/**
 * Factory function
 */
export function createBenchmarkRunner(config?: BenchmarkRunnerConfig): BenchmarkRunner {
  return new BenchmarkRunner(config);
}
