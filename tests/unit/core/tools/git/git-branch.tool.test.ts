/**
 * Git Branch Tool Tests
 *
 * Tests for the GitBranchTool class.
 */

import { GitBranchTool, GitBranchInput } from '@/core/tools/git/git-branch.tool';
import { IGitClient, GitBranch } from '@/core/tools/git/git.interface';

// Mock logger
jest.mock('@/core/services/logger', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  })),
}));

describe('GitBranchTool', () => {
  let tool: GitBranchTool;
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

    tool = new GitBranchTool(mockGitClient);
  });

  describe('constructor', () => {
    it('should create tool with default git client', () => {
      const defaultTool = new GitBranchTool();
      expect(defaultTool.name).toBe('git-branch');
    });

    it('should create tool with custom git client', () => {
      expect(tool.name).toBe('git-branch');
      expect(tool.description).toBe('List, create, or delete branches');
    });
  });

  describe('schema', () => {
    it('should have correct schema definition', () => {
      expect(tool.schema.name).toBe('git-branch');
      expect(tool.schema.parameters).toHaveLength(7);
      expect(tool.schema.parameters.find(p => p.name === 'action')?.required).toBe(true);
    });
  });

  describe('execute - list action', () => {
    it('should list branches successfully', async () => {
      const branches: GitBranch[] = [
        { name: 'main', current: true },
        { name: 'feature/test', current: false },
      ];

      mockGitClient.branch.mockResolvedValue({
        success: true,
        data: branches,
      });

      const result = await tool.execute({ action: 'list' });

      expect(result.success).toBe(true);
      expect(result.data?.branches).toHaveLength(2);
      expect(result.data?.branches?.[0].name).toBe('main');
    });

    it('should list all branches including remote', async () => {
      const branches: GitBranch[] = [
        { name: 'main', current: true },
        { name: 'origin/main', current: false, remote: 'origin' },
      ];

      mockGitClient.branch.mockResolvedValue({
        success: true,
        data: branches,
      });

      const result = await tool.execute({ action: 'list', all: true });

      expect(mockGitClient.branch).toHaveBeenCalledWith({
        cwd: undefined,
        all: true,
        remote: undefined,
      });
      expect(result.success).toBe(true);
    });

    it('should list only remote branches', async () => {
      const branches: GitBranch[] = [
        { name: 'origin/main', current: false, remote: 'origin' },
      ];

      mockGitClient.branch.mockResolvedValue({
        success: true,
        data: branches,
      });

      const result = await tool.execute({ action: 'list', remote: true });

      expect(mockGitClient.branch).toHaveBeenCalledWith({
        cwd: undefined,
        all: undefined,
        remote: true,
      });
      expect(result.success).toBe(true);
    });

    it('should handle list failure', async () => {
      mockGitClient.branch.mockResolvedValue({
        success: false,
        error: 'Not a git repository',
      });

      const result = await tool.execute({ action: 'list' });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('GIT_BRANCH_FAILED');
      expect(result.error?.message).toBe('Not a git repository');
    });

    it('should handle list failure with no error message', async () => {
      mockGitClient.branch.mockResolvedValue({
        success: false,
      });

      const result = await tool.execute({ action: 'list' });

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('Failed to list branches');
    });

    it('should use custom working directory', async () => {
      mockGitClient.branch.mockResolvedValue({
        success: true,
        data: [],
      });

      await tool.execute({ action: 'list', cwd: '/custom/path' });

      expect(mockGitClient.branch).toHaveBeenCalledWith({
        cwd: '/custom/path',
        all: undefined,
        remote: undefined,
      });
    });
  });

  describe('execute - create action', () => {
    it('should create branch successfully', async () => {
      mockGitClient.createBranch.mockResolvedValue({
        success: true,
      });

      const result = await tool.execute({
        action: 'create',
        name: 'feature/new-feature',
      });

      expect(result.success).toBe(true);
      expect(result.data?.created).toBe('feature/new-feature');
    });

    it('should create branch with start point', async () => {
      mockGitClient.createBranch.mockResolvedValue({
        success: true,
      });

      const result = await tool.execute({
        action: 'create',
        name: 'hotfix/fix-bug',
        startPoint: 'v1.0.0',
      });

      expect(mockGitClient.createBranch).toHaveBeenCalledWith('hotfix/fix-bug', {
        cwd: undefined,
        startPoint: 'v1.0.0',
      });
      expect(result.success).toBe(true);
    });

    it('should fail when branch name is missing', async () => {
      const result = await tool.execute({ action: 'create' });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_PARAMS');
      expect(result.error?.message).toBe('Branch name is required for create action');
    });

    it('should handle create failure', async () => {
      mockGitClient.createBranch.mockResolvedValue({
        success: false,
        error: 'Branch already exists',
      });

      const result = await tool.execute({
        action: 'create',
        name: 'existing-branch',
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('GIT_BRANCH_FAILED');
      expect(result.error?.message).toBe('Branch already exists');
    });

    it('should handle create failure with no error message', async () => {
      mockGitClient.createBranch.mockResolvedValue({
        success: false,
      });

      const result = await tool.execute({
        action: 'create',
        name: 'new-branch',
      });

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('Failed to create branch');
    });
  });

  describe('execute - delete action', () => {
    it('should delete branch successfully', async () => {
      mockGitClient.deleteBranch.mockResolvedValue({
        success: true,
      });

      const result = await tool.execute({
        action: 'delete',
        name: 'feature/old-feature',
      });

      expect(result.success).toBe(true);
      expect(result.data?.deleted).toBe('feature/old-feature');
    });

    it('should force delete branch', async () => {
      mockGitClient.deleteBranch.mockResolvedValue({
        success: true,
      });

      const result = await tool.execute({
        action: 'delete',
        name: 'unmerged-branch',
        force: true,
      });

      expect(mockGitClient.deleteBranch).toHaveBeenCalledWith(
        'unmerged-branch',
        true,
        { cwd: undefined }
      );
      expect(result.success).toBe(true);
    });

    it('should fail when branch name is missing', async () => {
      const result = await tool.execute({ action: 'delete' });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_PARAMS');
      expect(result.error?.message).toBe('Branch name is required for delete action');
    });

    it('should handle delete failure', async () => {
      mockGitClient.deleteBranch.mockResolvedValue({
        success: false,
        error: 'Cannot delete current branch',
      });

      const result = await tool.execute({
        action: 'delete',
        name: 'main',
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('GIT_BRANCH_FAILED');
      expect(result.error?.message).toBe('Cannot delete current branch');
    });

    it('should handle delete failure with no error message', async () => {
      mockGitClient.deleteBranch.mockResolvedValue({
        success: false,
      });

      const result = await tool.execute({
        action: 'delete',
        name: 'some-branch',
      });

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('Failed to delete branch');
    });
  });

  describe('execute - invalid action', () => {
    it('should handle unknown action', async () => {
      const result = await tool.execute({
        action: 'invalid' as GitBranchInput['action'],
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
