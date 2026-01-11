/**
 * Git Client Implementation
 *
 * Provides git command execution with parsing of results.
 *
 * @module core/tools/git/git-client
 */

import { spawn } from 'node:child_process';
import {
  IGitClient,
  GitClientOptions,
  GitOperationResult,
  GitStatus,
  GitFileStatus,
  GitFileChange,
  GitCommit,
  GitBranch,
  GitFileDiff,
  GitDiffHunk,
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
} from './git.interface.js';

/**
 * Default timeout for git operations (30 seconds)
 */
const DEFAULT_TIMEOUT = 30000;

/**
 * Git Client Implementation
 *
 * Executes git commands and parses results into structured data.
 */
export class GitClient implements IGitClient {
  private readonly defaultCwd: string;
  private readonly defaultEnv: Record<string, string>;

  constructor(options?: GitClientOptions) {
    this.defaultCwd = options?.cwd ?? process.cwd();
    this.defaultEnv = options?.env ?? {};
  }

  /**
   * Execute a git command
   */
  private async exec(
    args: string[],
    options?: GitClientOptions
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    const cwd = options?.cwd ?? this.defaultCwd;
    const timeout = options?.timeout ?? DEFAULT_TIMEOUT;
    const env = { ...process.env, ...this.defaultEnv, ...options?.env };

    return new Promise((resolve, reject) => {
      const proc = spawn('git', args, { cwd, env });
      let stdout = '';
      let stderr = '';

      const timer = setTimeout(() => {
        proc.kill('SIGTERM');
        reject(new Error(`Git command timed out after ${timeout}ms`));
      }, timeout);

      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('error', (error) => {
        clearTimeout(timer);
        reject(error);
      });

      proc.on('close', (exitCode) => {
        clearTimeout(timer);
        resolve({ stdout, stderr, exitCode: exitCode ?? 0 });
      });
    });
  }

