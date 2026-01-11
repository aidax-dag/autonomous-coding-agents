/**
 * Git Tool Interfaces
 *
 * Defines types and interfaces for Git operations.
 *
 * @module core/tools/git/git.interface
 */

/**
 * Git file status
 */
export enum GitFileStatus {
  ADDED = 'A',
  MODIFIED = 'M',
  DELETED = 'D',
  RENAMED = 'R',
  COPIED = 'C',
  UNTRACKED = '?',
  IGNORED = '!',
  UNMERGED = 'U',
}

/**
 * Git file change
 */
export interface GitFileChange {
  path: string;
  status: GitFileStatus;
  oldPath?: string; // For renames
  staged: boolean;
}

/**
 * Git repository status
 */
export interface GitStatus {
  branch: string;
  upstream?: string;
  ahead: number;
  behind: number;
  staged: GitFileChange[];
  unstaged: GitFileChange[];
  untracked: string[];
  hasConflicts: boolean;
  isClean: boolean;
}

/**
 * Git commit info
 */
export interface GitCommit {
  hash: string;
  shortHash: string;
  author: string;
  email: string;
  date: Date;
  message: string;
  body?: string;
}

/**
 * Git branch info
 */
export interface GitBranch {
  name: string;
  current: boolean;
  remote?: string;
  upstream?: string;
  lastCommit?: string;
}

/**
 * Git diff hunk
 */
export interface GitDiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  content: string;
}

/**
 * Git diff for a file
 */
export interface GitFileDiff {
  path: string;
  oldPath?: string;
  status: GitFileStatus;
  hunks: GitDiffHunk[];
  additions: number;
  deletions: number;
  binary: boolean;
}

/**
 * Git stash entry
 */
export interface GitStashEntry {
  index: number;
  message: string;
  branch: string;
  date: Date;
}

/**
 * Git remote info
 */
export interface GitRemote {
  name: string;
  fetchUrl: string;
  pushUrl: string;
}

/**
 * Git tag info
 */
export interface GitTag {
  name: string;
  hash: string;
  message?: string;
  date?: Date;
  tagger?: string;
}

/**
 * Git merge result
 */
export interface GitMergeResult {
  success: boolean;
  conflicts: string[];
  mergedFiles: string[];
  message?: string;
}

/**
 * Git pull/push result
 */
export interface GitSyncResult {
  success: boolean;
  updatedRefs: string[];
  message?: string;
}

/**
 * Git client options
 */
export interface GitClientOptions {
  cwd?: string;
  env?: Record<string, string>;
  timeout?: number;
}

/**
 * Git operation result
 */
export interface GitOperationResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
  stderr?: string;
}

/**
 * Git client interface for executing git commands
 */
export interface IGitClient {
  // Status
  status(options?: GitClientOptions): Promise<GitOperationResult<GitStatus>>;

  // Staging
  add(paths: string[], options?: GitClientOptions): Promise<GitOperationResult>;
  reset(paths: string[], options?: GitClientOptions): Promise<GitOperationResult>;

  // Commits
  commit(message: string, options?: CommitOptions): Promise<GitOperationResult<GitCommit>>;
  log(options?: LogOptions): Promise<GitOperationResult<GitCommit[]>>;

  // Branches
  branch(options?: BranchOptions): Promise<GitOperationResult<GitBranch[]>>;
  createBranch(name: string, options?: CreateBranchOptions): Promise<GitOperationResult>;
  deleteBranch(name: string, force?: boolean, options?: GitClientOptions): Promise<GitOperationResult>;
  checkout(ref: string, options?: CheckoutOptions): Promise<GitOperationResult>;

  // Remote operations
  push(options?: PushOptions): Promise<GitOperationResult<GitSyncResult>>;
  pull(options?: PullOptions): Promise<GitOperationResult<GitSyncResult>>;
  fetch(options?: FetchOptions): Promise<GitOperationResult>;

  // Diff
  diff(options?: DiffOptions): Promise<GitOperationResult<GitFileDiff[]>>;

  // Merge
  merge(branch: string, options?: MergeOptions): Promise<GitOperationResult<GitMergeResult>>;

  // Stash
  stash(options?: StashOptions): Promise<GitOperationResult<GitStashEntry[]>>;
  stashPush(message?: string, options?: GitClientOptions): Promise<GitOperationResult>;
  stashPop(index?: number, options?: GitClientOptions): Promise<GitOperationResult>;
  stashDrop(index?: number, options?: GitClientOptions): Promise<GitOperationResult>;

  // Tags
  tag(options?: TagOptions): Promise<GitOperationResult<GitTag[]>>;
  createTag(name: string, options?: CreateTagOptions): Promise<GitOperationResult>;
  deleteTag(name: string, options?: GitClientOptions): Promise<GitOperationResult>;

  // Remote management
  remote(options?: GitClientOptions): Promise<GitOperationResult<GitRemote[]>>;

  // Utilities
  isRepository(path?: string): Promise<boolean>;
  getRoot(options?: GitClientOptions): Promise<GitOperationResult<string>>;
  getConfig(key: string, options?: GitClientOptions): Promise<GitOperationResult<string>>;
}

/**
 * Commit options
 */
export interface CommitOptions extends GitClientOptions {
  all?: boolean;
  amend?: boolean;
  allowEmpty?: boolean;
  signoff?: boolean;
  author?: string;
}

/**
 * Log options
 */
export interface LogOptions extends GitClientOptions {
  maxCount?: number;
  since?: Date;
  until?: Date;
  author?: string;
  grep?: string;
  path?: string;
}

/**
 * Branch options
 */
export interface BranchOptions extends GitClientOptions {
  all?: boolean;
  remote?: boolean;
}

/**
 * Create branch options
 */
export interface CreateBranchOptions extends GitClientOptions {
  startPoint?: string;
  checkout?: boolean;
  track?: boolean;
}

/**
 * Checkout options
 */
export interface CheckoutOptions extends GitClientOptions {
  create?: boolean;
  force?: boolean;
  track?: boolean;
}

/**
 * Push options
 */
export interface PushOptions extends GitClientOptions {
  remote?: string;
  branch?: string;
  force?: boolean;
  setUpstream?: boolean;
  tags?: boolean;
  dryRun?: boolean;
}

/**
 * Pull options
 */
export interface PullOptions extends GitClientOptions {
  remote?: string;
  branch?: string;
  rebase?: boolean;
  noCommit?: boolean;
  ffOnly?: boolean;
}

/**
 * Fetch options
 */
export interface FetchOptions extends GitClientOptions {
  remote?: string;
  all?: boolean;
  prune?: boolean;
  tags?: boolean;
}

/**
 * Diff options
 */
export interface DiffOptions extends GitClientOptions {
  staged?: boolean;
  commit?: string;
  commits?: [string, string];
  paths?: string[];
  stat?: boolean;
  nameOnly?: boolean;
}

/**
 * Merge options
 */
export interface MergeOptions extends GitClientOptions {
  noCommit?: boolean;
  noFf?: boolean;
  squash?: boolean;
  message?: string;
  strategy?: string;
}

/**
 * Stash options
 */
export interface StashOptions extends GitClientOptions {
  includeUntracked?: boolean;
}

/**
 * Tag options
 */
export interface TagOptions extends GitClientOptions {
  pattern?: string;
  sort?: 'version' | 'date';
}

/**
 * Create tag options
 */
export interface CreateTagOptions extends GitClientOptions {
  message?: string;
  annotated?: boolean;
  commit?: string;
  force?: boolean;
}
