/**
 * Git Checkout Tool
 *
 * Switches branches or restores working tree files.
 *
 * @module core/tools/git/git-checkout
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
 * Input parameters for git checkout
 */
export interface GitCheckoutInput {
  ref: string;
  create?: boolean;
  force?: boolean;
  track?: boolean;
  cwd?: string;
}

/**
 * Output for git checkout
 */
export interface GitCheckoutOutput {
  ref: string;
  created: boolean;
}

/**
 * Git Checkout Tool
 *
 * Switches to a branch or commit.
 */
export class GitCheckoutTool extends BaseTool<GitCheckoutInput, GitCheckoutOutput> {
  readonly name = 'git-checkout';
  readonly description = 'Switch branches or restore working tree files';
  readonly schema: ToolSchema = {
    name: this.name,
    description: this.description,
    category: ToolCategory.GIT,
    version: '1.0.0',
    parameters: [
      {
        name: 'ref',
        type: 'string',
        description: 'Branch name, tag, or commit to checkout',
        required: true,
      },
      {
        name: 'create',
        type: 'boolean',
        description: 'Create a new branch (-b)',
        required: false,
      },
      {
        name: 'force',
        type: 'boolean',
        description: 'Force checkout (discard local changes)',
        required: false,
      },
      {
        name: 'track',
        type: 'boolean',
        description: 'Set up tracking for remote branch',
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
      description: 'Checkout result',
    },
    tags: ['git', 'checkout', 'switch', 'branch'],
  };

  private readonly gitClient: IGitClient;

  constructor(gitClient?: IGitClient) {
    super();
    this.gitClient = gitClient ?? new GitClient();
  }

  async execute(
    params: GitCheckoutInput,
    _options?: ToolExecutionOptions
  ): Promise<ToolResult<GitCheckoutOutput>> {
    const startTime = Date.now();

    if (!params.ref) {
      return this.failure(
        'INVALID_PARAMS',
        'Reference (branch, tag, or commit) is required',
        Date.now() - startTime
      );
    }

    const result = await this.gitClient.checkout(params.ref, {
      cwd: params.cwd,
      create: params.create,
      force: params.force,
      track: params.track,
    });

    if (!result.success) {
      return this.failure(
        'GIT_CHECKOUT_FAILED',
        result.error ?? 'Failed to checkout',
        Date.now() - startTime
      );
    }

    return this.success(
      {
        ref: params.ref,
        created: params.create ?? false,
      },
      Date.now() - startTime
    );
  }

  async isAvailable(): Promise<boolean> {
    return this.gitClient.isRepository();
  }
}
