/**
 * GitHub Client
 *
 * Wraps Octokit to provide typed methods for Pull Request, Issue,
 * and Repository operations with structured error handling.
 *
 * @module shared/github/github-client
 */

import { Octokit } from 'octokit';
import type { RestEndpointMethodTypes } from '@octokit/rest';
import { createAgentLogger } from '../logging/logger';
import {
  GitHubError,
  GitHubAuthenticationError,
  GitHubRateLimitError,
  GitHubNotFoundError,
  GitHubValidationError,
} from '../errors/custom-errors';
import type {
  PullRequest,
  CreatePullRequestInput,
  UpdatePullRequestInput,
  PullRequestFile,
  PullRequestComment,
  MergeMethod,
  CreateReviewInput,
  Issue,
  CreateIssueInput,
  UpdateIssueInput,
  IssueComment,
  Repository,
  Branch,
  CommitComparison,
} from './types';

// Octokit response type aliases
type OctokitPR = RestEndpointMethodTypes['pulls']['get']['response']['data'];
type OctokitIssue = RestEndpointMethodTypes['issues']['get']['response']['data'];
type OctokitRepo = RestEndpointMethodTypes['repos']['get']['response']['data'];
type OctokitPRFile = RestEndpointMethodTypes['pulls']['listFiles']['response']['data'][number];
type OctokitComment = RestEndpointMethodTypes['issues']['listComments']['response']['data'][number];
type OctokitBranch = RestEndpointMethodTypes['repos']['listBranches']['response']['data'][number];
type OctokitCompareFile = NonNullable<RestEndpointMethodTypes['repos']['compareCommits']['response']['data']['files']>[number];

const logger = createAgentLogger('GitHub', 'github-client');

// =============================================================================
// Mappers
// =============================================================================

function mapPullRequest(pr: OctokitPR): PullRequest {
  return {
    number: pr.number,
    title: pr.title,
    body: pr.body,
    state: pr.state as 'open' | 'closed',
    htmlUrl: pr.html_url,
    head: { ref: pr.head.ref, sha: pr.head.sha },
    base: { ref: pr.base.ref },
    draft: pr.draft ?? false,
    merged: pr.merged ?? false,
    mergeable: pr.mergeable ?? null,
    createdAt: pr.created_at,
    updatedAt: pr.updated_at,
  };
}

function mapIssue(issue: OctokitIssue): Issue {
  return {
    number: issue.number,
    title: issue.title,
    body: issue.body ?? null,
    state: issue.state as 'open' | 'closed',
    htmlUrl: issue.html_url,
    labels: issue.labels.map((l) => (typeof l === 'string' ? l : l.name ?? '')),
    createdAt: issue.created_at,
    updatedAt: issue.updated_at,
  };
}

function mapRepository(repo: OctokitRepo): Repository {
  return {
    name: repo.name,
    fullName: repo.full_name,
    description: repo.description,
    defaultBranch: repo.default_branch,
    private: repo.private,
    htmlUrl: repo.html_url,
  };
}

// =============================================================================
// Error Handling
// =============================================================================

function handleApiError(error: unknown, context: string): never {
  if (error instanceof GitHubError) throw error;

  const status = (error as { status?: number }).status;
  const message = error instanceof Error ? error.message : String(error);

  logger.error(`GitHub API error: ${context}`, { status, message });

  switch (status) {
    case 401:
      throw new GitHubAuthenticationError(`Authentication failed: ${context}`);
    case 403:
    case 429: {
      const resetAt = (error as { response?: { headers?: Record<string, string> } })
        .response?.headers?.['x-ratelimit-reset'];
      throw new GitHubRateLimitError(
        `Rate limit exceeded: ${context}`,
        resetAt ? Number(resetAt) : undefined,
      );
    }
    case 404:
      throw new GitHubNotFoundError(context);
    case 422:
      throw new GitHubValidationError(`Validation failed: ${context}`);
    default:
      throw new GitHubError(
        `GitHub API error: ${context} - ${message}`,
        status,
        undefined,
        status !== undefined && status >= 500,
      );
  }
}

// =============================================================================
// Client
// =============================================================================

export class GitHubClient {
  private octokit: Octokit;

  constructor(token: string) {
    this.octokit = new Octokit({ auth: token });
  }

  // ===========================================================================
  // Pull Requests
  // ===========================================================================

  async createPullRequest(
    owner: string,
    repo: string,
    input: CreatePullRequestInput,
  ): Promise<PullRequest> {
    logger.info('Creating pull request', { owner, repo, title: input.title });
    try {
      const { data } = await this.octokit.rest.pulls.create({
        owner,
        repo,
        title: input.title,
        body: input.body,
        head: input.head,
        base: input.base,
        draft: input.draft,
      });
      return mapPullRequest(data);
    } catch (error) {
      handleApiError(error, `createPullRequest(${owner}/${repo})`);
    }
  }

