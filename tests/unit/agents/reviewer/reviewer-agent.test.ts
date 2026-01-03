import { ReviewerAgent } from '@/agents/reviewer/reviewer-agent';
import {
  AgentType,
  AgentState,
  TaskStatus,
  TaskPriority,
  ReviewRequest,
  ReviewResult,
} from '@/agents/base/types';
import { NatsClient } from '@/shared/messaging/nats-client';
import { ILLMClient } from '@/shared/llm/base-client';
import { GitHubClient } from '@/shared/github/client';
import { ErrorCode } from '@/shared/errors/custom-errors';

/**
 * Reviewer Agent Tests
 *
 * TDD approach with strict quality standards
 * Tests code review, GitHub PR integration, and analysis
 *
 * Feature: F2.4 - Reviewer Agent
 */

// Mock dependencies
jest.mock('@/shared/messaging/nats-client');
jest.mock('@/shared/github/client');
jest.mock('@/shared/ci/index.js', () => ({
  CIChecker: jest.fn().mockImplementation(() => ({
    getCIStatus: jest.fn().mockResolvedValue({
      status: 'success',
      conclusion: 'success',
      checks: [],
      workflows: [],
      overallStatus: 'success',
      hasFailures: false,
      hasPending: false,
      summary: 'All checks passed',
    }),
    getCheckRuns: jest.fn().mockResolvedValue([]),
    getWorkflowRuns: jest.fn().mockResolvedValue([]),
    isReviewBlocked: jest.fn().mockResolvedValue(false),
    waitForCompletion: jest.fn().mockResolvedValue({
      status: 'success',
      conclusion: 'success',
      checks: [],
      workflows: [],
      overallStatus: 'success',
      hasFailures: false,
      hasPending: false,
      summary: 'All checks passed',
    }),
    getStatus: jest.fn().mockResolvedValue({
      status: 'success',
      conclusion: 'success',
      checks: [],
      workflows: [],
      overallStatus: 'success',
      hasFailures: false,
      hasPending: false,
      summary: 'All checks passed',
    }),
    isFailed: jest.fn().mockReturnValue(false),
    isPassed: jest.fn().mockReturnValue(true),
    getFailedChecks: jest.fn().mockReturnValue([]),
    formatStatus: jest.fn().mockReturnValue('All checks passed'),
    getStatusIcon: jest.fn().mockReturnValue('✅'),
    getConfig: jest.fn().mockReturnValue({}),
    updateConfig: jest.fn(),
  })),
  CIStatus: {
    SUCCESS: 'success',
    FAILURE: 'failure',
    PENDING: 'pending',
    NEUTRAL: 'neutral',
  },
}));

