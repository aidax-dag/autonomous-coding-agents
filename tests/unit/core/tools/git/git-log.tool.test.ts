/**
 * Git Log Tool Tests
 *
 * Tests for the GitLogTool class.
 */

import { GitLogTool } from '@/core/tools/git/git-log.tool';
import { IGitClient, GitCommit } from '@/core/tools/git/git.interface';

// Mock logger
jest.mock('@/core/services/logger', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  })),
}));

describe('GitLogTool', () => {
  let tool: GitLogTool;
  let mockGitClient: jest.Mocked<IGitClient>;

  beforeEach(() => {
    mockGitClient = {
      status: jest.fn(),
      add: jest.fn(),
      reset: jest.fn(),
      commit: jest.fn(),
      log: jest.fn(),
      branch: jest.fn(),
      createBranch: jest.fn(),
      deleteBranch: jest.fn(),
      checkout: jest.fn(),
      push: jest.fn(),
      pull: jest.fn(),
      fetch: jest.fn(),
      diff: jest.fn(),
      merge: jest.fn(),
      stash: jest.fn(),
      stashPush: jest.fn(),
      stashPop: jest.fn(),
      stashDrop: jest.fn(),
      tag: jest.fn(),
      createTag: jest.fn(),
      deleteTag: jest.fn(),
      remote: jest.fn(),
      isRepository: jest.fn(),
      getRoot: jest.fn(),
      getConfig: jest.fn(),
    };

    tool = new GitLogTool(mockGitClient);
  });

  describe('constructor', () => {
    it('should create tool with default git client', () => {
      const defaultTool = new GitLogTool();
      expect(defaultTool.name).toBe('git-log');
    });

    it('should create tool with custom git client', () => {
      expect(tool.name).toBe('git-log');
      expect(tool.description).toBe('Show commit logs');
    });
  });

  describe('schema', () => {
    it('should have correct schema definition', () => {
      expect(tool.schema.name).toBe('git-log');
      expect(tool.schema.parameters).toHaveLength(7);
    });
  });

  describe('execute', () => {
    it('should get log successfully', async () => {
      const commits: GitCommit[] = [
        {
          hash: 'abc123',
          shortHash: 'abc123',
          message: 'First commit',
          author: 'Test User',
          email: 'test@example.com',
          date: new Date('2024-01-01'),
        },
        {
          hash: 'def456',
          shortHash: 'def456',
          message: 'Second commit',
          author: 'Test User',
          email: 'test@example.com',
          date: new Date('2024-01-02'),
        },
      ];

      mockGitClient.log.mockResolvedValue({
        success: true,
        data: commits,
      });

      const result = await tool.execute({});

      expect(result.success).toBe(true);
      expect(result.data?.commits).toHaveLength(2);
      expect(result.data?.count).toBe(2);
    });

    it('should use default maxCount of 50', async () => {
      mockGitClient.log.mockResolvedValue({
        success: true,
        data: [],
      });

      await tool.execute({});

      expect(mockGitClient.log).toHaveBeenCalledWith(
        expect.objectContaining({
          maxCount: 50,
        })
      );
    });

    it('should pass custom maxCount', async () => {
      mockGitClient.log.mockResolvedValue({
        success: true,
        data: [],
      });

      await tool.execute({ maxCount: 10 });

      expect(mockGitClient.log).toHaveBeenCalledWith(
        expect.objectContaining({
          maxCount: 10,
        })
      );
    });

    it('should parse since date option', async () => {
      mockGitClient.log.mockResolvedValue({
        success: true,
        data: [],
      });

      await tool.execute({ since: '2024-01-01' });

      expect(mockGitClient.log).toHaveBeenCalledWith(
        expect.objectContaining({
          since: expect.any(Date),
        })
      );
    });

    it('should parse until date option', async () => {
      mockGitClient.log.mockResolvedValue({
        success: true,
        data: [],
      });

      await tool.execute({ until: '2024-12-31' });

      expect(mockGitClient.log).toHaveBeenCalledWith(
        expect.objectContaining({
          until: expect.any(Date),
        })
      );
    });

    it('should not set since when not provided', async () => {
      mockGitClient.log.mockResolvedValue({
        success: true,
        data: [],
      });

      await tool.execute({});

      expect(mockGitClient.log).toHaveBeenCalledWith(
        expect.objectContaining({
          since: undefined,
        })
      );
    });

    it('should not set until when not provided', async () => {
      mockGitClient.log.mockResolvedValue({
        success: true,
        data: [],
      });

      await tool.execute({});

      expect(mockGitClient.log).toHaveBeenCalledWith(
        expect.objectContaining({
          until: undefined,
        })
      );
    });

    it('should pass author option', async () => {
      mockGitClient.log.mockResolvedValue({
        success: true,
        data: [],
      });

      await tool.execute({ author: 'john@example.com' });

      expect(mockGitClient.log).toHaveBeenCalledWith(
        expect.objectContaining({
          author: 'john@example.com',
        })
      );
    });

    it('should pass grep option', async () => {
      mockGitClient.log.mockResolvedValue({
        success: true,
        data: [],
      });

      await tool.execute({ grep: 'fix:' });

      expect(mockGitClient.log).toHaveBeenCalledWith(
        expect.objectContaining({
          grep: 'fix:',
        })
      );
    });

    it('should pass path option', async () => {
      mockGitClient.log.mockResolvedValue({
        success: true,
        data: [],
      });

      await tool.execute({ path: 'src/main.ts' });

      expect(mockGitClient.log).toHaveBeenCalledWith(
        expect.objectContaining({
          path: 'src/main.ts',
        })
      );
    });

    it('should use custom working directory', async () => {
      mockGitClient.log.mockResolvedValue({
        success: true,
        data: [],
      });

      await tool.execute({ cwd: '/custom/path' });

      expect(mockGitClient.log).toHaveBeenCalledWith(
        expect.objectContaining({
          cwd: '/custom/path',
        })
      );
    });

    it('should handle log failure', async () => {
      mockGitClient.log.mockResolvedValue({
        success: false,
        error: 'Not a git repository',
      });

      const result = await tool.execute({});

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('GIT_LOG_FAILED');
      expect(result.error?.message).toBe('Not a git repository');
    });

    it('should handle log failure with no error message', async () => {
      mockGitClient.log.mockResolvedValue({
        success: false,
      });

      const result = await tool.execute({});

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('Failed to get log');
    });

    it('should return empty commits correctly', async () => {
      mockGitClient.log.mockResolvedValue({
        success: true,
        data: [],
      });

      const result = await tool.execute({});

      expect(result.success).toBe(true);
      expect(result.data?.commits).toHaveLength(0);
      expect(result.data?.count).toBe(0);
    });
  });

  describe('isAvailable', () => {
    it('should return true when in git repository', async () => {
      mockGitClient.isRepository.mockResolvedValue(true);

      const available = await tool.isAvailable();

      expect(available).toBe(true);
    });

    it('should return false when not in git repository', async () => {
      mockGitClient.isRepository.mockResolvedValue(false);

      const available = await tool.isAvailable();

      expect(available).toBe(false);
    });
  });
});