  async getPullRequest(
    owner: string,
    repo: string,
    pullNumber: number,
  ): Promise<PullRequest> {
    logger.info('Getting pull request', { owner, repo, pullNumber });
    try {
      const { data } = await this.octokit.rest.pulls.get({
        owner,
        repo,
        pull_number: pullNumber,
      });
      return mapPullRequest(data);
    } catch (error) {
      handleApiError(error, `getPullRequest(${owner}/${repo}#${pullNumber})`);
    }
  }

  async listPullRequests(
    owner: string,
    repo: string,
    state: 'open' | 'closed' | 'all' = 'open',
  ): Promise<PullRequest[]> {
    logger.info('Listing pull requests', { owner, repo, state });
    try {
      const { data } = await this.octokit.rest.pulls.list({
        owner,
        repo,
        state,
      });
      return data.map(mapPullRequest);
    } catch (error) {
      handleApiError(error, `listPullRequests(${owner}/${repo})`);
    }
  }

  async updatePullRequest(
    owner: string,
    repo: string,
    pullNumber: number,
    input: UpdatePullRequestInput,
  ): Promise<PullRequest> {
    logger.info('Updating pull request', { owner, repo, pullNumber });
    try {
      const { data } = await this.octokit.rest.pulls.update({
        owner,
        repo,
        pull_number: pullNumber,
        title: input.title,
        body: input.body,
        state: input.state,
        base: input.base,
      });
      return mapPullRequest(data);
    } catch (error) {
      handleApiError(error, `updatePullRequest(${owner}/${repo}#${pullNumber})`);
    }
  }

  async mergePullRequest(
    owner: string,
    repo: string,
    pullNumber: number,
    mergeMethod: MergeMethod = 'merge',
  ): Promise<{ merged: boolean; message: string; sha: string }> {
    logger.info('Merging pull request', { owner, repo, pullNumber, mergeMethod });
    try {
      const { data } = await this.octokit.rest.pulls.merge({
        owner,
        repo,
        pull_number: pullNumber,
        merge_method: mergeMethod,
      });
      return { merged: data.merged, message: data.message, sha: data.sha };
    } catch (error) {
      handleApiError(error, `mergePullRequest(${owner}/${repo}#${pullNumber})`);
    }
  }

  async closePullRequest(
    owner: string,
    repo: string,
    pullNumber: number,
  ): Promise<PullRequest> {
    return this.updatePullRequest(owner, repo, pullNumber, { state: 'closed' });
  }

  async listPullRequestFiles(
    owner: string,
    repo: string,
    pullNumber: number,
  ): Promise<PullRequestFile[]> {
    logger.info('Listing pull request files', { owner, repo, pullNumber });
    try {
      const { data } = await this.octokit.rest.pulls.listFiles({
        owner,
        repo,
        pull_number: pullNumber,
      });
      return data.map((f: OctokitPRFile) => ({
        filename: f.filename,
        status: f.status,
        additions: f.additions,
        deletions: f.deletions,
        changes: f.changes,
        patch: f.patch,
      }));
    } catch (error) {
      handleApiError(error, `listPullRequestFiles(${owner}/${repo}#${pullNumber})`);
    }
  }

  async createPullRequestComment(
    owner: string,
    repo: string,
    pullNumber: number,
    body: string,
  ): Promise<PullRequestComment> {
    logger.info('Creating PR comment', { owner, repo, pullNumber });
    try {
      // GitHub API: PR comments use the issues API
      const { data } = await this.octokit.rest.issues.createComment({
        owner,
        repo,
        issue_number: pullNumber,
        body,
      });
      return {
        id: data.id,
        body: data.body ?? '',
        user: data.user?.login ?? '',
        createdAt: data.created_at,
      };
    } catch (error) {
      handleApiError(error, `createPullRequestComment(${owner}/${repo}#${pullNumber})`);
    }
  }

  async createPullRequestReview(
    owner: string,
    repo: string,
    pullNumber: number,
    input: CreateReviewInput,
  ): Promise<{ id: number; state: string }> {
    logger.info('Creating PR review', { owner, repo, pullNumber, event: input.event });
    try {
      const { data } = await this.octokit.rest.pulls.createReview({
        owner,
        repo,
        pull_number: pullNumber,
        event: input.event,
        body: input.body,
        comments: input.comments,
      });
      return { id: data.id, state: data.state };
    } catch (error) {
      handleApiError(error, `createPullRequestReview(${owner}/${repo}#${pullNumber})`);
    }
  }

  // ===========================================================================
  // Issues
  // ===========================================================================

  async createIssue(
    owner: string,
    repo: string,
    input: CreateIssueInput,
  ): Promise<Issue> {
    logger.info('Creating issue', { owner, repo, title: input.title });
    try {
      const { data } = await this.octokit.rest.issues.create({
        owner,
        repo,
        title: input.title,
        body: input.body,
        labels: input.labels,
        assignees: input.assignees,
      });
      return mapIssue(data);
    } catch (error) {
      handleApiError(error, `createIssue(${owner}/${repo})`);
    }
  }

