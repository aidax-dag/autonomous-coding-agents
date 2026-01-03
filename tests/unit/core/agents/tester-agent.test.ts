/**
 * TesterAgent Unit Tests
 *
 * Feature: F1.7 - Tester Agent Enhance
 */

import {
  TesterAgent,
  TesterAgentConfig,
  createTesterAgent,
  TestExecutionPayloadSchema,
  TestGenerationPayloadSchema,
  TestAnalysisPayloadSchema,
  GeneratedTestResponseSchema,
  TestAnalysisResponseSchema,
  ITestRunner,
  TestRunResult,
} from '../../../../src/core/agents/specialized/tester-agent';
import {
  AgentType,
  AgentStatus,
  TaskPriority,
  type ITask,
} from '../../../../src/core/interfaces';
import type {
  AgentDependencies,
  ILLMClient,
  IMessageBroker,
  IAgentLogger,
  LLMResponse,
} from '../../../../src/core/agents/interfaces';

// ============================================================================
// Mock Factories
// ============================================================================

const createMockLLMClient = (): ILLMClient => ({
  complete: jest.fn().mockResolvedValue({
    content: JSON.stringify({
      testFile: {
        path: 'test/example.test.ts',
        content: 'describe("example", () => { it("works", () => {}); });',
      },
      testCases: [
        { name: 'should work', description: 'Basic functionality test', type: 'unit' },
      ],
      mocks: [],
      summary: 'Generated 1 test case',
    }),
    usage: { inputTokens: 100, outputTokens: 200, totalTokens: 300 },
    stopReason: 'end',
  } as LLMResponse),
  stream: jest.fn(),
  getProvider: jest.fn().mockReturnValue('claude'),
  getModel: jest.fn().mockReturnValue('claude-3'),
});

const createMockMessageBroker = (): IMessageBroker => ({
  publish: jest.fn().mockResolvedValue(undefined),
  subscribe: jest.fn().mockResolvedValue(undefined),
  unsubscribe: jest.fn().mockResolvedValue(undefined),
  request: jest.fn().mockResolvedValue({}),
  isConnected: jest.fn().mockReturnValue(true),
  connect: jest.fn().mockResolvedValue(undefined),
  disconnect: jest.fn().mockResolvedValue(undefined),
});

const createMockLogger = (): IAgentLogger => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  child: jest.fn().mockReturnThis(),
});

const createMockTestRunner = (): ITestRunner => ({
  runTests: jest.fn().mockResolvedValue({
    success: true,
    total: 10,
    passed: 9,
    failed: 1,
    skipped: 0,
    duration: 5000,
    failedTests: [
      {
        name: 'should handle edge case',
        file: 'test/example.test.ts',
        error: 'Expected true but got false',
        stack: 'Error at line 42',
      },
    ],
    coverage: {
      statements: 85,
      branches: 78,
      functions: 90,
      lines: 82,
    },
  } as TestRunResult),
});

const createDependencies = (): AgentDependencies => ({
  llmClient: createMockLLMClient(),
  messageBroker: createMockMessageBroker(),
  logger: createMockLogger(),
});

const createConfig = (overrides?: Partial<TesterAgentConfig>): TesterAgentConfig => ({
  id: 'tester-test-1',
  type: AgentType.TESTER,
  name: 'Test Tester Agent',
  llm: { provider: 'claude', model: 'claude-3' },
  ...overrides,
});

// ============================================================================
// Tests
// ============================================================================

