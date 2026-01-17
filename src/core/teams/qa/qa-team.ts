/**
 * QA Team
 *
 * Specialized team for quality assurance and testing.
 * Handles test planning, test generation, test execution, and bug tracking.
 *
 * Feature: Team System
 */

import { v4 as uuidv4 } from 'uuid';
import {
  TeamType,
  TeamCapability,
  TeamConfig,
  TaskDocument,
  TaskResult,
  TaskArtifact,
  AgentRole,
  TaskPriority,
  TEAM_CAPABILITIES,
} from '../team-types';
import { BaseTeam, createRole } from '../base-team';

// ============================================================================
// Types
// ============================================================================

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

// ============================================================================
// Default Configuration
// ============================================================================

export const DEFAULT_QA_CONFIG: QATeamConfig = {
  testFrameworks: ['jest', 'vitest'],
  e2eTool: 'playwright',
  enableCoverage: true,
  coverageThreshold: 80,
  enableVisualRegression: false,
  enableA11yTesting: true,
  enablePerformanceTesting: false,
  reportFormat: 'json',
  parallelExecution: true,
  maxWorkers: 4,
};

// ============================================================================
// QA Team Implementation
// ============================================================================

/**
 * QA Team for testing and quality assurance
 */
export class QATeam extends BaseTeam {
  protected qaConfig: QATeamConfig & Required<Omit<QATeamConfig, keyof TeamConfig>>;

  // Statistics
  protected qaStats = {
    testsGenerated: 0,
    testsExecuted: 0,
    testsPassed: 0,
    testsFailed: 0,
    bugsFound: 0,
    bugsVerified: 0,
    coverageAchieved: 0,
    totalDuration: 0,
  };

  constructor(config: QATeamConfig = {}) {
    const teamConfig: TeamConfig = {
      id: config.id || `qa-team-${uuidv4().slice(0, 8)}`,
      name: config.name || 'QA Team',
      type: TeamType.QA,
      capabilities: TEAM_CAPABILITIES[TeamType.QA],
      maxConcurrentTasks: config.maxConcurrentTasks || 5,
      taskTimeoutMs: config.taskTimeoutMs || 600000, // 10 minutes for test execution
      autoRetry: config.autoRetry ?? true,
      maxRetries: config.maxRetries || 2,
      metadata: config.metadata || {},
    };

    super(teamConfig);

    this.qaConfig = {
      ...DEFAULT_QA_CONFIG,
      ...config,
      id: teamConfig.id,
      name: teamConfig.name,
      type: teamConfig.type,
      capabilities: teamConfig.capabilities,
      maxConcurrentTasks: teamConfig.maxConcurrentTasks,
      taskTimeoutMs: teamConfig.taskTimeoutMs,
      autoRetry: teamConfig.autoRetry,
      maxRetries: teamConfig.maxRetries,
      metadata: teamConfig.metadata,
      testFrameworks: config.testFrameworks || DEFAULT_QA_CONFIG.testFrameworks!,
      e2eTool: config.e2eTool || DEFAULT_QA_CONFIG.e2eTool!,
      enableCoverage: config.enableCoverage ?? DEFAULT_QA_CONFIG.enableCoverage!,
      coverageThreshold: config.coverageThreshold || DEFAULT_QA_CONFIG.coverageThreshold!,
      enableVisualRegression: config.enableVisualRegression ?? DEFAULT_QA_CONFIG.enableVisualRegression!,
      enableA11yTesting: config.enableA11yTesting ?? DEFAULT_QA_CONFIG.enableA11yTesting!,
      enablePerformanceTesting: config.enablePerformanceTesting ?? DEFAULT_QA_CONFIG.enablePerformanceTesting!,
      reportFormat: config.reportFormat || DEFAULT_QA_CONFIG.reportFormat!,
      parallelExecution: config.parallelExecution ?? DEFAULT_QA_CONFIG.parallelExecution!,
      maxWorkers: config.maxWorkers || DEFAULT_QA_CONFIG.maxWorkers!,
    };
  }

  // ============================================================================
  // Agent Roles
  // ============================================================================

