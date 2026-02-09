/**
 * Quality Executor Tests
 */

import { QualityExecutor, createQualityExecutor, createQAExecutor } from '../../../../src/core/orchestrator/quality/quality-executor';
import type { TaskDocument } from '../../../../src/core/workspace/task-document';
import { IssueSeverity } from '../../../../src/core/hooks/code-quality/code-quality.interface';

// ============================================================================
// Mocks
// ============================================================================

// Mock CodeQualityHook
const mockCheck = jest.fn().mockResolvedValue({
  passed: true,
  score: 90,
  issues: [],
  metrics: {},
});

jest.mock('../../../../src/core/hooks/code-quality/code-quality.hook', () => ({
  CodeQualityHook: jest.fn().mockImplementation(() => ({
    check: mockCheck,
  })),
}));

// Mock TestResultParser
jest.mock('../../../../src/shared/ci/test-parser', () => ({
  TestResultParser: jest.fn().mockImplementation(() => ({
    parseJestResults: jest.fn().mockReturnValue({
      totalTests: 10,
      passed: 9,
      failed: 1,
      skipped: 0,
      duration: 5000,
      failures: [{ name: 'test1', message: 'assertion failed', stack: '' }],
    }),
    parsePytestResults: jest.fn().mockReturnValue({
      totalTests: 5,
      passed: 5,
      failed: 0,
      skipped: 0,
      duration: 2000,
      failures: [],
    }),
  })),
}));

// Mock child_process.spawn — use a deferred pattern to avoid hoisting issues
jest.mock('child_process', () => {
  const mockStdout = { on: jest.fn() };
  const mockStderr = { on: jest.fn() };
  const mockProc = {
    stdout: mockStdout,
    stderr: mockStderr,
    on: jest.fn(),
    kill: jest.fn(),
  };
  return {
    spawn: jest.fn().mockReturnValue(mockProc),
    __mockProc: mockProc,
    __mockStdout: mockStdout,
    __mockStderr: mockStderr,
  };
});

// Mock fs
jest.mock('fs', () => ({
  readdirSync: jest.fn().mockReturnValue([]),
  existsSync: jest.fn().mockReturnValue(false),
}));

// ============================================================================
// Helpers
// ============================================================================

function getSpawnMocks() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const cp = require('child_process');
  return {
    spawn: cp.spawn as jest.Mock,
    proc: cp.__mockProc as { stdout: { on: jest.Mock }; stderr: { on: jest.Mock }; on: jest.Mock; kill: jest.Mock },
    stdout: cp.__mockStdout as { on: jest.Mock },
    stderr: cp.__mockStderr as { on: jest.Mock },
  };
}

function makeTask(overrides: Partial<{
  title: string;
  type: string;
  content: string;
  files: Array<{ path: string; action: string }>;
}> = {}): TaskDocument {
  return {
    metadata: {
      id: 'task-1',
      title: overrides.title || 'Test Task',
      type: overrides.type || 'test',
      from: 'development',
      to: 'qa',
      priority: 'medium',
      status: 'pending',
      tags: [],
      files: overrides.files || [],
    },
    content: overrides.content || 'Run tests',
  } as unknown as TaskDocument;
}

function simulateProcessOutput(stdout: string, exitCode = 0): void {
  const { proc, stdout: stdoutMock, stderr: stderrMock } = getSpawnMocks();

  stdoutMock.on.mockImplementation((event: string, cb: (data: Buffer) => void) => {
    if (event === 'data') {
      cb(Buffer.from(stdout));
    }
  });
  stderrMock.on.mockImplementation(() => {});

  proc.on.mockImplementation((event: string, cb: (...args: any[]) => void) => {
    if (event === 'close') {
      setTimeout(() => cb(exitCode), 0);
    }
  });
}

function createExecutor(overrides?: Partial<Parameters<typeof createQualityExecutor>[0]>) {
  return new QualityExecutor({
    workspaceDir: '/tmp/test-workspace',
    ...overrides,
  });
}