describe('TesterAgent', () => {
  let agent: TesterAgent;
  let dependencies: AgentDependencies;
  let testRunner: ITestRunner;

  beforeEach(() => {
    dependencies = createDependencies();
    testRunner = createMockTestRunner();
  });

  afterEach(async () => {
    if (agent) {
      try {
        await agent.dispose();
      } catch {
        // Already disposed, ignore
      }
    }
  });

  describe('Construction', () => {
    it('should create agent with default config', () => {
      agent = new TesterAgent(createConfig(), dependencies);

      expect(agent.id).toBe('tester-test-1');
      expect(agent.name).toBe('Test Tester Agent');
      expect(agent.type).toBe(AgentType.TESTER);
      expect(agent.getState().status).toBe(AgentStatus.STOPPED);
    });

    it('should create agent with test runner', () => {
      agent = new TesterAgent(
        createConfig({ testRunner }),
        dependencies
      );

      expect(agent).toBeInstanceOf(TesterAgent);
    });

    it('should accept custom configuration', () => {
      agent = new TesterAgent(
        createConfig({
          defaultTimeout: 600000,
          coverageThresholds: {
            statements: 90,
            branches: 85,
            functions: 95,
            lines: 90,
          },
          retry: {
            maxAttempts: 5,
            baseDelay: 2000,
            maxDelay: 20000,
          },
        }),
        dependencies
      );

      expect(agent).toBeInstanceOf(TesterAgent);
    });
  });

  describe('Lifecycle', () => {
    beforeEach(() => {
      agent = new TesterAgent(
        createConfig({ testRunner }),
        dependencies
      );
    });

    it('should initialize successfully', async () => {
      await agent.initialize();

      expect(agent.getState().status).toBe(AgentStatus.IDLE);
      expect(dependencies.logger.info).toHaveBeenCalledWith(
        'TesterAgent initializing',
        expect.objectContaining({
          hasTestRunner: true,
        })
      );
    });

    it('should start successfully', async () => {
      await agent.initialize();
      await agent.start();

      expect(agent.getState().status).toBe(AgentStatus.IDLE);
    });

    it('should pause and resume', async () => {
      await agent.initialize();
      await agent.start();

      await agent.pause();
      expect(agent.getState().status).toBe(AgentStatus.PAUSED);

      await agent.resume();
      expect(agent.getState().status).toBe(AgentStatus.IDLE);
    });

    it('should stop gracefully', async () => {
      await agent.initialize();
      await agent.start();
      await agent.stop();

      expect(agent.getState().status).toBe(AgentStatus.STOPPED);
    });

    it('should dispose and cleanup', async () => {
      await agent.initialize();
      await agent.start();
      await agent.dispose();

      expect(() => agent.getState()).toThrow('Agent has been disposed');
    });
  });

  describe('Capabilities', () => {
    it('should return base capabilities without test runner', () => {
      agent = new TesterAgent(createConfig(), dependencies);

      const capabilities = agent.getCapabilities();

      expect(capabilities).toContainEqual(
        expect.objectContaining({ name: 'test-generation' })
      );
      expect(capabilities).toContainEqual(
        expect.objectContaining({ name: 'test-analysis' })
      );
      expect(capabilities).not.toContainEqual(
        expect.objectContaining({ name: 'test-execution' })
      );
    });

    it('should include test-execution when test runner is configured', () => {
      agent = new TesterAgent(
        createConfig({ testRunner }),
        dependencies
      );

      const capabilities = agent.getCapabilities();

      expect(capabilities).toContainEqual(
        expect.objectContaining({ name: 'test-execution' })
      );
    });
  });

  describe('Test Execution Task', () => {
    const createTestExecutionTask = (): ITask => ({
      id: 'task-exec-1',
      type: 'test-execution',
      agentType: AgentType.TESTER,
      payload: {
        repository: { owner: 'testorg', repo: 'testrepo' },
        testType: 'unit',
        coverage: true,
        timeout: 60000,
        parallel: true,
      },
      priority: TaskPriority.NORMAL,
      createdAt: new Date(),
    });

    beforeEach(async () => {
      agent = new TesterAgent(
        createConfig({ testRunner }),
        dependencies
      );
      await agent.initialize();
      await agent.start();
    });

    it('should process test execution task successfully', async () => {
      const task = createTestExecutionTask();
      const result = await agent.processTask(task);

      expect(result.success).toBe(true);
      expect(result.taskId).toBe(task.id);
      expect(result.data).toBeDefined();
      const data = result.data as { results: { total: number } };
      expect(data.results).toBeDefined();
      expect(data.results.total).toBe(10);
    });

    it('should call test runner with correct options', async () => {
      const task = createTestExecutionTask();
      await agent.processTask(task);

      expect(testRunner.runTests).toHaveBeenCalledWith(
        expect.objectContaining({
          testType: 'unit',
          coverage: true,
          timeout: 60000,
          parallel: true,
        })
      );
    });

    it('should fail without test runner', async () => {
      const agentWithoutRunner = new TesterAgent(createConfig(), dependencies);
      await agentWithoutRunner.initialize();
      await agentWithoutRunner.start();

      const task = createTestExecutionTask();
      const result = await agentWithoutRunner.processTask(task);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Test runner not configured');

      await agentWithoutRunner.dispose();
    });

    it('should fail with invalid payload', async () => {
      const task: ITask = {
        id: 'task-invalid',
        type: 'test-execution',
        agentType: AgentType.TESTER,
        payload: { invalid: 'payload' },
        priority: TaskPriority.NORMAL,
        createdAt: new Date(),
      };

      const result = await agent.processTask(task);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Invalid payload');
    });
  });

  describe('Test Generation Task', () => {
    const createTestGenerationTask = (): ITask => ({
      id: 'task-gen-1',
      type: 'test-generation',
      agentType: AgentType.TESTER,
      payload: {
        sourceFile: 'src/utils/calculator.ts',
        sourceCode: 'export function add(a: number, b: number): number { return a + b; }',
        testFramework: 'jest',
        testType: 'unit',
        mockDependencies: true,
        includeEdgeCases: true,
      },
      priority: TaskPriority.NORMAL,
      createdAt: new Date(),
    });

    beforeEach(async () => {
      agent = new TesterAgent(createConfig(), dependencies);
      await agent.initialize();
      await agent.start();
    });

    it('should process test generation task successfully', async () => {
      const task = createTestGenerationTask();
      const result = await agent.processTask(task);

      expect(result.success).toBe(true);
      expect(result.taskId).toBe(task.id);
      expect(result.data).toBeDefined();
      const data = result.data as { generatedTests: unknown };
      expect(data.generatedTests).toBeDefined();
    });

    it('should call LLM for test generation', async () => {
      const task = createTestGenerationTask();
      await agent.processTask(task);

      expect(dependencies.llmClient.complete).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ role: 'system' }),
          expect.objectContaining({ role: 'user' }),
        ]),
        expect.objectContaining({ maxTokens: 4000 })
      );
    });

    it('should fail without source code in payload', async () => {
      const task: ITask = {
        id: 'task-gen-invalid',
        type: 'test-generation',
        agentType: AgentType.TESTER,
        payload: {
          sourceFile: 'src/utils/calculator.ts',
          testFramework: 'jest',
        },
        priority: TaskPriority.NORMAL,
        createdAt: new Date(),
      };

      const result = await agent.processTask(task);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Invalid payload');
    });
  });

  describe('Test Analysis Task', () => {
    const createTestAnalysisTask = (): ITask => ({
      id: 'task-analysis-1',
      type: 'test-analysis',
      agentType: AgentType.TESTER,
      payload: {
        testResults: {
          total: 100,
          passed: 95,
          failed: 3,
          skipped: 2,
          duration: 30000,
        },
        failedTests: [
          {
            name: 'should validate input',
            error: 'Expected validation to fail',
            file: 'test/validator.test.ts',
          },
        ],
        coverage: {
          statements: 85,
          branches: 78,
          functions: 90,
          lines: 82,
        },
      },
      priority: TaskPriority.NORMAL,
      createdAt: new Date(),
    });

    beforeEach(async () => {
      agent = new TesterAgent(createConfig(), dependencies);
      await agent.initialize();
      await agent.start();
    });

    it('should process test analysis task successfully', async () => {
      // Mock LLM response for analysis
      (dependencies.llmClient.complete as jest.Mock).mockResolvedValueOnce({
        content: JSON.stringify({
          summary: '95% of tests passed with good coverage',
          issues: [
            {
              severity: 'warning',
              message: 'Branch coverage below threshold',
              suggestion: 'Add tests for uncovered branches',
            },
          ],
          recommendations: ['Fix the 3 failing tests', 'Increase branch coverage'],
          coverageAnalysis: {
            status: 'good',
            gaps: ['Branch coverage: 78% < 80%'],
          },
        }),
        usage: { inputTokens: 100, outputTokens: 200, totalTokens: 300 },
        stopReason: 'end',
      });

      const task = createTestAnalysisTask();
      const result = await agent.processTask(task);

      expect(result.success).toBe(true);
      expect(result.taskId).toBe(task.id);
      expect(result.data).toBeDefined();
      const data = result.data as { analysis: unknown };
      expect(data.analysis).toBeDefined();
    });

    it('should call LLM for analysis', async () => {
      (dependencies.llmClient.complete as jest.Mock).mockResolvedValueOnce({
        content: JSON.stringify({
          summary: 'Test analysis complete',
          issues: [],
          recommendations: [],
          coverageAnalysis: { status: 'good', gaps: [] },
        }),
        usage: { inputTokens: 100, outputTokens: 200, totalTokens: 300 },
        stopReason: 'end',
      });

      const task = createTestAnalysisTask();
      await agent.processTask(task);

      expect(dependencies.llmClient.complete).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            role: 'system',
            content: expect.stringContaining('testing analyst'),
          }),
          expect.objectContaining({ role: 'user' }),
        ]),
        expect.any(Object)
      );
    });

    it('should handle malformed LLM response gracefully', async () => {
      (dependencies.llmClient.complete as jest.Mock).mockResolvedValueOnce({
        content: 'This is not valid JSON',
        usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
        stopReason: 'end',
      });

      const task = createTestAnalysisTask();
      const result = await agent.processTask(task);

      // Should still complete with default analysis
      expect(result.success).toBe(true);
      const data = result.data as { analysis: { summary: string } };
      expect(data.analysis).toBeDefined();
      expect(data.analysis.summary).toContain('95.0% passed');
    });
  });

  describe('Unsupported Task', () => {
    beforeEach(async () => {
      agent = new TesterAgent(createConfig(), dependencies);
      await agent.initialize();
      await agent.start();
    });

    it('should fail for unsupported task type', async () => {
      const task: ITask = {
        id: 'task-unknown',
        type: 'unknown-task-type',
        agentType: AgentType.TESTER,
        payload: {},
        priority: TaskPriority.NORMAL,
        createdAt: new Date(),
      };

      const result = await agent.processTask(task);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Unsupported task type');
    });
  });

  describe('Retry Behavior', () => {
    it('should retry on transient failures', async () => {
      const failingRunner = createMockTestRunner();
      (failingRunner.runTests as jest.Mock)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          success: true,
          total: 5,
          passed: 5,
          failed: 0,
          skipped: 0,
          duration: 1000,
          failedTests: [],
          coverage: { statements: 100, branches: 100, functions: 100, lines: 100 },
        });

      agent = new TesterAgent(
        createConfig({
          testRunner: failingRunner,
          retry: { maxAttempts: 3, baseDelay: 10, maxDelay: 100 },
        }),
        dependencies
      );
      await agent.initialize();
      await agent.start();

      const task: ITask = {
        id: 'task-retry',
        type: 'test-execution',
        agentType: AgentType.TESTER,
        payload: {
          repository: { owner: 'test', repo: 'test' },
          testType: 'unit',
          coverage: true,
          timeout: 60000,
          parallel: true,
        },
        priority: TaskPriority.NORMAL,
        createdAt: new Date(),
      };

      const result = await agent.processTask(task);

      expect(result.success).toBe(true);
      expect(failingRunner.runTests).toHaveBeenCalledTimes(2);
    });
  });
});

