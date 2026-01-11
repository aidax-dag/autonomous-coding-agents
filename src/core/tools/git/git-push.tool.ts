/**
 * Git Push Tool
 *
 * Pushes commits to a remote repository.
 *
 * @module core/tools/git/git-push
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
 * Input parameters for git push
 */
export interface GitPushInput {
  remote?: string;
  branch?: string;
  force?: boolean;
  setUpstream?: boolean;
  tags?: boolean;
  dryRun?: boolean;
  cwd?: string;
}

/**
 * Git Push Tool
 *
 * Pushes local commits to a remote repository.
 */
export class GitPushTool extends BaseTool<GitPushInput, GitSyncResult> {
  readonly name = 'git-push';
  readonly description = 'Push commits to a remote repository';
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
        description: 'Branch to push',
        required: false,
      },
      {
        name: 'force',
        type: 'boolean',
        description: 'Force push (use with caution)',
        required: false,
      },
      {
        name: 'setUpstream',
        type: 'boolean',
        description: 'Set upstream tracking reference',
        required: false,
      },
      {
        name: 'tags',
        type: 'boolean',
        description: 'Push tags',
        required: false,
      },
      {
        name: 'dryRun',
        type: 'boolean',
        description: 'Dry run (show what would be pushed)',
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
      description: 'Push result information',
    },
    tags: ['git', 'push', 'remote'],
  };

  private readonly gitClient: IGitClient;

  constructor(gitClient?: IGitClient) {
    super();
    this.gitClient = gitClient ?? new GitClient();
  }

  async execute(
    params: GitPushInput,
    _options?: ToolExecutionOptions
  ): Promise<ToolResult<GitSyncResult>> {
    const startTime = Date.now();

    const result = await this.gitClient.push({
      cwd: params.cwd,
      remote: params.remote,
      branch: params.branch,
      force: params.force,
      setUpstream: params.setUpstream,
      tags: params.tags,
      dryRun: params.dryRun,
    });

    if (!result.success || !result.data) {
      return this.failure(
        'GIT_PUSH_FAILED',
        result.error ?? 'Failed to push changes',
        Date.now() - startTime
      );
    }

    return this.success(result.data, Date.now() - startTime);
  }

  async isAvailable(): Promise<boolean> {
    return this.gitClient.isRepository();
  }
}
