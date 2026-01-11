/**
 * Git Branch Tool
 *
 * Manages Git branches.
 *
 * @module core/tools/git/git-branch
 */

import { BaseTool } from '../base-tool.js';
import {
  ToolSchema,
  ToolCategory,
  ToolResult,
  ToolExecutionOptions,
} from '../../interfaces/tool.interface.js';
import { IGitClient, GitBranch } from './git.interface.js';
import { GitClient } from './git-client.js';

/**
 * Input parameters for git branch
 */
export interface GitBranchInput {
  action: 'list' | 'create' | 'delete';
  name?: string;
  startPoint?: string;
  force?: boolean;
  all?: boolean;
  remote?: boolean;
  cwd?: string;
}

/**
 * Output for git branch
 */
export interface GitBranchOutput {
  branches?: GitBranch[];
  created?: string;
  deleted?: string;
}

/**
 * Git Branch Tool
 *
 * List, create, or delete branches.
 */
export class GitBranchTool extends BaseTool<GitBranchInput, GitBranchOutput> {
  readonly name = 'git-branch';
  readonly description = 'List, create, or delete branches';
  readonly schema: ToolSchema = {
    name: this.name,
    description: this.description,
    category: ToolCategory.GIT,
    version: '1.0.0',
    parameters: [
      {
        name: 'action',
        type: 'string',
        description: 'Action to perform: list, create, or delete',
        required: true,
        enum: ['list', 'create', 'delete'],
      },
      {
        name: 'name',
        type: 'string',
        description: 'Branch name (required for create/delete)',
        required: false,
      },
      {
        name: 'startPoint',
        type: 'string',
        description: 'Starting point for new branch (commit, tag, or branch)',
        required: false,
      },
      {
        name: 'force',
        type: 'boolean',
        description: 'Force delete branch',
        required: false,
      },
      {
        name: 'all',
        type: 'boolean',
        description: 'List all branches including remote',
        required: false,
      },
      {
        name: 'remote',
        type: 'boolean',
        description: 'List only remote branches',
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
      description: 'Branch operation result',
    },
    tags: ['git', 'branch', 'create', 'delete'],
  };

  private readonly gitClient: IGitClient;

  constructor(gitClient?: IGitClient) {
    super();
    this.gitClient = gitClient ?? new GitClient();
  }

  async execute(
    params: GitBranchInput,
    _options?: ToolExecutionOptions
  ): Promise<ToolResult<GitBranchOutput>> {
    const startTime = Date.now();

    switch (params.action) {
      case 'list':
        return this.listBranches(params, startTime);
      case 'create':
        return this.createBranch(params, startTime);
      case 'delete':
        return this.deleteBranch(params, startTime);
      default:
        return this.failure(
          'INVALID_ACTION',
          `Unknown action: ${params.action}`,
          Date.now() - startTime
        );
    }
  }

  private async listBranches(
    params: GitBranchInput,
    startTime: number
  ): Promise<ToolResult<GitBranchOutput>> {
    const result = await this.gitClient.branch({
      cwd: params.cwd,
      all: params.all,
      remote: params.remote,
    });

    if (!result.success || !result.data) {
      return this.failure(
        'GIT_BRANCH_FAILED',
        result.error ?? 'Failed to list branches',
        Date.now() - startTime
      );
    }

    return this.success({ branches: result.data }, Date.now() - startTime);
  }

  private async createBranch(
    params: GitBranchInput,
    startTime: number
  ): Promise<ToolResult<GitBranchOutput>> {
    if (!params.name) {
      return this.failure(
        'INVALID_PARAMS',
        'Branch name is required for create action',
        Date.now() - startTime
      );
    }

    const result = await this.gitClient.createBranch(params.name, {
      cwd: params.cwd,
      startPoint: params.startPoint,
    });

    if (!result.success) {
      return this.failure(
        'GIT_BRANCH_FAILED',
        result.error ?? 'Failed to create branch',
        Date.now() - startTime
      );
    }

    return this.success({ created: params.name }, Date.now() - startTime);
  }

  private async deleteBranch(
    params: GitBranchInput,
    startTime: number
  ): Promise<ToolResult<GitBranchOutput>> {
    if (!params.name) {
      return this.failure(
        'INVALID_PARAMS',
        'Branch name is required for delete action',
        Date.now() - startTime
      );
    }

    const result = await this.gitClient.deleteBranch(
      params.name,
      params.force,
      { cwd: params.cwd }
    );

    if (!result.success) {
      return this.failure(
        'GIT_BRANCH_FAILED',
        result.error ?? 'Failed to delete branch',
        Date.now() - startTime
      );
    }

    return this.success({ deleted: params.name }, Date.now() - startTime);
  }

  async isAvailable(): Promise<boolean> {
    return this.gitClient.isRepository();
  }
}
