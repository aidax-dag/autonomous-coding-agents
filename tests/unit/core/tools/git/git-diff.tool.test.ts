/**
 * Git Diff Tool Tests
 *
 * Tests for the GitDiffTool class.
 */

import { GitDiffTool } from '@/core/tools/git/git-diff.tool';
import { IGitClient, GitFileDiff, GitFileStatus } from '@/core/tools/git/git.interface';

// Mock logger
jest.mock('@/core/services/logger', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  })),
}));

describe('GitDiffTool', () => {
  let tool: GitDiffTool;
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

    tool = new GitDiffTool(mockGitClient);
  });

  describe('constructor', () => {
    it('should create tool with default git client', () => {
      const defaultTool = new GitDiffTool();
      expect(defaultTool.name).toBe('git-diff');
    });

    it('should create tool with custom git client', () => {
      expect(tool.name).toBe('git-diff');
      expect(tool.description).toBe('Show changes between commits, commit and working tree, etc.');
    });
  });

  describe('schema', () => {
    it('should have correct schema definition', () => {
      expect(tool.schema.name).toBe('git-diff');
      expect(tool.schema.parameters).toHaveLength(8);
    });
  });

  describe('execute', () => {
    it('should get diff successfully', async () => {
      const diffs: GitFileDiff[] = [
        { path: 'file1.ts', status: GitFileStatus.MODIFIED, additions: 10, deletions: 5, hunks: [], binary: false },
        { path: 'file2.ts', status: GitFileStatus.MODIFIED, additions: 3, deletions: 2, hunks: [], binary: false },
      ];

      mockGitClient.diff.mockResolvedValue({
        success: true,
        data: diffs,
      });

      const result = await tool.execute({});

      expect(result.success).toBe(true);
      expect(result.data?.files).toHaveLength(2);
      expect(result.data?.totalAdditions).toBe(13);
      expect(result.data?.totalDeletions).toBe(7);
    });

    it('should pass staged option', async () => {
      mockGitClient.diff.mockResolvedValue({
        success: true,
        data: [],
      });

      await tool.execute({ staged: true });

      expect(mockGitClient.diff).toHaveBeenCalledWith({
        cwd: undefined,
        staged: true,
        commit: undefined,
        commits: undefined,
        paths: undefined,
        stat: undefined,
        nameOnly: undefined,
      });
    });

    it('should pass commit option', async () => {
      mockGitClient.diff.mockResolvedValue({
        success: true,
        data: [],
      });

      await tool.execute({ commit: 'abc123' });

      expect(mockGitClient.diff).toHaveBeenCalledWith(
        expect.objectContaining({
          commit: 'abc123',
        })
      );
    });

    it('should pass commit range options', async () => {
      mockGitClient.diff.mockResolvedValue({
        success: true,
        data: [],
      });

      await tool.execute({ fromCommit: 'abc123', toCommit: 'def456' });

      expect(mockGitClient.diff).toHaveBeenCalledWith(
        expect.objectContaining({
          commits: ['abc123', 'def456'],
        })
      );
    });

    it('should not set commits when only fromCommit is provided', async () => {
      mockGitClient.diff.mockResolvedValue({
        success: true,
        data: [],
      });

      await tool.execute({ fromCommit: 'abc123' });

      expect(mockGitClient.diff).toHaveBeenCalledWith(
        expect.objectContaining({
          commits: undefined,
        })
      );
    });

    it('should not set commits when only toCommit is provided', async () => {
      mockGitClient.diff.mockResolvedValue({
        success: true,
        data: [],
      });

      await tool.execute({ toCommit: 'def456' });

      expect(mockGitClient.diff).toHaveBeenCalledWith(
        expect.objectContaining({
          commits: undefined,
        })
      );
    });

    it('should pass paths option', async () => {
      mockGitClient.diff.mockResolvedValue({
        success: true,
        data: [],
      });

      await tool.execute({ paths: ['src/', 'tests/'] });

      expect(mockGitClient.diff).toHaveBeenCalledWith(
        expect.objectContaining({
          paths: ['src/', 'tests/'],
        })
      );
    });

    it('should pass stat and nameOnly options', async () => {
      mockGitClient.diff.mockResolvedValue({
        success: true,
        data: [],
      });

      await tool.execute({ stat: true, nameOnly: true });

      expect(mockGitClient.diff).toHaveBeenCalledWith(
        expect.objectContaining({
          stat: true,
          nameOnly: true,
        })
      );
    });

    it('should use custom working directory', async () => {
      mockGitClient.diff.mockResolvedValue({
        success: true,
        data: [],
      });

      await tool.execute({ cwd: '/custom/path' });

      expect(mockGitClient.diff).toHaveBeenCalledWith(
        expect.objectContaining({
          cwd: '/custom/path',
        })
      );
    });

    it('should handle diff failure', async () => {
      mockGitClient.diff.mockResolvedValue({
        success: false,
        error: 'fatal: bad revision',
      });

      const result = await tool.execute({ commit: 'nonexistent' });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('GIT_DIFF_FAILED');
      expect(result.error?.message).toBe('fatal: bad revision');
    });

    it('should handle diff failure with no error message', async () => {
      mockGitClient.diff.mockResolvedValue({
        success: false,
      });

      const result = await tool.execute({});

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('Failed to get diff');
    });

    it('should calculate totals correctly with empty diff', async () => {
      mockGitClient.diff.mockResolvedValue({
        success: true,
        data: [],
      });

      const result = await tool.execute({});

      expect(result.success).toBe(true);
      expect(result.data?.totalAdditions).toBe(0);
      expect(result.data?.totalDeletions).toBe(0);
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
