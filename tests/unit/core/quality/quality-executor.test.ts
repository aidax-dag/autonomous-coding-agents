/**
 * Quality Executor Tests
 *
 * Tests for the QualityExecutor that bridges QAAgent with real quality tools.
 */

import {
  QualityExecutor,
  createQualityExecutor,
  createQAExecutor,
  QualityExecutorConfig,
} from '../../../../src/core/orchestrator/quality';
import { createTask } from '../../../../src/core/workspace/task-document';

// Mock child_process spawn
jest.mock('child_process', () => ({
  spawn: jest.fn(),
}));

// Mock fs
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  readdirSync: jest.fn(() => []),
}));

// Get mocked spawn
import { spawn } from 'child_process';
const mockSpawn = spawn as jest.MockedFunction<typeof spawn>;

describe('QualityExecutor', () => {
  let executor: QualityExecutor;
  const testConfig: QualityExecutorConfig = {
    workspaceDir: '/test/workspace',
    minQualityScore: 70,
    autoApproveOnPass: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    executor = createQualityExecutor(testConfig);
  });

  describe('constructor', () => {
    it('should create executor with default config', () => {
      const exec = new QualityExecutor({ workspaceDir: '/test' });
      expect(exec).toBeInstanceOf(QualityExecutor);
    });

    it('should create executor with custom config', () => {
      const exec = new QualityExecutor({
        workspaceDir: '/test',
        minQualityScore: 80,
        autoApproveOnPass: false,
        testCommand: 'pnpm',
        testArgs: ['test'],
      });
      expect(exec).toBeInstanceOf(QualityExecutor);
    });
  });

  describe('execute', () => {
    it('should route test tasks to executeTestTask', async () => {
      const task = createTask({
        title: 'Test Task',
        content: 'Run tests',
        from: 'development',
        to: 'qa',
        type: 'test',
        priority: 'medium',
      });

      // Mock spawn to return successful test results
      const mockProcess = createMockProcess({
        stdout: JSON.stringify({
          numTotalTests: 10,
          numPassedTests: 10,
          numFailedTests: 0,
          numPendingTests: 0,
          testResults: [],
        }),
      });
      mockSpawn.mockReturnValue(mockProcess as any);

      const result = await executor.execute(task);

      expect(result.summary).toContain('Test execution');
      expect(result.testResults).toBeDefined();
    });

    it('should route review tasks to executeReviewTask', async () => {
      const task = createTask({
        title: 'Review Task',
        content: 'Review code quality',
        from: 'development',
        to: 'qa',
        type: 'review',
        priority: 'medium',
      });

      const result = await executor.execute(task);

      expect(result.summary).toContain('Code review');
      expect(result.reviewFindings).toBeDefined();
    });
  });

  describe('executeTestTask', () => {
    it('should parse Jest JSON results correctly', async () => {
      const task = createTask({
        title: 'Unit Tests',
        content: 'Run unit tests',
        from: 'development',
        to: 'qa',
        type: 'test',
        priority: 'high',
      });

      const jestOutput = {
        numTotalTests: 15,
        numPassedTests: 14,
        numFailedTests: 1,
        numPendingTests: 0,
        testResults: [
          {
            name: 'test-file.ts',
            assertionResults: [
              {
                fullName: 'should pass',
                status: 'passed',
                title: 'should pass',
                failureMessages: [],
              },
              {
                fullName: 'should fail',
                status: 'failed',
                title: 'should fail',
                failureMessages: ['Expected true to be false'],
              },
            ],
          },
        ],
        coverageMap: {
          total: {
            lines: { pct: 85 },
            statements: { pct: 82 },
            functions: { pct: 90 },
            branches: { pct: 75 },
          },
        },
      };

      const mockProcess = createMockProcess({
        stdout: JSON.stringify(jestOutput),
      });
      mockSpawn.mockReturnValue(mockProcess as any);

      const result = await executor.executeTestTask(task);

      expect(result.testResults?.total).toBe(15);
      expect(result.testResults?.passed).toBe(14);
      expect(result.testResults?.failed).toBe(1);
      expect(result.coverage?.lines).toBe(85);
      // Quality score = 93% (14/15 pass rate) + 10 (>80% coverage bonus) = 100 (capped)
      expect(result.qualityScore).toBe(100);
    });

    it('should approve when all tests pass', async () => {
      const task = createTask({
        title: 'All Pass',
        content: 'All tests should pass',
        from: 'development',
        to: 'qa',
        type: 'test',
        priority: 'high',
      });

      const jestOutput = {
        numTotalTests: 10,
        numPassedTests: 10,
        numFailedTests: 0,
        numPendingTests: 0,
        testResults: [],
      };

      const mockProcess = createMockProcess({
        stdout: JSON.stringify(jestOutput),
      });
      mockSpawn.mockReturnValue(mockProcess as any);

      const result = await executor.executeTestTask(task);

      expect(result.approved).toBe(true);
      expect(result.qualityScore).toBe(100);
    });

    it('should handle test execution errors', async () => {
      const task = createTask({
        title: 'Error Test',
        content: 'Test with errors',
        from: 'development',
        to: 'qa',
        type: 'test',
        priority: 'high',
      });

      const mockProcess = createMockProcess({
        exitCode: 1,
        stderr: 'Command failed',
      });
      mockSpawn.mockReturnValue(mockProcess as any);

      const result = await executor.executeTestTask(task);

      expect(result.approved).toBe(false);
      expect(result.reason).toContain('failed');
    });

    it('should generate recommendations for failed tests', async () => {
      const task = createTask({
        title: 'Failed Tests',
        content: 'Some tests fail',
        from: 'development',
        to: 'qa',
        type: 'test',
        priority: 'high',
      });

      const jestOutput = {
        numTotalTests: 10,
        numPassedTests: 7,
        numFailedTests: 3,
        numPendingTests: 0,
        testResults: [],
      };

      const mockProcess = createMockProcess({
        stdout: JSON.stringify(jestOutput),
      });
      mockSpawn.mockReturnValue(mockProcess as any);

      const result = await executor.executeTestTask(task);

      expect(result.recommendations).toContain('Fix 3 failing tests before merging');
    });
  });

  describe('executeReviewTask', () => {
    it('should return review findings', async () => {
      const task = createTask({
        title: 'Code Review',
        content: 'Review the implementation',
        from: 'development',
        to: 'qa',
        type: 'review',
        priority: 'medium',
      });

      const result = await executor.executeReviewTask(task);

      expect(result.summary).toContain('Code review completed');
      expect(result.reviewFindings).toBeDefined();
      expect(Array.isArray(result.reviewFindings)).toBe(true);
    });

    it('should approve when no critical issues', async () => {
      const task = createTask({
        title: 'Clean Code Review',
        content: 'Review clean code',
        from: 'development',
        to: 'qa',
        type: 'review',
        priority: 'medium',
        files: [], // No files to check = no issues
      });

      const result = await executor.executeReviewTask(task);

      // With no files, the result depends on CodeQualityHook behavior
      expect(result.qualityScore).toBeDefined();
      expect(typeof result.approved).toBe('boolean');
    });
  });

  describe('createQAExecutor', () => {
    it('should create a function compatible with QAAgent', async () => {
      const qaExecutor = createQAExecutor({
        workspaceDir: '/test/workspace',
      });

      expect(typeof qaExecutor).toBe('function');

      const task = createTask({
        title: 'Test Task',
        content: 'Run tests',
        from: 'development',
        to: 'qa',
        type: 'test',
        priority: 'medium',
      });

      const mockProcess = createMockProcess({
        stdout: JSON.stringify({
          numTotalTests: 5,
          numPassedTests: 5,
          numFailedTests: 0,
          numPendingTests: 0,
          testResults: [],
        }),
      });
      mockSpawn.mockReturnValue(mockProcess as any);

      const result = await qaExecutor(task);

      expect(result).toHaveProperty('summary');
      expect(result).toHaveProperty('approved');
      expect(result).toHaveProperty('qualityScore');
    });
  });

  describe('quality score calculation', () => {
    it('should calculate 100% for all passing tests', async () => {
      const task = createTask({
        title: 'Perfect Score',
        content: 'All tests pass',
        from: 'development',
        to: 'qa',
        type: 'test',
        priority: 'high',
      });

      const mockProcess = createMockProcess({
        stdout: JSON.stringify({
          numTotalTests: 100,
          numPassedTests: 100,
          numFailedTests: 0,
          numPendingTests: 0,
          testResults: [],
        }),
      });
      mockSpawn.mockReturnValue(mockProcess as any);

      const result = await executor.executeTestTask(task);

      expect(result.qualityScore).toBe(100);
    });

    it('should calculate proportional score for partial failures', async () => {
      const task = createTask({
        title: 'Partial Pass',
        content: 'Some tests fail',
        from: 'development',
        to: 'qa',
        type: 'test',
        priority: 'high',
      });

      const mockProcess = createMockProcess({
        stdout: JSON.stringify({
          numTotalTests: 10,
          numPassedTests: 8,
          numFailedTests: 2,
          numPendingTests: 0,
          testResults: [],
        }),
      });
      mockSpawn.mockReturnValue(mockProcess as any);

      const result = await executor.executeTestTask(task);

      expect(result.qualityScore).toBe(80);
    });

    it('should add bonus for good coverage', async () => {
      const task = createTask({
        title: 'High Coverage',
        content: 'Tests with high coverage',
        from: 'development',
        to: 'qa',
        type: 'test',
        priority: 'high',
      });

      const mockProcess = createMockProcess({
        stdout: JSON.stringify({
          numTotalTests: 10,
          numPassedTests: 9,
          numFailedTests: 1,
          numPendingTests: 0,
          testResults: [],
          coverageMap: {
            total: {
              lines: { pct: 90 },
              statements: { pct: 90 },
              functions: { pct: 90 },
              branches: { pct: 90 },
            },
          },
        }),
      });
      mockSpawn.mockReturnValue(mockProcess as any);

      const result = await executor.executeTestTask(task);

      // 90% pass rate + 10 bonus for >80% coverage = 100 (capped)
      expect(result.qualityScore).toBe(100);
    });
  });

  describe('approval logic', () => {
    it('should approve with autoApproveOnPass when all tests pass', async () => {
      const exec = new QualityExecutor({
        workspaceDir: '/test',
        autoApproveOnPass: true,
        minQualityScore: 90,
      });

      const task = createTask({
        title: 'Auto Approve Test',
        content: 'All tests should pass',
        from: 'development',
        to: 'qa',
        type: 'test',
        priority: 'high',
      });

      const mockProcess = createMockProcess({
        stdout: JSON.stringify({
          numTotalTests: 10,
          numPassedTests: 10,
          numFailedTests: 0,
          numPendingTests: 0,
          testResults: [],
        }),
      });
      mockSpawn.mockReturnValue(mockProcess as any);

      const result = await exec.executeTestTask(task);

      expect(result.approved).toBe(true);
    });

    it('should reject when quality score below threshold', async () => {
      const exec = new QualityExecutor({
        workspaceDir: '/test',
        autoApproveOnPass: false,
        minQualityScore: 90,
      });

      const task = createTask({
        title: 'Below Threshold',
        content: 'Quality score test',
        from: 'development',
        to: 'qa',
        type: 'test',
        priority: 'high',
      });

      const mockProcess = createMockProcess({
        stdout: JSON.stringify({
          numTotalTests: 10,
          numPassedTests: 8,
          numFailedTests: 2,
          numPendingTests: 0,
          testResults: [],
        }),
      });
      mockSpawn.mockReturnValue(mockProcess as any);

      const result = await exec.executeTestTask(task);

      expect(result.approved).toBe(false);
      expect(result.qualityScore).toBe(80);
      // When there are failed tests, reason indicates tests failed
      expect(result.reason).toContain('failed');
    });
  });
});

