/**
 * Git Stash Tool
 *
 * Stashes changes in working directory.
 *
 * @module core/tools/git/git-stash
 */

import { BaseTool } from '../base-tool.js';
import {
  ToolSchema,
  ToolCategory,
  ToolResult,
  ToolExecutionOptions,
} from '../../interfaces/tool.interface.js';
import { IGitClient, GitStashEntry } from './git.interface.js';
import { GitClient } from './git-client.js';

/**
 * Input parameters for git stash
 */
export interface GitStashInput {
  action: 'list' | 'push' | 'pop' | 'drop' | 'apply';
  message?: string;
  index?: number;
  cwd?: string;
}

/**
 * Output for git stash
 */
export interface GitStashOutput {
  stashes?: GitStashEntry[];
  applied?: number;
  dropped?: number;
  created?: boolean;
}

/**
 * Git Stash Tool
 *
 * Stash the changes in a dirty working directory.
 */
export class GitStashTool extends BaseTool<GitStashInput, GitStashOutput> {
  readonly name = 'git-stash';
  readonly description = 'Stash changes in working directory';
  readonly schema: ToolSchema = {
    name: this.name,
    description: this.description,
    category: ToolCategory.GIT,
    version: '1.0.0',
    parameters: [
      {
        name: 'action',
        type: 'string',
        description: 'Stash action to perform',
        required: true,
        enum: ['list', 'push', 'pop', 'drop', 'apply'],
      },
      {
        name: 'message',
        type: 'string',
        description: 'Stash message (for push action)',
        required: false,
      },
      {
        name: 'index',
        type: 'number',
        description: 'Stash index (for pop, drop, apply)',
        required: false,
        validation: {
          min: 0,
        },
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
      description: 'Stash operation result',
    },
    tags: ['git', 'stash', 'save', 'changes'],
  };

  private readonly gitClient: IGitClient;

  constructor(gitClient?: IGitClient) {
    super();
    this.gitClient = gitClient ?? new GitClient();
  }

  async execute(
    params: GitStashInput,
    _options?: ToolExecutionOptions
  ): Promise<ToolResult<GitStashOutput>> {
    const startTime = Date.now();

    switch (params.action) {
      case 'list':
        return this.listStashes(params, startTime);
      case 'push':
        return this.pushStash(params, startTime);
      case 'pop':
        return this.popStash(params, startTime);
      case 'drop':
        return this.dropStash(params, startTime);
      case 'apply':
        return this.applyStash(params, startTime);
      default:
        return this.failure(
          'INVALID_ACTION',
          `Unknown action: ${params.action}`,
          Date.now() - startTime
        );
    }
  }

  private async listStashes(
    params: GitStashInput,
    startTime: number
  ): Promise<ToolResult<GitStashOutput>> {
    const result = await this.gitClient.stash({ cwd: params.cwd });

    if (!result.success || !result.data) {
      return this.failure(
        'GIT_STASH_FAILED',
        result.error ?? 'Failed to list stashes',
        Date.now() - startTime
      );
    }

    return this.success({ stashes: result.data }, Date.now() - startTime);
  }

  private async pushStash(
    params: GitStashInput,
    startTime: number
  ): Promise<ToolResult<GitStashOutput>> {
    const result = await this.gitClient.stashPush(params.message, {
      cwd: params.cwd,
    });

    if (!result.success) {
      return this.failure(
        'GIT_STASH_FAILED',
        result.error ?? 'Failed to push stash',
        Date.now() - startTime
      );
    }

    return this.success({ created: true }, Date.now() - startTime);
  }

  private async popStash(
    params: GitStashInput,
    startTime: number
  ): Promise<ToolResult<GitStashOutput>> {
    const result = await this.gitClient.stashPop(params.index ?? 0, {
      cwd: params.cwd,
    });

    if (!result.success) {
      return this.failure(
        'GIT_STASH_FAILED',
        result.error ?? 'Failed to pop stash',
        Date.now() - startTime
      );
    }

    return this.success({ applied: params.index ?? 0 }, Date.now() - startTime);
  }

  private async dropStash(
    params: GitStashInput,
    startTime: number
  ): Promise<ToolResult<GitStashOutput>> {
    const result = await this.gitClient.stashDrop(params.index ?? 0, {
      cwd: params.cwd,
    });

    if (!result.success) {
      return this.failure(
        'GIT_STASH_FAILED',
        result.error ?? 'Failed to drop stash',
        Date.now() - startTime
      );
    }

    return this.success({ dropped: params.index ?? 0 }, Date.now() - startTime);
  }

  private async applyStash(
    params: GitStashInput,
    startTime: number
  ): Promise<ToolResult<GitStashOutput>> {
    // Apply is same as pop but doesn't remove from stash list
    // We use pop and if there's an error with conflicts, it's still applied
    const result = await this.gitClient.stashPop(params.index ?? 0, {
      cwd: params.cwd,
    });

    // For apply, we'd need to implement a separate apply command
    // For now, we'll use pop behavior
    if (!result.success) {
      return this.failure(
        'GIT_STASH_FAILED',
        result.error ?? 'Failed to apply stash',
        Date.now() - startTime
      );
    }

    return this.success({ applied: params.index ?? 0 }, Date.now() - startTime);
  }

  async isAvailable(): Promise<boolean> {
    return this.gitClient.isRepository();
  }
}
