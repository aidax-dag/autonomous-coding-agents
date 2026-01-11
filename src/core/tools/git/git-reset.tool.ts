/**
 * Git Reset Tool
 *
 * Unstages files or resets working tree.
 *
 * @module core/tools/git/git-reset
 */

import { BaseTool } from '../base-tool.js';
import {
  ToolSchema,
  ToolCategory,
  ToolResult,
  ToolExecutionOptions,
} from '../../interfaces/tool.interface.js';
import { IGitClient } from './git.interface.js';
import { GitClient } from './git-client.js';

/**
 * Input parameters for git reset
 */
export interface GitResetInput {
  paths: string[];
  cwd?: string;
}

/**
 * Output for git reset
 */
export interface GitResetOutput {
  unstagedFiles: string[];
}

/**
 * Git Reset Tool
 *
 * Unstages files from the staging area.
 */
export class GitResetTool extends BaseTool<GitResetInput, GitResetOutput> {
  readonly name = 'git-reset';
  readonly description = 'Unstage files from the staging area';
  readonly schema: ToolSchema = {
    name: this.name,
    description: this.description,
    category: ToolCategory.GIT,
    version: '1.0.0',
    parameters: [
      {
        name: 'paths',
        type: 'array',
        description: 'File paths to unstage',
        required: true,
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
      description: 'List of unstaged files',
    },
    tags: ['git', 'reset', 'unstage'],
  };

  private readonly gitClient: IGitClient;

  constructor(gitClient?: IGitClient) {
    super();
    this.gitClient = gitClient ?? new GitClient();
  }

  async execute(
    params: GitResetInput,
    _options?: ToolExecutionOptions
  ): Promise<ToolResult<GitResetOutput>> {
    const startTime = Date.now();

    if (!params.paths || params.paths.length === 0) {
      return this.failure(
        'INVALID_PARAMS',
        'No paths specified to unstage',
        Date.now() - startTime
      );
    }

    const result = await this.gitClient.reset(params.paths, { cwd: params.cwd });

    if (!result.success) {
      return this.failure(
        'GIT_RESET_FAILED',
        result.error ?? 'Failed to unstage files',
        Date.now() - startTime
      );
    }

    return this.success(
      { unstagedFiles: params.paths },
      Date.now() - startTime
    );
  }

  async isAvailable(): Promise<boolean> {
    return this.gitClient.isRepository();
  }
}
