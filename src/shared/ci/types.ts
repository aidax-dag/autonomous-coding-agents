/**
 * CI/CD Integration Types
 *
 * Defines types for CI/CD status checking and test result parsing.
 *
 * Feature: F4.1 - CI/CD Integration
 */

/**
 * CI/CD provider types
 */
export type CIProvider = 'github-actions' | 'circleci' | 'jenkins' | 'gitlab-ci';

/**
 * CI check run status
 */
export type CheckStatus = 'queued' | 'in_progress' | 'completed';

/**
 * CI check run conclusion
 */
export type CheckConclusion =
  | 'success'
  | 'failure'
  | 'neutral'
  | 'cancelled'
  | 'skipped'
  | 'timed_out'
  | 'action_required';

/**
 * Individual check run information
 */
export interface CheckRun {
  /** Check run ID */
  id: number;

  /** Check run name */
  name: string;

  /** Current status */
  status: CheckStatus;

  /** Conclusion (only when status is 'completed') */
  conclusion?: CheckConclusion;

  /** Start time */
  startedAt: string;

  /** Completion time */
  completedAt?: string;

  /** Details URL */
  detailsUrl?: string;

  /** Output summary */
  output?: {
    title: string;
    summary: string;
  };
}

/**
 * Overall CI status for a commit
 */
export interface CIStatus {
  /** CI provider */
  provider: CIProvider;

  /** Commit SHA */
  sha: string;

  /** Overall status */
  status: CheckStatus;

  /** Overall conclusion (when all checks completed) */
  conclusion?: CheckConclusion;

  /** Individual check runs */
  checkRuns: CheckRun[];

  /** Code coverage percentage */
  coverage?: number;

  /** Total check runs */
  totalCount: number;

  /** Completed check runs */
  completedCount: number;
}

/**
 * Test failure information
 */
export interface TestFailure {
  /** Test name/description */
  name: string;

  /** Failure message */
  message: string;

  /** Stack trace */
  stack?: string;

  /** File path */
  file?: string;

  /** Line number */
  line?: number;
}

/**
 * Test results summary
 */
export interface TestResults {
  /** Total number of tests */
  totalTests: number;

  /** Number of passed tests */
  passed: number;

  /** Number of failed tests */
  failed: number;

  /** Number of skipped tests */
  skipped: number;

  /** Total duration in milliseconds */
  duration: number;

  /** Test failures */
  failures: TestFailure[];

  /** Code coverage (if available) */
  coverage?: {
    lines: number;
    statements: number;
    functions: number;
    branches: number;
  };
}

/**
 * CI check configuration
 */
export interface CICheckConfig {
  /** Provider to use */
  provider: CIProvider;

  /** Minimum required coverage percentage */
  minCoverage?: number;

  /** Timeout for waiting (in milliseconds) */
  timeout?: number;

  /** Polling interval (in milliseconds) */
  pollInterval?: number;

  /** Required check names (if empty, all checks must pass) */
  requiredChecks?: string[];
}