  async getIssue(
    owner: string,
    repo: string,
    issueNumber: number,
  ): Promise<Issue> {
    logger.info('Getting issue', { owner, repo, issueNumber });
    try {
      const { data } = await this.octokit.rest.issues.get({
        owner,
        repo,
        issue_number: issueNumber,
      });
      return mapIssue(data);
    } catch (error) {
      handleApiError(error, `getIssue(${owner}/${repo}#${issueNumber})`);
    }
  }

  async updateIssue(
    owner: string,
    repo: string,
    issueNumber: number,
    input: UpdateIssueInput,
  ): Promise<Issue> {
    logger.info('Updating issue', { owner, repo, issueNumber });
    try {
      const { data } = await this.octokit.rest.issues.update({
        owner,
        repo,
        issue_number: issueNumber,
        title: input.title,
        body: input.body,
        state: input.state,
        labels: input.labels,
      });
      return mapIssue(data);
    } catch (error) {
      handleApiError(error, `updateIssue(${owner}/${repo}#${issueNumber})`);
    }
  }

  async listIssueComments(
    owner: string,
    repo: string,
    issueNumber: number,
  ): Promise<IssueComment[]> {
    logger.info('Listing issue comments', { owner, repo, issueNumber });
    try {
      const { data } = await this.octokit.rest.issues.listComments({
        owner,
        repo,
        issue_number: issueNumber,
      });
      return data.map((c: OctokitComment) => ({
        id: c.id,
        body: c.body ?? '',
        user: c.user?.login ?? '',
        createdAt: c.created_at,
      }));
    } catch (error) {
      handleApiError(error, `listIssueComments(${owner}/${repo}#${issueNumber})`);
    }
  }

  async createIssueComment(
    owner: string,
    repo: string,
    issueNumber: number,
    body: string,
  ): Promise<IssueComment> {
    logger.info('Creating issue comment', { owner, repo, issueNumber });
    try {
      const { data } = await this.octokit.rest.issues.createComment({
        owner,
        repo,
        issue_number: issueNumber,
        body,
      });
      return {
        id: data.id,
        body: data.body ?? '',
        user: data.user?.login ?? '',
        createdAt: data.created_at,
      };
    } catch (error) {
      handleApiError(error, `createIssueComment(${owner}/${repo}#${issueNumber})`);
    }
  }

  // ===========================================================================
  // Repository
  // ===========================================================================

  async getRepository(owner: string, repo: string): Promise<Repository> {
    logger.info('Getting repository', { owner, repo });
    try {
      const { data } = await this.octokit.rest.repos.get({ owner, repo });
      return mapRepository(data);
    } catch (error) {
      handleApiError(error, `getRepository(${owner}/${repo})`);
    }
  }

  async getBranch(owner: string, repo: string, branch: string): Promise<Branch> {
    logger.info('Getting branch', { owner, repo, branch });
    try {
      const { data } = await this.octokit.rest.repos.getBranch({
        owner,
        repo,
        branch,
      });
      return {
        name: data.name,
        sha: data.commit.sha,
        protected: data.protected,
      };
    } catch (error) {
      handleApiError(error, `getBranch(${owner}/${repo}:${branch})`);
    }
  }

  async listBranches(owner: string, repo: string): Promise<Branch[]> {
    logger.info('Listing branches', { owner, repo });
    try {
      const { data } = await this.octokit.rest.repos.listBranches({
        owner,
        repo,
      });
      return data.map((b: OctokitBranch) => ({
        name: b.name,
        sha: b.commit.sha,
        protected: b.protected,
      }));
    } catch (error) {
      handleApiError(error, `listBranches(${owner}/${repo})`);
    }
  }

  async compareCommits(
    owner: string,
    repo: string,
    base: string,
    head: string,
  ): Promise<CommitComparison> {
    logger.info('Comparing commits', { owner, repo, base, head });
    try {
      const { data } = await this.octokit.rest.repos.compareCommits({
        owner,
        repo,
        base,
        head,
      });
      return {
        aheadBy: data.ahead_by,
        behindBy: data.behind_by,
        status: data.status,
        totalCommits: data.total_commits,
        files: (data.files ?? []).map((f: OctokitCompareFile) => ({
          filename: f.filename,
          status: f.status,
          additions: f.additions,
          deletions: f.deletions,
          changes: f.changes,
          patch: f.patch,
        })),
      };
    } catch (error) {
      handleApiError(error, `compareCommits(${owner}/${repo} ${base}...${head})`);
    }
  }
}

/**
 * Factory function
 */
export function createGitHubClient(token: string): GitHubClient {
  return new GitHubClient(token);
}
