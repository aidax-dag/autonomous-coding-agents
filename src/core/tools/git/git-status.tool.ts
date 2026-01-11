/**
 * Git Status Tool
 *
 * Retrieves the current status of a Git repository.
 *
 * @module core/tools/git/git-status
 */

import { BaseTool } from '../base-tool.js';
import {
  ToolSchema,
  ToolCategory,
  ToolResult,
  ToolExecutionOptions,
} from '../../interfaces/tool.interface.js';
import { IGitClient, GitStatus } from './git.interface.js';
import { GitClient } from './git-client.js';

/**
 * Input parameters for git status
 */
export interface GitStatusInput {
  cwd?: string;
}

/**
 * Git Status Tool
 *
 * Returns the current status of the repository including:
 * - Current branch
 * - Staged and unstaged changes
 * - Untracked files
 * - Ahead/behind status
 */
export class GitStatusTool extends BaseTool<GitStatusInput, GitStatus> {
  readonly name = 'git-status';
  readonly description = 'Get the current status of a Git repository';
  readonly schema: ToolSchema = {
    name: this.name,
    description: this.description,
    category: ToolCategory.GIT,
    version: '1.0.0',
    parameters: [
      {
        name: 'cwd',
        type: 'string',
        description: 'Working directory (defaults to current directory)',
        required: false,
      },
    ],
    returns: {
      type: 'object',
      description: 'Repository status information',
    },
    tags: ['git', 'status', 'repository'],
  };

  private readonly gitClient: IGitClient;

  constructor(gitClient?: IGitClient) {
    super();
    this.gitClient = gitClient ?? new GitClient();
  }

  async execute(
    params: GitStatusInput,
    _options?: ToolExecutionOptions
  ): Promise<ToolResult<GitStatus>> {
    const startTime = Date.now();

    const result = await this.gitClient.status({ cwd: params.cwd });

    if (!result.success || !result.data) {
      return this.failure(
        'GIT_STATUS_FAILED',
        result.error ?? 'Failed to get git status',
        Date.now() - startTime
      );
    }

    return this.success(result.data, Date.now() - startTime);
  }

  async isAvailable(): Promise<boolean> {
    return this.gitClient.isRepository();
  }
}
