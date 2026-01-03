/**
 * ReviewerAgent Unit Tests
 *
 * Feature: F1.6 - Reviewer Agent Enhance
 */

import {
  ReviewerAgent,
  ReviewerAgentConfig,
  createReviewerAgent,
  ReviewPayloadSchema,
  CodeReviewResponseSchema,
  ReviewDecision,
  IGitHubClient,
  ICIChecker,
  PullRequestInfo,
} from '../../../../src/core/agents/specialized/reviewer-agent';
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
      decision: 'APPROVE',
      summary: 'Code looks good',
      comments: [],
      stats: {
        filesReviewed: 2,
        issuesFound: 0,
        criticalIssues: 0,
        warnings: 0,
        suggestions: 0,
      },
    }),
    usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
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

const createMockGitHubClient = (): IGitHubClient => ({
  getPullRequest: jest.fn().mockResolvedValue({
    number: 123,
    title: 'Test PR',
    body: 'Test description',
    head: { ref: 'feature-branch', sha: 'abc123' },
    base: { ref: 'main', sha: 'def456' },
    state: 'open',
    user: { login: 'testuser' },
    additions: 100,
    deletions: 50,
    changedFiles: 5,
  } as PullRequestInfo),
  getPullRequestDiff: jest.fn().mockResolvedValue(`
diff --git a/test.ts b/test.ts
index 1234567..abcdefg 100644
--- a/test.ts
+++ b/test.ts
@@ -1,3 +1,4 @@
+// New line
 function test() {
   return true;
 }
`),
  createReview: jest.fn().mockResolvedValue(undefined),
});

const createMockCIChecker = (): ICIChecker => ({
  checkCIStatus: jest.fn().mockResolvedValue({
    status: 'success',
    checks: [
      { name: 'build', status: 'completed', conclusion: 'success' },
      { name: 'test', status: 'completed', conclusion: 'success' },
    ],
  }),
});

const createDependencies = (): AgentDependencies => ({
  llmClient: createMockLLMClient(),
  messageBroker: createMockMessageBroker(),
  logger: createMockLogger(),
});

const createConfig = (overrides?: Partial<ReviewerAgentConfig>): ReviewerAgentConfig => ({
  id: 'reviewer-test-1',
  type: AgentType.REVIEWER,
  name: 'Test Reviewer Agent',
  llm: { provider: 'claude', model: 'claude-3' },
  ...overrides,
});

// ============================================================================
// Tests
// ============================================================================