  /**
   * Get repository status
   */
  async status(options?: GitClientOptions): Promise<GitOperationResult<GitStatus>> {
    try {
      const result = await this.exec(['status', '--porcelain=v2', '--branch'], options);

      if (result.exitCode !== 0) {
        return { success: false, error: result.stderr };
      }

      const status = this.parseStatus(result.stdout);
      return { success: true, data: status };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Parse git status output
   */
  private parseStatus(output: string): GitStatus {
    const lines = output.trim().split('\n').filter(Boolean);
    const status: GitStatus = {
      branch: '',
      ahead: 0,
      behind: 0,
      staged: [],
      unstaged: [],
      untracked: [],
      hasConflicts: false,
      isClean: true,
    };

    for (const line of lines) {
      if (line.startsWith('# branch.head')) {
        status.branch = line.split(' ')[2] || '';
      } else if (line.startsWith('# branch.upstream')) {
        status.upstream = line.split(' ')[2];
      } else if (line.startsWith('# branch.ab')) {
        const match = line.match(/\+(\d+) -(\d+)/);
        if (match) {
          status.ahead = parseInt(match[1], 10);
          status.behind = parseInt(match[2], 10);
        }
      } else if (line.startsWith('1 ') || line.startsWith('2 ')) {
        // Ordinary or renamed/copied entry
        const change = this.parseFileChange(line);
        if (change) {
          if (change.staged) {
            status.staged.push(change);
          } else {
            status.unstaged.push(change);
          }
          status.isClean = false;
        }
      } else if (line.startsWith('u ')) {
        // Unmerged entry
        status.hasConflicts = true;
        status.isClean = false;
      } else if (line.startsWith('? ')) {
        // Untracked file
        status.untracked.push(line.substring(2));
        status.isClean = false;
      }
    }

    return status;
  }

  /**
   * Parse a file change from status output
   */
  private parseFileChange(line: string): GitFileChange | null {
    const parts = line.split(' ');
    if (parts.length < 2) return null;

    const statusCode = parts[1];
    const staged = statusCode[0] !== '.';
    const unstaged = statusCode[1] !== '.';

    // Get the relevant status character
    const statusChar = staged ? statusCode[0] : statusCode[1];
    const status = this.mapFileStatus(statusChar);

    // Get path (last part after tabs)
    const pathPart = line.split('\t');
    const path = pathPart[pathPart.length - 1] || parts[parts.length - 1];

    // Handle renames (line type 2)
    let oldPath: string | undefined;
    if (line.startsWith('2 ') && pathPart.length >= 2) {
      oldPath = pathPart[pathPart.length - 2];
    }

    return {
      path,
      status,
      oldPath,
      staged: staged && !unstaged,
    };
  }

  /**
   * Map status character to enum
   */
  private mapFileStatus(char: string): GitFileStatus {
    const map: Record<string, GitFileStatus> = {
      A: GitFileStatus.ADDED,
      M: GitFileStatus.MODIFIED,
      D: GitFileStatus.DELETED,
      R: GitFileStatus.RENAMED,
      C: GitFileStatus.COPIED,
      '?': GitFileStatus.UNTRACKED,
      '!': GitFileStatus.IGNORED,
      U: GitFileStatus.UNMERGED,
    };
    return map[char] || GitFileStatus.MODIFIED;
  }

  /**
   * Stage files
   */
  async add(paths: string[], options?: GitClientOptions): Promise<GitOperationResult> {
    try {
      const args = ['add', ...paths];
      const result = await this.exec(args, options);

      if (result.exitCode !== 0) {
        return { success: false, error: result.stderr };
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Unstage files
   */
  async reset(paths: string[], options?: GitClientOptions): Promise<GitOperationResult> {
    try {
      const args = ['reset', 'HEAD', '--', ...paths];
      const result = await this.exec(args, options);

      if (result.exitCode !== 0) {
        return { success: false, error: result.stderr };
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Create a commit
   */
  async commit(
    message: string,
    options?: CommitOptions
  ): Promise<GitOperationResult<GitCommit>> {
    try {
      const args = ['commit', '-m', message];

      if (options?.all) args.push('-a');
      if (options?.amend) args.push('--amend');
      if (options?.allowEmpty) args.push('--allow-empty');
      if (options?.signoff) args.push('-s');
      if (options?.author) args.push('--author', options.author);

      const result = await this.exec(args, options);

      if (result.exitCode !== 0) {
        return { success: false, error: result.stderr };
      }

      // Get the created commit info
      const logResult = await this.log({ ...options, maxCount: 1 });
      if (logResult.success && logResult.data?.length) {
        return { success: true, data: logResult.data[0] };
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Get commit log
   */
  async log(options?: LogOptions): Promise<GitOperationResult<GitCommit[]>> {
    try {
      const format = '%H%n%h%n%an%n%ae%n%aI%n%s%n%b%n---COMMIT_END---';
      const args = ['log', `--format=${format}`];

      if (options?.maxCount) args.push(`-n`, `${options.maxCount}`);
      if (options?.since) args.push(`--since=${options.since.toISOString()}`);
      if (options?.until) args.push(`--until=${options.until.toISOString()}`);
      if (options?.author) args.push(`--author=${options.author}`);
      if (options?.grep) args.push(`--grep=${options.grep}`);
      if (options?.path) args.push('--', options.path);

      const result = await this.exec(args, options);

      if (result.exitCode !== 0) {
        return { success: false, error: result.stderr };
      }

      const commits = this.parseLog(result.stdout);
      return { success: true, data: commits };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Parse git log output
   */
  private parseLog(output: string): GitCommit[] {
    const commits: GitCommit[] = [];
    const entries = output.split('---COMMIT_END---').filter((e) => e.trim());

    for (const entry of entries) {
      const lines = entry.trim().split('\n');
      if (lines.length < 6) continue;

      const [hash, shortHash, author, email, dateStr, message, ...bodyLines] = lines;
      const body = bodyLines.join('\n').trim();

      commits.push({
        hash,
        shortHash,
        author,
        email,
        date: new Date(dateStr),
        message,
        body: body || undefined,
      });
    }

    return commits;
  }

  /**
   * List branches
   */
  async branch(options?: BranchOptions): Promise<GitOperationResult<GitBranch[]>> {
    try {
      const args = ['branch', '-v', '--format=%(HEAD)%(refname:short)%09%(upstream:short)%09%(objectname:short)'];

      if (options?.all) args.push('-a');
      if (options?.remote) args.push('-r');

      const result = await this.exec(args, options);

      if (result.exitCode !== 0) {
        return { success: false, error: result.stderr };
      }

      const branches = this.parseBranches(result.stdout);
      return { success: true, data: branches };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Parse branch output
   */
  private parseBranches(output: string): GitBranch[] {
    const branches: GitBranch[] = [];
    const lines = output.trim().split('\n').filter(Boolean);

    for (const line of lines) {
      const current = line.startsWith('*');
      const rest = line.substring(1);
      const [name, upstream, lastCommit] = rest.split('\t');

      branches.push({
        name: name.trim(),
        current,
        upstream: upstream || undefined,
        lastCommit: lastCommit || undefined,
      });
    }

    return branches;
  }

  /**
   * Create a new branch
   */
  async createBranch(
    name: string,
    options?: CreateBranchOptions
  ): Promise<GitOperationResult> {
    try {
      if (options?.checkout) {
        const args = ['checkout', '-b', name];
        if (options.startPoint) args.push(options.startPoint);
        if (options.track) args.push('--track');

        const result = await this.exec(args, options);
        return result.exitCode === 0
          ? { success: true }
          : { success: false, error: result.stderr };
      } else {
        const args = ['branch', name];
        if (options?.startPoint) args.push(options.startPoint);

        const result = await this.exec(args, options);
        return result.exitCode === 0
          ? { success: true }
          : { success: false, error: result.stderr };
      }
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Delete a branch
   */
  async deleteBranch(
    name: string,
    force = false,
    options?: GitClientOptions
  ): Promise<GitOperationResult> {
    try {
      const args = ['branch', force ? '-D' : '-d', name];
      const result = await this.exec(args, options);

      return result.exitCode === 0
        ? { success: true }
        : { success: false, error: result.stderr };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Checkout a branch or commit
   */
  async checkout(ref: string, options?: CheckoutOptions): Promise<GitOperationResult> {
    try {
      const args = ['checkout'];

      if (options?.create) args.push('-b');
      if (options?.force) args.push('-f');
      if (options?.track) args.push('--track');
      args.push(ref);

      const result = await this.exec(args, options);

      return result.exitCode === 0
        ? { success: true }
        : { success: false, error: result.stderr };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Push to remote
   */
  async push(options?: PushOptions): Promise<GitOperationResult<GitSyncResult>> {
    try {
      const args = ['push'];

      if (options?.force) args.push('-f');
      if (options?.setUpstream) args.push('-u');
      if (options?.tags) args.push('--tags');
      if (options?.dryRun) args.push('--dry-run');
      if (options?.remote) args.push(options.remote);
      if (options?.branch) args.push(options.branch);

      const result = await this.exec(args, options);

      if (result.exitCode !== 0) {
        return { success: false, error: result.stderr };
      }

      return {
        success: true,
        data: {
          success: true,
          updatedRefs: [],
          message: result.stderr || result.stdout,
        },
      };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Pull from remote
   */
  async pull(options?: PullOptions): Promise<GitOperationResult<GitSyncResult>> {
    try {
      const args = ['pull'];

      if (options?.rebase) args.push('--rebase');
      if (options?.noCommit) args.push('--no-commit');
      if (options?.ffOnly) args.push('--ff-only');
      if (options?.remote) args.push(options.remote);
      if (options?.branch) args.push(options.branch);

      const result = await this.exec(args, options);

      if (result.exitCode !== 0) {
        return { success: false, error: result.stderr };
      }

      return {
        success: true,
        data: {
          success: true,
          updatedRefs: [],
          message: result.stdout,
        },
      };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Fetch from remote
   */
  async fetch(options?: FetchOptions): Promise<GitOperationResult> {
    try {
      const args = ['fetch'];

      if (options?.all) args.push('--all');
      if (options?.prune) args.push('--prune');
      if (options?.tags) args.push('--tags');
      if (options?.remote) args.push(options.remote);

      const result = await this.exec(args, options);

      return result.exitCode === 0
        ? { success: true }
        : { success: false, error: result.stderr };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Get diff
   */
  async diff(options?: DiffOptions): Promise<GitOperationResult<GitFileDiff[]>> {
    try {
      const args = ['diff'];

      if (options?.staged) args.push('--cached');
      if (options?.stat) args.push('--stat');
      if (options?.nameOnly) args.push('--name-only');
      if (options?.commit) args.push(options.commit);
      if (options?.commits) args.push(`${options.commits[0]}..${options.commits[1]}`);
      if (options?.paths?.length) {
        args.push('--');
        args.push(...options.paths);
      }

      const result = await this.exec(args, options);

      if (result.exitCode !== 0) {
        return { success: false, error: result.stderr };
      }

      const diffs = this.parseDiff(result.stdout);
      return { success: true, data: diffs };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Parse diff output
   */
  private parseDiff(output: string): GitFileDiff[] {
    const diffs: GitFileDiff[] = [];
    const fileDiffs = output.split(/^diff --git /m).filter(Boolean);

    for (const fileDiff of fileDiffs) {
      const lines = fileDiff.split('\n');
      const headerMatch = lines[0].match(/a\/(.+) b\/(.+)/);
      if (!headerMatch) continue;

      const [, oldPath, newPath] = headerMatch;
      const hunks: GitDiffHunk[] = [];
      let additions = 0;
      let deletions = 0;
      let binary = false;

      // Check for binary file
      if (fileDiff.includes('Binary files')) {
        binary = true;
      }

      // Parse hunks
      const hunkMatches = fileDiff.matchAll(/@@ -(\d+),?(\d*) \+(\d+),?(\d*) @@(.*)/g);
      for (const match of hunkMatches) {
        const hunkStart = fileDiff.indexOf(match[0]);
        const nextHunkStart = fileDiff.indexOf('\n@@', hunkStart + 1);
        const hunkEnd = nextHunkStart === -1 ? fileDiff.length : nextHunkStart;
        const hunkContent = fileDiff.substring(hunkStart, hunkEnd);

        // Count additions and deletions
        for (const line of hunkContent.split('\n')) {
          if (line.startsWith('+') && !line.startsWith('+++')) additions++;
          if (line.startsWith('-') && !line.startsWith('---')) deletions++;
        }

        hunks.push({
          oldStart: parseInt(match[1], 10),
          oldLines: parseInt(match[2] || '1', 10),
          newStart: parseInt(match[3], 10),
          newLines: parseInt(match[4] || '1', 10),
          content: hunkContent,
        });
      }

      // Determine status
      let status = GitFileStatus.MODIFIED;
      if (fileDiff.includes('new file mode')) {
        status = GitFileStatus.ADDED;
      } else if (fileDiff.includes('deleted file mode')) {
        status = GitFileStatus.DELETED;
      } else if (oldPath !== newPath) {
        status = GitFileStatus.RENAMED;
      }

      diffs.push({
        path: newPath,
        oldPath: oldPath !== newPath ? oldPath : undefined,
        status,
        hunks,
        additions,
        deletions,
        binary,
      });
    }

    return diffs;
  }

  /**
   * Merge a branch
   */
  async merge(
    branch: string,
    options?: MergeOptions
  ): Promise<GitOperationResult<GitMergeResult>> {
    try {
      const args = ['merge', branch];

      if (options?.noCommit) args.push('--no-commit');
      if (options?.noFf) args.push('--no-ff');
      if (options?.squash) args.push('--squash');
      if (options?.message) args.push('-m', options.message);
      if (options?.strategy) args.push('-s', options.strategy);

      const result = await this.exec(args, options);

      // Check for conflicts
      const conflicts: string[] = [];
      if (result.exitCode !== 0) {
        const conflictMatch = result.stdout.match(/CONFLICT.*: (.+)/g);
        if (conflictMatch) {
          conflicts.push(...conflictMatch);
        }
      }

      return {
        success: result.exitCode === 0,
        data: {
          success: result.exitCode === 0,
          conflicts,
          mergedFiles: [],
          message: result.stdout,
        },
        error: result.exitCode !== 0 ? result.stderr : undefined,
      };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * List stashes
   */
  async stash(options?: StashOptions): Promise<GitOperationResult<GitStashEntry[]>> {
    try {
      const args = ['stash', 'list', '--format=%gd%n%gs%n%aI%n---STASH_END---'];
      const result = await this.exec(args, options);

      if (result.exitCode !== 0) {
        return { success: false, error: result.stderr };
      }

      const stashes = this.parseStashList(result.stdout);
      return { success: true, data: stashes };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Parse stash list output
   */
  private parseStashList(output: string): GitStashEntry[] {
    const stashes: GitStashEntry[] = [];
    const entries = output.split('---STASH_END---').filter((e) => e.trim());

    for (const entry of entries) {
      const lines = entry.trim().split('\n');
      if (lines.length < 3) continue;

      const indexMatch = lines[0].match(/stash@\{(\d+)\}/);
      const index = indexMatch ? parseInt(indexMatch[1], 10) : 0;

      // Parse message to extract branch
      const messageMatch = lines[1].match(/WIP on (.+?):|On (.+?):/);
      const branch = messageMatch ? messageMatch[1] || messageMatch[2] : '';

      stashes.push({
        index,
        message: lines[1],
        branch,
        date: new Date(lines[2]),
      });
    }

    return stashes;
  }

  /**
   * Create a stash
   */
  async stashPush(message?: string, options?: GitClientOptions): Promise<GitOperationResult> {
    try {
      const args = ['stash', 'push'];
      if (message) args.push('-m', message);

      const result = await this.exec(args, options);

      return result.exitCode === 0
        ? { success: true }
        : { success: false, error: result.stderr };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Pop a stash
   */
  async stashPop(index = 0, options?: GitClientOptions): Promise<GitOperationResult> {
    try {
      const args = ['stash', 'pop', `stash@{${index}}`];
      const result = await this.exec(args, options);

      return result.exitCode === 0
        ? { success: true }
        : { success: false, error: result.stderr };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Drop a stash
   */
  async stashDrop(index = 0, options?: GitClientOptions): Promise<GitOperationResult> {
    try {
      const args = ['stash', 'drop', `stash@{${index}}`];
      const result = await this.exec(args, options);

      return result.exitCode === 0
        ? { success: true }
        : { success: false, error: result.stderr };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * List tags
   */
  async tag(options?: TagOptions): Promise<GitOperationResult<GitTag[]>> {
    try {
      const args = ['tag', '-l', '--format=%(refname:short)%09%(objectname:short)%09%(contents:subject)%09%(creatordate:iso)'];

      if (options?.pattern) args.push(options.pattern);
      if (options?.sort === 'version') args.push('--sort=-v:refname');
      if (options?.sort === 'date') args.push('--sort=-creatordate');

      const result = await this.exec(args, options);

      if (result.exitCode !== 0) {
        return { success: false, error: result.stderr };
      }

      const tags = this.parseTags(result.stdout);
      return { success: true, data: tags };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Parse tag output
   */
  private parseTags(output: string): GitTag[] {
    const tags: GitTag[] = [];
    const lines = output.trim().split('\n').filter(Boolean);

    for (const line of lines) {
      const [name, hash, message, dateStr] = line.split('\t');
      tags.push({
        name,
        hash,
        message: message || undefined,
        date: dateStr ? new Date(dateStr) : undefined,
      });
    }

    return tags;
  }

  /**
   * Create a tag
   */
  async createTag(name: string, options?: CreateTagOptions): Promise<GitOperationResult> {
    try {
      const args = ['tag'];

      if (options?.annotated || options?.message) {
        args.push('-a');
        if (options.message) args.push('-m', options.message);
      }
      if (options?.force) args.push('-f');
      args.push(name);
      if (options?.commit) args.push(options.commit);

      const result = await this.exec(args, options);

      return result.exitCode === 0
        ? { success: true }
        : { success: false, error: result.stderr };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Delete a tag
   */
  async deleteTag(name: string, options?: GitClientOptions): Promise<GitOperationResult> {
    try {
      const args = ['tag', '-d', name];
      const result = await this.exec(args, options);

      return result.exitCode === 0
        ? { success: true }
        : { success: false, error: result.stderr };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * List remotes
   */
  async remote(options?: GitClientOptions): Promise<GitOperationResult<GitRemote[]>> {
    try {
      const args = ['remote', '-v'];
      const result = await this.exec(args, options);

      if (result.exitCode !== 0) {
        return { success: false, error: result.stderr };
      }

      const remotes = this.parseRemotes(result.stdout);
      return { success: true, data: remotes };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Parse remote output
   */
  private parseRemotes(output: string): GitRemote[] {
    const remoteMap = new Map<string, GitRemote>();
    const lines = output.trim().split('\n').filter(Boolean);

    for (const line of lines) {
      const match = line.match(/^(\S+)\s+(\S+)\s+\((fetch|push)\)$/);
      if (!match) continue;

      const [, name, url, type] = match;
      const existing = remoteMap.get(name) || { name, fetchUrl: '', pushUrl: '' };

      if (type === 'fetch') {
        existing.fetchUrl = url;
      } else {
        existing.pushUrl = url;
      }

      remoteMap.set(name, existing);
    }

    return Array.from(remoteMap.values());
  }

  /**
   * Check if path is a git repository
   */
  async isRepository(path?: string): Promise<boolean> {
    try {
      const result = await this.exec(['rev-parse', '--is-inside-work-tree'], {
        cwd: path,
      });
      return result.exitCode === 0 && result.stdout.trim() === 'true';
    } catch {
      return false;
    }
  }

  /**
   * Get repository root
   */
  async getRoot(options?: GitClientOptions): Promise<GitOperationResult<string>> {
    try {
      const result = await this.exec(['rev-parse', '--show-toplevel'], options);

      if (result.exitCode !== 0) {
        return { success: false, error: result.stderr };
      }

      return { success: true, data: result.stdout.trim() };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Get git config value
   */
  async getConfig(
    key: string,
    options?: GitClientOptions
  ): Promise<GitOperationResult<string>> {
    try {
      const result = await this.exec(['config', '--get', key], options);

      if (result.exitCode !== 0) {
        return { success: false, error: result.stderr };
      }

      return { success: true, data: result.stdout.trim() };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }
}
