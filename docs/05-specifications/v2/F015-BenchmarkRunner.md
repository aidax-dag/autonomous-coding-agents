# F015 -- BenchmarkRunner

> SWE-bench style benchmark execution framework with pluggable task executors and suite loaders.

## 1. Purpose

The BenchmarkRunner module provides a framework for running standardized coding benchmarks (modeled after SWE-bench) to objectively measure agent quality. It supports pluggable task executors and suite loaders, enabling integration with different benchmark datasets and execution backends. The runner collects per-task results and aggregates them into suite-level statistics including pass rate, token usage, duration, and cost estimates.

## 2. Interface

**Source**: `src/core/benchmark/interfaces/benchmark.interface.ts`

### Data Types

```typescript
interface BenchmarkTask {
  id: string;                          // e.g., SWE-bench instance ID
  repo: string;                        // repository reference
  description: string;                 // issue description
  expectedPatch?: string;              // expected solution pattern
  testCommands: string[];              // validation commands
  difficulty: 'easy' | 'medium' | 'hard';
  tags: string[];
}

interface BenchmarkResult {
  taskId: string;
  passed: boolean;
  testsPassedRatio: number;            // 0-1
  generatedPatch: string;
  tokensUsed: number;
  durationMs: number;
  llmCalls: number;
  error?: string;
}

interface BenchmarkSuiteResult {
  suiteName: string;
  runAt: string;                       // ISO timestamp
  results: BenchmarkResult[];
  passRate: number;                    // 0-1
  avgTokensPerTask: number;
  avgDurationMs: number;
  totalCostEstimate: number;
}
```

### Runner Interface

```typescript
interface IBenchmarkRunner {
  loadSuite(suiteName: string): Promise<BenchmarkTask[]>;
  runTask(task: BenchmarkTask): Promise<BenchmarkResult>;
  runSuite(suiteName: string): Promise<BenchmarkSuiteResult>;
  listSuites(): Promise<string[]>;
}
```

## 3. Implementation

### BenchmarkRunner (`src/core/benchmark/benchmark-runner.ts`)

- **Class**: `BenchmarkRunner implements IBenchmarkRunner`
- **Config**: `BenchmarkRunnerConfig { executor?, loader?, suites?, costPer1KTokens? }`
- **Pluggable types**:
  - `TaskExecutor = (task: BenchmarkTask) => Promise<BenchmarkResult>` -- executes a single task
  - `SuiteLoader = (suiteName: string) => Promise<BenchmarkTask[]>` -- loads tasks from a suite
- **Constants/Defaults**:
  - Default suites: `['swe-bench-lite']`
  - Default cost per 1K tokens: `0.003`
- **Key behaviors**:
  - `loadSuite()`: Delegates to custom loader if provided; otherwise returns empty array (stub).
  - `runTask()`: Delegates to custom executor if provided; otherwise returns a failure result with `'No executor configured'` error.
  - `runSuite()`: Loads the suite, runs each task sequentially, then aggregates results:
    - `passRate` = passed count / total count (0 if no tasks)
    - `avgTokensPerTask` = total tokens / task count
    - `avgDurationMs` = total duration / task count
    - `totalCostEstimate` = (total tokens / 1000) * costPer1KTokens
  - `listSuites()`: Returns a copy of the configured suite names.
- **Factory**: `createBenchmarkRunner(config?)`

## 4. Dependencies

- **Depends on**: No external module dependencies. Executor and loader are injected via config.
- **Depended on by**: CI/CD pipelines (for automated quality measurement), project analysis tooling, potentially the EvalRunner module (F010) when implemented.

## 5. Testing

- **Test file location**: `tests/unit/core/benchmark/benchmark-runner.test.ts`
- **Test count**: 12 tests across 5 describe blocks
- **Key test scenarios**:
  - Constructor: default config creation
  - loadSuite: empty result with no loader, custom loader returns tasks
  - runTask: failure stub without executor, custom executor returns passing result
  - runSuite: empty suite aggregation (zeros), multi-task aggregation with mixed pass/fail, cost estimation calculation
  - listSuites: default suite name, custom suite names
  - Factory function creation