  protected getAgentRoles(): AgentRole[] {
    return [
      createRole(
        'Test Planner',
        'Plans test strategies and identifies test scenarios',
        `You are a Test Planner responsible for:
- Analyzing requirements and identifying testable scenarios
- Creating comprehensive test plans with coverage goals
- Prioritizing test cases based on risk and impact
- Identifying edge cases and boundary conditions
- Planning test data requirements

Follow testing best practices:
- Test pyramid (unit > integration > e2e)
- Behavior-driven development (BDD) style scenarios
- Risk-based testing prioritization
- Complete coverage of acceptance criteria`,
        { capabilities: [TeamCapability.TEST_GENERATION], tools: ['read', 'analyze', 'write'] },
      ),

      createRole(
        'Unit Test Writer',
        'Writes unit tests for individual functions and components',
        `You are a Unit Test Writer responsible for:
- Writing comprehensive unit tests for functions and classes
- Creating test fixtures and mocks
- Testing edge cases and error conditions
- Ensuring high code coverage
- Following testing best practices

Use ${this.qaConfig.testFrameworks.join(' or ')} for unit tests.
Follow AAA pattern: Arrange, Act, Assert.
Write descriptive test names that explain the behavior being tested.`,
        { capabilities: [TeamCapability.TEST_GENERATION, TeamCapability.CODE_GENERATION], tools: ['read', 'write', 'edit'] },
      ),

      createRole(
        'Integration Test Writer',
        'Writes integration tests for component interactions',
        `You are an Integration Test Writer responsible for:
- Testing component integrations and API contracts
- Verifying database interactions and external services
- Testing error handling and recovery scenarios
- Creating integration test suites with proper setup/teardown
- Managing test databases and external dependencies

Focus on testing the boundaries between components.
Use realistic test data and scenarios.
Ensure proper isolation between tests.`,
        { capabilities: [TeamCapability.TEST_GENERATION, TeamCapability.CODE_GENERATION], tools: ['read', 'write', 'edit', 'shell'] },
      ),

      createRole(
        'E2E Test Writer',
        'Writes end-to-end tests for user workflows',
        `You are an E2E Test Writer using ${this.qaConfig.e2eTool} responsible for:
- Writing end-to-end tests for critical user journeys
- Testing full application workflows from UI to database
- Implementing visual regression tests
- Testing accessibility compliance
- Creating reliable and maintainable E2E test suites

Use Page Object Model pattern for maintainability.
Focus on critical user paths and business workflows.
Handle async operations and timing properly.`,
        { capabilities: [TeamCapability.TEST_GENERATION, TeamCapability.TEST_EXECUTION], tools: ['read', 'write', 'edit', 'shell', 'browser'] },
      ),

      createRole(
        'Test Executor',
        'Executes tests and analyzes results',
        `You are a Test Executor responsible for:
- Running test suites and collecting results
- Analyzing test failures and identifying root causes
- Generating coverage reports
- Performance benchmarking
- Creating test execution reports

Provide detailed failure analysis with reproduction steps.
Track test flakiness and reliability.
Monitor and report on coverage trends.`,
        { capabilities: [TeamCapability.TEST_EXECUTION, TeamCapability.DEBUGGING], tools: ['shell', 'read', 'analyze'] },
      ),

      createRole(
        'Bug Tracker',
        'Tracks bugs, verifies fixes, and manages defects',
        `You are a Bug Tracker responsible for:
- Documenting bugs with clear reproduction steps
- Classifying bugs by severity and priority
- Verifying bug fixes with regression tests
- Tracking bug resolution metrics
- Maintaining defect documentation

Create clear, actionable bug reports.
Link bugs to test cases and requirements.
Ensure proper fix verification before closure.`,
        { capabilities: [TeamCapability.DEBUGGING, TeamCapability.DOCUMENTATION], tools: ['read', 'write', 'analyze'] },
      ),
    ];
  }

  // ============================================================================
  // Task Processing
  // ============================================================================

