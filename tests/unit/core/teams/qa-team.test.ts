/**
 * QA Team Tests
 *
 * Unit tests for the QA team implementation.
 *
 * Feature: Team System
 */

import {
  QATeam,
  createQATeam,
  DEFAULT_QA_CONFIG,
} from '../../../../src/core/teams/qa';
import {
  TeamType,
  TeamStatus,
  TaskDocument,
  TaskPriority,
  TaskStatus,
  TaskResult,
} from '../../../../src/core/teams/team-types';

// ============================================================================
// Testable QA Team - Exposes protected methods for testing
// ============================================================================

class TestableQATeam extends QATeam {
  public async testProcessTask(task: TaskDocument): Promise<TaskResult> {
    return this.processTask(task);
  }
}

// ============================================================================
// Test Utilities
// ============================================================================

function createTestTask(overrides: Partial<TaskDocument> = {}): TaskDocument {
  return {
    id: `task-${Date.now()}`,
    title: 'Test Task',
    description: 'A test task for QA team',
    type: 'test',
    priority: TaskPriority.NORMAL,
    status: TaskStatus.PENDING,
    subtaskIds: [],
    dependencies: [],
    inputs: {},
    outputs: {},
    acceptanceCriteria: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    metadata: {},
    ...overrides,
  };
}

// ============================================================================
// QATeam Tests
// ============================================================================