describe('ReviewerAgent', () => {
  let agent: ReviewerAgent;
  let mockNatsClient: jest.Mocked<NatsClient>;
  let mockLLMClient: jest.Mocked<ILLMClient>;
  let mockGitHubClient: jest.Mocked<GitHubClient>;

  beforeEach(() => {
    jest.clearAllMocks();

    process.env.ANTHROPIC_API_KEY = 'test-key';
    process.env.GITHUB_TOKEN = 'test-token';

    mockNatsClient = {
      subscribe: jest.fn(),
      publish: jest.fn(),
      request: jest.fn(),
      close: jest.fn(),
      isConnected: jest.fn().mockReturnValue(true),
    } as any;

    mockLLMClient = {
      getProvider: jest.fn().mockReturnValue('claude'),
      getDefaultModel: jest.fn().mockReturnValue('claude-3-5-sonnet-20241022'),
      chat: jest.fn(),
      chatStream: jest.fn(),
      getMaxContextLength: jest.fn().mockReturnValue(200000),
    };

    mockGitHubClient = {
      getPullRequest: jest.fn(),
      getPullRequestDiff: jest.fn(),
      createReview: jest.fn(),
    } as any;

    const config = {
      id: 'reviewer-1',
      type: AgentType.REVIEWER,
      name: 'Reviewer Agent',
      llm: { provider: 'claude' as const },
      nats: { servers: ['nats://localhost:4222'] },
    };

    agent = new ReviewerAgent(config, mockNatsClient, mockLLMClient, mockGitHubClient);
  });

  afterEach(async () => {
    await agent.stop();
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.GITHUB_TOKEN;
  });

  describe('Agent Type', () => {
    it('should return REVIEWER agent type', () => {
      expect(agent.getAgentType()).toBe(AgentType.REVIEWER);
    });
  });

  describe('Task Processing', () => {
    it('should process review request successfully', async () => {
      const task: ReviewRequest = {
        id: 'task-1',
        type: 'REVIEW_REQUEST',
        agentType: AgentType.REVIEWER,
        priority: TaskPriority.NORMAL,
        status: TaskStatus.PENDING,
        payload: {
          repository: {
            owner: 'test-owner',
            repo: 'test-repo',
          },
          pullRequest: {
            number: 123,
            title: 'Add user authentication',
            description: 'Implement JWT-based authentication',
          },
        },
        metadata: {
          createdAt: Date.now(),
        },
      };

      mockGitHubClient.getPullRequest.mockResolvedValue({
        number: 123,
        title: 'Add user authentication',
        body: 'Implement JWT-based authentication',
        state: 'open',
        head: {
          ref: 'feature/auth',
          sha: 'abc123',
        },
        base: {
          ref: 'main',
          sha: 'def456',
        },
        user: {
          login: 'coder-agent',
        },
        url: 'https://github.com/test-owner/test-repo/pull/123',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      mockGitHubClient.getPullRequestDiff.mockResolvedValue({
        files: [
          {
            filename: 'src/auth/login.ts',
            status: 'added',
            additions: 50,
            deletions: 0,
            changes: 50,
            patch: '@@ -0,0 +1,50 @@\n+export function login() { /* implementation */ }',
          },
        ],
        totalAdditions: 50,
        totalDeletions: 0,
        totalChanges: 50,
      });

      mockLLMClient.chat.mockResolvedValue({
        content: JSON.stringify({
          decision: 'APPROVE',
          summary: 'Code looks good. Well-structured authentication implementation.',
          comments: [],
          stats: {
            filesReviewed: 1,
            issuesFound: 0,
            criticalIssues: 0,
            warnings: 0,
            suggestions: 0,
          },
        }),
        model: 'claude-3-5-sonnet-20241022',
        usage: { promptTokens: 200, completionTokens: 100, totalTokens: 300 },
        finishReason: 'stop',
      });

      mockGitHubClient.createReview.mockResolvedValue({
        id: 456,
        body: 'Code looks good. Well-structured authentication implementation.',
        state: 'APPROVED',
        user: { login: 'reviewer-agent' },
        submittedAt: new Date().toISOString(),
      });

      const result = (await agent.processTask(task)) as ReviewResult;

      // Debug: log result if failed
      if (!result.success) {
        console.log('Review result:', JSON.stringify(result, null, 2));
      }

      expect(result.success).toBe(true);
      expect(result.status).toBe(TaskStatus.COMPLETED);
      expect(result.data?.review.decision).toBe('APPROVE');
      expect(result.data?.review.id).toBe(456);
      expect(mockGitHubClient.getPullRequest).toHaveBeenCalledWith(
        { owner: 'test-owner', repo: 'test-repo' },
        123
      );
      expect(mockGitHubClient.getPullRequestDiff).toHaveBeenCalledWith(
        { owner: 'test-owner', repo: 'test-repo' },
        123
      );
      expect(mockGitHubClient.createReview).toHaveBeenCalled();
    });

    it('should validate review request payload', async () => {
      const invalidTask = {
        id: 'task-1',
        type: 'REVIEW_REQUEST',
        agentType: AgentType.REVIEWER,
        priority: TaskPriority.NORMAL,
        status: TaskStatus.PENDING,
        payload: {
          repository: {}, // Missing required fields
          pullRequest: {},
        },
        metadata: { createdAt: Date.now() },
      } as ReviewRequest;

      const result = await agent.processTask(invalidTask);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ErrorCode.VALIDATION_ERROR);
    });

    it('should handle GitHub API errors', async () => {
      const task: ReviewRequest = {
        id: 'task-3',
        type: 'REVIEW_REQUEST',
        agentType: AgentType.REVIEWER,
        priority: TaskPriority.NORMAL,
        status: TaskStatus.PENDING,
        payload: {
          repository: {
            owner: 'test-owner',
            repo: 'test-repo',
          },
          pullRequest: {
            number: 999,
            title: 'Test PR',
          },
        },
        metadata: { createdAt: Date.now() },
      };

      mockGitHubClient.getPullRequest.mockRejectedValue(new Error('PR not found'));

      const result = await agent.processTask(task);

      expect(result.success).toBe(false);
      expect(result.status).toBe(TaskStatus.FAILED);
      expect(result.error).toBeDefined();
    });
  });

  describe('Resource Cleanup', () => {
    it('should cleanup resources on stop', async () => {
      await agent.start();
      await agent.stop();

      expect(agent.getState()).toBe(AgentState.STOPPED);
    });
  });
});
