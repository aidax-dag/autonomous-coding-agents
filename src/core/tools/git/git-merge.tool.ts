/**
 * Git Merge Tool
 *
 * Merges branches.
 *
 * @module core/tools/git/git-merge
 */

import { BaseTool } from '../base-tool.js';
import {
  ToolSchema,
  ToolCategory,
  ToolResult,
  ToolExecutionOptions,
} from '../../interfaces/tool.interface.js';
import { IGitClient, GitMergeResult } from './git.interface.js';
import { GitClient } from './git-client.js';

/**
 * Input parameters for git merge
 */
export interface GitMergeInput {
  branch: string;
  noCommit?: boolean;
  noFf?: boolean;
  squash?: boolean;
  message?: string;
  strategy?: string;
  cwd?: string;
}

/**
 * Git Merge Tool
 *
 * Merges the specified branch into the current branch.
 */
export class GitMergeTool extends BaseTool<GitMergeInput, GitMergeResult> {
  readonly name = 'git-merge';
  readonly description = 'Merge branches';
  readonly schema: ToolSchema = {
    name: this.name,
    description: this.description,
    category: ToolCategory.GIT,
    version: '1.0.0',
    parameters: [
      {
        name: 'branch',
        type: 'string',
        description: 'Branch to merge into current branch',
        required: true,
      },
      {
        name: 'noCommit',
        type: 'boolean',
        description: 'Perform merge but do not commit',
        required: false,
      },
      {
        name: 'noFf',
        type: 'boolean',
        description: 'Create merge commit even if fast-forward is possible',
        required: false,
      },
      {
        name: 'squash',
        type: 'boolean',
        description: 'Squash commits into single change',
        required: false,
      },
      {
        name: 'message',
        type: 'string',
        description: 'Merge commit message',
        required: false,
      },
      {
        name: 'strategy',
        type: 'string',
        description: 'Merge strategy (recursive, resolve, octopus, ours, subtree)',
        required: false,
        enum: ['recursive', 'resolve', 'octopus', 'ours', 'subtree'],
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
      description: 'Merge result information',
    },
    tags: ['git', 'merge', 'branch', 'integrate'],
  };

  private readonly gitClient: IGitClient;

  constructor(gitClient?: IGitClient) {
    super();
    this.gitClient = gitClient ?? new GitClient();
  }

  async execute(
    params: GitMergeInput,
    _options?: ToolExecutionOptions
  ): Promise<ToolResult<GitMergeResult>> {
    const startTime = Date.now();

    if (!params.branch) {
      return this.failure(
        'INVALID_PARAMS',
        'Branch name is required',
        Date.now() - startTime
      );
    }

    const result = await this.gitClient.merge(params.branch, {
      cwd: params.cwd,
      noCommit: params.noCommit,
      noFf: params.noFf,
      squash: params.squash,
      message: params.message,
      strategy: params.strategy,
    });

    if (!result.success || !result.data) {
      return this.failure(
        'GIT_MERGE_FAILED',
        result.error ?? 'Failed to merge',
        Date.now() - startTime,
        { conflicts: result.data?.conflicts }
      );
    }

    // Report conflicts if any
    if (result.data.conflicts.length > 0) {
      return this.failure(
        'MERGE_CONFLICTS',
        'Merge completed with conflicts',
        Date.now() - startTime,
        { conflicts: result.data.conflicts },
        true // recoverable
      );
    }

    return this.success(result.data, Date.now() - startTime);
  }

  async isAvailable(): Promise<boolean> {
    return this.gitClient.isRepository();
  }
}