describe('QATeam', () => {
  let team: TestableQATeam;

  beforeEach(() => {
    team = new TestableQATeam();
  });

  afterEach(async () => {
    if (team.getStatus() === TeamStatus.WORKING || team.getStatus() === TeamStatus.IDLE) {
      try {
        await team.stop();
      } catch {
        // Ignore stop errors in cleanup
      }
    }
  });

  // ============================================================================
  // Configuration
  // ============================================================================

  describe('Configuration', () => {
    it('should use default configuration', () => {
      expect(team.getTestFrameworks()).toContain('jest');
      expect(team.getTestFrameworks()).toContain('vitest');
      expect(team.getE2ETool()).toBe('playwright');
      expect(team.getCoverageThreshold()).toBe(80);
    });

    it('should have correct team type', () => {
      expect(team.type).toBe(TeamType.QA);
    });

    it('should have QA capabilities', () => {
      expect(team.hasCapability('test_generation')).toBe(true);
      expect(team.hasCapability('test_execution')).toBe(true);
      expect(team.hasCapability('debugging')).toBe(true);
    });

    it('should accept custom configuration', () => {
      const customTeam = new TestableQATeam({
        testFrameworks: ['mocha', 'chai'],
        e2eTool: 'cypress',
        coverageThreshold: 90,
        enableVisualRegression: true,
      });

      expect(customTeam.getTestFrameworks()).toContain('mocha');
      expect(customTeam.getE2ETool()).toBe('cypress');
      expect(customTeam.getCoverageThreshold()).toBe(90);
    });

    it('should have sensible defaults for all options', () => {
      expect(DEFAULT_QA_CONFIG.testFrameworks).toBeDefined();
      expect(DEFAULT_QA_CONFIG.e2eTool).toBeDefined();
      expect(DEFAULT_QA_CONFIG.enableCoverage).toBe(true);
      expect(DEFAULT_QA_CONFIG.coverageThreshold).toBeGreaterThan(0);
      expect(DEFAULT_QA_CONFIG.parallelExecution).toBe(true);
      expect(DEFAULT_QA_CONFIG.maxWorkers).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // Initialization
  // ============================================================================

  describe('Initialization', () => {
    it('should initialize with idle status', async () => {
      await team.initialize();
      expect(team.getStatus()).toBe(TeamStatus.IDLE);
    });

    it('should have correct name', () => {
      expect(team.name).toBe('QA Team');
    });

    it('should accept custom name', () => {
      const customTeam = new TestableQATeam({ name: 'Test Engineers' });
      expect(customTeam.name).toBe('Test Engineers');
    });
  });

  // ============================================================================
  // Task Processing - Unit Tests
  // ============================================================================

  describe('Task Processing - Unit Tests', () => {
    it('should process unit test task', async () => {
      const task = createTestTask({
        title: 'Write unit tests for UserService',
        description: 'Create comprehensive unit tests for the user service module',
      });

      const result = await team.testProcessTask(task);
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.outputs.files).toBeDefined();
      expect(result.outputs.totalTests).toBeGreaterThan(0);
    });

    it('should generate test plan document', async () => {
      const task = createTestTask({
        title: 'Unit test plan for auth module',
        description: 'Create unit tests for authentication',
        acceptanceCriteria: [
          'should validate user credentials',
          'should handle invalid tokens',
          'should refresh expired tokens',
        ],
      });

      const result = await team.testProcessTask(task);
      expect(result.outputs.testPlan).toBeDefined();
      expect(result.outputs.testPlan).toContain('Test Plan');
    });
  });

  // ============================================================================
  // Task Processing - Integration Tests
  // ============================================================================

  describe('Task Processing - Integration Tests', () => {
    it('should process integration test task', async () => {
      const task = createTestTask({
        title: 'Integration tests for API endpoints',
        description: 'Create integration tests for REST API with database operations',
      });

      const result = await team.testProcessTask(task);
      expect(result.success).toBe(true);
      expect(result.outputs.files).toBeDefined();
      expect(Array.isArray(result.outputs.files)).toBe(true);
    });

    it('should include test utilities', async () => {
      const task = createTestTask({
        title: 'Integration test for payment service',
        description: 'Test payment service with database and external API',
      });

      const result = await team.testProcessTask(task);
      const files = result.outputs.files as Array<{ path: string }>;
      const hasUtilFile = files.some((f) => f.path.includes('utils') || f.path.includes('helpers'));
      expect(hasUtilFile).toBe(true);
    });
  });

  // ============================================================================
  // Task Processing - E2E Tests
  // ============================================================================

  describe('Task Processing - E2E Tests', () => {
    it('should process E2E test task', async () => {
      const task = createTestTask({
        title: 'E2E tests for user registration',
        description: 'Create end-to-end tests for the complete user registration flow',
      });

      const result = await team.testProcessTask(task);
      expect(result.success).toBe(true);
      expect(result.outputs.files).toBeDefined();
    });

    it('should generate page objects for E2E tests', async () => {
      const task = createTestTask({
        title: 'End-to-end test for checkout flow',
        description: 'Test the complete checkout user journey',
      });

      const result = await team.testProcessTask(task);
      const files = result.outputs.files as Array<{ path: string }>;
      const hasPageObject = files.some((f) => f.path.includes('page'));
      expect(hasPageObject).toBe(true);
    });

    it('should include test fixtures', async () => {
      const task = createTestTask({
        title: 'E2E test for dashboard',
        description: 'Test dashboard user workflows end to end',
      });

      const result = await team.testProcessTask(task);
      const files = result.outputs.files as Array<{ path: string }>;
      const hasFixtures = files.some((f) => f.path.includes('fixture'));
      expect(hasFixtures).toBe(true);
    });
  });

  // ============================================================================
  // Task Processing - Test Plan
  // ============================================================================

  describe('Task Processing - Test Plan', () => {
    it('should generate comprehensive test plan', async () => {
      const task = createTestTask({
        title: 'Test plan for e-commerce platform',
        description: 'Create a comprehensive test strategy for the platform',
      });

      const result = await team.testProcessTask(task);
      expect(result.success).toBe(true);
      expect(result.outputs.testPlan).toBeDefined();
      expect(result.outputs.testPlan).toContain('Test Plan');
    });

    it('should include test strategy sections', async () => {
      const task = createTestTask({
        title: 'Test strategy document',
        description: 'Define testing approach for new feature',
      });

      const result = await team.testProcessTask(task);
      const testPlan = result.outputs.testPlan as string;
      expect(testPlan).toContain('Summary');
    });
  });

  // ============================================================================
  // Task Processing - Accessibility Tests
  // ============================================================================

  describe('Task Processing - Accessibility Tests', () => {
    let a11yTeam: TestableQATeam;

    beforeEach(() => {
      a11yTeam = new TestableQATeam({
        enableA11yTesting: true,
      });
    });

    it('should process accessibility test task', async () => {
      const task = createTestTask({
        title: 'Accessibility tests for navigation',
        description: 'A11y compliance testing for main navigation component',
      });

      const result = await a11yTeam.testProcessTask(task);
      expect(result.success).toBe(true);
      expect(result.outputs.files).toBeDefined();
    });

    it('should generate a11y test files', async () => {
      const task = createTestTask({
        title: 'A11y audit for forms',
        description: 'Accessibility testing for all form components',
      });

      const result = await a11yTeam.testProcessTask(task);
      expect(result.outputs.files).toBeDefined();
    });
  });

  // ============================================================================
  // Task Processing - Performance Tests
  // ============================================================================

  describe('Task Processing - Performance Tests', () => {
    let perfTeam: TestableQATeam;

    beforeEach(() => {
      perfTeam = new TestableQATeam({
        enablePerformanceTesting: true,
      });
    });

    it('should process performance test task', async () => {
      const task = createTestTask({
        title: 'Performance benchmark for API',
        description: 'Create performance tests and load testing for API endpoints',
      });

      const result = await perfTeam.testProcessTask(task);
      expect(result.success).toBe(true);
      expect(result.outputs.files).toBeDefined();
    });
  });

  // ============================================================================
  // Task Processing - Bug Verification
  // ============================================================================

  describe('Task Processing - Bug Verification', () => {
    it('should process bug verification task', async () => {
      const task = createTestTask({
        title: 'Verify fix for login bug',
        description: 'Bug: Users cannot login with special characters in password',
        metadata: { bugId: 'BUG-123' },
      });

      const result = await team.testProcessTask(task);
      expect(result.success).toBe(true);
      expect(result.outputs.files).toBeDefined();
    });

    it('should create regression test for bug', async () => {
      const task = createTestTask({
        title: 'Bug verification for cart issue',
        description: 'Verify the shopping cart bug is fixed',
        metadata: { bugId: 'BUG-456' },
      });

      const result = await team.testProcessTask(task);
      const files = result.outputs.files as Array<{ path: string }>;
      const hasRegressionTest = files.some((f) => f.path.includes('regression') || f.path.includes('bug'));
      expect(hasRegressionTest).toBe(true);
    });
  });

  // ============================================================================
  // Statistics
  // ============================================================================

  describe('QA Statistics', () => {
    it('should track test generation statistics', async () => {
      const task = createTestTask({
        title: 'Unit test for validator',
        description: 'Write unit tests for input validator',
      });

      await team.testProcessTask(task);

      const stats = team.getQAStats();
      expect(stats.testsGenerated).toBeGreaterThan(0);
    });

    it('should have initial stats at zero', () => {
      const freshTeam = new TestableQATeam();
      const stats = freshTeam.getQAStats();

      expect(stats.testsGenerated).toBe(0);
      expect(stats.testsExecuted).toBe(0);
      expect(stats.testsPassed).toBe(0);
      expect(stats.testsFailed).toBe(0);
    });

    it('should return a copy of stats', () => {
      const stats1 = team.getQAStats();
      const stats2 = team.getQAStats();

      expect(stats1).not.toBe(stats2);
      expect(stats1).toEqual(stats2);
    });
  });

  // ============================================================================
  // Factory Function
  // ============================================================================

  describe('Factory Function', () => {
    it('should create team with defaults', () => {
      const factoryTeam = createQATeam();
      expect(factoryTeam).toBeInstanceOf(QATeam);
      expect(factoryTeam.type).toBe(TeamType.QA);
    });

    it('should accept custom config', () => {
      const factoryTeam = createQATeam({
        name: 'Custom QA',
        testFrameworks: ['mocha'],
        e2eTool: 'cypress',
        coverageThreshold: 95,
      });

      expect(factoryTeam.name).toBe('Custom QA');
      expect(factoryTeam.getTestFrameworks()).toContain('mocha');
      expect(factoryTeam.getE2ETool()).toBe('cypress');
      expect(factoryTeam.getCoverageThreshold()).toBe(95);
    });
  });

  // ============================================================================
  // Test Type Detection
  // ============================================================================

  describe('Test Type Detection', () => {
    it('should detect unit test from title', async () => {
      const task = createTestTask({
        title: 'Unit test for calculator',
        description: 'Test calculator functions',
      });

      const result = await team.testProcessTask(task);
      const files = result.outputs.files as Array<{ path: string; type: string }>;
      expect(files.some((f) => f.type === 'unit' || f.path.includes('unit'))).toBe(true);
    });

    it('should detect integration test from title', async () => {
      const task = createTestTask({
        title: 'Integration test for database',
        description: 'Test database operations',
      });

      const result = await team.testProcessTask(task);
      const files = result.outputs.files as Array<{ path: string }>;
      expect(files.some((f) => f.path.includes('integration'))).toBe(true);
    });

    it('should detect E2E test from title', async () => {
      const task = createTestTask({
        title: 'E2E test for login flow',
        description: 'End-to-end login testing',
      });

      const result = await team.testProcessTask(task);
      const files = result.outputs.files as Array<{ path: string }>;
      expect(files.some((f) => f.path.includes('e2e'))).toBe(true);
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle generic test task', async () => {
      const task = createTestTask({
        title: 'Test the system',
        description: 'General testing needed',
      });

      const result = await team.testProcessTask(task);
      expect(result.success).toBe(true);
    });

    it('should handle task with no acceptance criteria', async () => {
      const task = createTestTask({
        title: 'Unit tests for module',
        description: 'Write tests',
        acceptanceCriteria: [],
      });

      const result = await team.testProcessTask(task);
      expect(result.success).toBe(true);
      expect(result.outputs.testPlan).toBeDefined();
    });

    it('should handle complex descriptions', async () => {
      const task = createTestTask({
        title: 'Comprehensive testing',
        description: `
          Test the following scenarios:
          - User authentication with API calls
          - Database operations and transactions
          - File system operations
          - Async promise handling
          - Timer and date operations
        `,
      });

      const result = await team.testProcessTask(task);
      expect(result.success).toBe(true);
    });
  });

  // ============================================================================
  // Coverage Analysis
  // ============================================================================

  describe('Coverage Analysis', () => {
    it('should process coverage analysis task', async () => {
      const task = createTestTask({
        title: 'Coverage analysis for project',
        description: 'Analyze test coverage and generate report',
      });

      const result = await team.testProcessTask(task);
      expect(result.success).toBe(true);
      expect(result.outputs.coverageEstimate).toBeDefined();
    });
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe('QA Team Integration', () => {
  it('should work with different E2E tools', () => {
    const playwrightTeam = createQATeam({ e2eTool: 'playwright' });
    const cypressTeam = createQATeam({ e2eTool: 'cypress' });

    expect(playwrightTeam.getE2ETool()).toBe('playwright');
    expect(cypressTeam.getE2ETool()).toBe('cypress');
  });

  it('should work with different test frameworks', () => {
    const jestTeam = createQATeam({ testFrameworks: ['jest'] });
    const vitestTeam = createQATeam({ testFrameworks: ['vitest'] });

    expect(jestTeam.getTestFrameworks()).toContain('jest');
    expect(vitestTeam.getTestFrameworks()).toContain('vitest');
  });

  it('should support different coverage thresholds', () => {
    const strictTeam = createQATeam({ coverageThreshold: 95 });
    const lenientTeam = createQATeam({ coverageThreshold: 60 });

    expect(strictTeam.getCoverageThreshold()).toBe(95);
    expect(lenientTeam.getCoverageThreshold()).toBe(60);
  });
});
