import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import {
  // LLM Integration
  TeamAgentLLMAdapter,
  createTeamAgentLLMAdapter,
  formatTaskForPrompt,
  PlanningPrompts,
  DevelopmentPrompts,
  QAPrompts,
  getPromptForTask,
  createPlanningLLMExecutor,
  createDevelopmentLLMExecutor,
  createQALLMExecutor,
  // Agents
  createPlanningAgent,
  createDevelopmentAgent,
  createQAAgent,
  // Types
  PlanningOutput,
  DevelopmentOutput,
  QAOutput,
} from '@/core/orchestrator';
import {
  DocumentQueue,
  WorkspaceManager,
  createTask,
} from '@/core/workspace';
import {
  ILLMClient,
  LLMMessage,
  LLMCompletionOptions,
  LLMCompletionResult,
  LLMStreamCallback,
} from '@/shared/llm';

/**
 * Mock LLM Client for testing
 */
class MockLLMClient implements ILLMClient {
  private responseMap: Map<string, string> = new Map();
  public callHistory: Array<{ messages: LLMMessage[]; options?: LLMCompletionOptions }> = [];

  getProvider(): string {
    return 'mock';
  }

  getDefaultModel(): string {
    return 'mock-model';
  }

  setResponse(keyword: string, response: string): void {
    this.responseMap.set(keyword, response);
  }

  async chat(
    messages: LLMMessage[],
    options?: LLMCompletionOptions
  ): Promise<LLMCompletionResult> {
    this.callHistory.push({ messages, options });

    // Find matching response
    const userMessage = messages.find((m) => m.role === 'user')?.content || '';
    let responseContent = '{}';

    for (const [keyword, response] of this.responseMap) {
      if (userMessage.toLowerCase().includes(keyword.toLowerCase())) {
        responseContent = response;
        break;
      }
    }

    return {
      content: responseContent,
      model: 'mock-model',
      usage: {
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
      },
      finishReason: 'stop',
    };
  }

  async chatStream(
    messages: LLMMessage[],
    callback: LLMStreamCallback,
    options?: LLMCompletionOptions
  ): Promise<LLMCompletionResult> {
    const result = await this.chat(messages, options);
    await callback({ content: result.content, isComplete: true, usage: result.usage });
    return result;
  }

  getMaxContextLength(): number {
    return 100000;
  }
}

