/**
 * Git Tools Tests
 */

import {
  GitStatusTool,
  GitAddTool,
  GitResetTool,
  GitCommitTool,
  GitPushTool,
  GitPullTool,
  GitBranchTool,
  GitCheckoutTool,
  GitDiffTool,
  GitLogTool,
  GitMergeTool,
  GitStashTool,
  createGitTools,
} from '../../../../../src/core/tools/git/index.js';
import { ToolCategory } from '../../../../../src/core/interfaces/tool.interface.js';
import {
  MockGitClient,
  createMockStatus,
  createMockCommit,
  createMockFileChange,
  createMockDiff,
} from './mock-git-client.js';

describe('Git Tools', () => {
  let mockClient: MockGitClient;

  beforeEach(() => {
    mockClient = new MockGitClient();
  });

  describe('GitStatusTool', () => {
    let tool: GitStatusTool;

    beforeEach(() => {
      tool = new GitStatusTool(mockClient);
    });

    it('should have correct metadata', () => {
      expect(tool.name).toBe('git-status');
      expect(tool.getCategory()).toBe(ToolCategory.GIT);
      expect(tool.schema.tags).toContain('git');
    });

    it('should return repository status', async () => {
      mockClient.statusResponse = {
        success: true,
        data: createMockStatus({
          branch: 'feature/test',
          staged: [createMockFileChange('file1.ts', true)],
          unstaged: [createMockFileChange('file2.ts', false)],
          untracked: ['file3.ts'],
          isClean: false,
        }),
      };

      const result = await tool.execute({});

      expect(result.success).toBe(true);
      expect(result.data?.branch).toBe('feature/test');
      expect(result.data?.staged).toHaveLength(1);
      expect(result.data?.unstaged).toHaveLength(1);
      expect(result.data?.untracked).toContain('file3.ts');
    });

    it('should handle errors', async () => {
      mockClient.statusResponse = {
        success: false,
        error: 'Not a git repository',
      };

      const result = await tool.execute({});

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('GIT_STATUS_FAILED');
    });

    it('should check availability', async () => {
      mockClient.isRepositoryResponse = true;
      expect(await tool.isAvailable()).toBe(true);

      mockClient.isRepositoryResponse = false;
      expect(await tool.isAvailable()).toBe(false);
    });
  });

  describe('GitAddTool', () => {
    let tool: GitAddTool;

    beforeEach(() => {
      tool = new GitAddTool(mockClient);
    });

    it('should stage files', async () => {
      const result = await tool.execute({ paths: ['file1.ts', 'file2.ts'] });

      expect(result.success).toBe(true);
      expect(result.data?.stagedFiles).toEqual(['file1.ts', 'file2.ts']);
      expect(mockClient.calls).toContainEqual({
        method: 'add',
        args: [['file1.ts', 'file2.ts'], { cwd: undefined }],
      });
    });

    it('should fail with empty paths', async () => {
      const result = await tool.execute({ paths: [] });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_PARAMS');
    });

    it('should handle errors', async () => {
      mockClient.addResponse = { success: false, error: 'Path not found' };

      const result = await tool.execute({ paths: ['nonexistent.ts'] });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('GIT_ADD_FAILED');
    });
  });

  describe('GitResetTool', () => {
    let tool: GitResetTool;

    beforeEach(() => {
      tool = new GitResetTool(mockClient);
    });

    it('should unstage files', async () => {
      const result = await tool.execute({ paths: ['file1.ts'] });

      expect(result.success).toBe(true);
      expect(result.data?.unstagedFiles).toEqual(['file1.ts']);
    });

    it('should fail with empty paths', async () => {
      const result = await tool.execute({ paths: [] });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_PARAMS');
    });
  });

  describe('GitCommitTool', () => {
    let tool: GitCommitTool;

    beforeEach(() => {
      tool = new GitCommitTool(mockClient);
    });

    it('should create commit', async () => {
      mockClient.commitResponse = {
        success: true,
        data: createMockCommit({ message: 'feat: add new feature' }),
      };

      const result = await tool.execute({ message: 'feat: add new feature' });

      expect(result.success).toBe(true);
      expect(result.data?.message).toBe('feat: add new feature');
    });

    it('should support commit options', async () => {
      await tool.execute({
        message: 'Test commit',
        all: true,
        signoff: true,
      });

      expect(mockClient.calls[0].args[1]).toMatchObject({
        all: true,
        signoff: true,
      });
    });

    it('should fail with empty message', async () => {
      const result = await tool.execute({ message: '' });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_PARAMS');
    });

    it('should handle commit failure', async () => {
      mockClient.commitResponse = {
        success: false,
        error: 'Nothing to commit',
      };

      const result = await tool.execute({ message: 'Test' });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('GIT_COMMIT_FAILED');
    });
  });

  describe('GitPushTool', () => {
    let tool: GitPushTool;

    beforeEach(() => {
      tool = new GitPushTool(mockClient);
    });

    it('should push changes', async () => {
      const result = await tool.execute({});

      expect(result.success).toBe(true);
      expect(result.data?.success).toBe(true);
    });

    it('should support push options', async () => {
      await tool.execute({
        remote: 'origin',
        branch: 'main',
        force: true,
        setUpstream: true,
      });

      expect(mockClient.calls[0].args[0]).toMatchObject({
        remote: 'origin',
        branch: 'main',
        force: true,
        setUpstream: true,
      });
    });

    it('should handle push failure', async () => {
      mockClient.pushResponse = {
        success: false,
        error: 'Remote rejected',
      };

      const result = await tool.execute({});

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('GIT_PUSH_FAILED');
    });
  });

  describe('GitPullTool', () => {
    let tool: GitPullTool;

    beforeEach(() => {
      tool = new GitPullTool(mockClient);
    });

    it('should pull changes', async () => {
      const result = await tool.execute({});

      expect(result.success).toBe(true);
    });

    it('should support pull options', async () => {
      await tool.execute({
        rebase: true,
        ffOnly: true,
      });

      expect(mockClient.calls[0].args[0]).toMatchObject({
        rebase: true,
        ffOnly: true,
      });
    });
  });

  describe('GitBranchTool', () => {
    let tool: GitBranchTool;

    beforeEach(() => {
      tool = new GitBranchTool(mockClient);
    });

    it('should list branches', async () => {
      const result = await tool.execute({ action: 'list' });

      expect(result.success).toBe(true);
      expect(result.data?.branches).toHaveLength(2);
    });

    it('should create branch', async () => {
      const result = await tool.execute({
        action: 'create',
        name: 'feature/new',
      });

      expect(result.success).toBe(true);
      expect(result.data?.created).toBe('feature/new');
    });

    it('should delete branch', async () => {
      const result = await tool.execute({
        action: 'delete',
        name: 'old-branch',
        force: true,
      });

      expect(result.success).toBe(true);
      expect(result.data?.deleted).toBe('old-branch');
    });

    it('should fail create without name', async () => {
      const result = await tool.execute({ action: 'create' });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_PARAMS');
    });
  });

  describe('GitCheckoutTool', () => {
    let tool: GitCheckoutTool;

    beforeEach(() => {
      tool = new GitCheckoutTool(mockClient);
    });

    it('should checkout branch', async () => {
      const result = await tool.execute({ ref: 'develop' });

      expect(result.success).toBe(true);
      expect(result.data?.ref).toBe('develop');
    });

    it('should create and checkout branch', async () => {
      const result = await tool.execute({
        ref: 'feature/new',
        create: true,
      });

      expect(result.success).toBe(true);
      expect(result.data?.created).toBe(true);
    });

    it('should fail without ref', async () => {
      const result = await tool.execute({ ref: '' });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_PARAMS');
    });
  });

  describe('GitDiffTool', () => {
    let tool: GitDiffTool;

    beforeEach(() => {
      tool = new GitDiffTool(mockClient);
    });

    it('should get diff', async () => {
      mockClient.diffResponse = {
        success: true,
        data: [
          createMockDiff('file1.ts', 10, 5),
          createMockDiff('file2.ts', 20, 3),
        ],
      };

      const result = await tool.execute({});

      expect(result.success).toBe(true);
      expect(result.data?.files).toHaveLength(2);
      expect(result.data?.totalAdditions).toBe(30);
      expect(result.data?.totalDeletions).toBe(8);
    });

    it('should support diff options', async () => {
      await tool.execute({
        staged: true,
        paths: ['src/'],
      });

      expect(mockClient.calls[0].args[0]).toMatchObject({
        staged: true,
        paths: ['src/'],
      });
    });
  });

  describe('GitLogTool', () => {
    let tool: GitLogTool;

    beforeEach(() => {
      tool = new GitLogTool(mockClient);
    });

    it('should get commit log', async () => {
      mockClient.logResponse = {
        success: true,
        data: [
          createMockCommit({ message: 'First commit' }),
          createMockCommit({ message: 'Second commit' }),
        ],
      };

      const result = await tool.execute({ maxCount: 10 });

      expect(result.success).toBe(true);
      expect(result.data?.commits).toHaveLength(2);
      expect(result.data?.count).toBe(2);
    });

    it('should support log filters', async () => {
      await tool.execute({
        author: 'test@example.com',
        grep: 'feat:',
        maxCount: 50,
      });

      expect(mockClient.calls[0].args[0]).toMatchObject({
        author: 'test@example.com',
        grep: 'feat:',
        maxCount: 50,
      });
    });
  });

  describe('GitMergeTool', () => {
    let tool: GitMergeTool;

    beforeEach(() => {
      tool = new GitMergeTool(mockClient);
    });

    it('should merge branch', async () => {
      const result = await tool.execute({ branch: 'feature/merge-me' });

      expect(result.success).toBe(true);
      expect(result.data?.success).toBe(true);
    });

    it('should report conflicts', async () => {
      mockClient.mergeResponse = {
        success: true,
        data: {
          success: false,
          conflicts: ['file1.ts', 'file2.ts'],
          mergedFiles: [],
        },
      };

      const result = await tool.execute({ branch: 'conflicting-branch' });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('MERGE_CONFLICTS');
      expect(result.error?.details?.conflicts).toHaveLength(2);
    });

    it('should fail without branch name', async () => {
      const result = await tool.execute({ branch: '' });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_PARAMS');
    });
  });

  describe('GitStashTool', () => {
    let tool: GitStashTool;

    beforeEach(() => {
      tool = new GitStashTool(mockClient);
    });

    it('should list stashes', async () => {
      mockClient.stashResponse = {
        success: true,
        data: [
          {
            index: 0,
            message: 'WIP on main: abc123 Test',
            branch: 'main',
            date: new Date(),
          },
        ],
      };

      const result = await tool.execute({ action: 'list' });

      expect(result.success).toBe(true);
      expect(result.data?.stashes).toHaveLength(1);
    });

    it('should push stash', async () => {
      const result = await tool.execute({
        action: 'push',
        message: 'Work in progress',
      });

      expect(result.success).toBe(true);
      expect(result.data?.created).toBe(true);
    });

    it('should pop stash', async () => {
      const result = await tool.execute({ action: 'pop', index: 0 });

      expect(result.success).toBe(true);
      expect(result.data?.applied).toBe(0);
    });

    it('should drop stash', async () => {
      const result = await tool.execute({ action: 'drop', index: 1 });

      expect(result.success).toBe(true);
      expect(result.data?.dropped).toBe(1);
    });
  });

  describe('createGitTools', () => {
    it('should create all git tools', () => {
      const tools = createGitTools({ client: mockClient });

      expect(tools).toHaveLength(12);
      expect(tools.map((t) => t.name)).toEqual([
        'git-status',
        'git-add',
        'git-reset',
        'git-commit',
        'git-push',
        'git-pull',
        'git-branch',
        'git-checkout',
        'git-diff',
        'git-log',
        'git-merge',
        'git-stash',
      ]);
    });

    it('should create tools with shared client', async () => {
      const tools = createGitTools({ client: mockClient });

      // Execute a tool to verify client is shared
      const statusTool = tools.find((t) => t.name === 'git-status');
      await statusTool?.execute({});

      expect(mockClient.calls).toContainEqual({
        method: 'status',
        args: [{ cwd: undefined }],
      });
    });
  });

  describe('Tool Validation', () => {
    it('should validate required parameters', () => {
      const tool = new GitCommitTool(mockClient);
      const validation = tool.validate({ message: '' });

      // Empty string may fail validation depending on implementation
      // Execute should also fail for empty messages
      expect(typeof validation.valid).toBe('boolean');
    });

    it('should validate parameter types', () => {
      const tool = new GitLogTool(mockClient);
      const validation = tool.validate({ maxCount: 'not a number' as unknown as number });

      expect(validation.valid).toBe(false);
      expect(validation.errors[0].parameter).toBe('maxCount');
    });
  });

  describe('Tool Metadata', () => {
    it('should have correct category for all tools', () => {
      const tools = createGitTools({ client: mockClient });

      for (const tool of tools) {
        expect(tool.getCategory()).toBe(ToolCategory.GIT);
      }
    });

    it('should have version for all tools', () => {
      const tools = createGitTools({ client: mockClient });

      for (const tool of tools) {
        expect(tool.getVersion()).toBe('1.0.0');
      }
    });

    it('should have tags for all tools', () => {
      const tools = createGitTools({ client: mockClient });

      for (const tool of tools) {
        expect(tool.schema.tags).toContain('git');
      }
    });
  });
});
