/**
 * Mock Git Client for Testing
 */

import {
  IGitClient,
  GitClientOptions,
  GitOperationResult,
  GitStatus,
  GitFileStatus,
  GitCommit,
  GitBranch,
  GitFileDiff,
  GitMergeResult,
  GitSyncResult,
  GitStashEntry,
  GitRemote,
  GitTag,
  CommitOptions,
  LogOptions,
  BranchOptions,
  CreateBranchOptions,
  CheckoutOptions,
  PushOptions,
  PullOptions,
  FetchOptions,
  DiffOptions,
  MergeOptions,
  StashOptions,
  TagOptions,
  CreateTagOptions,
} from '../../../../../src/core/tools/git/git.interface.js';

/**
 * Mock GitClient for testing
 */
export class MockGitClient implements IGitClient {
  // Track method calls
  public calls: { method: string; args: unknown[] }[] = [];

  // Configurable responses
  public statusResponse: GitOperationResult<GitStatus> = {
    success: true,
    data: {
      branch: 'main',
      ahead: 0,
      behind: 0,
      staged: [],
      unstaged: [],
      untracked: [],
      hasConflicts: false,
      isClean: true,
    },
  };

  public addResponse: GitOperationResult = { success: true };
  public resetResponse: GitOperationResult = { success: true };
  public commitResponse: GitOperationResult<GitCommit> = {
    success: true,
    data: {
      hash: 'abc123def456',
      shortHash: 'abc123d',
      author: 'Test User',
      email: 'test@example.com',
      date: new Date('2024-01-01'),
      message: 'Test commit',
    },
  };

  public logResponse: GitOperationResult<GitCommit[]> = {
    success: true,
    data: [],
  };

  public branchResponse: GitOperationResult<GitBranch[]> = {
    success: true,
    data: [
      { name: 'main', current: true },
      { name: 'develop', current: false },
    ],
  };

  public createBranchResponse: GitOperationResult = { success: true };
  public deleteBranchResponse: GitOperationResult = { success: true };
  public checkoutResponse: GitOperationResult = { success: true };

  public pushResponse: GitOperationResult<GitSyncResult> = {
    success: true,
    data: {
      success: true,
      updatedRefs: ['refs/heads/main'],
      message: 'Everything up-to-date',
    },
  };

  public pullResponse: GitOperationResult<GitSyncResult> = {
    success: true,
    data: {
      success: true,
      updatedRefs: [],
      message: 'Already up to date.',
    },
  };

  public fetchResponse: GitOperationResult = { success: true };

  public diffResponse: GitOperationResult<GitFileDiff[]> = {
    success: true,
    data: [],
  };

  public mergeResponse: GitOperationResult<GitMergeResult> = {
    success: true,
    data: {
      success: true,
      conflicts: [],
      mergedFiles: [],
      message: 'Merge made',
    },
  };

  public stashResponse: GitOperationResult<GitStashEntry[]> = {
    success: true,
    data: [],
  };

  public stashPushResponse: GitOperationResult = { success: true };
  public stashPopResponse: GitOperationResult = { success: true };
  public stashDropResponse: GitOperationResult = { success: true };

  public tagResponse: GitOperationResult<GitTag[]> = {
    success: true,
    data: [],
  };

  public createTagResponse: GitOperationResult = { success: true };
  public deleteTagResponse: GitOperationResult = { success: true };

  public remoteResponse: GitOperationResult<GitRemote[]> = {
    success: true,
    data: [
      {
        name: 'origin',
        fetchUrl: 'https://github.com/test/repo.git',
        pushUrl: 'https://github.com/test/repo.git',
      },
    ],
  };

  public isRepositoryResponse = true;
  public getRootResponse: GitOperationResult<string> = {
    success: true,
    data: '/path/to/repo',
  };

  public getConfigResponse: GitOperationResult<string> = {
    success: true,
    data: 'test-value',
  };

  private recordCall(method: string, ...args: unknown[]): void {
    this.calls.push({ method, args });
  }

  clearCalls(): void {
    this.calls = [];
  }

  async status(_options?: GitClientOptions): Promise<GitOperationResult<GitStatus>> {
    this.recordCall('status', _options);
    return this.statusResponse;
  }

  async add(paths: string[], _options?: GitClientOptions): Promise<GitOperationResult> {
    this.recordCall('add', paths, _options);
    return this.addResponse;
  }

  async reset(paths: string[], _options?: GitClientOptions): Promise<GitOperationResult> {
    this.recordCall('reset', paths, _options);
    return this.resetResponse;
  }

  async commit(
    message: string,
    _options?: CommitOptions
  ): Promise<GitOperationResult<GitCommit>> {
    this.recordCall('commit', message, _options);
    return this.commitResponse;
  }

  async log(_options?: LogOptions): Promise<GitOperationResult<GitCommit[]>> {
    this.recordCall('log', _options);
    return this.logResponse;
  }