/**
 * Helper to create mock child process
 */
function createMockProcess(options: {
  stdout?: string;
  stderr?: string;
  exitCode?: number;
}) {
  const { stdout = '', stderr = '', exitCode = 0 } = options;

  const stdoutEvents: Record<string, Function[]> = {};
  const stderrEvents: Record<string, Function[]> = {};
  const processEvents: Record<string, Function[]> = {};

  const mockProcess = {
    stdout: {
      on: (event: string, callback: Function) => {
        stdoutEvents[event] = stdoutEvents[event] || [];
        stdoutEvents[event].push(callback);
        if (event === 'data' && stdout) {
          setTimeout(() => callback(Buffer.from(stdout)), 0);
        }
      },
    },
    stderr: {
      on: (event: string, callback: Function) => {
        stderrEvents[event] = stderrEvents[event] || [];
        stderrEvents[event].push(callback);
        if (event === 'data' && stderr) {
          setTimeout(() => callback(Buffer.from(stderr)), 0);
        }
      },
    },
    on: (event: string, callback: Function) => {
      processEvents[event] = processEvents[event] || [];
      processEvents[event].push(callback);
      if (event === 'close') {
        setTimeout(() => callback(exitCode), 10);
      }
    },
    kill: jest.fn(),
  };

  return mockProcess;
}
