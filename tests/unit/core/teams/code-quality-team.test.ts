/**
 * Code Quality Team Tests
 *
 * Unit tests for the Code Quality team implementation.
 *
 * Feature: Team System
 */

import {
  CodeQualityTeam,
  createCodeQualityTeam,
  DEFAULT_CODE_QUALITY_CONFIG,
} from '../../../../src/core/teams/code-quality';
import {
  TeamType,
  TeamStatus,
  TaskDocument,
  TaskPriority,
  TaskStatus,
  TaskResult,
} from '../../../../src/core/teams/team-types';

// ============================================================================
// Testable Code Quality Team - Exposes protected methods for testing
// ============================================================================

class TestableCodeQualityTeam extends CodeQualityTeam {
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
    description: 'A test task for code quality team',
    type: 'code-quality',
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
// CodeQualityTeam Tests
// ============================================================================

describe('CodeQualityTeam', () => {
  let team: TestableCodeQualityTeam;

  beforeEach(() => {
    team = new TestableCodeQualityTeam();
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
      expect(team.getLinters()).toContain('eslint');
      expect(team.getLinters()).toContain('typescript');
      expect(team.getSecurityScanners()).toContain('npm-audit');
      expect(team.getComplexityThreshold()).toBe(10);
      expect(team.getReviewStrictness()).toBe('standard');
    });

    it('should have correct team type', () => {
      expect(team.type).toBe(TeamType.CODE_QUALITY);
    });

    it('should have code quality capabilities', () => {
      expect(team.hasCapability('code_review')).toBe(true);
      expect(team.hasCapability('refactoring')).toBe(true);
      expect(team.hasCapability('security_analysis')).toBe(true);
    });

    it('should accept custom configuration', () => {
      const customTeam = new TestableCodeQualityTeam({
        linters: ['biome'],
        securityScanners: ['snyk'],
        complexityThreshold: 15,
        reviewStrictness: 'strict',
      });

      expect(customTeam.getLinters()).toContain('biome');
      expect(customTeam.getSecurityScanners()).toContain('snyk');
      expect(customTeam.getComplexityThreshold()).toBe(15);
      expect(customTeam.getReviewStrictness()).toBe('strict');
    });

    it('should have sensible defaults for all options', () => {
      expect(DEFAULT_CODE_QUALITY_CONFIG.linters).toBeDefined();
      expect(DEFAULT_CODE_QUALITY_CONFIG.securityScanners).toBeDefined();
      expect(DEFAULT_CODE_QUALITY_CONFIG.enableAutoFix).toBe(false);
      expect(DEFAULT_CODE_QUALITY_CONFIG.complexityThreshold).toBeGreaterThan(0);
      expect(DEFAULT_CODE_QUALITY_CONFIG.enableSecurityScan).toBe(true);
      expect(DEFAULT_CODE_QUALITY_CONFIG.reviewStrictness).toBe('standard');
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
      expect(team.name).toBe('Code Quality Team');
    });

    it('should accept custom name', () => {
      const customTeam = new TestableCodeQualityTeam({ name: 'Code Review Team' });
      expect(customTeam.name).toBe('Code Review Team');
    });
  });

  // ============================================================================
  // Task Processing - Code Review
  // ============================================================================

