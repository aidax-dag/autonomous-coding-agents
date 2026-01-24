import simpleGit, { SimpleGit, CleanOptions } from 'simple-git';
import { GitError, GitMergeConflictError, GitAuthenticationError } from '@/shared/errors/custom-errors';

/**
 * Git Operations Utility
 *
 * Provides Git operations using simple-git library.
 * Handles clone, pull, push, branch, commit, merge, and status operations.
 *
 * Feature: F1.8 - Git Operations
 */

/**
 * Git repository configuration
 */
export interface GitConfig {
  repoPath: string;
  defaultBranch?: string;
  remote?: string;
}

/**
 * Clone repository options
 */
export interface CloneOptions {
  url: string;
  targetPath: string;
  branch?: string;
  depth?: number;
}

/**
 * Commit options
 */
export interface CommitOptions {
  message: string;
  files?: string[];
  author?: {
    name: string;
    email: string;
  };
}

/**
 * Branch info
 */
export interface BranchInfo {
  current: string;
  all: string[];
  branches: {
    [key: string]: {
      current: boolean;
      name: string;
      commit: string;
      label: string;
    };
  };
}

/**
 * Git status info
 */
export interface GitStatus {
  current: string;
  tracking: string | null;
  ahead: number;
  behind: number;
  modified: string[];
  created: string[];
  deleted: string[];
  renamed: Array<{ from: string; to: string }>;
  conflicted: string[];
  isClean: boolean;
}

/**
 * Merge result
 */
export interface MergeResult {
  merged: boolean;
  conflicts: string[];
  summary: {
    changes: number;
    insertions: number;
    deletions: number;
  };
}

/**
 * Git Operations Client
 */
export class GitOperations {
  private git: SimpleGit;
  private config: GitConfig;

  constructor(config: GitConfig) {
    this.config = config;
    this.git = simpleGit(config.repoPath);
  }

  /**
   * Clone a repository
   */
  static async clone(options: CloneOptions): Promise<GitOperations> {
    try {
      const git = simpleGit();
      const cloneOptions: string[] = [];

      if (options.branch) {
        cloneOptions.push('--branch', options.branch);
      }

      if (options.depth) {
        cloneOptions.push('--depth', options.depth.toString());
      }

      await git.clone(options.url, options.targetPath, cloneOptions);

      return new GitOperations({
        repoPath: options.targetPath,
        defaultBranch: options.branch,
      });
    } catch (error) {
      throw this.handleError(error, 'Failed to clone repository');
    }
  }

  /**
   * Initialize a new repository
   */
  static async init(repoPath: string, bare: boolean = false): Promise<GitOperations> {
    try {
      const git = simpleGit(repoPath);
      await git.init(bare);

      return new GitOperations({ repoPath });
    } catch (error) {
      throw this.handleError(error, 'Failed to initialize repository');
    }
  }

  /**
   * Pull changes from remote
   */
  async pull(remote?: string, branch?: string): Promise<void> {
    try {
      const remoteName = remote || this.config.remote || 'origin';
      const branchName = branch || this.config.defaultBranch;

      if (branchName) {
        await this.git.pull(remoteName, branchName);
      } else {
        await this.git.pull(remoteName);
      }
    } catch (error) {
      throw GitOperations.handleError(error, 'Failed to pull changes');
    }
  }

  /**
   * Push changes to remote
   */
  async push(remote?: string, branch?: string, force: boolean = false): Promise<void> {
    try {
      const remoteName = remote || this.config.remote || 'origin';
      const branchName = branch || this.config.defaultBranch;

      if (force) {
        if (branchName) {
          await this.git.push([remoteName, branchName, '--force']);
        } else {
          await this.git.push([remoteName, '--force']);
        }
      } else {
        if (branchName) {
          await this.git.push(remoteName, branchName);
        } else {
          await this.git.push(remoteName);
        }
      }
    } catch (error) {
      throw GitOperations.handleError(error, 'Failed to push changes');
    }
  }

