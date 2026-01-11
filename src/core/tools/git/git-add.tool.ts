/**
 * Git Add Tool
 *
 * Stages files for commit.
 *
 * @module core/tools/git/git-add
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
 * Input parameters for git add
 */
export interface GitAddInput {
  paths: string[];
  cwd?: string;
}

/**
 * Output for git add
 */
export interface GitAddOutput {
  stagedFiles: string[];
}

/**
 * Git Add Tool
 *
 * Stages specified files for the next commit.
 */
export class GitAddTool extends BaseTool<GitAddInput, GitAddOutput> {
  readonly name = 'git-add';
  readonly description = 'Stage files for commit';
  readonly schema: ToolSchema = {
    name: this.name,
    description: this.description,
    category: ToolCategory.GIT,
    version: '1.0.0',
    parameters: [
      {
        name: 'paths',
        type: 'array',
        description: 'File paths to stage (use "." for all files)',
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
      description: 'List of staged files',
    },
    tags: ['git', 'add', 'stage'],
  };

  private readonly gitClient: IGitClient;

  constructor(gitClient?: IGitClient) {
    super();
    this.gitClient = gitClient ?? new GitClient();
  }

  async execute(
    params: GitAddInput,
    _options?: ToolExecutionOptions
  ): Promise<ToolResult<GitAddOutput>> {
    const startTime = Date.now();

    if (!params.paths || params.paths.length === 0) {
      return this.failure(
        'INVALID_PARAMS',
        'No paths specified to add',
        Date.now() - startTime
      );
    }

    const result = await this.gitClient.add(params.paths, { cwd: params.cwd });

    if (!result.success) {
      return this.failure(
        'GIT_ADD_FAILED',
        result.error ?? 'Failed to stage files',
        Date.now() - startTime
      );
    }

    return this.success(
      { stagedFiles: params.paths },
      Date.now() - startTime
    );
  }

  async isAvailable(): Promise<boolean> {
    return this.gitClient.isRepository();
  }
}