// ============================================================================
// Tests
// ============================================================================

describe('QualityExecutor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================================================
  // Constructor
  // ==========================================================================

  describe('constructor', () => {
    it('should create with default config', () => {
      const executor = createExecutor();
      expect(executor).toBeDefined();
    });

    it('should accept custom config', () => {
      const executor = createExecutor({
        minQualityScore: 90,
        testCommand: 'yarn',
        testTimeout: 60000,
      });
      expect(executor).toBeDefined();
    });
  });

  // ==========================================================================
  // execute - routing
  // ==========================================================================

  describe('execute - routing', () => {
    it('should route test-type tasks to executeTestTask', async () => {
      simulateProcessOutput('{"numTotalTests": 5}');
      const executor = createExecutor();

      const result = await executor.execute(makeTask({ type: 'test' }));
      expect(result.summary).toContain('Test execution');
    });

    it('should route tasks with "test" in content to executeTestTask', async () => {
      simulateProcessOutput('{"numTotalTests": 5}');
      const executor = createExecutor();

      const result = await executor.execute(
        makeTask({ type: 'review', content: 'Run the test suite' }),
      );
      expect(result.summary).toContain('Test execution');
    });

    it('should route review-type tasks to executeReviewTask', async () => {
      const executor = createExecutor();

      const result = await executor.execute(
        makeTask({ type: 'review', content: 'Review the code quality' }),
      );
      expect(result.summary).toContain('Code review');
    });
  });

  // ==========================================================================
  // executeTestTask
  // ==========================================================================

  describe('executeTestTask', () => {
    it('should handle test execution and return QAOutput', async () => {
      simulateProcessOutput('{"numTotalTests": 10, "numPassedTests": 9}');
      const executor = createExecutor();

      const result = await executor.executeTestTask(makeTask());

      expect(result.summary).toContain('Test execution completed');
      expect(result.testResults).toBeDefined();
      expect(result.testResults!.total).toBe(10);
      expect(result.testResults!.passed).toBe(9);
      expect(result.testResults!.failed).toBe(1);
      expect(result.qualityScore).toBeDefined();
    });

    it('should return failure output on test execution error', async () => {
      const { proc, stdout, stderr } = getSpawnMocks();
      stdout.on.mockImplementation(() => {});
      stderr.on.mockImplementation(() => {});
      proc.on.mockImplementation((event: string, cb: (...args: any[]) => void) => {
        if (event === 'error') {
          setTimeout(() => cb(new Error('spawn failed')), 0);
        }
      });

      const executor = createExecutor();
      const result = await executor.executeTestTask(makeTask());

      expect(result.summary).toContain('Test execution failed');
      expect(result.approved).toBe(false);
      expect(result.qualityScore).toBe(0);
    });
  });

  // ==========================================================================
  // executeReviewTask
  // ==========================================================================

  describe('executeReviewTask', () => {
    it('should run code quality checks and return review output', async () => {
      mockCheck.mockResolvedValueOnce({
        passed: true,
        score: 90,
        issues: [],
        metrics: {},
      });

      const executor = createExecutor();
      const result = await executor.executeReviewTask(
        makeTask({ type: 'review', content: 'Review code' }),
      );

      expect(result.summary).toContain('Code review completed');
      expect(result.reviewFindings).toBeDefined();
      expect(result.qualityScore).toBeDefined();
    });

    it('should detect critical issues and reject', async () => {
      mockCheck.mockResolvedValueOnce({
        passed: false,
        score: 40,
        issues: [
          {
            severity: IssueSeverity.ERROR,
            message: 'Type error found',
            checkType: 'type-check',
            location: { file: 'src/app.ts', line: 10 },
          },
        ],
        metrics: {},
      });

      const executor = createExecutor();
      const result = await executor.executeReviewTask(
        makeTask({ type: 'review', content: 'Review code' }),
      );

      expect(result.approved).toBe(false);
      expect(result.reviewFindings!.length).toBeGreaterThan(0);
      expect(result.reviewFindings![0].severity).toBe('critical');
    });

    it('should approve when no critical issues and score meets threshold', async () => {
      mockCheck.mockResolvedValueOnce({
        passed: true,
        score: 95,
        issues: [
          {
            severity: IssueSeverity.INFO,
            message: 'Consider using const',
            checkType: 'lint',
            location: { file: 'src/app.ts', line: 5 },
          },
        ],
        metrics: {},
      });

      const executor = createExecutor();
      const result = await executor.executeReviewTask(
        makeTask({ type: 'review', content: 'Review code' }),
      );

      expect(result.approved).toBe(true);
    });

    it('should handle review execution failure', async () => {
      mockCheck.mockRejectedValueOnce(new Error('Check failed'));

      const executor = createExecutor();
      const result = await executor.executeReviewTask(
        makeTask({ type: 'review', content: 'Review code' }),
      );

      expect(result.summary).toContain('Code review failed');
      expect(result.approved).toBe(false);
      expect(result.qualityScore).toBe(0);
    });

    it('should extract files from task metadata', async () => {
      mockCheck.mockResolvedValueOnce({
        passed: true,
        score: 100,
        issues: [],
        metrics: {},
      });

      const executor = createExecutor();
      await executor.executeReviewTask(
        makeTask({
          type: 'review',
          content: 'Review',
          files: [
            { path: 'src/auth.ts', action: 'modify' },
            { path: '/absolute/path.ts', action: 'create' },
          ],
        }),
      );

      expect(mockCheck).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.stringContaining('auth.ts'),
          '/absolute/path.ts',
        ]),
        expect.any(Array),
      );
    });
  });

  // ==========================================================================
  // Severity mapping
  // ==========================================================================

  describe('severity mapping', () => {
    it('should map ERROR to critical', async () => {
      mockCheck.mockResolvedValueOnce({
        passed: false,
        score: 0,
        issues: [
          { severity: IssueSeverity.ERROR, message: 'err', checkType: 'lint', location: { file: 'a.ts', line: 1 } },
        ],
        metrics: {},
      });

      const executor = createExecutor();
      const result = await executor.executeReviewTask(makeTask({ type: 'review', content: 'review' }));
      expect(result.reviewFindings![0].severity).toBe('critical');
    });

    it('should map WARNING to major', async () => {
      mockCheck.mockResolvedValueOnce({
        passed: true,
        score: 80,
        issues: [
          { severity: IssueSeverity.WARNING, message: 'warn', checkType: 'lint', location: { file: 'a.ts', line: 1 } },
        ],
        metrics: {},
      });

      const executor = createExecutor();
      const result = await executor.executeReviewTask(makeTask({ type: 'review', content: 'review' }));
      expect(result.reviewFindings![0].severity).toBe('major');
    });

    it('should map INFO to minor', async () => {
      mockCheck.mockResolvedValueOnce({
        passed: true,
        score: 90,
        issues: [
          { severity: IssueSeverity.INFO, message: 'info', checkType: 'lint', location: { file: 'a.ts', line: 1 } },
        ],
        metrics: {},
      });

      const executor = createExecutor();
      const result = await executor.executeReviewTask(makeTask({ type: 'review', content: 'review' }));
      expect(result.reviewFindings![0].severity).toBe('minor');
    });

    it('should map HINT to info', async () => {
      mockCheck.mockResolvedValueOnce({
        passed: true,
        score: 95,
        issues: [
          { severity: IssueSeverity.HINT, message: 'hint', checkType: 'lint', location: { file: 'a.ts', line: 1 } },
        ],
        metrics: {},
      });

      const executor = createExecutor();
      const result = await executor.executeReviewTask(makeTask({ type: 'review', content: 'review' }));
      expect(result.reviewFindings![0].severity).toBe('info');
    });
  });

  // ==========================================================================
  // Recommendations
  // ==========================================================================

  describe('recommendations', () => {
    it('should recommend fixing failing tests', async () => {
      simulateProcessOutput('{"numTotalTests": 10}');
      const executor = createExecutor();

      const result = await executor.executeTestTask(makeTask());

      // The mock returns 1 failure
      expect(result.recommendations).toEqual(
        expect.arrayContaining([expect.stringContaining('failing test')]),
      );
    });

    it('should recommend fixing critical review issues', async () => {
      mockCheck.mockResolvedValueOnce({
        passed: false,
        score: 30,
        issues: [
          { severity: IssueSeverity.ERROR, message: 'critical bug', checkType: 'lint', location: { file: 'a.ts', line: 1 } },
        ],
        metrics: {},
      });

      const executor = createExecutor();
      const result = await executor.executeReviewTask(makeTask({ type: 'review', content: 'review' }));

      expect(result.recommendations).toEqual(
        expect.arrayContaining([expect.stringContaining('critical')]),
      );
    });

    it('should recommend addressing major review issues', async () => {
      mockCheck.mockResolvedValueOnce({
        passed: false,
        score: 60,
        issues: [
          { severity: IssueSeverity.WARNING, message: 'warn1', checkType: 'lint', location: { file: 'a.ts', line: 1 } },
          { severity: IssueSeverity.WARNING, message: 'warn2', checkType: 'lint', location: { file: 'b.ts', line: 2 } },
        ],
        metrics: {},
      });

      const executor = createExecutor();
      const result = await executor.executeReviewTask(makeTask({ type: 'review', content: 'review' }));

      expect(result.recommendations).toEqual(
        expect.arrayContaining([expect.stringContaining('major')]),
      );
    });
  });

  // ==========================================================================
  // Approval logic
  // ==========================================================================

  describe('approval logic', () => {
    it('should approve review when no critical issues and score above threshold', async () => {
      mockCheck.mockResolvedValueOnce({
        passed: true,
        score: 100,
        issues: [],
        metrics: {},
      });

      const executor = createExecutor({ minQualityScore: 70 });
      const result = await executor.executeReviewTask(makeTask({ type: 'review', content: 'review' }));
      expect(result.approved).toBe(true);
    });

    it('should reject review when critical issues present', async () => {
      mockCheck.mockResolvedValueOnce({
        passed: false,
        score: 50,
        issues: [
          { severity: IssueSeverity.ERROR, message: 'err', checkType: 'lint', location: { file: 'a.ts', line: 1 } },
        ],
        metrics: {},
      });

      const executor = createExecutor();
      const result = await executor.executeReviewTask(makeTask({ type: 'review', content: 'review' }));
      expect(result.approved).toBe(false);
    });

    it('should reject review when score below minimum', async () => {
      mockCheck.mockResolvedValueOnce({
        passed: true,
        score: 40,
        issues: [
          { severity: IssueSeverity.WARNING, message: 'w1', checkType: 'lint', location: { file: 'a.ts', line: 1 } },
          { severity: IssueSeverity.WARNING, message: 'w2', checkType: 'lint', location: { file: 'a.ts', line: 2 } },
          { severity: IssueSeverity.WARNING, message: 'w3', checkType: 'lint', location: { file: 'a.ts', line: 3 } },
          { severity: IssueSeverity.WARNING, message: 'w4', checkType: 'lint', location: { file: 'a.ts', line: 4 } },
        ],
        metrics: {},
      });

      const executor = createExecutor({ minQualityScore: 90 });
      const result = await executor.executeReviewTask(makeTask({ type: 'review', content: 'review' }));
      expect(result.approved).toBe(false);
    });
  });
});

// ============================================================================
// Factory Functions
// ============================================================================

describe('factory functions', () => {
  it('createQualityExecutor should create executor', () => {
    const executor = createQualityExecutor({ workspaceDir: '/tmp/test' });
    expect(executor).toBeInstanceOf(QualityExecutor);
  });

  it('createQAExecutor should create executor function', () => {
    const executorFn = createQAExecutor({ workspaceDir: '/tmp/test' });
    expect(typeof executorFn).toBe('function');
  });
});