describe('Schema Validation', () => {
  describe('TestExecutionPayloadSchema', () => {
    it('should validate correct payload', () => {
      const payload = {
        repository: { owner: 'test', repo: 'test' },
        testType: 'unit',
        coverage: true,
      };

      const result = TestExecutionPayloadSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it('should apply defaults', () => {
      const payload = {
        repository: { owner: 'test', repo: 'test' },
      };

      const result = TestExecutionPayloadSchema.parse(payload);
      expect(result.testType).toBe('all');
      expect(result.coverage).toBe(true);
      expect(result.parallel).toBe(true);
    });

    it('should reject invalid test type', () => {
      const payload = {
        repository: { owner: 'test', repo: 'test' },
        testType: 'invalid-type',
      };

      const result = TestExecutionPayloadSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });
  });

  describe('TestGenerationPayloadSchema', () => {
    it('should validate correct payload', () => {
      const payload = {
        sourceFile: 'src/index.ts',
        sourceCode: 'export function test() {}',
        testFramework: 'jest',
      };

      const result = TestGenerationPayloadSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it('should reject empty source code', () => {
      const payload = {
        sourceFile: 'src/index.ts',
        sourceCode: '',
        testFramework: 'jest',
      };

      const result = TestGenerationPayloadSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });
  });

  describe('TestAnalysisPayloadSchema', () => {
    it('should validate correct payload', () => {
      const payload = {
        testResults: {
          total: 100,
          passed: 95,
          failed: 5,
          duration: 10000,
        },
      };

      const result = TestAnalysisPayloadSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it('should validate with coverage', () => {
      const payload = {
        testResults: {
          total: 100,
          passed: 100,
          failed: 0,
          duration: 5000,
        },
        coverage: {
          statements: 90,
          branches: 85,
          functions: 95,
          lines: 88,
        },
      };

      const result = TestAnalysisPayloadSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });
  });

  describe('GeneratedTestResponseSchema', () => {
    it('should validate correct response', () => {
      const response = {
        testFile: {
          path: 'test/example.test.ts',
          content: 'describe("test", () => {});',
        },
        testCases: [
          { name: 'should work', description: 'Basic test', type: 'unit' },
        ],
        summary: 'Generated 1 test',
      };

      const result = GeneratedTestResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });
  });

  describe('TestAnalysisResponseSchema', () => {
    it('should validate correct response', () => {
      const response = {
        summary: 'All tests passed',
        issues: [],
        recommendations: ['Keep up the good work'],
        coverageAnalysis: {
          status: 'excellent',
          gaps: [],
        },
      };

      const result = TestAnalysisResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });

    it('should validate with issues', () => {
      const response = {
        summary: 'Some tests failed',
        issues: [
          {
            severity: 'critical',
            message: 'Test failure',
            suggestion: 'Fix the test',
            testName: 'should validate input',
          },
        ],
        recommendations: ['Fix failing tests'],
      };

      const result = TestAnalysisResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });
  });
});

describe('createTesterAgent helper', () => {
  it('should create TesterAgent instance', () => {
    const dependencies = createDependencies();
    const config = createConfig();

    const agent = createTesterAgent(config, dependencies);

    expect(agent).toBeInstanceOf(TesterAgent);
    expect(agent.id).toBe(config.id);
  });
});
