/**
 * Git Log Tool
 *
 * Shows commit logs.
 *
 * @module core/tools/git/git-log
 */

import { BaseTool } from '../base-tool.js';
import {
  ToolSchema,
  ToolCategory,
  ToolResult,
  ToolExecutionOptions,
} from '../../interfaces/tool.interface.js';
import { IGitClient, GitCommit } from './git.interface.js';
import { GitClient } from './git-client.js';

/**
 * Input parameters for git log
 */
export interface GitLogInput {
  maxCount?: number;
  since?: string;
  until?: string;
  author?: string;
  grep?: string;
  path?: string;
  cwd?: string;
}

/**
 * Output for git log
 */
export interface GitLogOutput {
  commits: GitCommit[];
  count: number;
}

/**
 * Git Log Tool
 *
 * Shows commit logs with various filter options.
 */
export class GitLogTool extends BaseTool<GitLogInput, GitLogOutput> {
  readonly name = 'git-log';
  readonly description = 'Show commit logs';
  readonly schema: ToolSchema = {
    name: this.name,
    description: this.description,
    category: ToolCategory.GIT,
    version: '1.0.0',
    parameters: [
      {
        name: 'maxCount',
        type: 'number',
        description: 'Maximum number of commits to show',
        required: false,
        validation: {
          min: 1,
          max: 1000,
        },
      },
      {
        name: 'since',
        type: 'string',
        description: 'Show commits after date (ISO format or relative)',
        required: false,
      },
      {
        name: 'until',
        type: 'string',
        description: 'Show commits before date (ISO format or relative)',
        required: false,
      },
      {
        name: 'author',
        type: 'string',
        description: 'Filter by author name or email',
        required: false,
      },
      {
        name: 'grep',
        type: 'string',
        description: 'Filter by commit message pattern',
        required: false,
      },
      {
        name: 'path',
        type: 'string',
        description: 'Show commits affecting path',
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
      description: 'Commit log information',
    },
    tags: ['git', 'log', 'history', 'commits'],
  };

  private readonly gitClient: IGitClient;

  constructor(gitClient?: IGitClient) {
    super();
    this.gitClient = gitClient ?? new GitClient();
  }

  async execute(
    params: GitLogInput,
    _options?: ToolExecutionOptions
  ): Promise<ToolResult<GitLogOutput>> {
    const startTime = Date.now();

    const result = await this.gitClient.log({
      cwd: params.cwd,
      maxCount: params.maxCount ?? 50,
      since: params.since ? new Date(params.since) : undefined,
      until: params.until ? new Date(params.until) : undefined,
      author: params.author,
      grep: params.grep,
      path: params.path,
    });

    if (!result.success || !result.data) {
      return this.failure(
        'GIT_LOG_FAILED',
        result.error ?? 'Failed to get log',
        Date.now() - startTime
      );
    }

    return this.success(
      {
        commits: result.data,
        count: result.data.length,
      },
      Date.now() - startTime
    );
  }

  async isAvailable(): Promise<boolean> {
    return this.gitClient.isRepository();
  }
}
