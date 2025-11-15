import { RepoManagerAgent } from '@/agents/repo-manager/repo-manager-agent';
import {
  AgentType,
  AgentState,
  TaskStatus,
  TaskPriority,
  FeatureRequest,
  FeatureResult,
} from '@/agents/base/types';
import { NatsClient } from '@/shared/messaging/nats-client';
import { ILLMClient } from '@/shared/llm/base-client';
import { GitHubClient } from '@/shared/github/client';
import { ErrorCode } from '@/shared/errors/custom-errors';

/**
 * Repo Manager Agent Tests
 *
 * TDD approach with strict quality standards
 * Tests workflow orchestration, multi-agent coordination, PR management
 *
 * Feature: F2.5 - Repo Manager Agent
 */

// Mock dependencies
jest.mock('@/shared/messaging/nats-client');
jest.mock('@/shared/github/client');

describe('RepoManagerAgent', () => {
  let agent: RepoManagerAgent;
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
      request: jest.fn().mockResolvedValue({
        data: Buffer.from(
          JSON.stringify({
            taskId: 'impl-1',
            status: TaskStatus.COMPLETED,
            success: true,
            data: {
              branch: 'feature/test',
              commits: [{ sha: 'abc123', message: 'feat: test', files: [] }],
              filesChanged: [],
            },
          })
        ),
        subject: 'task.coder',
      }),
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
      createPullRequest: jest.fn(),
      getPullRequest: jest.fn(),
      mergePullRequest: jest.fn(),
    } as any;

    const config = {
      id: 'repo-manager-1',
      type: AgentType.REPO_MANAGER,
      name: 'Repo Manager Agent',
      llm: { provider: 'claude' as const },
      nats: { servers: ['nats://localhost:4222'] },
    };

    agent = new RepoManagerAgent(config, mockNatsClient, mockLLMClient, mockGitHubClient);
  });

  afterEach(async () => {
    await agent.stop();
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.GITHUB_TOKEN;
  });

  describe('Agent Type', () => {
    it('should return REPO_MANAGER agent type', () => {
      expect(agent.getAgentType()).toBe(AgentType.REPO_MANAGER);
    });
  });

  describe('Task Processing', () => {
    it('should process feature request successfully', async () => {
      const task: FeatureRequest = {
        id: 'task-1',
        type: 'FEATURE_REQUEST',
        agentType: AgentType.REPO_MANAGER,
        priority: TaskPriority.NORMAL,
        status: TaskStatus.PENDING,
        payload: {
          repository: {
            owner: 'test-owner',
            repo: 'test-repo',
            url: 'https://github.com/test-owner/test-repo.git',
          },
          feature: {
            title: 'Add user authentication',
            description: 'Implement JWT-based authentication',
            requirements: [
              'Create login endpoint',
              'Generate JWT tokens',
              'Validate tokens on protected routes',
            ],
          },
        },
        metadata: {
          createdAt: Date.now(),
        },
      };

      // Mock NATS request for implementation
      mockNatsClient.request.mockResolvedValueOnce({
        data: JSON.stringify({
          taskId: 'impl-1',
          status: TaskStatus.COMPLETED,
          success: true,
          data: {
            branch: 'feature/add-user-authentication',
            commits: [
              {
                sha: 'abc123',
                message: 'feat: Add user authentication',
                files: ['src/auth/login.ts'],
              },
            ],
            filesChanged: [
              {
                path: 'src/auth/login.ts',
                status: 'added',
                additions: 50,
                deletions: 0,
              },
            ],
          },
        }),
      });

      // Mock PR creation
      mockGitHubClient.createPullRequest.mockResolvedValue({
        number: 123,
        title: 'Add user authentication',
        body: 'Implement JWT-based authentication',
        state: 'open',
        head: { ref: 'feature/add-user-authentication', sha: 'abc123' },
        base: { ref: 'main', sha: 'def456' },
        user: { login: 'repo-manager' },
        url: 'https://github.com/test-owner/test-repo/pull/123',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // Mock NATS request for review
      mockNatsClient.request.mockResolvedValueOnce({
        data: JSON.stringify({
          taskId: 'review-1',
          status: TaskStatus.COMPLETED,
          success: true,
          data: {
            review: {
              id: 456,
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
            },
          },
        }),
      });

      // Mock PR merge
      mockGitHubClient.mergePullRequest.mockResolvedValue({
        sha: 'merged123',
        merged: true,
        message: 'Pull request successfully merged',
      });

      const result = (await agent.processTask(task)) as FeatureResult;

      expect(result.success).toBe(true);
      expect(result.status).toBe(TaskStatus.COMPLETED);
      expect(result.data?.pullRequest.number).toBe(123);
      expect(result.data?.pullRequest.merged).toBe(true);
      expect(mockNatsClient.request).toHaveBeenCalledTimes(2); // Implementation + Review
      expect(mockGitHubClient.createPullRequest).toHaveBeenCalled();
      expect(mockGitHubClient.mergePullRequest).toHaveBeenCalled();
    });

    it('should validate feature request payload', async () => {
      const invalidTask = {
        id: 'task-1',
        type: 'FEATURE_REQUEST',
        agentType: AgentType.REPO_MANAGER,
        priority: TaskPriority.NORMAL,
        status: TaskStatus.PENDING,
        payload: {
          repository: {}, // Missing required fields
          feature: {},
        },
        metadata: { createdAt: Date.now() },
      } as FeatureRequest;

      const result = await agent.processTask(invalidTask);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ErrorCode.VALIDATION_ERROR);
    });

    it('should handle implementation failures', async () => {
      const task: FeatureRequest = {
        id: 'task-2',
        type: 'FEATURE_REQUEST',
        agentType: AgentType.REPO_MANAGER,
        priority: TaskPriority.NORMAL,
        status: TaskStatus.PENDING,
        payload: {
          repository: {
            owner: 'test-owner',
            repo: 'test-repo',
            url: 'https://github.com/test-owner/test-repo.git',
          },
          feature: {
            title: 'Test feature',
            description: 'Test',
            requirements: ['Test'],
          },
        },
        metadata: { createdAt: Date.now() },
      };

      // Mock failed implementation
      mockNatsClient.request.mockResolvedValueOnce({
        data: JSON.stringify({
          taskId: 'impl-1',
          status: TaskStatus.FAILED,
          success: false,
          error: {
            code: ErrorCode.IMPLEMENTATION_FAILED,
            message: 'Implementation failed',
          },
        }),
      });

      const result = await agent.processTask(task);

      expect(result.success).toBe(false);
      expect(result.status).toBe(TaskStatus.FAILED);
      expect(result.error).toBeDefined();
    });

    it('should handle review requesting changes', async () => {
      const task: FeatureRequest = {
        id: 'task-3',
        type: 'FEATURE_REQUEST',
        agentType: AgentType.REPO_MANAGER,
        priority: TaskPriority.NORMAL,
        status: TaskStatus.PENDING,
        payload: {
          repository: {
            owner: 'test-owner',
            repo: 'test-repo',
            url: 'https://github.com/test-owner/test-repo.git',
          },
          feature: {
            title: 'Test feature',
            description: 'Test',
            requirements: ['Test'],
          },
          workflow: {
            requireApproval: true,
            autoMerge: false, // Don't auto-merge when changes requested
          },
        },
        metadata: { createdAt: Date.now() },
      };

      // Mock implementation success
      mockNatsClient.request.mockResolvedValueOnce({
        data: JSON.stringify({
          taskId: 'impl-1',
          status: TaskStatus.COMPLETED,
          success: true,
          data: {
            branch: 'feature/test',
            commits: [{ sha: 'abc', message: 'test', files: [] }],
            filesChanged: [],
          },
        }),
      });

      // Mock PR creation
      mockGitHubClient.createPullRequest.mockResolvedValue({
        number: 124,
        title: 'Test feature',
        body: 'Test',
        state: 'open',
        head: { ref: 'feature/test', sha: 'abc' },
        base: { ref: 'main', sha: 'def' },
        user: { login: 'test' },
        url: 'https://github.com/test-owner/test-repo/pull/124',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // Mock review requesting changes
      mockNatsClient.request.mockResolvedValueOnce({
        data: JSON.stringify({
          taskId: 'review-1',
          status: TaskStatus.COMPLETED,
          success: true,
          data: {
            review: {
              id: 457,
              decision: 'REQUEST_CHANGES',
              summary: 'Please fix issues',
              comments: [{ path: 'test.ts', body: 'Fix this', severity: 'error' }],
              stats: {
                filesReviewed: 1,
                issuesFound: 1,
                criticalIssues: 1,
                warnings: 0,
                suggestions: 0,
              },
            },
          },
        }),
      });

      const result = (await agent.processTask(task)) as FeatureResult;

      expect(result.success).toBe(true);
      expect(result.status).toBe(TaskStatus.COMPLETED);
      expect(result.data?.pullRequest.merged).toBe(false);
      expect(result.data?.review?.decision).toBe('REQUEST_CHANGES');
      expect(mockGitHubClient.mergePullRequest).not.toHaveBeenCalled();
    });
  });

  describe('Workflow Orchestration', () => {
    it('should orchestrate implementation task', async () => {
      const feature = {
        title: 'Test Feature',
        description: 'Test Description',
        requirements: ['Req 1', 'Req 2'],
      };

      const repository = {
        owner: 'test-owner',
        repo: 'test-repo',
        url: 'https://github.com/test-owner/test-repo.git',
      };

      mockNatsClient.request.mockResolvedValue({
        data: JSON.stringify({
          taskId: 'impl-1',
          status: TaskStatus.COMPLETED,
          success: true,
          data: {
            branch: 'feature/test-feature',
            commits: [],
            filesChanged: [],
          },
        }),
      });

      const result = await (agent as any).requestImplementation(repository, feature);

      expect(result.success).toBe(true);
      expect(result.data.branch).toBe('feature/test-feature');
      expect(mockNatsClient.request).toHaveBeenCalledWith(
        'task.coder',
        expect.any(Object),
        expect.any(Object)
      );
    });

    it('should orchestrate review task', async () => {
      const repository = { owner: 'test-owner', repo: 'test-repo' };
      const prNumber = 123;

      mockNatsClient.request.mockResolvedValue({
        data: JSON.stringify({
          taskId: 'review-1',
          status: TaskStatus.COMPLETED,
          success: true,
          data: {
            review: {
              id: 456,
              decision: 'APPROVE',
              summary: 'LGTM',
              comments: [],
              stats: {
                filesReviewed: 1,
                issuesFound: 0,
                criticalIssues: 0,
                warnings: 0,
                suggestions: 0,
              },
            },
          },
        }),
      });

      const result = await (agent as any).requestReview(repository, prNumber, 'Test PR');

      expect(result.success).toBe(true);
      expect(result.data.review.decision).toBe('APPROVE');
      expect(mockNatsClient.request).toHaveBeenCalledWith(
        'task.reviewer',
        expect.any(Object),
        expect.any(Object)
      );
    });
  });

  describe('PR Management', () => {
    it('should create pull request', async () => {
      const repository = { owner: 'test-owner', repo: 'test-repo' };
      const branch = 'feature/test';
      const feature = {
        title: 'Test Feature',
        description: 'Test Description',
        requirements: [],
      };

      mockGitHubClient.createPullRequest.mockResolvedValue({
        number: 125,
        title: 'Test Feature',
        body: 'Test Description',
        state: 'open',
        head: { ref: branch, sha: 'abc' },
        base: { ref: 'main', sha: 'def' },
        user: { login: 'test' },
        url: 'https://github.com/test-owner/test-repo/pull/125',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const pr = await (agent as any).createPullRequest(repository, branch, feature);

      expect(pr.number).toBe(125);
      expect(mockGitHubClient.createPullRequest).toHaveBeenCalled();
    });

    it('should merge pull request', async () => {
      const repository = { owner: 'test-owner', repo: 'test-repo' };
      const prNumber = 126;

      mockGitHubClient.mergePullRequest.mockResolvedValue({
        sha: 'merged456',
        merged: true,
        message: 'Merged successfully',
      });

      const result = await (agent as any).mergePullRequest(repository, prNumber);

      expect(result.merged).toBe(true);
      expect(mockGitHubClient.mergePullRequest).toHaveBeenCalled();
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
