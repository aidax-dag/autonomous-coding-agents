/**
 * Git Commit Tool
 *
 * Creates a new commit with staged changes.
 *
 * @module core/tools/git/git-commit
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
 * Input parameters for git commit
 */
export interface GitCommitInput {
  message: string;
  all?: boolean;
  amend?: boolean;
  allowEmpty?: boolean;
  signoff?: boolean;
  author?: string;
  cwd?: string;
}

/**
 * Git Commit Tool
 *
 * Creates a new commit with the specified message.
 */
export class GitCommitTool extends BaseTool<GitCommitInput, GitCommit> {
  readonly name = 'git-commit';
  readonly description = 'Create a new commit with staged changes';
  readonly schema: ToolSchema = {
    name: this.name,
    description: this.description,
    category: ToolCategory.GIT,
    version: '1.0.0',
    parameters: [
      {
        name: 'message',
        type: 'string',
        description: 'Commit message',
        required: true,
        validation: {
          minLength: 1,
          maxLength: 10000,
        },
      },
      {
        name: 'all',
        type: 'boolean',
        description: 'Automatically stage all modified files (-a)',
        required: false,
      },
      {
        name: 'amend',
        type: 'boolean',
        description: 'Amend the previous commit',
        required: false,
      },
      {
        name: 'allowEmpty',
        type: 'boolean',
        description: 'Allow empty commits',
        required: false,
      },
      {
        name: 'signoff',
        type: 'boolean',
        description: 'Add Signed-off-by line',
        required: false,
      },
      {
        name: 'author',
        type: 'string',
        description: 'Override author (format: "Name <email>")',
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
      description: 'Created commit information',
    },
    tags: ['git', 'commit', 'save'],
  };

  private readonly gitClient: IGitClient;

  constructor(gitClient?: IGitClient) {
    super();
    this.gitClient = gitClient ?? new GitClient();
  }

  async execute(
    params: GitCommitInput,
    _options?: ToolExecutionOptions
  ): Promise<ToolResult<GitCommit>> {
    const startTime = Date.now();

    if (!params.message || params.message.trim().length === 0) {
      return this.failure(
        'INVALID_PARAMS',
        'Commit message cannot be empty',
        Date.now() - startTime
      );
    }

    const result = await this.gitClient.commit(params.message, {
      cwd: params.cwd,
      all: params.all,
      amend: params.amend,
      allowEmpty: params.allowEmpty,
      signoff: params.signoff,
      author: params.author,
    });

    if (!result.success) {
      return this.failure(
        'GIT_COMMIT_FAILED',
        result.error ?? 'Failed to create commit',
        Date.now() - startTime
      );
    }

    if (result.data) {
      return this.success(result.data, Date.now() - startTime);
    }

    // Fallback if commit data wasn't returned
    return this.success(
      {
        hash: '',
        shortHash: '',
        author: '',
        email: '',
        date: new Date(),
        message: params.message,
      },
      Date.now() - startTime
    );
  }

  async isAvailable(): Promise<boolean> {
    return this.gitClient.isRepository();
  }
}
