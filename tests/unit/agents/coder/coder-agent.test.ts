import { CoderAgent } from '@/agents/coder/coder-agent';
import {
  AgentType,
  AgentState,
  TaskStatus,
  TaskPriority,
  ImplementationRequest,
  ImplementationResult,
} from '@/agents/base/types';
import { NatsClient } from '@/shared/messaging/nats-client';
import { ILLMClient } from '@/shared/llm/base-client';
import { GitOperations } from '@/shared/git/operations';
import { ErrorCode } from '@/shared/errors/custom-errors';
import * as fs from 'fs/promises';

/**
 * Coder Agent Tests
 *
 * TDD approach with strict quality standards
 * Tests code generation, git operations, and validation
 *
 * Feature: F2.3 - Coder Agent
 */

// Mock dependencies
jest.mock('@/shared/messaging/nats-client');
jest.mock('@/shared/git/operations');
jest.mock('fs/promises');

describe('CoderAgent', () => {
  let agent: CoderAgent;
  let mockNatsClient: jest.Mocked<NatsClient>;
  let mockLLMClient: jest.Mocked<ILLMClient>;
  let mockGitOps: jest.Mocked<GitOperations>;

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

    mockGitOps = {
      createBranch: jest.fn().mockResolvedValue(undefined),
      checkout: jest.fn().mockResolvedValue(undefined),
      add: jest.fn().mockResolvedValue(undefined),
      commit: jest.fn().mockResolvedValue('abc123'),
      push: jest.fn().mockResolvedValue(undefined),
      status: jest.fn().mockResolvedValue({
        current: 'feature/test',
        tracking: null,
        ahead: 0,
        behind: 0,
        modified: [],
        created: [],
        deleted: [],
        renamed: [],
        conflicted: [],
        isClean: true,
      }),
    } as any;

    // Mock GitOperations constructor
    (GitOperations as jest.MockedClass<typeof GitOperations>).mockImplementation(
      () => mockGitOps
    );

    // Mock GitOperations.clone static method
    jest.spyOn(GitOperations, 'clone').mockResolvedValue(mockGitOps as any);

    // Mock fs/promises methods
    jest.spyOn(fs, 'mkdir').mockResolvedValue(undefined);
    jest.spyOn(fs, 'writeFile').mockResolvedValue(undefined);
    jest.spyOn(fs, 'unlink').mockResolvedValue(undefined);
    jest.spyOn(fs, 'rm').mockResolvedValue(undefined);

    const config = {
      id: 'coder-1',
      type: AgentType.CODER,
      name: 'Coder Agent',
      llm: { provider: 'claude' as const },
      nats: { servers: ['nats://localhost:4222'] },
    };

    agent = new CoderAgent(config, mockNatsClient, mockLLMClient);
  });

  afterEach(async () => {
    await agent.stop();
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.GITHUB_TOKEN;
  });

  describe('Agent Type', () => {
    it('should return CODER agent type', () => {
      expect(agent.getAgentType()).toBe(AgentType.CODER);
    });
  });

  describe('Task Processing', () => {
    it('should process implementation request successfully', async () => {
      const task: ImplementationRequest = {
        id: 'task-1',
        type: 'IMPLEMENTATION_REQUEST',
        agentType: AgentType.CODER,
        priority: TaskPriority.NORMAL,
        status: TaskStatus.PENDING,
        payload: {
          repository: {
            owner: 'test-owner',
            repo: 'test-repo',
            url: 'https://github.com/test-owner/test-repo.git',
          },
          branch: 'main',
          featureBranch: 'feature/test-feature',
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

      mockLLMClient.chat.mockResolvedValue({
        content: JSON.stringify({
          files: [
            {
              path: 'src/auth/login.ts',
              content: 'export function login() { /* implementation */ }',
              action: 'create',
            },
          ],
          summary: 'Implemented JWT authentication',
        }),
        model: 'claude-3-5-sonnet-20241022',
        usage: { promptTokens: 100, completionTokens: 200, totalTokens: 300 },
        finishReason: 'stop',
      });

      mockGitOps.commit.mockResolvedValue('abc123');
      mockGitOps.status.mockResolvedValue({
        current: 'feature/test-feature',
        tracking: null,
        ahead: 0,
        behind: 0,
        modified: [],
        created: [],
        deleted: [],
        renamed: [],
        conflicted: [],
        isClean: true,
      });

      const result = (await agent.processTask(task)) as ImplementationResult;

      expect(result.success).toBe(true);
      expect(result.status).toBe(TaskStatus.COMPLETED);
      expect(result.data?.branch).toBe('feature/test-feature');
      expect(result.data?.filesChanged).toHaveLength(1);
      expect(result.data?.commits).toBeDefined();
    });

    it('should validate implementation request payload', async () => {
      const invalidTask = {
        id: 'task-1',
        type: 'IMPLEMENTATION_REQUEST',
        agentType: AgentType.CODER,
        priority: TaskPriority.NORMAL,
        status: TaskStatus.PENDING,
        payload: {
          // Missing required fields
          repository: {},
        },
        metadata: { createdAt: Date.now() },
      } as ImplementationRequest;

      const result = await agent.processTask(invalidTask);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ErrorCode.VALIDATION_ERROR);
    });

    it('should handle LLM errors gracefully', async () => {
      const task: ImplementationRequest = {
        id: 'task-1',
        type: 'IMPLEMENTATION_REQUEST',
        agentType: AgentType.CODER,
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
            requirements: ['Requirement 1'],
          },
        },
        metadata: { createdAt: Date.now() },
      };

      mockLLMClient.chat.mockRejectedValue(new Error('LLM rate limited'));

      const result = await agent.processTask(task);

      expect(result.success).toBe(false);
      expect(result.status).toBe(TaskStatus.FAILED);
      expect(result.error).toBeDefined();
    });

    it('should handle git operation errors', async () => {
      const task: ImplementationRequest = {
        id: 'task-1',
        type: 'IMPLEMENTATION_REQUEST',
        agentType: AgentType.CODER,
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
            requirements: ['Requirement 1'],
          },
        },
        metadata: { createdAt: Date.now() },
      };

      mockLLMClient.chat.mockResolvedValue({
        content: JSON.stringify({
          files: [{ path: 'test.ts', content: 'test', action: 'create' }],
        }),
        model: 'claude',
        usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
        finishReason: 'stop',
      });

      mockGitOps.commit.mockRejectedValue(new Error('Commit failed'));

      const result = await agent.processTask(task);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Code Generation', () => {
    it('should generate code using LLM', async () => {
      const requirements = {
        title: 'User login feature',
        description: 'Create user login functionality',
        requirements: ['Login endpoint', 'Password validation'],
      };

      mockLLMClient.chat.mockResolvedValue({
        content: JSON.stringify({
          files: [
            {
              path: 'src/auth.ts',
              content: 'export function login() {}',
              action: 'create',
            },
          ],
        }),
        model: 'claude',
        usage: { promptTokens: 50, completionTokens: 100, totalTokens: 150 },
        finishReason: 'stop',
      });

      const result = await (agent as any).generateCode(requirements);

      expect(result.files).toHaveLength(1);
      expect(result.files[0].path).toBe('src/auth.ts');
      expect(mockLLMClient.chat).toHaveBeenCalled();
    });

    it('should validate LLM response format', async () => {
      const requirements = {
        title: 'Test',
        description: 'Test',
        requirements: ['Test'],
      };

      mockLLMClient.chat.mockResolvedValue({
        content: 'invalid json',
        model: 'claude',
        usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
        finishReason: 'stop',
      });

      await expect((agent as any).generateCode(requirements)).rejects.toThrow();
    });
  });

  describe('File Operations', () => {
    it('should create new files', async () => {
      const files = [
        { path: 'src/new.ts', content: 'export const test = 1;', action: 'create' as const },
      ];

      await expect((agent as any).applyFileChanges(files, '/test/repo')).resolves.not.toThrow();
    });

    it('should modify existing files', async () => {
      const files = [
        { path: 'src/existing.ts', content: 'updated content', action: 'modify' as const },
      ];

      await expect((agent as any).applyFileChanges(files, '/test/repo')).resolves.not.toThrow();
    });

    it('should handle file write errors', async () => {
      const files = [
        { path: '/invalid/path/file.ts', content: 'test', action: 'create' as const },
      ];

      // Mock mkdir to throw for invalid path
      jest.spyOn(fs, 'mkdir').mockRejectedValueOnce(new Error('ENOENT: no such file or directory'));

      // Should handle error gracefully
      await expect((agent as any).applyFileChanges(files, '/test/repo')).rejects.toThrow();
    });
  });

  describe('Git Operations', () => {
    it('should create and checkout feature branch', async () => {
      await (agent as any).createFeatureBranch(mockGitOps, 'feature/test');

      expect(mockGitOps.createBranch).toHaveBeenCalledWith('feature/test', true);
    });

    it('should commit changes with message', async () => {
      const files = ['src/file1.ts', 'src/file2.ts'];
      mockGitOps.commit.mockResolvedValue('abc123');

      const commitSha = await (agent as any).commitChanges(
        mockGitOps,
        files,
        'Implement feature'
      );

      expect(commitSha).toBe('abc123');
      expect(mockGitOps.add).toHaveBeenCalledWith(files);
      expect(mockGitOps.commit).toHaveBeenCalled();
    });

    it('should push changes to remote', async () => {
      await (agent as any).pushChanges(mockGitOps, 'feature/test');

      expect(mockGitOps.push).toHaveBeenCalledWith('origin', 'feature/test');
    });
  });

  describe('Validation', () => {
    it('should validate generated code has no syntax errors', async () => {
      const code = 'export function test() { return true; }';

      const result = await (agent as any).validateSyntax(code);

      expect(result.valid).toBe(true);
    });

    it('should detect syntax errors', async () => {
      const code = 'export function test() { return true; '; // Missing closing brace

      const result = await (agent as any).validateSyntax(code);

      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
    });
  });

  describe('Resource Cleanup', () => {
    it('should cleanup resources on stop', async () => {
      await agent.start();
      await agent.stop();

      expect(agent.getState()).toBe(AgentState.STOPPED);
    });
  });

  describe('Error Recovery', () => {
    it('should retry on retryable errors', async () => {
      const task: ImplementationRequest = {
        id: 'task-1',
        type: 'IMPLEMENTATION_REQUEST',
        agentType: AgentType.CODER,
        priority: TaskPriority.NORMAL,
        status: TaskStatus.PENDING,
        payload: {
          repository: {
            owner: 'test',
            repo: 'test',
            url: 'https://github.com/test/test.git',
          },
          feature: {
            title: 'Test',
            description: 'Test',
            requirements: ['Test'],
          },
        },
        metadata: { createdAt: Date.now() },
      };

      let callCount = 0;
      mockLLMClient.chat.mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          throw new Error('Rate limited');
        }
        return {
          content: JSON.stringify({ files: [], summary: 'Success' }),
          model: 'claude',
          usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
          finishReason: 'stop',
        };
      });

      await agent.processTask(task);

      // Should eventually succeed after retry
      expect(callCount).toBeGreaterThan(1);
    });
  });
});