  /**
   * Create a new branch
   */
  async createBranch(branchName: string, checkout: boolean = false): Promise<void> {
    try {
      if (checkout) {
        await this.git.checkoutLocalBranch(branchName);
      } else {
        await this.git.branch([branchName]);
      }
    } catch (error) {
      throw GitOperations.handleError(error, `Failed to create branch ${branchName}`);
    }
  }

  /**
   * Switch to a branch
   */
  async checkout(branchName: string): Promise<void> {
    try {
      await this.git.checkout(branchName);
    } catch (error) {
      throw GitOperations.handleError(error, `Failed to checkout branch ${branchName}`);
    }
  }

  /**
   * Delete a branch
   */
  async deleteBranch(branchName: string, force: boolean = false): Promise<void> {
    try {
      const deleteFlag = force ? '-D' : '-d';
      await this.git.branch([deleteFlag, branchName]);
    } catch (error) {
      throw GitOperations.handleError(error, `Failed to delete branch ${branchName}`);
    }
  }

  /**
   * Get current branch name
   */
  async getCurrentBranch(): Promise<string> {
    try {
      const status = await this.git.status();
      return status.current || '';
    } catch (error) {
      throw GitOperations.handleError(error, 'Failed to get current branch');
    }
  }

  /**
   * List branches
   */
  async listBranches(): Promise<BranchInfo> {
    try {
      const branchSummary = await this.git.branch();
      return {
        current: branchSummary.current,
        all: branchSummary.all,
        branches: branchSummary.branches,
      };
    } catch (error) {
      throw GitOperations.handleError(error, 'Failed to list branches');
    }
  }

  /**
   * Add files to staging
   */
  async add(files: string | string[]): Promise<void> {
    try {
      if (Array.isArray(files)) {
        await this.git.add(files);
      } else {
        await this.git.add(files);
      }
    } catch (error) {
      throw GitOperations.handleError(error, 'Failed to add files');
    }
  }

  /**
   * Create a commit
   */
  async commit(options: CommitOptions): Promise<string> {
    try {
      // Add files if specified
      if (options.files) {
        await this.add(options.files);
      }

      // Set author if specified
      if (options.author) {
        await this.git.addConfig('user.name', options.author.name);
        await this.git.addConfig('user.email', options.author.email);
      }

      const result = await this.git.commit(options.message);
      return result.commit || '';
    } catch (error) {
      throw GitOperations.handleError(error, 'Failed to create commit');
    }
  }

  /**
   * Merge a branch
   */
  async merge(branchName: string, options?: { noFastForward?: boolean }): Promise<MergeResult> {
    try {
      const mergeOptions: string[] = [];

      if (options?.noFastForward) {
        mergeOptions.push('--no-ff');
      }

      const result = await this.git.merge([branchName, ...mergeOptions]);

      // Check for conflicts
      const status = await this.git.status();
      const hasConflicts = status.conflicted.length > 0;

      if (hasConflicts) {
        throw new GitMergeConflictError(
          `Merge conflict detected when merging ${branchName}`,
          status.conflicted
        );
      }

      return {
        merged: result.result === 'success',
        conflicts: [],
        summary: {
          changes: result.summary?.changes || 0,
          insertions: result.summary?.insertions || 0,
          deletions: result.summary?.deletions || 0,
        },
      };
    } catch (error) {
      if (error instanceof GitMergeConflictError) {
        throw error;
      }
      throw GitOperations.handleError(error, `Failed to merge branch ${branchName}`);
    }
  }

  /**
   * Abort a merge
   */
  async abortMerge(): Promise<void> {
    try {
      await this.git.merge(['--abort']);
    } catch (error) {
      throw GitOperations.handleError(error, 'Failed to abort merge');
    }
  }

  /**
   * Get repository status
   */
  async status(): Promise<GitStatus> {
    try {
      const status = await this.git.status();

      return {
        current: status.current || '',
        tracking: status.tracking || null,
        ahead: status.ahead,
        behind: status.behind,
        modified: status.modified,
        created: status.created,
        deleted: status.deleted,
        renamed: status.renamed.map((r) => ({ from: r.from, to: r.to })),
        conflicted: status.conflicted,
        isClean: status.isClean(),
      };
    } catch (error) {
      throw GitOperations.handleError(error, 'Failed to get repository status');
    }
  }