describe('Team Agents LLM Integration', () => {
  let tempDir: string;
  let workspace: WorkspaceManager;
  let queue: DocumentQueue;
  let mockClient: MockLLMClient;
  let adapter: TeamAgentLLMAdapter;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'llm-test-'));
    workspace = new WorkspaceManager({ baseDir: tempDir });
    queue = new DocumentQueue(workspace);
    await queue.initialize();

    mockClient = new MockLLMClient();
    adapter = createTeamAgentLLMAdapter({
      client: mockClient,
      temperature: 0.7,
      maxTokens: 4096,
    });
  });

  afterEach(async () => {
    await queue.stop();
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore
    }
  });

  describe('TeamAgentLLMAdapter', () => {
    it('should create adapter with correct config', () => {
      expect(adapter.getClient()).toBe(mockClient);
    });

    it('should execute raw LLM call', async () => {
      mockClient.setResponse('test', '{"result": "success"}');

      const result = await adapter.executeRaw(
        'You are a test assistant',
        'Test prompt'
      );

      expect(result.content).toContain('result');
      expect(mockClient.callHistory.length).toBe(1);
    });

    it('should include system and user messages', async () => {
      mockClient.setResponse('hello', '{"greeting": "world"}');

      await adapter.executeRaw('System prompt', 'Hello user');

      const call = mockClient.callHistory[0];
      expect(call.messages.length).toBe(2);
      expect(call.messages[0].role).toBe('system');
      expect(call.messages[1].role).toBe('user');
    });

    it('should retry on retryable errors', async () => {
      let callCount = 0;
      const originalChat = mockClient.chat.bind(mockClient);

      mockClient.chat = async (messages, options) => {
        callCount++;
        if (callCount < 3) {
          const error = new Error('503 Service Unavailable');
          throw error;
        }
        return originalChat(messages, options);
      };

      mockClient.setResponse('retry', '{"status": "ok"}');

      const result = await adapter.executeRaw('System', 'Retry test');

      expect(callCount).toBe(3);
      expect(result.content).toContain('status');
    });

    it('should not retry on non-retryable errors', async () => {
      let callCount = 0;

      mockClient.chat = async () => {
        callCount++;
        throw new Error('Invalid API key');
      };

      await expect(adapter.executeRaw('System', 'Invalid test')).rejects.toThrow(
        'Invalid API key'
      );

      expect(callCount).toBe(1);
    });
  });

  describe('formatTaskForPrompt', () => {
    it('should format task with all fields', () => {
      const task = createTask({
        title: 'Test Task',
        type: 'feature',
        from: 'planning',
        to: 'development',
        content: 'Task description',
        priority: 'critical',
        tags: ['urgent', 'frontend'],
        files: [
          { path: 'src/test.ts', action: 'create', description: 'New file' },
        ],
      });

      const formatted = formatTaskForPrompt(task);

      expect(formatted).toContain('## Task: Test Task');
      expect(formatted).toContain('**Type**: feature');
      expect(formatted).toContain('**Priority**: critical');
      expect(formatted).toContain('**Tags**: urgent, frontend');
      expect(formatted).toContain('### Description');
      expect(formatted).toContain('Task description');
      expect(formatted).toContain('### Related Files');
      expect(formatted).toContain('`src/test.ts`');
    });

    it('should handle task without optional fields', () => {
      const task = createTask({
        title: 'Simple Task',
        type: 'bugfix',
        from: 'qa',
        to: 'development',
      });

      const formatted = formatTaskForPrompt(task);

      expect(formatted).toContain('## Task: Simple Task');
      expect(formatted).not.toContain('### Related Files');
    });
  });

  describe('Prompt Templates', () => {
    describe('PlanningPrompts', () => {
      it('should have system prompt', () => {
        expect(PlanningPrompts.system).toContain('Planning Agent');
        expect(PlanningPrompts.system).toContain('JSON');
      });

      it('should generate user prompt', () => {
        const task = createTask({
          title: 'Plan Feature',
          type: 'planning',
          from: 'orchestrator',
          to: 'planning',
          content: 'Plan the new feature',
        });

        const prompt = PlanningPrompts.user(task);

        expect(prompt).toContain('Plan Feature');
        expect(prompt).toContain('### Instructions');
      });

      it('should include project context when provided', () => {
        const task = createTask({
          title: 'Plan with Context',
          type: 'planning',
          from: 'orchestrator',
          to: 'planning',
        });

        const prompt = PlanningPrompts.user(task, 'This is a React project');

        expect(prompt).toContain('### Project Context');
        expect(prompt).toContain('React project');
      });
    });

    describe('DevelopmentPrompts', () => {
      it('should have feature system prompt', () => {
        expect(DevelopmentPrompts.featureSystem).toContain('Development Agent');
        expect(DevelopmentPrompts.featureSystem).toContain('filesModified');
      });

      it('should have bugfix system prompt', () => {
        expect(DevelopmentPrompts.bugfixSystem).toContain('bug');
        expect(DevelopmentPrompts.bugfixSystem).toContain('rootCause');
      });

      it('should have refactor system prompt', () => {
        expect(DevelopmentPrompts.refactorSystem).toContain('refactoring');
        expect(DevelopmentPrompts.refactorSystem).toContain('rationale');
      });
    });

    describe('QAPrompts', () => {
      it('should have test system prompt', () => {
        expect(QAPrompts.testSystem).toContain('QA Agent');
        expect(QAPrompts.testSystem).toContain('testResults');
        expect(QAPrompts.testSystem).toContain('coverage');
      });

      it('should have review system prompt', () => {
        expect(QAPrompts.reviewSystem).toContain('code review');
        expect(QAPrompts.reviewSystem).toContain('reviewFindings');
      });

      it('should include code in review prompt', () => {
        const task = createTask({
          title: 'Review Code',
          type: 'review',
          from: 'development',
          to: 'qa',
        });

        const prompt = QAPrompts.reviewUser(task, 'function test() {}');

        expect(prompt).toContain('### Code to Review');
        expect(prompt).toContain('function test()');
      });
    });
  });

  describe('getPromptForTask', () => {
    it('should return planning prompts for planning team', () => {
      const prompts = getPromptForTask('planning', 'planning');
      expect(prompts.system).toContain('Planning Agent');
    });

    it('should return development prompts for development team', () => {
      const prompts = getPromptForTask('feature', 'development');
      expect(prompts.system).toContain('Development Agent');
    });

    it('should return bugfix prompts for bugfix tasks', () => {
      const prompts = getPromptForTask('bugfix', 'development');
      expect(prompts.system).toContain('bug');
    });

    it('should return QA prompts for qa team', () => {
      const prompts = getPromptForTask('test', 'qa');
      expect(prompts.system).toContain('QA Agent');
    });

    it('should return review prompts for review tasks', () => {
      const prompts = getPromptForTask('review', 'qa');
      expect(prompts.system).toContain('code review');
    });
  });

  describe('Planning LLM Executor', () => {
    it('should create plan from LLM response', async () => {
      const planResponse: PlanningOutput = {
        title: 'Plan: Test Feature',
        summary: 'Implementation plan for test feature',
        tasks: [
          {
            title: 'Design: Test Feature',
            type: 'design',
            targetTeam: 'design',
            description: 'Create design specs',
          },
          {
            title: 'Implement: Test Feature',
            type: 'feature',
            targetTeam: 'development',
            description: 'Implement the feature',
            dependencies: ['Design: Test Feature'],
            estimatedEffort: 'medium',
          },
        ],
        phases: [
          { name: 'Design', taskIndices: [0], description: 'Design phase' },
          { name: 'Implementation', taskIndices: [1], description: 'Dev phase' },
        ],
        risks: ['Timeline risk'],
        assumptions: ['API available'],
      };

      mockClient.setResponse('feature', JSON.stringify(planResponse));

      const executor = createPlanningLLMExecutor({ adapter });

      const task = createTask({
        title: 'Test Feature',
        type: 'planning',
        from: 'orchestrator',
        to: 'planning',
        content: 'Implement a new test feature',
      });

      const result = await executor(task);

      expect(result.title).toBe('Plan: Test Feature');
      expect(result.tasks.length).toBe(2);
      expect(result.tasks[0].targetTeam).toBe('design');
    });

    it('should integrate with PlanningAgent', async () => {
      const planResponse: PlanningOutput = {
        title: 'Plan: LLM Feature',
        summary: 'LLM-generated plan',
        tasks: [
          {
            title: 'Task 1',
            type: 'feature',
            targetTeam: 'development',
            description: 'First task',
          },
        ],
      };

      mockClient.setResponse('llm', JSON.stringify(planResponse));

      const executor = createPlanningLLMExecutor({ adapter });
      const agent = createPlanningAgent(queue);

      agent.setPlanGenerator(executor);
      await agent.start();

      const task = createTask({
        title: 'LLM Test',
        type: 'planning',
        from: 'orchestrator',
        to: 'planning',
        content: 'Test LLM integration',
      });

      const result = await agent.processTask(task);

      expect(result.success).toBe(true);
      expect((result.result as PlanningOutput).title).toBe('Plan: LLM Feature');

      await agent.stop();
    });
  });

  describe('Development LLM Executor', () => {
    it('should create development output from LLM response', async () => {
      const devResponse: DevelopmentOutput = {
        summary: 'Implemented login feature',
        filesModified: [
          {
            path: 'src/auth/login.ts',
            action: 'created',
            description: 'Login component',
          },
        ],
        codeChanges: [
          {
            file: 'src/auth/login.ts',
            language: 'typescript',
            newCode: 'export function login() {}',
          },
        ],
        tests: ['Added login tests'],
        reviewNotes: ['Ready for review'],
      };

      mockClient.setResponse('login', JSON.stringify(devResponse));

      const executor = createDevelopmentLLMExecutor({ adapter });

      const task = createTask({
        title: 'Implement Login',
        type: 'feature',
        from: 'planning',
        to: 'development',
        content: 'Implement user login functionality',
      });

      const result = await executor(task);

      expect(result.summary).toContain('login');
      expect(result.filesModified.length).toBe(1);
    });

    it('should integrate with DevelopmentAgent', async () => {
      const devResponse = {
        summary: 'Feature implemented',
        filesModified: [
          { path: 'src/test.ts', action: 'created', description: 'Test file' },
        ],
      };

      mockClient.setResponse('feature', JSON.stringify(devResponse));

      const executor = createDevelopmentLLMExecutor({ adapter });
      const agent = createDevelopmentAgent(queue);

      agent.setCodeExecutor(executor);
      await agent.start();

      const task = createTask({
        title: 'Test Feature',
        type: 'feature',
        from: 'planning',
        to: 'development',
        content: 'Build a new feature',
      });

      const result = await agent.processTask(task);

      expect(result.success).toBe(true);
      expect((result.result as DevelopmentOutput).filesModified.length).toBe(1);

      await agent.stop();
    });
  });

  describe('QA LLM Executor', () => {
    it('should create QA output from LLM response', async () => {
      const qaResponse: QAOutput = {
        summary: 'Test execution completed',
        testResults: {
          total: 10,
          passed: 9,
          failed: 1,
          skipped: 0,
          tests: [
            { name: 'test_1', status: 'passed' },
            { name: 'test_2', status: 'failed', error: 'Assertion error' },
          ],
        },
        coverage: {
          lines: 85,
          branches: 75,
          functions: 90,
          statements: 85,
        },
        qualityScore: 80,
        approved: false,
        reason: 'One test failed',
      };

      mockClient.setResponse('test', JSON.stringify(qaResponse));

      const executor = createQALLMExecutor({ adapter });

      const task = createTask({
        title: 'Run Tests',
        type: 'test',
        from: 'development',
        to: 'qa',
        content: 'Test the login feature',
      });

      const result = await executor(task);

      expect(result.summary).toContain('Test execution');
      expect(result.testResults?.total).toBe(10);
      expect(result.qualityScore).toBe(80);
    });

    it('should handle review tasks', async () => {
      const reviewResponse = {
        summary: 'Code review completed',
        reviewFindings: [
          {
            severity: 'major',
            category: 'security',
            message: 'Missing input validation',
            file: 'src/api.ts',
            line: 42,
          },
        ],
        qualityScore: 65,
        approved: false,
        reason: 'Security issues found',
      };

      mockClient.setResponse('review', JSON.stringify(reviewResponse));

      const executor = createQALLMExecutor({ adapter });

      const task = createTask({
        title: 'Review Code',
        type: 'review',
        from: 'development',
        to: 'qa',
        content: 'Review authentication code',
      });

      const result = await executor(task);

      expect(result.summary).toContain('Code review');
      expect(result.reviewFindings?.length).toBe(1);
      expect(result.approved).toBe(false);
    });

    it('should integrate with QAAgent', async () => {
      const qaResponse = {
        summary: 'All tests passed',
        testResults: {
          total: 5,
          passed: 5,
          failed: 0,
          skipped: 0,
          tests: [],
        },
        qualityScore: 95,
        approved: true,
        reason: 'Excellent quality',
      };

      mockClient.setResponse('qa', JSON.stringify(qaResponse));

      const executor = createQALLMExecutor({ adapter });
      const agent = createQAAgent(queue);

      agent.setQAExecutor(executor);
      await agent.start();

      const task = createTask({
        title: 'QA Test',
        type: 'test',
        from: 'development',
        to: 'qa',
        content: 'Run QA tests',
      });

      const result = await agent.processTask(task);

      expect(result.success).toBe(true);
      expect((result.result as QAOutput).approved).toBe(true);

      await agent.stop();
    });
  });

  describe('End-to-End LLM Integration', () => {
    it('should process task through full agent pipeline', async () => {
      // Setup mock responses
      const planResponse: PlanningOutput = {
        title: 'Plan: E2E Feature',
        summary: 'End-to-end test plan',
        tasks: [
          {
            title: 'Implement E2E Feature',
            type: 'feature',
            targetTeam: 'development',
            description: 'Implement feature',
          },
          {
            title: 'Test E2E Feature',
            type: 'test',
            targetTeam: 'qa',
            description: 'Test feature',
          },
        ],
      };

      const devResponse = {
        summary: 'E2E feature implemented',
        filesModified: [
          { path: 'src/e2e.ts', action: 'created', description: 'E2E module' },
        ],
      };

      const qaResponse = {
        summary: 'E2E tests passed',
        testResults: { total: 3, passed: 3, failed: 0, skipped: 0, tests: [] },
        qualityScore: 90,
        approved: true,
        reason: 'All E2E tests passed',
      };

      // Use unique keywords for each task
      mockClient.setResponse('planning-workflow', JSON.stringify(planResponse));
      mockClient.setResponse('development-workflow', JSON.stringify(devResponse));
      mockClient.setResponse('testing-workflow', JSON.stringify(qaResponse));

      // Create agents with LLM executors
      const planningAgent = createPlanningAgent(queue);
      const devAgent = createDevelopmentAgent(queue);
      const qaAgent = createQAAgent(queue);

      planningAgent.setPlanGenerator(createPlanningLLMExecutor({ adapter }));
      devAgent.setCodeExecutor(createDevelopmentLLMExecutor({ adapter }));
      qaAgent.setQAExecutor(createQALLMExecutor({ adapter }));

      await planningAgent.start();
      await devAgent.start();
      await qaAgent.start();

      // Process planning task
      const planTask = createTask({
        title: 'E2E Test Plan',
        type: 'planning',
        from: 'orchestrator',
        to: 'planning',
        content: 'Execute planning-workflow for E2E feature',
      });

      const planResult = await planningAgent.processTask(planTask);
      expect(planResult.success).toBe(true);

      // Process development task
      const devTask = createTask({
        title: 'Implement E2E',
        type: 'feature',
        from: 'planning',
        to: 'development',
        content: 'Execute development-workflow for the feature',
      });

      const devResult = await devAgent.processTask(devTask);
      expect(devResult.success).toBe(true);

      // Process QA task
      const qaTask = createTask({
        title: 'Test E2E',
        type: 'test',
        from: 'development',
        to: 'qa',
        content: 'Execute testing-workflow for feature',
      });

      const qaResult = await qaAgent.processTask(qaTask);
      expect(qaResult.success).toBe(true);
      expect((qaResult.result as QAOutput).approved).toBe(true);

      // Cleanup
      await planningAgent.stop();
      await devAgent.stop();
      await qaAgent.stop();
    });
  });
});
