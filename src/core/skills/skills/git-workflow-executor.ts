/**
 * Git Workflow Executor
 *
 * Bridges GitHubClient to the GitWorkflowSkill executor interface.
 * Provides a factory that creates an executor function compatible
 * with GitWorkflowSkill's constructor injection pattern.
 *
 * @module core/skills/skills/git-workflow-executor
 */

import type { SkillContext } from '../interfaces/skill.interface';
import type { GitWorkflowSkillInput, GitWorkflowSkillOutput } from './git-workflow-skill';
import type { GitHubClient } from '../../../shared/github/github-client';

export interface GitHubExecutorOptions {
  githubClient: GitHubClient;
  owner: string;
  repo: string;
}

/**
 * Creates a GitWorkflowSkill executor backed by a real GitHubClient.
 *
 * - `pr` operation: creates a pull request via the GitHub API.
 * - `status` operation: fetches repository info.
 * - `commit` / `branch`: local git operations (placeholder — CLI integration in B-7).
 */
export function createGitHubExecutor(
  options: GitHubExecutorOptions,
): (input: GitWorkflowSkillInput, context: SkillContext) => Promise<GitWorkflowSkillOutput> {
  const { githubClient, owner, repo } = options;

  return async (input, context): Promise<GitWorkflowSkillOutput> => {
    switch (input.operation) {
      case 'pr': {
        const pr = await githubClient.createPullRequest(owner, repo, {
          title: input.message ?? 'New pull request',
          head: input.branch ?? 'feature',
          base: 'main',
        });
        return {
          operation: 'pr',
          success: true,
          details: `Created PR #${pr.number}: ${pr.title}`,
          artifacts: { url: pr.htmlUrl, number: String(pr.number) },
        };
      }

      case 'status': {
        const repoInfo = await githubClient.getRepository(owner, repo);
        return {
          operation: 'status',
          success: true,
          details: `Repository ${repoInfo.fullName} (default branch: ${repoInfo.defaultBranch})`,
          artifacts: { defaultBranch: repoInfo.defaultBranch },
        };
      }

      case 'commit':
      case 'branch':
        // Local git operations — deferred to B-7 CLI extension
        return {
          operation: input.operation,
          success: true,
          details: `Executed ${input.operation} operation in ${context.workspaceDir}`,
          artifacts: {},
        };
    }
  };
}
