/**
 * Benchmark Integration Module
 *
 * @module core/benchmark
 */

export type {
  IBenchmarkRunner,
  BenchmarkTask,
  BenchmarkResult,
  BenchmarkSuiteResult,
} from './interfaces/benchmark.interface';

export {
  BenchmarkRunner,
  createBenchmarkRunner,
  type BenchmarkRunnerConfig,
  type TaskExecutor,
  type SuiteLoader,
} from './benchmark-runner';

export {
  createOrchestratorTaskExecutor,
  type OrchestratorTaskExecutorConfig,
} from './orchestrator-task-executor';
