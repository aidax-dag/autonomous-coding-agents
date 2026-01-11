/**
 * Git Diff Tool
 *
 * Shows changes between commits, commit and working tree, etc.
 *
 * @module core/tools/git/git-diff
 */

import { BaseTool } from '../base-tool.js';
import {
  ToolSchema,
  ToolCategory,
  ToolResult,
  ToolExecutionOptions,
} from '../../interfaces/tool.interface.js';
import { IGitClient, GitFileDiff } from './git.interface.js';
import { GitClient } from './git-client.js';

/**
 * Input parameters for git diff
 */
export interface GitDiffInput {
  staged?: boolean;
  commit?: string;
  fromCommit?: string;
  toCommit?: string;
  paths?: string[];
  stat?: boolean;
  nameOnly?: boolean;
  cwd?: string;
}

/**
 * Output for git diff
 */
export interface GitDiffOutput {
  files: GitFileDiff[];
  totalAdditions: number;
  totalDeletions: number;
}

/**
 * Git Diff Tool
 *
 * Shows changes between commits, commit and working tree, etc.
 */
export class GitDiffTool extends BaseTool<GitDiffInput, GitDiffOutput> {
  readonly name = 'git-diff';
  readonly description = 'Show changes between commits, commit and working tree, etc.';
  readonly schema: ToolSchema = {
    name: this.name,
    description: this.description,
    category: ToolCategory.GIT,
    version: '1.0.0',
    parameters: [
      {
        name: 'staged',
        type: 'boolean',
        description: 'Show staged changes',
        required: false,
      },
      {
        name: 'commit',
        type: 'string',
        description: 'Compare with specific commit',
        required: false,
      },
      {
        name: 'fromCommit',
        type: 'string',
        description: 'Start commit for range comparison',
        required: false,
      },
      {
        name: 'toCommit',
        type: 'string',
        description: 'End commit for range comparison',
        required: false,
      },
      {
        name: 'paths',
        type: 'array',
        description: 'Limit diff to specific paths',
        required: false,
      },
      {
        name: 'stat',
        type: 'boolean',
        description: 'Show diffstat instead of patch',
        required: false,
      },
      {
        name: 'nameOnly',
        type: 'boolean',
        description: 'Show only names of changed files',
        required: false,
      },
      {
        name: 'cwd',
        type: 'string',
        description: 'Working directory',
        required: false,
      },
    ],
    returns: {
      type: 'object',
      description: 'Diff information',
    },
    tags: ['git', 'diff', 'changes', 'compare'],
  };

  private readonly gitClient: IGitClient;

  constructor(gitClient?: IGitClient) {
    super();
    this.gitClient = gitClient ?? new GitClient();
  }

  async execute(
    params: GitDiffInput,
    _options?: ToolExecutionOptions
  ): Promise<ToolResult<GitDiffOutput>> {
    const startTime = Date.now();

    const result = await this.gitClient.diff({
      cwd: params.cwd,
      staged: params.staged,
      commit: params.commit,
      commits:
        params.fromCommit && params.toCommit
          ? [params.fromCommit, params.toCommit]
          : undefined,
      paths: params.paths,
      stat: params.stat,
      nameOnly: params.nameOnly,
    });

    if (!result.success || !result.data) {
      return this.failure(
        'GIT_DIFF_FAILED',
        result.error ?? 'Failed to get diff',
        Date.now() - startTime
      );
    }

    const totalAdditions = result.data.reduce((sum, f) => sum + f.additions, 0);
    const totalDeletions = result.data.reduce((sum, f) => sum + f.deletions, 0);

    return this.success(
      {
        files: result.data,
        totalAdditions,
        totalDeletions,
      },
      Date.now() - startTime
    );
  }

  async isAvailable(): Promise<boolean> {
    return this.gitClient.isRepository();
  }
}