  async branch(_options?: BranchOptions): Promise<GitOperationResult<GitBranch[]>> {
    this.recordCall('branch', _options);
    return this.branchResponse;
  }

  async createBranch(
    name: string,
    _options?: CreateBranchOptions
  ): Promise<GitOperationResult> {
    this.recordCall('createBranch', name, _options);
    return this.createBranchResponse;
  }

  async deleteBranch(
    name: string,
    force?: boolean,
    _options?: GitClientOptions
  ): Promise<GitOperationResult> {
    this.recordCall('deleteBranch', name, force, _options);
    return this.deleteBranchResponse;
  }

  async checkout(ref: string, _options?: CheckoutOptions): Promise<GitOperationResult> {
    this.recordCall('checkout', ref, _options);
    return this.checkoutResponse;
  }

  async push(_options?: PushOptions): Promise<GitOperationResult<GitSyncResult>> {
    this.recordCall('push', _options);
    return this.pushResponse;
  }

  async pull(_options?: PullOptions): Promise<GitOperationResult<GitSyncResult>> {
    this.recordCall('pull', _options);
    return this.pullResponse;
  }

  async fetch(_options?: FetchOptions): Promise<GitOperationResult> {
    this.recordCall('fetch', _options);
    return this.fetchResponse;
  }

  async diff(_options?: DiffOptions): Promise<GitOperationResult<GitFileDiff[]>> {
    this.recordCall('diff', _options);
    return this.diffResponse;
  }

  async merge(
    branch: string,
    _options?: MergeOptions
  ): Promise<GitOperationResult<GitMergeResult>> {
    this.recordCall('merge', branch, _options);
    return this.mergeResponse;
  }

  async stash(_options?: StashOptions): Promise<GitOperationResult<GitStashEntry[]>> {
    this.recordCall('stash', _options);
    return this.stashResponse;
  }

  async stashPush(message?: string, _options?: GitClientOptions): Promise<GitOperationResult> {
    this.recordCall('stashPush', message, _options);
    return this.stashPushResponse;
  }

  async stashPop(index?: number, _options?: GitClientOptions): Promise<GitOperationResult> {
    this.recordCall('stashPop', index, _options);
    return this.stashPopResponse;
  }

  async stashDrop(index?: number, _options?: GitClientOptions): Promise<GitOperationResult> {
    this.recordCall('stashDrop', index, _options);
    return this.stashDropResponse;
  }

  async tag(_options?: TagOptions): Promise<GitOperationResult<GitTag[]>> {
    this.recordCall('tag', _options);
    return this.tagResponse;
  }

  async createTag(name: string, _options?: CreateTagOptions): Promise<GitOperationResult> {
    this.recordCall('createTag', name, _options);
    return this.createTagResponse;
  }

  async deleteTag(name: string, _options?: GitClientOptions): Promise<GitOperationResult> {
    this.recordCall('deleteTag', name, _options);
    return this.deleteTagResponse;
  }

  async remote(_options?: GitClientOptions): Promise<GitOperationResult<GitRemote[]>> {
    this.recordCall('remote', _options);
    return this.remoteResponse;
  }

  async isRepository(_path?: string): Promise<boolean> {
    this.recordCall('isRepository', _path);
    return this.isRepositoryResponse;
  }

  async getRoot(_options?: GitClientOptions): Promise<GitOperationResult<string>> {
    this.recordCall('getRoot', _options);
    return this.getRootResponse;
  }

  async getConfig(
    key: string,
    _options?: GitClientOptions
  ): Promise<GitOperationResult<string>> {
    this.recordCall('getConfig', key, _options);
    return this.getConfigResponse;
  }
}

/**
 * Create mock status with changes
 */
export function createMockStatus(overrides?: Partial<GitStatus>): GitStatus {
  return {
    branch: 'main',
    ahead: 0,
    behind: 0,
    staged: [],
    unstaged: [],
    untracked: [],
    hasConflicts: false,
    isClean: true,
    ...overrides,
  };
}

/**
 * Create mock commit
 */
export function createMockCommit(overrides?: Partial<GitCommit>): GitCommit {
  return {
    hash: 'abc123def456',
    shortHash: 'abc123d',
    author: 'Test User',
    email: 'test@example.com',
    date: new Date('2024-01-01'),
    message: 'Test commit',
    ...overrides,
  };
}

/**
 * Create mock file change
 */
export function createMockFileChange(path: string, staged = false) {
  return {
    path,
    status: GitFileStatus.MODIFIED,
    staged,
  };
}

/**
 * Create mock diff
 */
export function createMockDiff(path: string, additions = 10, deletions = 5): GitFileDiff {
  return {
    path,
    status: GitFileStatus.MODIFIED,
    hunks: [],
    additions,
    deletions,
    binary: false,
  };
}