  describe('Task Processing - Code Review', () => {
    it('should process code review task', async () => {
      const task = createTestTask({
        title: 'Code review for UserService',
        description: 'Review the user service implementation for bugs and best practices',
      });

      const result = await team.testProcessTask(task);
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.outputs.taskType).toBe('code-review');
    });

    it('should return review result with score', async () => {
      const task = createTestTask({
        title: 'Review pull request',
        description: 'Review PR #123 for code quality',
        inputs: { files: ['src/user.ts', 'src/auth.ts'] },
      });

      const result = await team.testProcessTask(task);
      const reviewResult = result.outputs.result as { score: number; passed: boolean };
      expect(reviewResult.score).toBeDefined();
      expect(typeof reviewResult.score).toBe('number');
      expect(reviewResult.passed).toBeDefined();
    });

    it('should identify issues in review', async () => {
      const task = createTestTask({
        title: 'Review bug fix',
        description: 'Review code that fixes a null pointer bug',
      });

      const result = await team.testProcessTask(task);
      const reviewResult = result.outputs.result as { issues: unknown[] };
      expect(reviewResult.issues).toBeDefined();
      expect(Array.isArray(reviewResult.issues)).toBe(true);
    });
  });

  // ============================================================================
  // Task Processing - Refactoring
  // ============================================================================

  describe('Task Processing - Refactoring', () => {
    it('should process refactoring task', async () => {
      const task = createTestTask({
        title: 'Refactor authentication module',
        description: 'Extract duplicate code and improve readability',
      });

      const result = await team.testProcessTask(task);
      expect(result.success).toBe(true);
      expect(result.outputs.taskType).toBe('refactoring');
    });

    it('should identify refactoring opportunities', async () => {
      const task = createTestTask({
        title: 'Refactor to extract methods',
        description: 'Extract duplicate logic into reusable methods',
      });

      const result = await team.testProcessTask(task);
      const refactorResult = result.outputs.result as { refactorings: unknown[] };
      expect(refactorResult.refactorings).toBeDefined();
      expect(Array.isArray(refactorResult.refactorings)).toBe(true);
    });

    it('should track complexity reduction', async () => {
      const task = createTestTask({
        title: 'Simplify complex function',
        description: 'Refactor nested conditionals',
      });

      const result = await team.testProcessTask(task);
      const refactorResult = result.outputs.result as { improvements: { complexityReduction: number } };
      expect(refactorResult.improvements).toBeDefined();
      expect(refactorResult.improvements.complexityReduction).toBeGreaterThanOrEqual(0);
    });
  });

  // ============================================================================
  // Task Processing - Technical Debt
  // ============================================================================

  describe('Task Processing - Technical Debt', () => {
    it('should process tech debt analysis task', async () => {
      const task = createTestTask({
        title: 'Analyze technical debt',
        description: 'Identify and catalog technical debt in the codebase',
      });

      const result = await team.testProcessTask(task);
      expect(result.success).toBe(true);
      expect(result.outputs.taskType).toBe('tech-debt');
    });

    it('should identify debt items', async () => {
      const task = createTestTask({
        title: 'Technical debt assessment',
        description: 'Review code for tech debt including test coverage and documentation',
      });

      const result = await team.testProcessTask(task);
      const debtItems = result.outputs.result as unknown[];
      expect(Array.isArray(debtItems)).toBe(true);
      expect(debtItems.length).toBeGreaterThan(0);
    });

    it('should categorize debt items', async () => {
      const task = createTestTask({
        title: 'Tech debt categorization',
        description: 'Categorize debt by type: code, testing, documentation, dependencies',
      });

      const result = await team.testProcessTask(task);
      const debtItems = result.outputs.result as Array<{ category: string }>;
      expect(debtItems[0].category).toBeDefined();
    });
  });

  // ============================================================================
  // Task Processing - Security Scan
  // ============================================================================

  describe('Task Processing - Security Scan', () => {
    it('should process security scan task', async () => {
      const task = createTestTask({
        title: 'Security vulnerability scan',
        description: 'Scan code for security vulnerabilities',
      });

      const result = await team.testProcessTask(task);
      expect(result.success).toBe(true);
      expect(result.outputs.taskType).toBe('security-scan');
    });

    it('should identify vulnerabilities', async () => {
      const task = createTestTask({
        title: 'Security audit',
        description: 'Check for SQL injection vulnerabilities in database queries',
      });

      const result = await team.testProcessTask(task);
      const securityResult = result.outputs.result as { vulnerabilities: unknown[] };
      expect(securityResult.vulnerabilities).toBeDefined();
      expect(Array.isArray(securityResult.vulnerabilities)).toBe(true);
    });

    it('should calculate risk level', async () => {
      const task = createTestTask({
        title: 'Security risk assessment',
        description: 'Assess security risk of authentication module',
      });

      const result = await team.testProcessTask(task);
      const securityResult = result.outputs.result as { riskLevel: string };
      expect(securityResult.riskLevel).toBeDefined();
      expect(['critical', 'high', 'medium', 'low', 'none']).toContain(securityResult.riskLevel);
    });

    it('should provide recommendations', async () => {
      const task = createTestTask({
        title: 'Security recommendations',
        description: 'Provide security improvement recommendations for auth tokens',
      });

      const result = await team.testProcessTask(task);
      const securityResult = result.outputs.result as { recommendations: string[] };
      expect(securityResult.recommendations).toBeDefined();
      expect(securityResult.recommendations.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // Task Processing - Complexity Analysis
  // ============================================================================

  describe('Task Processing - Complexity Analysis', () => {
    it('should process complexity analysis task', async () => {
      const task = createTestTask({
        title: 'Cyclomatic complexity analysis',
        description: 'Analyze code complexity metrics',
      });

      const result = await team.testProcessTask(task);
      expect(result.success).toBe(true);
      expect(result.outputs.taskType).toBe('complexity-analysis');
    });

    it('should identify high complexity areas', async () => {
      const task = createTestTask({
        title: 'Complex code detection',
        description: 'Find functions with deeply nested conditionals',
      });

      const result = await team.testProcessTask(task);
      const reviewResult = result.outputs.result as { issues: unknown[] };
      expect(reviewResult.issues).toBeDefined();
    });
  });

  // ============================================================================
  // Task Processing - Style Check
  // ============================================================================

  describe('Task Processing - Style Check', () => {
    it('should process style check task', async () => {
      const task = createTestTask({
        title: 'Lint and format check',
        description: 'Check code style and formatting compliance',
      });

      const result = await team.testProcessTask(task);
      expect(result.success).toBe(true);
      expect(result.outputs.taskType).toBe('style-check');
    });

    it('should identify style issues', async () => {
      const task = createTestTask({
        title: 'Code style review',
        description: 'Check naming conventions and formatting',
      });

      const result = await team.testProcessTask(task);
      const reviewResult = result.outputs.result as { issues: unknown[] };
      expect(reviewResult.issues).toBeDefined();
    });
  });

  // ============================================================================
  // Task Processing - Performance Analysis
  // ============================================================================

  describe('Task Processing - Performance Analysis', () => {
    it('should process performance analysis task', async () => {
      const task = createTestTask({
        title: 'Performance optimization review',
        description: 'Analyze code for slow performance and memory issues',
      });

      const result = await team.testProcessTask(task);
      expect(result.success).toBe(true);
      expect(result.outputs.taskType).toBe('performance-analysis');
    });

    it('should identify performance issues', async () => {
      const task = createTestTask({
        title: 'Optimize slow function',
        description: 'Review slow loop with potential memory leak',
      });

      const result = await team.testProcessTask(task);
      const reviewResult = result.outputs.result as { issues: unknown[] };
      expect(reviewResult.issues).toBeDefined();
      expect(reviewResult.issues.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // Statistics
  // ============================================================================

  describe('Code Quality Statistics', () => {
    it('should track review statistics', async () => {
      const task = createTestTask({
        title: 'Code review',
        description: 'Review code changes',
      });

      await team.testProcessTask(task);

      const stats = team.getCodeQualityStats();
      expect(stats.reviewsCompleted).toBeGreaterThan(0);
    });

    it('should have initial stats at zero', () => {
      const freshTeam = new TestableCodeQualityTeam();
      const stats = freshTeam.getCodeQualityStats();

      expect(stats.reviewsCompleted).toBe(0);
      expect(stats.issuesFound).toBe(0);
      expect(stats.refactoringsApplied).toBe(0);
    });

    it('should return a copy of stats', () => {
      const stats1 = team.getCodeQualityStats();
      const stats2 = team.getCodeQualityStats();

      expect(stats1).not.toBe(stats2);
      expect(stats1).toEqual(stats2);
    });
  });

  // ============================================================================
  // Factory Function
  // ============================================================================

  describe('Factory Function', () => {
    it('should create team with defaults', () => {
      const factoryTeam = createCodeQualityTeam();
      expect(factoryTeam).toBeInstanceOf(CodeQualityTeam);
      expect(factoryTeam.type).toBe(TeamType.CODE_QUALITY);
    });

    it('should accept custom config', () => {
      const factoryTeam = createCodeQualityTeam({
        name: 'Custom Quality',
        linters: ['biome'],
        complexityThreshold: 20,
        reviewStrictness: 'lenient',
      });

      expect(factoryTeam.name).toBe('Custom Quality');
      expect(factoryTeam.getLinters()).toContain('biome');
      expect(factoryTeam.getComplexityThreshold()).toBe(20);
      expect(factoryTeam.getReviewStrictness()).toBe('lenient');
    });
  });

  // ============================================================================
  // Review Strictness Levels
  // ============================================================================

  describe('Review Strictness Levels', () => {
    it('should apply strict review threshold', async () => {
      const strictTeam = new TestableCodeQualityTeam({ reviewStrictness: 'strict' });
      const task = createTestTask({
        title: 'Review with strict standards',
        description: 'Apply highest quality standards',
      });

      const result = await strictTeam.testProcessTask(task);
      expect(result.success).toBe(true);
    });

    it('should apply lenient review threshold', async () => {
      const lenientTeam = new TestableCodeQualityTeam({ reviewStrictness: 'lenient' });
      const task = createTestTask({
        title: 'Review with lenient standards',
        description: 'Apply basic quality standards',
      });

      const result = await lenientTeam.testProcessTask(task);
      expect(result.success).toBe(true);
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle generic quality task', async () => {
      const task = createTestTask({
        title: 'Check code quality',
        description: 'General quality assessment',
      });

      const result = await team.testProcessTask(task);
      expect(result.success).toBe(true);
    });

    it('should handle task with file inputs', async () => {
      const task = createTestTask({
        title: 'Review specific files',
        description: 'Review these specific files',
        inputs: { files: ['src/auth.ts', 'src/user.ts', 'src/api.ts'] },
      });

      const result = await team.testProcessTask(task);
      expect(result.success).toBe(true);
    });

    it('should handle task with no inputs', async () => {
      const task = createTestTask({
        title: 'General review',
        description: 'Review the codebase',
        inputs: {},
      });

      const result = await team.testProcessTask(task);
      expect(result.success).toBe(true);
    });

    it('should extract files from description', async () => {
      const task = createTestTask({
        title: 'Review auth',
        description: 'Please review src/auth/login.ts and src/auth/register.tsx',
      });

      const result = await team.testProcessTask(task);
      expect(result.success).toBe(true);
    });
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe('Code Quality Team Integration', () => {
  it('should work with different linters', () => {
    const eslintTeam = createCodeQualityTeam({ linters: ['eslint'] });
    const biomeTeam = createCodeQualityTeam({ linters: ['biome'] });

    expect(eslintTeam.getLinters()).toContain('eslint');
    expect(biomeTeam.getLinters()).toContain('biome');
  });

  it('should work with different security scanners', () => {
    const npmAuditTeam = createCodeQualityTeam({ securityScanners: ['npm-audit'] });
    const snykTeam = createCodeQualityTeam({ securityScanners: ['snyk'] });

    expect(npmAuditTeam.getSecurityScanners()).toContain('npm-audit');
    expect(snykTeam.getSecurityScanners()).toContain('snyk');
  });

  it('should support different strictness levels', () => {
    const strictTeam = createCodeQualityTeam({ reviewStrictness: 'strict' });
    const lenientTeam = createCodeQualityTeam({ reviewStrictness: 'lenient' });

    expect(strictTeam.getReviewStrictness()).toBe('strict');
    expect(lenientTeam.getReviewStrictness()).toBe('lenient');
  });

  it('should support different complexity thresholds', () => {
    const lowThresholdTeam = createCodeQualityTeam({ complexityThreshold: 5 });
    const highThresholdTeam = createCodeQualityTeam({ complexityThreshold: 20 });

    expect(lowThresholdTeam.getComplexityThreshold()).toBe(5);
    expect(highThresholdTeam.getComplexityThreshold()).toBe(20);
  });
});
