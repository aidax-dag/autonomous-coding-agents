/**
 * Git Pull Tool
 *
 * Pulls changes from a remote repository.
 *
 * @module core/tools/git/git-pull
 */

import { BaseTool } from '../base-tool.js';
import {
  ToolSchema,
  ToolCategory,
  ToolResult,
  ToolExecutionOptions,
} from '../../interfaces/tool.interface.js';
import { IGitClient, GitSyncResult } from './git.interface.js';
import { GitClient } from './git-client.js';

/**
 * Input parameters for git pull
 */
export interface GitPullInput {
  remote?: string;
  branch?: string;
  rebase?: boolean;
  noCommit?: boolean;
  ffOnly?: boolean;
  cwd?: string;
}

/**
 * Git Pull Tool
 *
 * Fetches and integrates changes from a remote repository.
 */
export class GitPullTool extends BaseTool<GitPullInput, GitSyncResult> {
  readonly name = 'git-pull';
  readonly description = 'Pull changes from a remote repository';
  readonly schema: ToolSchema = {
    name: this.name,
    description: this.description,
    category: ToolCategory.GIT,
    version: '1.0.0',
    parameters: [
      {
        name: 'remote',
        type: 'string',
        description: 'Remote name (defaults to origin)',
        required: false,
      },
      {
        name: 'branch',
        type: 'string',
        description: 'Branch to pull',
        required: false,
      },
      {
        name: 'rebase',
        type: 'boolean',
        description: 'Rebase instead of merge',
        required: false,
      },
      {
        name: 'noCommit',
        type: 'boolean',
        description: 'Do not create merge commit',
        required: false,
      },
      {
        name: 'ffOnly',
        type: 'boolean',
        description: 'Only allow fast-forward merges',
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
      description: 'Pull result information',
    },
    tags: ['git', 'pull', 'remote', 'fetch'],
  };

  private readonly gitClient: IGitClient;

  constructor(gitClient?: IGitClient) {
    super();
    this.gitClient = gitClient ?? new GitClient();
  }

  async execute(
    params: GitPullInput,
    _options?: ToolExecutionOptions
  ): Promise<ToolResult<GitSyncResult>> {
    const startTime = Date.now();

    const result = await this.gitClient.pull({
      cwd: params.cwd,
      remote: params.remote,
      branch: params.branch,
      rebase: params.rebase,
      noCommit: params.noCommit,
      ffOnly: params.ffOnly,
    });

    if (!result.success || !result.data) {
      return this.failure(
        'GIT_PULL_FAILED',
        result.error ?? 'Failed to pull changes',
        Date.now() - startTime
      );
    }

    return this.success(result.data, Date.now() - startTime);
  }

  async isAvailable(): Promise<boolean> {
    return this.gitClient.isRepository();
  }
}
