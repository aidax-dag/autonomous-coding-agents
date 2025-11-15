import { GitOperations } from '@/shared/git/operations';
import {
  GitError,
  GitMergeConflictError,
  GitAuthenticationError,
} from '@/shared/errors/custom-errors';
import simpleGit from 'simple-git';

/**
 * Git Operations Tests
 *
 * Tests Git operations utility.
 * Note: Uses mocked simple-git to avoid actual Git operations.
 *
 * Feature: F1.8 - Git Operations
 */

// Mock simple-git
jest.mock('simple-git');

describe('GitOperations', () => {
  let mockGit: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockGit = {
      clone: jest.fn().mockResolvedValue(undefined),
      init: jest.fn().mockResolvedValue(undefined),
      pull: jest.fn().mockResolvedValue(undefined),
      push: jest.fn().mockResolvedValue(undefined),
      checkout: jest.fn().mockResolvedValue(undefined),
      checkoutLocalBranch: jest.fn().mockResolvedValue(undefined),
      branch: jest.fn().mockResolvedValue({
        current: 'main',
        all: ['main', 'develop'],
        branches: {
          main: { current: true, name: 'main', commit: 'abc123', label: 'main' },
          develop: { current: false, name: 'develop', commit: 'def456', label: 'develop' },
        },
      }),
      status: jest.fn().mockResolvedValue({
        current: 'main',
        tracking: 'origin/main',
        ahead: 0,
        behind: 0,
        modified: [],
        created: [],
        deleted: [],
        renamed: [],
        conflicted: [],
        isClean: () => true,
      }),
      add: jest.fn().mockResolvedValue(undefined),
      commit: jest.fn().mockResolvedValue({ commit: 'commit123' }),
      merge: jest.fn().mockResolvedValue({
        result: 'success',
        summary: { changes: 5, insertions: 10, deletions: 3 },
      }),
      log: jest.fn().mockResolvedValue({
        all: [
          {
            hash: 'abc123',
            date: '2024-01-01',
            message: 'Initial commit',
            author_name: 'Test User',
            author_email: 'test@example.com',
          },
        ],
      }),
      fetch: jest.fn().mockResolvedValue(undefined),
      addRemote: jest.fn().mockResolvedValue(undefined),
      getRemotes: jest.fn().mockResolvedValue([
        { name: 'origin', refs: { fetch: 'git@github.com:test/repo.git', push: 'git@github.com:test/repo.git' } },
      ]),
      reset: jest.fn().mockResolvedValue(undefined),
      clean: jest.fn().mockResolvedValue(undefined),
      diff: jest.fn().mockResolvedValue('diff content'),
      addConfig: jest.fn().mockResolvedValue(undefined),
    };

    (simpleGit as jest.MockedFunction<typeof simpleGit>).mockReturnValue(mockGit);
  });

  describe('Constructor', () => {
    it('should create GitOperations instance', () => {
      const git = new GitOperations({ repoPath: '/test/repo' });
      expect(git).toBeInstanceOf(GitOperations);
    });
  });

  describe('Clone', () => {
    it('should clone a repository', async () => {
      const git = await GitOperations.clone({
        url: 'https://github.com/test/repo.git',
        targetPath: '/test/target',
      });

      expect(git).toBeInstanceOf(GitOperations);
      expect(mockGit.clone).toHaveBeenCalledWith(
        'https://github.com/test/repo.git',
        '/test/target',
        []
      );
    });

    it('should clone with specific branch', async () => {
      await GitOperations.clone({
        url: 'https://github.com/test/repo.git',
        targetPath: '/test/target',
        branch: 'develop',
      });

      expect(mockGit.clone).toHaveBeenCalledWith(
        'https://github.com/test/repo.git',
        '/test/target',
        ['--branch', 'develop']
      );
    });

    it('should clone with depth', async () => {
      await GitOperations.clone({
        url: 'https://github.com/test/repo.git',
        targetPath: '/test/target',
        depth: 1,
      });

      expect(mockGit.clone).toHaveBeenCalledWith(
        'https://github.com/test/repo.git',
        '/test/target',
        ['--depth', '1']
      );
    });

    it('should handle clone errors', async () => {
      mockGit.clone.mockRejectedValue(new Error('Clone failed'));

      await expect(
        GitOperations.clone({
          url: 'https://github.com/test/repo.git',
          targetPath: '/test/target',
        })
      ).rejects.toThrow(GitError);
    });
  });

  describe('Init', () => {
    it('should initialize a repository', async () => {
      const git = await GitOperations.init('/test/repo');

      expect(git).toBeInstanceOf(GitOperations);
      expect(mockGit.init).toHaveBeenCalledWith(false);
    });

    it('should initialize bare repository', async () => {
      await GitOperations.init('/test/repo', true);

      expect(mockGit.init).toHaveBeenCalledWith(true);
    });
  });

  describe('Pull', () => {
    it('should pull changes', async () => {
      const git = new GitOperations({ repoPath: '/test/repo' });
      await git.pull();

      expect(mockGit.pull).toHaveBeenCalledWith('origin');
    });

    it('should pull from specific remote and branch', async () => {
      const git = new GitOperations({ repoPath: '/test/repo' });
      await git.pull('upstream', 'develop');

      expect(mockGit.pull).toHaveBeenCalledWith('upstream', 'develop');
    });

    it('should handle pull errors', async () => {
      mockGit.pull.mockRejectedValue(new Error('Pull failed'));
      const git = new GitOperations({ repoPath: '/test/repo' });

      await expect(git.pull()).rejects.toThrow(GitError);
    });
  });

  describe('Push', () => {
    it('should push changes', async () => {
      const git = new GitOperations({ repoPath: '/test/repo' });
      await git.push();

      expect(mockGit.push).toHaveBeenCalledWith('origin');
    });

    it('should push to specific remote and branch', async () => {
      const git = new GitOperations({ repoPath: '/test/repo' });
      await git.push('upstream', 'develop');

      expect(mockGit.push).toHaveBeenCalledWith('upstream', 'develop');
    });

    it('should force push', async () => {
      const git = new GitOperations({ repoPath: '/test/repo' });
      await git.push('origin', 'main', true);

      expect(mockGit.push).toHaveBeenCalledWith(['origin', 'main', '--force']);
    });

    it('should handle push errors', async () => {
      mockGit.push.mockRejectedValue(new Error('Push failed'));
      const git = new GitOperations({ repoPath: '/test/repo' });

      await expect(git.push()).rejects.toThrow(GitError);
    });
  });

  describe('Branch Operations', () => {
    it('should create a branch', async () => {
      const git = new GitOperations({ repoPath: '/test/repo' });
      await git.createBranch('feature-branch');

      expect(mockGit.branch).toHaveBeenCalledWith(['feature-branch']);
    });

    it('should create and checkout branch', async () => {
      const git = new GitOperations({ repoPath: '/test/repo' });
      await git.createBranch('feature-branch', true);

      expect(mockGit.checkoutLocalBranch).toHaveBeenCalledWith('feature-branch');
    });

    it('should checkout a branch', async () => {
      const git = new GitOperations({ repoPath: '/test/repo' });
      await git.checkout('develop');

      expect(mockGit.checkout).toHaveBeenCalledWith('develop');
    });

    it('should delete a branch', async () => {
      const git = new GitOperations({ repoPath: '/test/repo' });
      await git.deleteBranch('old-branch');

      expect(mockGit.branch).toHaveBeenCalledWith(['-d', 'old-branch']);
    });

    it('should force delete a branch', async () => {
      const git = new GitOperations({ repoPath: '/test/repo' });
      await git.deleteBranch('old-branch', true);

      expect(mockGit.branch).toHaveBeenCalledWith(['-D', 'old-branch']);
    });

    it('should get current branch', async () => {
      const git = new GitOperations({ repoPath: '/test/repo' });
      const branch = await git.getCurrentBranch();

      expect(branch).toBe('main');
      expect(mockGit.status).toHaveBeenCalled();
    });

    it('should list branches', async () => {
      const git = new GitOperations({ repoPath: '/test/repo' });
      const branches = await git.listBranches();

      expect(branches.current).toBe('main');
      expect(branches.all).toEqual(['main', 'develop']);
      expect(mockGit.branch).toHaveBeenCalled();
    });
  });

  describe('Commit Operations', () => {
    it('should add files', async () => {
      const git = new GitOperations({ repoPath: '/test/repo' });
      await git.add('file.txt');

      expect(mockGit.add).toHaveBeenCalledWith('file.txt');
    });

    it('should add multiple files', async () => {
      const git = new GitOperations({ repoPath: '/test/repo' });
      await git.add(['file1.txt', 'file2.txt']);

      expect(mockGit.add).toHaveBeenCalledWith(['file1.txt', 'file2.txt']);
    });

    it('should create a commit', async () => {
      const git = new GitOperations({ repoPath: '/test/repo' });
      const commitHash = await git.commit({ message: 'Test commit' });

      expect(commitHash).toBe('commit123');
      expect(mockGit.commit).toHaveBeenCalledWith('Test commit');
    });

    it('should commit with files', async () => {
      const git = new GitOperations({ repoPath: '/test/repo' });
      await git.commit({
        message: 'Test commit',
        files: ['file1.txt', 'file2.txt'],
      });

      expect(mockGit.add).toHaveBeenCalledWith(['file1.txt', 'file2.txt']);
      expect(mockGit.commit).toHaveBeenCalledWith('Test commit');
    });

    it('should commit with author', async () => {
      const git = new GitOperations({ repoPath: '/test/repo' });
      await git.commit({
        message: 'Test commit',
        author: { name: 'Test User', email: 'test@example.com' },
      });

      expect(mockGit.addConfig).toHaveBeenCalledWith('user.name', 'Test User');
      expect(mockGit.addConfig).toHaveBeenCalledWith('user.email', 'test@example.com');
      expect(mockGit.commit).toHaveBeenCalledWith('Test commit');
    });
  });

  describe('Merge Operations', () => {
    it('should merge a branch', async () => {
      const git = new GitOperations({ repoPath: '/test/repo' });
      const result = await git.merge('feature-branch');

      expect(result.merged).toBe(true);
      expect(result.conflicts).toEqual([]);
      expect(result.summary.changes).toBe(5);
      expect(mockGit.merge).toHaveBeenCalledWith(['feature-branch']);
    });

    it('should merge with no fast-forward', async () => {
      const git = new GitOperations({ repoPath: '/test/repo' });
      await git.merge('feature-branch', { noFastForward: true });

      expect(mockGit.merge).toHaveBeenCalledWith(['feature-branch', '--no-ff']);
    });

    it('should detect merge conflicts', async () => {
      mockGit.status.mockResolvedValue({
        current: 'main',
        tracking: 'origin/main',
        ahead: 0,
        behind: 0,
        modified: [],
        created: [],
        deleted: [],
        renamed: [],
        conflicted: ['file.txt'],
        isClean: () => false,
      });

      const git = new GitOperations({ repoPath: '/test/repo' });

      await expect(git.merge('feature-branch')).rejects.toThrow(GitMergeConflictError);
    });

    it('should abort merge', async () => {
      const git = new GitOperations({ repoPath: '/test/repo' });
      await git.abortMerge();

      expect(mockGit.merge).toHaveBeenCalledWith(['--abort']);
    });
  });

  describe('Status', () => {
    it('should get repository status', async () => {
      const git = new GitOperations({ repoPath: '/test/repo' });
      const status = await git.status();

      expect(status.current).toBe('main');
      expect(status.tracking).toBe('origin/main');
      expect(status.ahead).toBe(0);
      expect(status.behind).toBe(0);
      expect(status.isClean).toBe(true);
    });

    it('should get status with modified files', async () => {
      mockGit.status.mockResolvedValue({
        current: 'main',
        tracking: 'origin/main',
        ahead: 1,
        behind: 0,
        modified: ['file1.txt', 'file2.txt'],
        created: ['file3.txt'],
        deleted: ['file4.txt'],
        renamed: [{ from: 'old.txt', to: 'new.txt' }],
        conflicted: [],
        isClean: () => false,
      });

      const git = new GitOperations({ repoPath: '/test/repo' });
      const status = await git.status();

      expect(status.modified).toEqual(['file1.txt', 'file2.txt']);
      expect(status.created).toEqual(['file3.txt']);
      expect(status.deleted).toEqual(['file4.txt']);
      expect(status.renamed).toEqual([{ from: 'old.txt', to: 'new.txt' }]);
      expect(status.isClean).toBe(false);
    });
  });

  describe('Log', () => {
    it('should get commit log', async () => {
      const git = new GitOperations({ repoPath: '/test/repo' });
      const log = await git.log();

      expect(log).toHaveLength(1);
      expect(log[0].hash).toBe('abc123');
      expect(log[0].message).toBe('Initial commit');
      expect(mockGit.log).toHaveBeenCalled();
    });

    it('should get log with max count', async () => {
      const git = new GitOperations({ repoPath: '/test/repo' });
      await git.log({ maxCount: 10 });

      expect(mockGit.log).toHaveBeenCalledWith({ maxCount: 10 });
    });

    it('should get log for specific file', async () => {
      const git = new GitOperations({ repoPath: '/test/repo' });
      await git.log({ file: 'file.txt' });

      expect(mockGit.log).toHaveBeenCalledWith({ file: 'file.txt' });
    });
  });

  describe('Remote Operations', () => {
    it('should fetch from remote', async () => {
      const git = new GitOperations({ repoPath: '/test/repo' });
      await git.fetch();

      expect(mockGit.fetch).toHaveBeenCalledWith('origin');
    });

    it('should fetch from specific remote', async () => {
      const git = new GitOperations({ repoPath: '/test/repo' });
      await git.fetch('upstream');

      expect(mockGit.fetch).toHaveBeenCalledWith('upstream');
    });

    it('should add remote', async () => {
      const git = new GitOperations({ repoPath: '/test/repo' });
      await git.addRemote('upstream', 'https://github.com/upstream/repo.git');

      expect(mockGit.addRemote).toHaveBeenCalledWith(
        'upstream',
        'https://github.com/upstream/repo.git'
      );
    });

    it('should list remotes', async () => {
      const git = new GitOperations({ repoPath: '/test/repo' });
      const remotes = await git.listRemotes();

      expect(remotes).toHaveLength(1);
      expect(remotes[0].name).toBe('origin');
      expect(mockGit.getRemotes).toHaveBeenCalledWith(true);
    });
  });

  describe('Reset', () => {
    it('should soft reset', async () => {
      const git = new GitOperations({ repoPath: '/test/repo' });
      await git.reset('soft');

      expect(mockGit.reset).toHaveBeenCalledWith(['--soft', 'HEAD']);
    });

    it('should hard reset', async () => {
      const git = new GitOperations({ repoPath: '/test/repo' });
      await git.reset('hard', 'abc123');

      expect(mockGit.reset).toHaveBeenCalledWith(['--hard', 'abc123']);
    });

    it('should mixed reset', async () => {
      const git = new GitOperations({ repoPath: '/test/repo' });
      await git.reset('mixed');

      expect(mockGit.reset).toHaveBeenCalledWith(['--mixed', 'HEAD']);
    });
  });

  describe('Clean', () => {
    it('should clean untracked files', async () => {
      const git = new GitOperations({ repoPath: '/test/repo' });
      await git.clean({ force: true });

      expect(mockGit.clean).toHaveBeenCalled();
    });

    it('should clean including directories', async () => {
      const git = new GitOperations({ repoPath: '/test/repo' });
      await git.clean({ force: true, directories: true });

      expect(mockGit.clean).toHaveBeenCalledWith(expect.anything(), ['-d']);
    });
  });

  describe('Diff', () => {
    it('should get diff', async () => {
      const git = new GitOperations({ repoPath: '/test/repo' });
      const diff = await git.diff();

      expect(diff).toBe('diff content');
      expect(mockGit.diff).toHaveBeenCalledWith([]);
    });

    it('should get cached diff', async () => {
      const git = new GitOperations({ repoPath: '/test/repo' });
      await git.diff({ cached: true });

      expect(mockGit.diff).toHaveBeenCalledWith(['--cached']);
    });

    it('should get diff for specific file', async () => {
      const git = new GitOperations({ repoPath: '/test/repo' });
      await git.diff({ file: 'file.txt' });

      expect(mockGit.diff).toHaveBeenCalledWith(['file.txt']);
    });
  });

  describe('Error Handling', () => {
    it('should handle authentication errors', async () => {
      mockGit.pull.mockRejectedValue(new Error('Authentication failed'));
      const git = new GitOperations({ repoPath: '/test/repo' });

      await expect(git.pull()).rejects.toThrow(GitAuthenticationError);
    });

    it('should handle permission denied errors', async () => {
      mockGit.push.mockRejectedValue(new Error('Permission denied'));
      const git = new GitOperations({ repoPath: '/test/repo' });

      await expect(git.push()).rejects.toThrow(GitAuthenticationError);
    });

    it('should handle merge conflict errors', async () => {
      mockGit.merge.mockRejectedValue(new Error('CONFLICT: Merge conflict in file.txt'));
      const git = new GitOperations({ repoPath: '/test/repo' });

      await expect(git.merge('feature-branch')).rejects.toThrow(GitMergeConflictError);
    });

    it('should handle general git errors', async () => {
      mockGit.checkout.mockRejectedValue(new Error('Branch not found'));
      const git = new GitOperations({ repoPath: '/test/repo' });

      await expect(git.checkout('nonexistent')).rejects.toThrow(GitError);
    });

    it('should handle unknown errors', async () => {
      mockGit.status.mockRejectedValue('String error');
      const git = new GitOperations({ repoPath: '/test/repo' });

      await expect(git.status()).rejects.toThrow(GitError);
    });
  });
});
