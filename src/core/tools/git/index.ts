/**
 * Git Tools Module
 *
 * Provides Git-related tools for repository operations.
 *
 * @module core/tools/git
 */

// Interfaces and types
export * from './git.interface.js';

// Git client
export { GitClient } from './git-client.js';

// Git tools
export { GitStatusTool, GitStatusInput } from './git-status.tool.js';
export { GitAddTool, GitAddInput, GitAddOutput } from './git-add.tool.js';
export { GitResetTool, GitResetInput, GitResetOutput } from './git-reset.tool.js';
export { GitCommitTool, GitCommitInput } from './git-commit.tool.js';
export { GitPushTool, GitPushInput } from './git-push.tool.js';
export { GitPullTool, GitPullInput } from './git-pull.tool.js';
export { GitBranchTool, GitBranchInput, GitBranchOutput } from './git-branch.tool.js';
export { GitCheckoutTool, GitCheckoutInput, GitCheckoutOutput } from './git-checkout.tool.js';
export { GitDiffTool, GitDiffInput, GitDiffOutput } from './git-diff.tool.js';
export { GitLogTool, GitLogInput, GitLogOutput } from './git-log.tool.js';
export { GitMergeTool, GitMergeInput } from './git-merge.tool.js';
export { GitStashTool, GitStashInput, GitStashOutput } from './git-stash.tool.js';

/**
 * Create all Git tools with optional shared client
 */
import { GitClient } from './git-client.js';
import { GitStatusTool } from './git-status.tool.js';
import { GitAddTool } from './git-add.tool.js';
import { GitResetTool } from './git-reset.tool.js';
import { GitCommitTool } from './git-commit.tool.js';
import { GitPushTool } from './git-push.tool.js';
import { GitPullTool } from './git-pull.tool.js';
import { GitBranchTool } from './git-branch.tool.js';
import { GitCheckoutTool } from './git-checkout.tool.js';
import { GitDiffTool } from './git-diff.tool.js';
import { GitLogTool } from './git-log.tool.js';
import { GitMergeTool } from './git-merge.tool.js';
import { GitStashTool } from './git-stash.tool.js';
import { ITool } from '../../interfaces/tool.interface.js';
import { IGitClient, GitClientOptions } from './git.interface.js';

/**
 * Git tool factory options
 */
export interface GitToolFactoryOptions extends GitClientOptions {
  client?: IGitClient;
}

/**
 * Create all Git tools
 */
export function createGitTools(options?: GitToolFactoryOptions): ITool[] {
  const client = options?.client ?? new GitClient(options);

  return [
    new GitStatusTool(client),
    new GitAddTool(client),
    new GitResetTool(client),
    new GitCommitTool(client),
    new GitPushTool(client),
    new GitPullTool(client),
    new GitBranchTool(client),
    new GitCheckoutTool(client),
    new GitDiffTool(client),
    new GitLogTool(client),
    new GitMergeTool(client),
    new GitStashTool(client),
  ];
}
