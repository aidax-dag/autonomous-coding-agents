/**
 * Git Stash Tool Tests
 *
 * Tests for the GitStashTool class.
 */

import { GitStashTool, GitStashInput } from '@/core/tools/git/git-stash.tool';
import { IGitClient, GitStashEntry } from '@/core/tools/git/git.interface';

// Mock logger
jest.mock('@/core/services/logger', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  })),
}));

describe('GitStashTool', () => {
  let tool: GitStashTool;
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

    tool = new GitStashTool(mockGitClient);
  });

  describe('constructor', () => {
    it('should create tool with default git client', () => {
      const defaultTool = new GitStashTool();
      expect(defaultTool.name).toBe('git-stash');
    });

    it('should create tool with custom git client', () => {
      expect(tool.name).toBe('git-stash');
      expect(tool.description).toBe('Stash changes in working directory');
    });
  });

  describe('schema', () => {
    it('should have correct schema definition', () => {
      expect(tool.schema.name).toBe('git-stash');
      expect(tool.schema.parameters).toHaveLength(4);
      expect(tool.schema.parameters.find(p => p.name === 'action')?.required).toBe(true);
      expect(tool.schema.parameters.find(p => p.name === 'action')?.enum).toEqual([
        'list', 'push', 'pop', 'drop', 'apply'
      ]);
    });
  });

  describe('execute - list action', () => {
    it('should list stashes successfully', async () => {
      const stashes: GitStashEntry[] = [
        { index: 0, message: 'WIP on main', branch: 'main', date: new Date() },
        { index: 1, message: 'Feature work', branch: 'feature', date: new Date() },
      ];

      mockGitClient.stash.mockResolvedValue({
        success: true,
        data: stashes,
      });

      const result = await tool.execute({ action: 'list' });

      expect(result.success).toBe(true);
      expect(result.data?.stashes).toHaveLength(2);
      expect(result.data?.stashes?.[0].message).toBe('WIP on main');
    });

    it('should use custom working directory for list', async () => {
      mockGitClient.stash.mockResolvedValue({
        success: true,
        data: [],
      });

      await tool.execute({ action: 'list', cwd: '/custom/path' });

      expect(mockGitClient.stash).toHaveBeenCalledWith({ cwd: '/custom/path' });
    });

    it('should handle list failure', async () => {
      mockGitClient.stash.mockResolvedValue({
        success: false,
        error: 'Not a git repository',
      });

      const result = await tool.execute({ action: 'list' });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('GIT_STASH_FAILED');
      expect(result.error?.message).toBe('Not a git repository');
    });

    it('should handle list failure with no error message', async () => {
      mockGitClient.stash.mockResolvedValue({
        success: false,
      });

      const result = await tool.execute({ action: 'list' });

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('Failed to list stashes');
    });
  });

  describe('execute - push action', () => {
    it('should push stash successfully', async () => {
      mockGitClient.stashPush.mockResolvedValue({
        success: true,
      });

      const result = await tool.execute({ action: 'push' });

      expect(result.success).toBe(true);
      expect(result.data?.created).toBe(true);
    });

    it('should push stash with message', async () => {
      mockGitClient.stashPush.mockResolvedValue({
        success: true,
      });

      const result = await tool.execute({
        action: 'push',
        message: 'Work in progress',
      });

      expect(mockGitClient.stashPush).toHaveBeenCalledWith('Work in progress', {
        cwd: undefined,
      });
      expect(result.success).toBe(true);
    });

    it('should push stash with custom cwd', async () => {
      mockGitClient.stashPush.mockResolvedValue({
        success: true,
      });

      await tool.execute({
        action: 'push',
        message: 'Save work',
        cwd: '/project',
      });

      expect(mockGitClient.stashPush).toHaveBeenCalledWith('Save work', {
        cwd: '/project',
      });
    });

    it('should handle push failure', async () => {
      mockGitClient.stashPush.mockResolvedValue({
        success: false,
        error: 'No local changes to save',
      });

      const result = await tool.execute({ action: 'push' });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('GIT_STASH_FAILED');
      expect(result.error?.message).toBe('No local changes to save');
    });

    it('should handle push failure with no error message', async () => {
      mockGitClient.stashPush.mockResolvedValue({
        success: false,
      });

      const result = await tool.execute({ action: 'push' });

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('Failed to push stash');
    });
  });

  describe('execute - pop action', () => {
    it('should pop stash successfully with default index', async () => {
      mockGitClient.stashPop.mockResolvedValue({
        success: true,
      });

      const result = await tool.execute({ action: 'pop' });

      expect(mockGitClient.stashPop).toHaveBeenCalledWith(0, { cwd: undefined });
      expect(result.success).toBe(true);
      expect(result.data?.applied).toBe(0);
    });

    it('should pop stash with specific index', async () => {
      mockGitClient.stashPop.mockResolvedValue({
        success: true,
      });

      const result = await tool.execute({ action: 'pop', index: 2 });

      expect(mockGitClient.stashPop).toHaveBeenCalledWith(2, { cwd: undefined });
      expect(result.success).toBe(true);
      expect(result.data?.applied).toBe(2);
    });

    it('should handle pop failure', async () => {
      mockGitClient.stashPop.mockResolvedValue({
        success: false,
        error: 'No stash entries found',
      });

      const result = await tool.execute({ action: 'pop' });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('GIT_STASH_FAILED');
      expect(result.error?.message).toBe('No stash entries found');
    });

    it('should handle pop failure with no error message', async () => {
      mockGitClient.stashPop.mockResolvedValue({
        success: false,
      });

      const result = await tool.execute({ action: 'pop' });

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('Failed to pop stash');
    });
  });

  describe('execute - drop action', () => {
    it('should drop stash successfully with default index', async () => {
      mockGitClient.stashDrop.mockResolvedValue({
        success: true,
      });

      const result = await tool.execute({ action: 'drop' });

      expect(mockGitClient.stashDrop).toHaveBeenCalledWith(0, { cwd: undefined });
      expect(result.success).toBe(true);
      expect(result.data?.dropped).toBe(0);
    });

    it('should drop stash with specific index', async () => {
      mockGitClient.stashDrop.mockResolvedValue({
        success: true,
      });

      const result = await tool.execute({ action: 'drop', index: 1 });

      expect(mockGitClient.stashDrop).toHaveBeenCalledWith(1, { cwd: undefined });
      expect(result.success).toBe(true);
      expect(result.data?.dropped).toBe(1);
    });

    it('should handle drop failure', async () => {
      mockGitClient.stashDrop.mockResolvedValue({
        success: false,
        error: 'stash@{5} is not a valid reference',
      });

      const result = await tool.execute({ action: 'drop', index: 5 });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('GIT_STASH_FAILED');
      expect(result.error?.message).toBe('stash@{5} is not a valid reference');
    });

    it('should handle drop failure with no error message', async () => {
      mockGitClient.stashDrop.mockResolvedValue({
        success: false,
      });

      const result = await tool.execute({ action: 'drop' });

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('Failed to drop stash');
    });
  });

  describe('execute - apply action', () => {
    it('should apply stash successfully with default index', async () => {
      mockGitClient.stashPop.mockResolvedValue({
        success: true,
      });

      const result = await tool.execute({ action: 'apply' });

      expect(mockGitClient.stashPop).toHaveBeenCalledWith(0, { cwd: undefined });
      expect(result.success).toBe(true);
      expect(result.data?.applied).toBe(0);
    });

    it('should apply stash with specific index', async () => {
      mockGitClient.stashPop.mockResolvedValue({
        success: true,
      });

      const result = await tool.execute({ action: 'apply', index: 3 });

      expect(mockGitClient.stashPop).toHaveBeenCalledWith(3, { cwd: undefined });
      expect(result.success).toBe(true);
      expect(result.data?.applied).toBe(3);
    });

    it('should handle apply failure', async () => {
      mockGitClient.stashPop.mockResolvedValue({
        success: false,
        error: 'Merge conflict',
      });

      const result = await tool.execute({ action: 'apply' });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('GIT_STASH_FAILED');
      expect(result.error?.message).toBe('Merge conflict');
    });

    it('should handle apply failure with no error message', async () => {
      mockGitClient.stashPop.mockResolvedValue({
        success: false,
      });

      const result = await tool.execute({ action: 'apply' });

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('Failed to apply stash');
    });
  });

  describe('execute - invalid action', () => {
    it('should handle unknown action', async () => {
      const result = await tool.execute({
        action: 'invalid' as GitStashInput['action'],
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_ACTION');
      expect(result.error?.message).toBe('Unknown action: invalid');
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