describe('ReviewerAgent', () => {
  let agent: ReviewerAgent;
  let dependencies: AgentDependencies;
  let githubClient: IGitHubClient;
  let ciChecker: ICIChecker;

  beforeEach(() => {
    dependencies = createDependencies();
    githubClient = createMockGitHubClient();
    ciChecker = createMockCIChecker();
  });

  afterEach(async () => {
    if (agent) {
      try {
        // Dispose if not already disposed
        await agent.dispose();
      } catch {
        // Already disposed, ignore
      }
    }
  });

  describe('Construction', () => {
    it('should create agent with default config', () => {
      agent = new ReviewerAgent(createConfig(), dependencies);

      expect(agent.id).toBe('reviewer-test-1');
      expect(agent.name).toBe('Test Reviewer Agent');
      expect(agent.type).toBe(AgentType.REVIEWER);
      expect(agent.getState().status).toBe(AgentStatus.STOPPED);
    });

    it('should create agent with GitHub client', () => {
      agent = new ReviewerAgent(
        createConfig({ githubClient }),
        dependencies
      );

      expect(agent).toBeInstanceOf(ReviewerAgent);
    });

    it('should create agent with CI checker', () => {
      agent = new ReviewerAgent(
        createConfig({ ciChecker, githubClient }),
        dependencies
      );

      expect(agent).toBeInstanceOf(ReviewerAgent);
    });

    it('should accept custom configuration', () => {
      agent = new ReviewerAgent(
        createConfig({
          maxFilesPerReview: 100,
          waitForCI: false,
          ciWaitTimeout: 600000,
          retry: {
            maxAttempts: 5,
            baseDelay: 2000,
            maxDelay: 20000,
          },
        }),
        dependencies
      );

      expect(agent).toBeInstanceOf(ReviewerAgent);
    });
  });

  describe('Lifecycle', () => {
    beforeEach(() => {
      agent = new ReviewerAgent(
        createConfig({ githubClient, ciChecker }),
        dependencies
      );
    });

    it('should initialize successfully', async () => {
      await agent.initialize();

      expect(agent.getState().status).toBe(AgentStatus.IDLE);
      expect(dependencies.logger.info).toHaveBeenCalledWith(
        'ReviewerAgent initializing',
        expect.objectContaining({
          hasGitHubClient: true,
          hasCIChecker: true,
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

      // Agent should throw when used after disposal
      expect(() => agent.getState()).toThrow('Agent has been disposed');
    });
  });

  describe('Capabilities', () => {
    it('should return base capabilities', () => {
      agent = new ReviewerAgent(createConfig({ githubClient }), dependencies);

      const capabilities = agent.getCapabilities();

      expect(capabilities).toContainEqual(
        expect.objectContaining({ name: 'code-review' })
      );
      expect(capabilities).toContainEqual(
        expect.objectContaining({ name: 'security-scan' })
      );
      expect(capabilities).toContainEqual(
        expect.objectContaining({ name: 'performance-review' })
      );
    });

    it('should include ci-check when CI checker is configured', () => {
      agent = new ReviewerAgent(
        createConfig({ githubClient, ciChecker }),
        dependencies
      );

      const capabilities = agent.getCapabilities();

      expect(capabilities).toContainEqual(
        expect.objectContaining({ name: 'ci-check' })
      );
    });

    it('should not include ci-check without CI checker', () => {
      agent = new ReviewerAgent(createConfig({ githubClient }), dependencies);

      const capabilities = agent.getCapabilities();

      expect(capabilities).not.toContainEqual(
        expect.objectContaining({ name: 'ci-check' })
      );
    });
  });

  describe('Code Review Task', () => {
    const createReviewTask = (): ITask => ({
      id: 'task-review-1',
      type: 'code-review',
      agentType: AgentType.REVIEWER,
      payload: {
        repository: { owner: 'testorg', repo: 'testrepo' },
        pullRequest: { number: 123, title: 'Test PR' },
        reviewCriteria: {
          checkSecurity: true,
          checkPerformance: true,
        },
      },
      priority: TaskPriority.NORMAL,
      createdAt: new Date(),
    });

    beforeEach(async () => {
      agent = new ReviewerAgent(
        createConfig({ githubClient, ciChecker, waitForCI: false }),
        dependencies
      );
      await agent.initialize();
      await agent.start();
    });

    it('should process code review task successfully', async () => {
      const task = createReviewTask();
      const result = await agent.processTask(task);

      expect(result.success).toBe(true);
      expect(result.taskId).toBe(task.id);
      expect(result.data).toBeDefined();
    });

    it('should call GitHub client methods', async () => {
      const task = createReviewTask();
      await agent.processTask(task);

      expect(githubClient.getPullRequest).toHaveBeenCalledWith(
        'testorg',
        'testrepo',
        123
      );
      expect(githubClient.getPullRequestDiff).toHaveBeenCalledWith(
        'testorg',
        'testrepo',
        123
      );
      expect(githubClient.createReview).toHaveBeenCalled();
    });

    it('should call LLM for analysis', async () => {
      const task = createReviewTask();
      await agent.processTask(task);

      expect(dependencies.llmClient.complete).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ role: 'system' }),
          expect.objectContaining({ role: 'user' }),
        ]),
        expect.objectContaining({ maxTokens: 4000 })
      );
    });

    it('should fail without GitHub client', async () => {
      const agentWithoutGH = new ReviewerAgent(createConfig(), dependencies);
      await agentWithoutGH.initialize();
      await agentWithoutGH.start();

      const task = createReviewTask();
      const result = await agentWithoutGH.processTask(task);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('GitHub client not configured');

      await agentWithoutGH.dispose();
    });

    it('should fail with invalid payload', async () => {
      const task: ITask = {
        id: 'task-invalid',
        type: 'code-review',
        agentType: AgentType.REVIEWER,
        payload: { invalid: 'payload' },
        priority: TaskPriority.NORMAL,
        createdAt: new Date(),
      };

      const result = await agent.processTask(task);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Invalid payload');
    });
  });

  describe('CI Status Check', () => {
    beforeEach(async () => {
      agent = new ReviewerAgent(
        createConfig({ githubClient, ciChecker, waitForCI: true }),
        dependencies
      );
      await agent.initialize();
      await agent.start();
    });

    it('should check CI status when waitForCI is enabled', async () => {
      const task: ITask = {
        id: 'task-ci-review',
        type: 'code-review',
        agentType: AgentType.REVIEWER,
        payload: {
          repository: { owner: 'testorg', repo: 'testrepo' },
          pullRequest: { number: 123, title: 'Test PR' },
        },
        priority: TaskPriority.NORMAL,
        createdAt: new Date(),
      };

      await agent.processTask(task);

      expect(ciChecker.checkCIStatus).toHaveBeenCalled();
    });

    it('should return early if CI fails', async () => {
      (ciChecker.checkCIStatus as jest.Mock).mockResolvedValueOnce({
        status: 'failure',
        checks: [{ name: 'test', status: 'completed', conclusion: 'failure' }],
      });

      const task: ITask = {
        id: 'task-ci-fail',
        type: 'code-review',
        agentType: AgentType.REVIEWER,
        payload: {
          repository: { owner: 'testorg', repo: 'testrepo' },
          pullRequest: { number: 123, title: 'Test PR' },
        },
        priority: TaskPriority.NORMAL,
        createdAt: new Date(),
      };

      const result = await agent.processTask(task);

      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        decision: ReviewDecision.COMMENT,
        summary: expect.stringContaining('CI checks are failing'),
      });
      // Should not call createReview since we returned early
      expect(githubClient.createReview).not.toHaveBeenCalled();
    });
  });

  describe('Security Scan Task', () => {
    beforeEach(async () => {
      agent = new ReviewerAgent(createConfig(), dependencies);
      await agent.initialize();
      await agent.start();
    });

    it('should process security scan task', async () => {
      const task: ITask = {
        id: 'task-security-1',
        type: 'security-scan',
        agentType: AgentType.REVIEWER,
        payload: {
          code: 'const password = "hardcoded";',
          language: 'javascript',
        },
        priority: TaskPriority.NORMAL,
        createdAt: new Date(),
      };

      const result = await agent.processTask(task);

      expect(result.success).toBe(true);
      expect(dependencies.llmClient.complete).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            role: 'system',
            content: expect.stringContaining('security expert'),
          }),
        ]),
        expect.any(Object)
      );
    });

    it('should fail without code in payload', async () => {
      const task: ITask = {
        id: 'task-security-invalid',
        type: 'security-scan',
        agentType: AgentType.REVIEWER,
        payload: { language: 'javascript' },
        priority: TaskPriority.NORMAL,
        createdAt: new Date(),
      };

      const result = await agent.processTask(task);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Code is required');
    });
  });

  describe('Performance Review Task', () => {
    beforeEach(async () => {
      agent = new ReviewerAgent(createConfig(), dependencies);
      await agent.initialize();
      await agent.start();
    });

    it('should process performance review task', async () => {
      const task: ITask = {
        id: 'task-perf-1',
        type: 'performance-review',
        agentType: AgentType.REVIEWER,
        payload: {
          code: 'for(let i=0;i<n;i++){for(let j=0;j<n;j++){}}',
          context: 'Hot path in data processing',
        },
        priority: TaskPriority.NORMAL,
        createdAt: new Date(),
      };

      const result = await agent.processTask(task);

      expect(result.success).toBe(true);
      expect(dependencies.llmClient.complete).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            role: 'system',
            content: expect.stringContaining('performance optimization'),
          }),
        ]),
        expect.any(Object)
      );
    });
  });

  describe('CI Check Task', () => {
    beforeEach(async () => {
      agent = new ReviewerAgent(
        createConfig({ ciChecker }),
        dependencies
      );
      await agent.initialize();
      await agent.start();
    });

    it('should process CI check task', async () => {
      const task: ITask = {
        id: 'task-ci-1',
        type: 'ci-check',
        agentType: AgentType.REVIEWER,
        payload: {
          owner: 'testorg',
          repo: 'testrepo',
          sha: 'abc123',
        },
        priority: TaskPriority.NORMAL,
        createdAt: new Date(),
      };

      const result = await agent.processTask(task);

      expect(result.success).toBe(true);
      expect(ciChecker.checkCIStatus).toHaveBeenCalledWith(
        'testorg',
        'testrepo',
        'abc123'
      );
    });

    it('should fail without CI checker', async () => {
      const agentWithoutCI = new ReviewerAgent(createConfig(), dependencies);
      await agentWithoutCI.initialize();
      await agentWithoutCI.start();

      const task: ITask = {
        id: 'task-ci-no-checker',
        type: 'ci-check',
        agentType: AgentType.REVIEWER,
        payload: { owner: 'test', repo: 'test', sha: 'abc' },
        priority: TaskPriority.NORMAL,
        createdAt: new Date(),
      };

      const result = await agentWithoutCI.processTask(task);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('CI checker not configured');

      await agentWithoutCI.dispose();
    });

    it('should fail with missing parameters', async () => {
      const task: ITask = {
        id: 'task-ci-invalid',
        type: 'ci-check',
        agentType: AgentType.REVIEWER,
        payload: { owner: 'testorg' }, // Missing repo and sha
        priority: TaskPriority.NORMAL,
        createdAt: new Date(),
      };

      const result = await agent.processTask(task);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('required');
    });
  });

  describe('Unsupported Task', () => {
    beforeEach(async () => {
      agent = new ReviewerAgent(createConfig(), dependencies);
      await agent.initialize();
      await agent.start();
    });

    it('should fail for unsupported task type', async () => {
      const task: ITask = {
        id: 'task-unknown',
        type: 'unknown-task-type',
        agentType: AgentType.REVIEWER,
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
      const failingGithubClient = createMockGitHubClient();
      (failingGithubClient.getPullRequest as jest.Mock)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          number: 123,
          title: 'Test PR',
          body: 'Test',
          head: { ref: 'feature', sha: 'abc' },
          base: { ref: 'main', sha: 'def' },
          state: 'open',
          user: { login: 'test' },
          additions: 10,
          deletions: 5,
          changedFiles: 1,
        });

      agent = new ReviewerAgent(
        createConfig({
          githubClient: failingGithubClient,
          waitForCI: false,
          retry: { maxAttempts: 3, baseDelay: 10, maxDelay: 100 },
        }),
        dependencies
      );
      await agent.initialize();
      await agent.start();

      const task: ITask = {
        id: 'task-retry',
        type: 'code-review',
        agentType: AgentType.REVIEWER,
        payload: {
          repository: { owner: 'test', repo: 'test' },
          pullRequest: { number: 123, title: 'Test' },
        },
        priority: TaskPriority.NORMAL,
        createdAt: new Date(),
      };

      const result = await agent.processTask(task);

      expect(result.success).toBe(true);
      expect(failingGithubClient.getPullRequest).toHaveBeenCalledTimes(2);
    });
  });

  describe('LLM Response Parsing', () => {
    beforeEach(async () => {
      agent = new ReviewerAgent(
        createConfig({ githubClient, waitForCI: false }),
        dependencies
      );
      await agent.initialize();
      await agent.start();
    });

    it('should handle malformed LLM response gracefully', async () => {
      (dependencies.llmClient.complete as jest.Mock).mockResolvedValueOnce({
        content: 'This is not valid JSON',
        usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
        stopReason: 'end' as const,
      });

      const task: ITask = {
        id: 'task-bad-llm',
        type: 'code-review',
        agentType: AgentType.REVIEWER,
        payload: {
          repository: { owner: 'test', repo: 'test' },
          pullRequest: { number: 123, title: 'Test' },
        },
        priority: TaskPriority.NORMAL,
        createdAt: new Date(),
      };

      const result = await agent.processTask(task);

      // Should still complete with default values
      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        review: {
          decision: ReviewDecision.COMMENT,
        },
      });
    });
  });
});

