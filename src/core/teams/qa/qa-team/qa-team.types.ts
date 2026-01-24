/**
 * QA Team Types
 *
 * Type definitions for the QA team.
 *
 * Feature: Team System
 */

import { TeamConfig } from '../../team-types';

/**
 * QA-specific configuration
 */
export interface QATeamConfig extends Partial<TeamConfig> {
  /** Test frameworks supported */
  testFrameworks?: string[];
  /** E2E test tool (playwright, cypress, puppeteer) */
  e2eTool?: string;
  /** Enable test coverage analysis */
  enableCoverage?: boolean;
  /** Coverage threshold percentage */
  coverageThreshold?: number;
  /** Enable visual regression testing */
  enableVisualRegression?: boolean;
  /** Enable accessibility testing */
  enableA11yTesting?: boolean;
  /** Enable performance testing */
  enablePerformanceTesting?: boolean;
  /** Test report format */
  reportFormat?: 'json' | 'html' | 'junit';
  /** Parallel test execution */
  parallelExecution?: boolean;
  /** Max parallel workers */
  maxWorkers?: number;
}

/**
 * Test analysis result
 */
export interface TestAnalysis {
  /** Type of testing needed */
  testType: 'unit' | 'integration' | 'e2e' | 'performance' | 'security' | 'accessibility';
  /** Target component/module to test */
  target: string;
  /** Test scenarios identified */
  scenarios: TestScenario[];
  /** Edge cases to cover */
  edgeCases: string[];
  /** Dependencies to mock */
  mocks: string[];
  /** Priority of testing */
  priority: 'critical' | 'high' | 'medium' | 'low';
  /** Estimated test count */
  estimatedTestCount: number;
}

/**
 * Test scenario
 */
export interface TestScenario {
  /** Scenario name */
  name: string;
  /** Description */
  description: string;
  /** Given conditions */
  given: string[];
  /** When actions */
  when: string[];
  /** Then expectations */
  then: string[];
  /** Data requirements */
  testData?: Record<string, unknown>;
}

/**
 * Generated test file
 */
export interface GeneratedTestFile {
  /** File path */
  path: string;
  /** File content */
  content: string;
  /** Test framework used */
  framework: string;
  /** Number of test cases */
  testCount: number;
  /** Test type */
  type: 'unit' | 'integration' | 'e2e';
}

/**
 * Test execution result
 */
export interface TestExecutionResult {
  /** Total tests */
  total: number;
  /** Passed tests */
  passed: number;
  /** Failed tests */
  failed: number;
  /** Skipped tests */
  skipped: number;
  /** Duration in ms */
  duration: number;
  /** Coverage percentage */
  coverage?: number;
  /** Failed test details */
  failures: TestFailure[];
}

/**
 * Test failure details
 */
export interface TestFailure {
  /** Test name */
  testName: string;
  /** Test file */
  file: string;
  /** Error message */
  error: string;
  /** Stack trace */
  stack?: string;
  /** Expected value */
  expected?: unknown;
  /** Actual value */
  actual?: unknown;
}

/**
 * Test generation result
 */
export interface TestGenerationResult {
  /** Generated test files */
  files: GeneratedTestFile[];
  /** Test plan document */
  testPlan?: string;
  /** Total test cases */
  totalTests: number;
  /** Coverage estimate */
  coverageEstimate: number;
  /** Dependencies identified */
  dependencies: { name: string; version: string; isDev: boolean }[];
}

/**
 * QA Statistics
 */
export interface QAStats {
  testsGenerated: number;
  testsExecuted: number;
  testsPassed: number;
  testsFailed: number;
  bugsFound: number;
  bugsVerified: number;
  coverageAchieved: number;
  totalDuration: number;
}