  /**
   * Get commit log
   */
  async log(options?: { maxCount?: number; file?: string }): Promise<Array<{
    hash: string;
    date: string;
    message: string;
    author_name: string;
    author_email: string;
  }>> {
    try {
      const logOptions: { maxCount?: number; file?: string } = {};

      if (options?.maxCount) {
        logOptions.maxCount = options.maxCount;
      }

      if (options?.file) {
        logOptions.file = options.file;
      }

      const result = await this.git.log(logOptions);

      return result.all.map((commit) => ({
        hash: commit.hash,
        date: commit.date,
        message: commit.message,
        author_name: commit.author_name,
        author_email: commit.author_email,
      }));
    } catch (error) {
      throw GitOperations.handleError(error, 'Failed to get commit log');
    }
  }

  /**
   * Fetch from remote
   */
  async fetch(remote?: string): Promise<void> {
    try {
      const remoteName = remote || this.config.remote || 'origin';
      await this.git.fetch(remoteName);
    } catch (error) {
      throw GitOperations.handleError(error, 'Failed to fetch from remote');
    }
  }

  /**
   * Add remote
   */
  async addRemote(name: string, url: string): Promise<void> {
    try {
      await this.git.addRemote(name, url);
    } catch (error) {
      throw GitOperations.handleError(error, `Failed to add remote ${name}`);
    }
  }

  /**
   * List remotes
   */
  async listRemotes(): Promise<Array<{ name: string; refs: { fetch: string; push: string } }>> {
    try {
      const remotes = await this.git.getRemotes(true);
      return remotes.map((r) => ({
        name: r.name,
        refs: r.refs,
      }));
    } catch (error) {
      throw GitOperations.handleError(error, 'Failed to list remotes');
    }
  }

  /**
   * Reset to a commit
   */
  async reset(mode: 'soft' | 'mixed' | 'hard', commit: string = 'HEAD'): Promise<void> {
    try {
      const resetMode = `--${mode}`;
      await this.git.reset([resetMode, commit]);
    } catch (error) {
      throw GitOperations.handleError(error, 'Failed to reset');
    }
  }

  /**
   * Clean untracked files
   */
  async clean(options?: { force?: boolean; directories?: boolean }): Promise<void> {
    try {
      const cleanMode: CleanOptions = CleanOptions.FORCE;

      if (options?.directories) {
        await this.git.clean(cleanMode, ['-d']);
      } else {
        await this.git.clean(cleanMode);
      }
    } catch (error) {
      throw GitOperations.handleError(error, 'Failed to clean repository');
    }
  }

  /**
   * Show diff
   */
  async diff(options?: { cached?: boolean; file?: string }): Promise<string> {
    try {
      const diffOptions: string[] = [];

      if (options?.cached) {
        diffOptions.push('--cached');
      }

      if (options?.file) {
        diffOptions.push(options.file);
      }

      return await this.git.diff(diffOptions);
    } catch (error) {
      throw GitOperations.handleError(error, 'Failed to get diff');
    }
  }

  /**
   * Handle Git errors
   */
  private static handleError(error: unknown, message: string): Error {
    if (error instanceof GitError) {
      return error;
    }

    if (error instanceof Error) {
      const errorMessage = error.message.toLowerCase();

      // Check for authentication errors
      if (
        errorMessage.includes('authentication') ||
        errorMessage.includes('permission denied') ||
        errorMessage.includes('could not read from remote')
      ) {
        return new GitAuthenticationError(
          `${message}: ${error.message}`,
          {
            originalError: error.message,
          }
        );
      }

      // Check for merge conflicts
      if (errorMessage.includes('conflict') || errorMessage.includes('merge')) {
        return new GitMergeConflictError(message, [], {
          originalError: error.message,
        });
      }

      // General git error
      return new GitError(message, undefined, false, {
        originalError: error.message,
      });
    }

    return new GitError(`${message}: ${String(error)}`, undefined, false);
  }
}