describe('Schema Validation', () => {
  describe('ReviewPayloadSchema', () => {
    it('should validate correct payload', () => {
      const payload = {
        repository: { owner: 'test', repo: 'test' },
        pullRequest: { number: 1, title: 'Test PR' },
      };

      const result = ReviewPayloadSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it('should reject missing repository owner', () => {
      const payload = {
        repository: { owner: '', repo: 'test' },
        pullRequest: { number: 1, title: 'Test PR' },
      };

      const result = ReviewPayloadSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it('should reject invalid PR number', () => {
      const payload = {
        repository: { owner: 'test', repo: 'test' },
        pullRequest: { number: -1, title: 'Test PR' },
      };

      const result = ReviewPayloadSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it('should apply defaults for reviewCriteria', () => {
      const payload = {
        repository: { owner: 'test', repo: 'test' },
        pullRequest: { number: 1, title: 'Test PR' },
      };

      const result = ReviewPayloadSchema.parse(payload);
      expect(result.reviewCriteria).toBeDefined();
      expect(result.reviewCriteria?.checkSecurity).toBe(true);
    });
  });

  describe('CodeReviewResponseSchema', () => {
    it('should validate correct response', () => {
      const response = {
        decision: 'APPROVE',
        summary: 'Looks good',
        comments: [],
        stats: {
          filesReviewed: 1,
          issuesFound: 0,
          criticalIssues: 0,
          warnings: 0,
          suggestions: 0,
        },
      };

      const result = CodeReviewResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });

    it('should reject invalid decision', () => {
      const response = {
        decision: 'INVALID_DECISION',
        summary: 'Test',
        comments: [],
        stats: {
          filesReviewed: 1,
          issuesFound: 0,
          criticalIssues: 0,
          warnings: 0,
          suggestions: 0,
        },
      };

      const result = CodeReviewResponseSchema.safeParse(response);
      expect(result.success).toBe(false);
    });

    it('should validate comments structure', () => {
      const response = {
        decision: 'REQUEST_CHANGES',
        summary: 'Issues found',
        comments: [
          {
            path: 'test.ts',
            line: 10,
            body: 'Fix this',
            severity: 'error',
          },
        ],
        stats: {
          filesReviewed: 1,
          issuesFound: 1,
          criticalIssues: 1,
          warnings: 0,
          suggestions: 0,
        },
      };

      const result = CodeReviewResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });
  });
});

describe('createReviewerAgent helper', () => {
  it('should create ReviewerAgent instance', () => {
    const dependencies = createDependencies();
    const config = createConfig();

    const agent = createReviewerAgent(config, dependencies);

    expect(agent).toBeInstanceOf(ReviewerAgent);
    expect(agent.id).toBe(config.id);
  });
});