  protected async processTask(task: TaskDocument): Promise<TaskResult> {
    const startTime = Date.now();
    const taskType = this.determineTaskType(task);

    try {
      let result: TestGenerationResult;

      switch (taskType) {
        case 'unit-test':
          result = await this.processUnitTestTask(task);
          break;
        case 'integration-test':
          result = await this.processIntegrationTestTask(task);
          break;
        case 'e2e-test':
          result = await this.processE2ETestTask(task);
          break;
        case 'test-plan':
          result = await this.processTestPlanTask(task);
          break;
        case 'test-execution':
          result = await this.processTestExecutionTask(task);
          break;
        case 'bug-verification':
          result = await this.processBugVerificationTask(task);
          break;
        case 'coverage-analysis':
          result = await this.processCoverageAnalysisTask(task);
          break;
        case 'accessibility-test':
          result = await this.processAccessibilityTestTask(task);
          break;
        case 'performance-test':
          result = await this.processPerformanceTestTask(task);
          break;
        default:
          result = await this.processGenericTestTask(task);
      }

      const duration = Date.now() - startTime;
      this.qaStats.testsGenerated += result.totalTests;
      this.qaStats.totalDuration += duration;

      return {
        taskId: task.id,
        success: true,
        outputs: {
          files: result.files,
          testPlan: result.testPlan,
          totalTests: result.totalTests,
          coverageEstimate: result.coverageEstimate,
        },
        subtasks: [],
        artifacts: this.createTestArtifacts(result),
        duration,
        tokensUsed: 0,
      };
    } catch (error) {
      return {
        taskId: task.id,
        success: false,
        outputs: {},
        subtasks: [],
        artifacts: [],
        duration: Date.now() - startTime,
        tokensUsed: 0,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  protected determineTaskType(task: TaskDocument): string {
    const title = task.title.toLowerCase();
    const description = task.description.toLowerCase();
    const combined = `${title} ${description}`;

    if (combined.includes('unit test')) return 'unit-test';
    if (combined.includes('integration test')) return 'integration-test';
    if (combined.includes('e2e') || combined.includes('end-to-end') || combined.includes('end to end')) return 'e2e-test';
    if (combined.includes('test plan') || combined.includes('test strategy')) return 'test-plan';
    if (combined.includes('execute') || combined.includes('run test')) return 'test-execution';
    if (combined.includes('bug') || combined.includes('verify fix')) return 'bug-verification';
    if (combined.includes('coverage')) return 'coverage-analysis';
    if (combined.includes('accessibility') || combined.includes('a11y')) return 'accessibility-test';
    if (combined.includes('performance') || combined.includes('benchmark')) return 'performance-test';

    return 'generic';
  }

  // ============================================================================
  // Task Type Processors
  // ============================================================================

  protected async processUnitTestTask(task: TaskDocument): Promise<TestGenerationResult> {
    const analysis = this.analyzeForUnitTests(task);
    const files: GeneratedTestFile[] = [];
    const dependencies: { name: string; version: string; isDev: boolean }[] = [];

    // Generate unit test file
    const testFile = this.generateUnitTestFile(task, analysis);
    files.push(testFile);

    // Add test dependencies
    dependencies.push(...this.detectTestDependencies('unit'));

    return {
      files,
      testPlan: this.generateTestPlanDocument(analysis),
      totalTests: testFile.testCount,
      coverageEstimate: 85,
      dependencies,
    };
  }

  protected async processIntegrationTestTask(task: TaskDocument): Promise<TestGenerationResult> {
    const analysis = this.analyzeForIntegrationTests(task);
    const files: GeneratedTestFile[] = [];
    const dependencies: { name: string; version: string; isDev: boolean }[] = [];

    // Generate integration test file
    const testFile = this.generateIntegrationTestFile(task, analysis);
    files.push(testFile);

    // Generate test utilities
    const utilsFile = this.generateTestUtilities(task);
    files.push(utilsFile);

    // Add test dependencies
    dependencies.push(...this.detectTestDependencies('integration'));

    return {
      files,
      testPlan: this.generateTestPlanDocument(analysis),
      totalTests: testFile.testCount,
      coverageEstimate: 70,
      dependencies,
    };
  }

  protected async processE2ETestTask(task: TaskDocument): Promise<TestGenerationResult> {
    const analysis = this.analyzeForE2ETests(task);
    const files: GeneratedTestFile[] = [];
    const dependencies: { name: string; version: string; isDev: boolean }[] = [];

    // Generate E2E test file
    const testFile = this.generateE2ETestFile(task, analysis);
    files.push(testFile);

    // Generate page objects
    const pageObjects = this.generatePageObjects(task, analysis);
    files.push(...pageObjects);

    // Generate test fixtures
    const fixtures = this.generateTestFixtures(task);
    files.push(fixtures);

    // Add E2E dependencies
    dependencies.push(...this.detectTestDependencies('e2e'));

    return {
      files,
      testPlan: this.generateTestPlanDocument(analysis),
      totalTests: testFile.testCount,
      coverageEstimate: 60,
      dependencies,
    };
  }

  protected async processTestPlanTask(task: TaskDocument): Promise<TestGenerationResult> {
    const analysis = this.analyzeTestRequirements(task);

    const testPlanContent = this.generateComprehensiveTestPlan(task, analysis);

    return {
      files: [{
        path: `docs/test-plans/${this.toKebabCase(task.title)}-test-plan.md`,
        content: testPlanContent,
        framework: 'markdown',
        testCount: 0,
        type: 'unit',
      }],
      testPlan: testPlanContent,
      totalTests: analysis.estimatedTestCount,
      coverageEstimate: 0,
      dependencies: [],
    };
  }

  protected async processTestExecutionTask(task: TaskDocument): Promise<TestGenerationResult> {
    // Generate test execution report
    const report = this.generateTestExecutionReport(task);

    return {
      files: [{
        path: `reports/test-execution-${Date.now()}.${this.qaConfig.reportFormat}`,
        content: report,
        framework: 'report',
        testCount: 0,
        type: 'unit',
      }],
      totalTests: 0,
      coverageEstimate: 0,
      dependencies: [],
    };
  }

  protected async processBugVerificationTask(task: TaskDocument): Promise<TestGenerationResult> {
    const testFile = this.generateBugVerificationTest(task);

    this.qaStats.bugsVerified++;

    return {
      files: [testFile],
      totalTests: testFile.testCount,
      coverageEstimate: 0,
      dependencies: this.detectTestDependencies('unit'),
    };
  }

  protected async processCoverageAnalysisTask(task: TaskDocument): Promise<TestGenerationResult> {
    const coverageReport = this.generateCoverageReport(task);

    return {
      files: [{
        path: 'reports/coverage-analysis.md',
        content: coverageReport,
        framework: 'report',
        testCount: 0,
        type: 'unit',
      }],
      totalTests: 0,
      coverageEstimate: this.qaStats.coverageAchieved,
      dependencies: [],
    };
  }

  protected async processAccessibilityTestTask(task: TaskDocument): Promise<TestGenerationResult> {
    const testFile = this.generateAccessibilityTests(task);

    return {
      files: [testFile],
      totalTests: testFile.testCount,
      coverageEstimate: 0,
      dependencies: [
        { name: '@axe-core/playwright', version: '^4.8.0', isDev: true },
        { name: 'axe-core', version: '^4.8.0', isDev: true },
      ],
    };
  }

  protected async processPerformanceTestTask(task: TaskDocument): Promise<TestGenerationResult> {
    const testFile = this.generatePerformanceTests(task);

    return {
      files: [testFile],
      totalTests: testFile.testCount,
      coverageEstimate: 0,
      dependencies: [
        { name: 'lighthouse', version: '^11.0.0', isDev: true },
        { name: 'autocannon', version: '^7.14.0', isDev: true },
      ],
    };
  }

  protected async processGenericTestTask(task: TaskDocument): Promise<TestGenerationResult> {
    // Analyze and determine best test type
    const analysis = this.analyzeTestRequirements(task);

    // Generate appropriate tests based on analysis
    const files: GeneratedTestFile[] = [];

    if (analysis.testType === 'unit') {
      files.push(this.generateUnitTestFile(task, analysis));
    } else if (analysis.testType === 'integration') {
      files.push(this.generateIntegrationTestFile(task, analysis));
    } else {
      files.push(this.generateE2ETestFile(task, analysis));
    }

    return {
      files,
      testPlan: this.generateTestPlanDocument(analysis),
      totalTests: files.reduce((sum, f) => sum + f.testCount, 0),
      coverageEstimate: 75,
      dependencies: this.detectTestDependencies(analysis.testType),
    };
  }

  // ============================================================================
  // Analysis Methods
  // ============================================================================

  protected analyzeTestRequirements(task: TaskDocument): TestAnalysis {
    const description = task.description.toLowerCase();

    // Determine test type
    let testType: TestAnalysis['testType'] = 'unit';
    if (description.includes('api') || description.includes('database') || description.includes('service')) {
      testType = 'integration';
    }
    if (description.includes('user') || description.includes('workflow') || description.includes('journey')) {
      testType = 'e2e';
    }
    if (description.includes('performance') || description.includes('load')) {
      testType = 'performance';
    }
    if (description.includes('security') || description.includes('auth')) {
      testType = 'security';
    }
    if (description.includes('accessibility') || description.includes('a11y')) {
      testType = 'accessibility';
    }

    // Extract target
    const target = this.extractTestTarget(task);

    // Identify scenarios
    const scenarios = this.extractTestScenarios(task);

    // Identify edge cases
    const edgeCases = this.extractEdgeCases(task);

    // Identify mocks
    const mocks = this.extractMockRequirements(task);

    // Determine priority
    const priority = this.determinePriority(task);

    return {
      testType,
      target,
      scenarios,
      edgeCases,
      mocks,
      priority,
      estimatedTestCount: scenarios.length + edgeCases.length,
    };
  }

  protected analyzeForUnitTests(task: TaskDocument): TestAnalysis {
    return {
      ...this.analyzeTestRequirements(task),
      testType: 'unit',
    };
  }

  protected analyzeForIntegrationTests(task: TaskDocument): TestAnalysis {
    return {
      ...this.analyzeTestRequirements(task),
      testType: 'integration',
    };
  }

  protected analyzeForE2ETests(task: TaskDocument): TestAnalysis {
    return {
      ...this.analyzeTestRequirements(task),
      testType: 'e2e',
    };
  }

  protected extractTestTarget(_task: TaskDocument): string {
    // Extract the main target from task title
    const title = _task.title
      .replace(/test(s)?|write|create|generate/gi, '')
      .replace(/for|of/gi, '')
      .trim();
    return title || 'Component';
  }

  protected extractTestScenarios(task: TaskDocument): TestScenario[] {
    const scenarios: TestScenario[] = [];

    // Look for acceptance criteria
    if (task.acceptanceCriteria && task.acceptanceCriteria.length > 0) {
      for (const criteria of task.acceptanceCriteria) {
        scenarios.push({
          name: `should ${criteria.toLowerCase().replace(/^(should|must|can)\s+/i, '')}`,
          description: criteria,
          given: ['the system is initialized'],
          when: ['the action is performed'],
          then: [criteria],
        });
      }
    }

    // Default scenarios if none found
    if (scenarios.length === 0) {
      scenarios.push(
        {
          name: 'should handle happy path',
          description: 'Test successful operation',
          given: ['valid input'],
          when: ['operation is performed'],
          then: ['expected output is returned'],
        },
        {
          name: 'should handle error cases',
          description: 'Test error handling',
          given: ['invalid input'],
          when: ['operation is performed'],
          then: ['appropriate error is thrown'],
        },
      );
    }

    return scenarios;
  }

  protected extractEdgeCases(task: TaskDocument): string[] {
    const edgeCases: string[] = [];
    const description = task.description.toLowerCase();

    // Common edge cases
    if (description.includes('input')) {
      edgeCases.push('empty input', 'null/undefined input', 'invalid format');
    }
    if (description.includes('list') || description.includes('array')) {
      edgeCases.push('empty array', 'single item', 'large dataset');
    }
    if (description.includes('number') || description.includes('count')) {
      edgeCases.push('zero', 'negative numbers', 'boundary values');
    }
    if (description.includes('string') || description.includes('text')) {
      edgeCases.push('empty string', 'special characters', 'unicode');
    }
    if (description.includes('async') || description.includes('promise')) {
      edgeCases.push('timeout', 'rejection', 'concurrent calls');
    }

    return edgeCases.length > 0 ? edgeCases : ['empty input', 'null values', 'boundary conditions'];
  }

  protected extractMockRequirements(task: TaskDocument): string[] {
    const mocks: string[] = [];
    const description = task.description.toLowerCase();

    if (description.includes('api') || description.includes('fetch') || description.includes('http')) {
      mocks.push('API client', 'HTTP responses');
    }
    if (description.includes('database') || description.includes('db')) {
      mocks.push('Database connection', 'Query results');
    }
    if (description.includes('file') || description.includes('filesystem')) {
      mocks.push('File system');
    }
    if (description.includes('auth') || description.includes('user')) {
      mocks.push('Authentication service', 'User context');
    }
    if (description.includes('timer') || description.includes('date') || description.includes('time')) {
      mocks.push('Date/Time');
    }

    return mocks;
  }

  protected determinePriority(task: TaskDocument): 'critical' | 'high' | 'medium' | 'low' {
    if (task.priority === TaskPriority.CRITICAL) return 'critical';
    if (task.priority === TaskPriority.HIGH) return 'high';
    if (task.priority === TaskPriority.LOW || task.priority === TaskPriority.BACKGROUND) return 'low';
    return 'medium';
  }

  // ============================================================================
  // Test Generation Methods
  // ============================================================================

  protected generateUnitTestFile(_task: TaskDocument, analysis: TestAnalysis): GeneratedTestFile {
    const target = analysis.target;
    const targetName = this.toPascalCase(target);
    const fileName = this.toKebabCase(target);
    const framework = this.qaConfig.testFrameworks[0] || 'jest';

    const scenarios = analysis.scenarios.map((s, i) => `
  ${i > 0 ? '\n' : ''}it('${s.name}', () => {
    // Arrange
    ${s.given.map(g => `// ${g}`).join('\n    ')}

    // Act
    ${s.when.map(w => `// ${w}`).join('\n    ')}

    // Assert
    ${s.then.map(t => `// ${t}`).join('\n    ')}
    expect(true).toBe(true); // TODO: Implement
  });`).join('');

    const edgeCaseTests = analysis.edgeCases.map((ec) => `
  it('should handle ${ec}', () => {
    // TODO: Implement edge case test
    expect(true).toBe(true);
  });`).join('');

    const content = `/**
 * Unit Tests for ${targetName}
 *
 * @generated by QA Team
 */

import { describe, it, expect, beforeEach, afterEach${analysis.mocks.length > 0 ? ', jest' : ''} } from '${framework}';
// import { ${targetName} } from '../src/${fileName}';

describe('${targetName}', () => {
  // Setup
  beforeEach(() => {
    // Test setup
  });

  afterEach(() => {
    // Cleanup
  });

  describe('Core Functionality', () => {${scenarios}
  });

  describe('Edge Cases', () => {${edgeCaseTests}
  });
${analysis.mocks.length > 0 ? `
  describe('Mock Behavior', () => {
${analysis.mocks.map(m => `    // Mock: ${m}`).join('\n')}
  });
` : ''}});
`;

    return {
      path: `tests/unit/${fileName}.test.ts`,
      content,
      framework,
      testCount: analysis.scenarios.length + analysis.edgeCases.length,
      type: 'unit',
    };
  }

  protected generateIntegrationTestFile(_task: TaskDocument, analysis: TestAnalysis): GeneratedTestFile {
    const target = analysis.target;
    const targetName = this.toPascalCase(target);
    const fileName = this.toKebabCase(target);
    const framework = this.qaConfig.testFrameworks[0] || 'jest';

    const content = `/**
 * Integration Tests for ${targetName}
 *
 * @generated by QA Team
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '${framework}';
import request from 'supertest';
// import { app } from '../src/app';
// import { setupTestDB, teardownTestDB, clearTestDB } from './utils/test-db';

describe('${targetName} Integration', () => {
  // Database setup
  beforeAll(async () => {
    // await setupTestDB();
  });

  afterAll(async () => {
    // await teardownTestDB();
  });

  beforeEach(async () => {
    // await clearTestDB();
  });

  describe('API Endpoints', () => {
    it('should handle successful requests', async () => {
      // const response = await request(app).get('/api/${fileName}');
      // expect(response.status).toBe(200);
      expect(true).toBe(true); // TODO: Implement
    });

    it('should handle error responses', async () => {
      // const response = await request(app).get('/api/${fileName}/invalid');
      // expect(response.status).toBe(404);
      expect(true).toBe(true); // TODO: Implement
    });
  });

  describe('Database Operations', () => {
    it('should persist data correctly', async () => {
      // TODO: Test database operations
      expect(true).toBe(true);
    });

    it('should handle transactions', async () => {
      // TODO: Test transaction behavior
      expect(true).toBe(true);
    });
  });

  describe('Service Integration', () => {
${analysis.scenarios.map(s => `
    it('${s.name}', async () => {
      // TODO: Implement integration test
      expect(true).toBe(true);
    });`).join('')}
  });
});
`;

    return {
      path: `tests/integration/${fileName}.integration.test.ts`,
      content,
      framework,
      testCount: analysis.scenarios.length + 4,
      type: 'integration',
    };
  }

  protected generateE2ETestFile(_task: TaskDocument, analysis: TestAnalysis): GeneratedTestFile {
    const target = analysis.target;
    const targetName = this.toPascalCase(target);
    const fileName = this.toKebabCase(target);
    const e2eTool = this.qaConfig.e2eTool;

    let content: string;

    if (e2eTool === 'playwright') {
      content = this.generatePlaywrightTest(targetName, fileName, analysis);
    } else if (e2eTool === 'cypress') {
      content = this.generateCypressTest(targetName, fileName, analysis);
    } else {
      content = this.generatePlaywrightTest(targetName, fileName, analysis);
    }

    return {
      path: `tests/e2e/${fileName}.e2e.test.ts`,
      content,
      framework: e2eTool,
      testCount: analysis.scenarios.length + 2,
      type: 'e2e',
    };
  }

  protected generatePlaywrightTest(targetName: string, fileName: string, analysis: TestAnalysis): string {
    return `/**
 * E2E Tests for ${targetName}
 *
 * @generated by QA Team
 */

import { test, expect } from '@playwright/test';
// import { ${targetName}Page } from './pages/${fileName}.page';

test.describe('${targetName} E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the page
    await page.goto('/');
  });

  test('should load successfully', async ({ page }) => {
    // Verify page loaded
    await expect(page).toHaveTitle(/.*${targetName}.*/i);
  });

  test('should complete main user flow', async ({ page }) => {
    // TODO: Implement main user journey
    // Step 1: Navigate
    // Step 2: Interact
    // Step 3: Verify
    expect(true).toBe(true);
  });

${analysis.scenarios.map(s => `
  test('${s.name}', async ({ page }) => {
    // Given: ${s.given.join(', ')}
    // When: ${s.when.join(', ')}
    // Then: ${s.then.join(', ')}
    expect(true).toBe(true); // TODO: Implement
  });`).join('')}
${this.qaConfig.enableA11yTesting ? `
  test('should be accessible', async ({ page }) => {
    // const results = await new AxeBuilder({ page }).analyze();
    // expect(results.violations).toEqual([]);
    expect(true).toBe(true); // TODO: Implement accessibility test
  });
` : ''}
${this.qaConfig.enableVisualRegression ? `
  test('should match visual snapshot', async ({ page }) => {
    await expect(page).toHaveScreenshot('${fileName}.png');
  });
` : ''}
});
`;
  }

  protected generateCypressTest(targetName: string, _fileName: string, analysis: TestAnalysis): string {
    return `/**
 * E2E Tests for ${targetName}
 *
 * @generated by QA Team
 */

describe('${targetName} E2E', () => {
  beforeEach(() => {
    cy.visit('/');
  });

  it('should load successfully', () => {
    cy.title().should('include', '${targetName}');
  });

  it('should complete main user flow', () => {
    // TODO: Implement main user journey
    cy.get('body').should('be.visible');
  });

${analysis.scenarios.map(s => `
  it('${s.name}', () => {
    // Given: ${s.given.join(', ')}
    // When: ${s.when.join(', ')}
    // Then: ${s.then.join(', ')}
    cy.get('body').should('exist'); // TODO: Implement
  });`).join('')}
});
`;
  }

  protected generateTestUtilities(_task: TaskDocument): GeneratedTestFile {
    return {
      path: 'tests/utils/test-helpers.ts',
      content: `/**
 * Test Utilities
 *
 * @generated by QA Team
 */

/**
 * Wait for a condition to be true
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  timeout = 5000,
  interval = 100
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await condition()) return;
    await new Promise((r) => setTimeout(r, interval));
  }
  throw new Error('Timeout waiting for condition');
}

/**
 * Create test data with defaults
 */
export function createTestData<T extends object>(defaults: T, overrides: Partial<T> = {}): T {
  return { ...defaults, ...overrides };
}

/**
 * Mock response generator
 */
export function createMockResponse<T>(data: T, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
    text: async () => JSON.stringify(data),
  };
}

/**
 * Async test wrapper with timeout
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message = 'Test timeout'
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(message)), timeoutMs)
    ),
  ]);
}
`,
      framework: 'typescript',
      testCount: 0,
      type: 'unit',
    };
  }

  protected generatePageObjects(_task: TaskDocument, analysis: TestAnalysis): GeneratedTestFile[] {
    const target = analysis.target;
    const targetName = this.toPascalCase(target);
    const fileName = this.toKebabCase(target);

    return [{
      path: `tests/e2e/pages/${fileName}.page.ts`,
      content: `/**
 * Page Object: ${targetName}
 *
 * @generated by QA Team
 */

import { Page, Locator } from '@playwright/test';

export class ${targetName}Page {
  readonly page: Page;
  readonly heading: Locator;
  readonly submitButton: Locator;
  readonly errorMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { level: 1 });
    this.submitButton = page.getByRole('button', { name: /submit/i });
    this.errorMessage = page.locator('.error-message');
  }

  async goto() {
    await this.page.goto('/${fileName}');
  }

  async submit() {
    await this.submitButton.click();
  }

  async waitForLoad() {
    await this.heading.waitFor();
  }

  async getErrorText(): Promise<string | null> {
    if (await this.errorMessage.isVisible()) {
      return this.errorMessage.textContent();
    }
    return null;
  }
}
`,
      framework: 'playwright',
      testCount: 0,
      type: 'e2e',
    }];
  }

  protected generateTestFixtures(task: TaskDocument): GeneratedTestFile {
    const target = this.extractTestTarget(task);
    const fileName = this.toKebabCase(target);

    return {
      path: `tests/fixtures/${fileName}.fixtures.ts`,
      content: `/**
 * Test Fixtures for ${this.toPascalCase(target)}
 *
 * @generated by QA Team
 */

export const validData = {
  id: 'test-id-1',
  name: 'Test Item',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

export const invalidData = {
  id: null,
  name: '',
};

export const edgeCaseData = {
  emptyString: '',
  longString: 'a'.repeat(10000),
  specialChars: '<script>alert("xss")</script>',
  unicode: '你好世界',
  nullValue: null,
  undefinedValue: undefined,
  negativeNumber: -1,
  zero: 0,
  maxNumber: Number.MAX_SAFE_INTEGER,
};

export const mockResponses = {
  success: {
    status: 200,
    data: validData,
  },
  notFound: {
    status: 404,
    error: 'Not found',
  },
  error: {
    status: 500,
    error: 'Internal server error',
  },
};
`,
      framework: 'typescript',
      testCount: 0,
      type: 'unit',
    };
  }

  protected generateBugVerificationTest(task: TaskDocument): GeneratedTestFile {
    const bugId = task.metadata?.bugId || 'unknown';
    const framework = this.qaConfig.testFrameworks[0] || 'jest';

    return {
      path: `tests/regression/bug-${bugId}.test.ts`,
      content: `/**
 * Bug Verification Test
 * Bug ID: ${bugId}
 * Description: ${task.description}
 *
 * @generated by QA Team
 */

import { describe, it, expect } from '${framework}';

describe('Bug #${bugId} - Regression Test', () => {
  it('should verify the bug is fixed', () => {
    // Original bug scenario
    // ${task.description}

    // Reproduction steps from bug report
    // TODO: Implement reproduction steps

    // Verify fix
    expect(true).toBe(true);
  });

  it('should not regress with similar inputs', () => {
    // Related edge cases
    expect(true).toBe(true);
  });
});
`,
      framework,
      testCount: 2,
      type: 'unit',
    };
  }

  protected generateAccessibilityTests(task: TaskDocument): GeneratedTestFile {
    const target = this.extractTestTarget(task);
    const fileName = this.toKebabCase(target);

    return {
      path: `tests/a11y/${fileName}.a11y.test.ts`,
      content: `/**
 * Accessibility Tests for ${this.toPascalCase(target)}
 *
 * @generated by QA Team
 */

import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('${this.toPascalCase(target)} Accessibility', () => {
  test('should not have any automatically detectable accessibility issues', async ({ page }) => {
    await page.goto('/${fileName}');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('should be keyboard navigable', async ({ page }) => {
    await page.goto('/${fileName}');

    // Tab through interactive elements
    await page.keyboard.press('Tab');
    const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
    expect(focusedElement).toBeTruthy();
  });

  test('should have proper ARIA labels', async ({ page }) => {
    await page.goto('/${fileName}');

    // Check for buttons with accessible names
    const buttons = await page.locator('button').all();
    for (const button of buttons) {
      const accessibleName = await button.getAttribute('aria-label') || await button.textContent();
      expect(accessibleName?.trim()).toBeTruthy();
    }
  });

  test('should have proper heading hierarchy', async ({ page }) => {
    await page.goto('/${fileName}');

    // Verify h1 exists and heading order is correct
    const h1Count = await page.locator('h1').count();
    expect(h1Count).toBe(1);
  });

  test('should have sufficient color contrast', async ({ page }) => {
    await page.goto('/${fileName}');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['color-contrast'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });
});
`,
      framework: 'playwright',
      testCount: 5,
      type: 'e2e',
    };
  }

  protected generatePerformanceTests(task: TaskDocument): GeneratedTestFile {
    const target = this.extractTestTarget(task);
    const fileName = this.toKebabCase(target);

    return {
      path: `tests/performance/${fileName}.perf.test.ts`,
      content: `/**
 * Performance Tests for ${this.toPascalCase(target)}
 *
 * @generated by QA Team
 */

import { test, expect } from '@playwright/test';

test.describe('${this.toPascalCase(target)} Performance', () => {
  test('should load within acceptable time', async ({ page }) => {
    const startTime = Date.now();
    await page.goto('/${fileName}');
    const loadTime = Date.now() - startTime;

    // Page should load within 3 seconds
    expect(loadTime).toBeLessThan(3000);
  });

  test('should have good Core Web Vitals', async ({ page }) => {
    await page.goto('/${fileName}');

    // Wait for page to be fully loaded
    await page.waitForLoadState('networkidle');

    // Measure Largest Contentful Paint (LCP)
    const lcp = await page.evaluate(() => {
      return new Promise((resolve) => {
        new PerformanceObserver((entryList) => {
          const entries = entryList.getEntries();
          resolve(entries[entries.length - 1].startTime);
        }).observe({ entryTypes: ['largest-contentful-paint'] });

        // Fallback if no LCP observed
        setTimeout(() => resolve(0), 5000);
      });
    });

    // LCP should be under 2.5 seconds
    expect(Number(lcp)).toBeLessThan(2500);
  });

  test('should not have memory leaks', async ({ page }) => {
    await page.goto('/${fileName}');

    const initialMemory = await page.evaluate(() => {
      if ('memory' in performance) {
        return (performance as any).memory.usedJSHeapSize;
      }
      return 0;
    });

    // Simulate user interactions
    for (let i = 0; i < 10; i++) {
      await page.reload();
    }

    const finalMemory = await page.evaluate(() => {
      if ('memory' in performance) {
        return (performance as any).memory.usedJSHeapSize;
      }
      return 0;
    });

    // Memory growth should be reasonable (less than 50% increase)
    if (initialMemory > 0) {
      expect(finalMemory).toBeLessThan(initialMemory * 1.5);
    }
  });

  test('should handle concurrent requests', async ({ page }) => {
    await page.goto('/${fileName}');

    // Make multiple concurrent requests
    const startTime = Date.now();
    await Promise.all([
      page.evaluate(() => fetch('/api/data').then(r => r.json())),
      page.evaluate(() => fetch('/api/data').then(r => r.json())),
      page.evaluate(() => fetch('/api/data').then(r => r.json())),
    ].map(p => p.catch(() => null)));
    const duration = Date.now() - startTime;

    // Concurrent requests should complete quickly
    expect(duration).toBeLessThan(5000);
  });
});
`,
      framework: 'playwright',
      testCount: 4,
      type: 'e2e',
    };
  }

  // ============================================================================
  // Documentation Generation
  // ============================================================================

  protected generateTestPlanDocument(analysis: TestAnalysis): string {
    return `# Test Plan: ${analysis.target}

## Overview
- **Test Type**: ${analysis.testType}
- **Priority**: ${analysis.priority}
- **Estimated Tests**: ${analysis.estimatedTestCount}

## Test Scenarios

${analysis.scenarios.map((s, i) => `### ${i + 1}. ${s.name}
${s.description}

**Given:**
${s.given.map(g => `- ${g}`).join('\n')}

**When:**
${s.when.map(w => `- ${w}`).join('\n')}

**Then:**
${s.then.map(t => `- ${t}`).join('\n')}
`).join('\n')}

## Edge Cases
${analysis.edgeCases.map(ec => `- ${ec}`).join('\n')}

## Mocking Requirements
${analysis.mocks.length > 0 ? analysis.mocks.map(m => `- ${m}`).join('\n') : '- No mocks required'}

## Coverage Goals
- Line Coverage: ${this.qaConfig.coverageThreshold}%
- Branch Coverage: ${this.qaConfig.coverageThreshold - 10}%
- Function Coverage: ${this.qaConfig.coverageThreshold}%
`;
  }

  protected generateComprehensiveTestPlan(task: TaskDocument, analysis: TestAnalysis): string {
    return `# Comprehensive Test Plan

## Project: ${task.title}
**Generated by**: QA Team
**Date**: ${new Date().toISOString().split('T')[0]}

---

## 1. Executive Summary

${task.description}

## 2. Test Scope

### In Scope
- Unit testing for core functionality
- Integration testing for API endpoints
- E2E testing for critical user journeys
${this.qaConfig.enableA11yTesting ? '- Accessibility compliance testing' : ''}
${this.qaConfig.enablePerformanceTesting ? '- Performance and load testing' : ''}

### Out of Scope
- Third-party service testing
- Hardware compatibility testing

## 3. Test Strategy

### Test Pyramid
\`\`\`
        /\\
       /E2E\\
      /------\\
     /Integr. \\
    /----------\\
   /   Unit     \\
  /--------------\\
\`\`\`

- **Unit Tests**: 70% of test effort
- **Integration Tests**: 20% of test effort
- **E2E Tests**: 10% of test effort

## 4. Test Scenarios

${this.generateTestPlanDocument(analysis).split('## Test Scenarios')[1]}

## 5. Test Environment

### Frameworks
${this.qaConfig.testFrameworks.map(f => `- ${f}`).join('\n')}

### E2E Tool
- ${this.qaConfig.e2eTool}

### Configuration
- Parallel Execution: ${this.qaConfig.parallelExecution ? 'Yes' : 'No'}
- Max Workers: ${this.qaConfig.maxWorkers}
- Coverage Threshold: ${this.qaConfig.coverageThreshold}%

## 6. Quality Gates

### Coverage Requirements
- Minimum Line Coverage: ${this.qaConfig.coverageThreshold}%
- Minimum Branch Coverage: ${this.qaConfig.coverageThreshold - 10}%
- Minimum Function Coverage: ${this.qaConfig.coverageThreshold}%

### Performance Requirements
- Page Load Time: < 3s
- API Response Time: < 500ms
- Memory Usage: < 100MB

## 7. Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Test flakiness | High | Implement retry logic, use stable selectors |
| Environment issues | Medium | Containerized test environments |
| Data dependencies | Medium | Use fixtures and factories |

## 8. Schedule

| Phase | Duration | Activities |
|-------|----------|------------|
| Planning | 1 day | Review requirements, create test plan |
| Unit Tests | 3 days | Write and execute unit tests |
| Integration Tests | 2 days | Write and execute integration tests |
| E2E Tests | 2 days | Write and execute E2E tests |
| Reporting | 1 day | Generate reports, document issues |

---

*Generated by QA Team - Autonomous Coding Agents*
`;
  }

  protected generateTestExecutionReport(_task: TaskDocument): string {
    return JSON.stringify({
      timestamp: new Date().toISOString(),
      summary: {
        total: this.qaStats.testsExecuted,
        passed: this.qaStats.testsPassed,
        failed: this.qaStats.testsFailed,
        skipped: 0,
        duration: this.qaStats.totalDuration,
      },
      coverage: {
        lines: this.qaStats.coverageAchieved,
        branches: Math.max(0, this.qaStats.coverageAchieved - 10),
        functions: this.qaStats.coverageAchieved,
        statements: this.qaStats.coverageAchieved,
      },
      configuration: {
        framework: this.qaConfig.testFrameworks[0],
        e2eTool: this.qaConfig.e2eTool,
        parallelExecution: this.qaConfig.parallelExecution,
        maxWorkers: this.qaConfig.maxWorkers,
      },
    }, null, 2);
  }

  protected generateCoverageReport(_task: TaskDocument): string {
    return `# Coverage Analysis Report

**Generated**: ${new Date().toISOString()}

## Summary

| Metric | Coverage | Threshold | Status |
|--------|----------|-----------|--------|
| Lines | ${this.qaStats.coverageAchieved}% | ${this.qaConfig.coverageThreshold}% | ${this.qaStats.coverageAchieved >= this.qaConfig.coverageThreshold ? '✅ Pass' : '❌ Fail'} |
| Branches | ${Math.max(0, this.qaStats.coverageAchieved - 10)}% | ${this.qaConfig.coverageThreshold - 10}% | ${this.qaStats.coverageAchieved - 10 >= this.qaConfig.coverageThreshold - 10 ? '✅ Pass' : '❌ Fail'} |
| Functions | ${this.qaStats.coverageAchieved}% | ${this.qaConfig.coverageThreshold}% | ${this.qaStats.coverageAchieved >= this.qaConfig.coverageThreshold ? '✅ Pass' : '❌ Fail'} |

## Test Statistics

- Tests Generated: ${this.qaStats.testsGenerated}
- Tests Executed: ${this.qaStats.testsExecuted}
- Tests Passed: ${this.qaStats.testsPassed}
- Tests Failed: ${this.qaStats.testsFailed}
- Bugs Found: ${this.qaStats.bugsFound}
- Bugs Verified: ${this.qaStats.bugsVerified}

## Recommendations

${this.qaStats.coverageAchieved < this.qaConfig.coverageThreshold ? `
1. Increase unit test coverage for uncovered modules
2. Add edge case tests for complex functions
3. Consider adding integration tests for API endpoints
` : '1. Coverage goals met - maintain current testing practices'}

---
*QA Team - Coverage Analysis*
`;
  }

  // ============================================================================
  // Dependency Detection
  // ============================================================================

  protected detectTestDependencies(testType: 'unit' | 'integration' | 'e2e' | string): { name: string; version: string; isDev: boolean }[] {
    const deps: { name: string; version: string; isDev: boolean }[] = [];

    // Base dependencies
    const framework = this.qaConfig.testFrameworks[0] || 'jest';
    if (framework === 'jest') {
      deps.push({ name: 'jest', version: '^29.7.0', isDev: true });
      deps.push({ name: '@types/jest', version: '^29.5.0', isDev: true });
      deps.push({ name: 'ts-jest', version: '^29.1.0', isDev: true });
    } else if (framework === 'vitest') {
      deps.push({ name: 'vitest', version: '^1.2.0', isDev: true });
      deps.push({ name: '@vitest/coverage-v8', version: '^1.2.0', isDev: true });
    }

    // Integration test dependencies
    if (testType === 'integration') {
      deps.push({ name: 'supertest', version: '^6.3.0', isDev: true });
      deps.push({ name: '@types/supertest', version: '^6.0.0', isDev: true });
    }

    // E2E test dependencies
    if (testType === 'e2e') {
      if (this.qaConfig.e2eTool === 'playwright') {
        deps.push({ name: '@playwright/test', version: '^1.41.0', isDev: true });
      } else if (this.qaConfig.e2eTool === 'cypress') {
        deps.push({ name: 'cypress', version: '^13.6.0', isDev: true });
      }
    }

    // Testing library
    deps.push({ name: '@testing-library/jest-dom', version: '^6.2.0', isDev: true });

    return deps;
  }

  // ============================================================================
  // Artifact Creation
  // ============================================================================

  protected createTestArtifacts(result: TestGenerationResult): TaskArtifact[] {
    return result.files.map((file) => ({
      id: uuidv4(),
      type: 'test' as const,
      name: file.path.split('/').pop() || 'test-file',
      path: file.path,
      content: file.content,
      mimeType: 'text/typescript',
      size: Buffer.byteLength(file.content, 'utf-8'),
      createdAt: new Date(),
    }));
  }

  // ============================================================================
  // Utilities
  // ============================================================================

  protected toPascalCase(str: string): string {
    return str
      .split(/[-_\s]+/)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('');
  }

  protected toKebabCase(str: string): string {
    return str
      .replace(/([a-z])([A-Z])/g, '$1-$2')
      .replace(/[\s_]+/g, '-')
      .toLowerCase();
  }

  // ============================================================================
  // Public Getters
  // ============================================================================

  getQAStats(): typeof this.qaStats {
    return { ...this.qaStats };
  }

  getTestFrameworks(): string[] {
    return [...this.qaConfig.testFrameworks];
  }

  getE2ETool(): string {
    return this.qaConfig.e2eTool;
  }

  getCoverageThreshold(): number {
    return this.qaConfig.coverageThreshold;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a QA team
 */
export function createQATeam(config: QATeamConfig = {}): QATeam {
  return new QATeam(config);
}
