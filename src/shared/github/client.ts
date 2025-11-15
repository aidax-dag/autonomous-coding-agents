import { Octokit } from '@octokit/rest';
import {
  ErrorCode,
  GitHubError,
  GitHubRateLimitError,
  GitHubNotFoundError,
  GitHubAuthenticationError,
  GitHubValidationError,
} from '@/shared/errors/custom-errors';

/**
 * GitHub API Client
 *
 * Provides integration with GitHub API using Octokit.
 * Handles PR operations, reviews, file operations, and diffs.
 *
 * Feature: F1.7 - GitHub API Client
 */

/**
 * GitHub repository identifier
 */
export interface GitHubRepo {
  owner: string;
  repo: string;
}

/**
 * Pull request data
 */
export interface PullRequest {
  number: number;
  title: string;
  body: string;
  state: 'open' | 'closed';
  head: {
    ref: string;
    sha: string;
  };
  base: {
    ref: string;
    sha: string;
  };
  user: {
    login: string;
  };
  createdAt: string;
  updatedAt: string;
  mergedAt?: string;
  url: string;
}

/**
 * Pull request creation options
 */
export interface CreatePullRequestOptions {
  title: string;
  body: string;
  head: string; // Branch to merge from
  base: string; // Branch to merge into
  draft?: boolean;
}

/**
 * Pull request update options
 */
export interface UpdatePullRequestOptions {
  title?: string;
  body?: string;
  state?: 'open' | 'closed';
}

/**
 * Review comment
 */
export interface ReviewComment {
  id: number;
  body: string;
  user: {
    login: string;
  };
  path?: string;
  position?: number;
  line?: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Review data
 */
export interface Review {
  id: number;
  body: string;
  state: 'PENDING' | 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED';
  user: {
    login: string;
  };
  submittedAt?: string;
}

/**
 * Create review options
 */
export interface CreateReviewOptions {
  body: string;
  event: 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT';
  comments?: Array<{
    path: string;
    position?: number;
    body: string;
  }>;
}

/**
 * File content
 */
export interface FileContent {
  content: string;
  sha: string;
  path: string;
  encoding: 'base64' | 'utf-8';
}

/**
 * Create or update file options
 */
export interface CreateOrUpdateFileOptions {
  path: string;
  content: string;
  message: string;
  branch: string;
  sha?: string; // Required for updates
}

/**
 * Diff file
 */
export interface DiffFile {
  filename: string;
  status: 'added' | 'removed' | 'modified' | 'renamed';
  additions: number;
  deletions: number;
  changes: number;
  patch?: string;
  previousFilename?: string;
}

/**
 * Pull request diff
 */
export interface PullRequestDiff {
  files: DiffFile[];
  totalAdditions: number;
  totalDeletions: number;
  totalChanges: number;
}

/**
 * GitHub API Client
 */
export class GitHubClient {
  private octokit: Octokit;

  constructor(token: string) {
    if (!token) {
      throw new GitHubAuthenticationError('GitHub token is required');
    }

    this.octokit = new Octokit({
      auth: token,
    });
  }

  /**
   * Create a pull request
   */
  async createPullRequest(
    repo: GitHubRepo,
    options: CreatePullRequestOptions
  ): Promise<PullRequest> {
    try {
      const response = await this.octokit.pulls.create({
        owner: repo.owner,
        repo: repo.repo,
        title: options.title,
        body: options.body,
        head: options.head,
        base: options.base,
        draft: options.draft,
      });

      return this.mapPullRequest(response.data);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Get a pull request
   */
  async getPullRequest(repo: GitHubRepo, prNumber: number): Promise<PullRequest> {
    try {
      const response = await this.octokit.pulls.get({
        owner: repo.owner,
        repo: repo.repo,
        pull_number: prNumber,
      });

      return this.mapPullRequest(response.data);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Update a pull request
   */
  async updatePullRequest(
    repo: GitHubRepo,
    prNumber: number,
    options: UpdatePullRequestOptions
  ): Promise<PullRequest> {
    try {
      const response = await this.octokit.pulls.update({
        owner: repo.owner,
        repo: repo.repo,
        pull_number: prNumber,
        title: options.title,
        body: options.body,
        state: options.state,
      });

      return this.mapPullRequest(response.data);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * List pull requests
   */
  async listPullRequests(
    repo: GitHubRepo,
    options?: {
      state?: 'open' | 'closed' | 'all';
      head?: string;
      base?: string;
    }
  ): Promise<PullRequest[]> {
    try {
      const response = await this.octokit.pulls.list({
        owner: repo.owner,
        repo: repo.repo,
        state: options?.state || 'open',
        head: options?.head,
        base: options?.base,
      });

      return response.data.map((pr) => this.mapPullRequest(pr));
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Create a review on a pull request
   */
  async createReview(
    repo: GitHubRepo,
    prNumber: number,
    options: CreateReviewOptions
  ): Promise<Review> {
    try {
      const response = await this.octokit.pulls.createReview({
        owner: repo.owner,
        repo: repo.repo,
        pull_number: prNumber,
        body: options.body,
        event: options.event,
        comments: options.comments,
      });

      return this.mapReview(response.data);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Get a review
   */
  async getReview(repo: GitHubRepo, prNumber: number, reviewId: number): Promise<Review> {
    try {
      const response = await this.octokit.pulls.getReview({
        owner: repo.owner,
        repo: repo.repo,
        pull_number: prNumber,
        review_id: reviewId,
      });

      return this.mapReview(response.data);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * List reviews for a pull request
   */
  async listReviews(repo: GitHubRepo, prNumber: number): Promise<Review[]> {
    try {
      const response = await this.octokit.pulls.listReviews({
        owner: repo.owner,
        repo: repo.repo,
        pull_number: prNumber,
      });

      return response.data.map((review) => this.mapReview(review));
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * List review comments on a pull request
   */
  async listReviewComments(repo: GitHubRepo, prNumber: number): Promise<ReviewComment[]> {
    try {
      const response = await this.octokit.pulls.listReviewComments({
        owner: repo.owner,
        repo: repo.repo,
        pull_number: prNumber,
      });

      return response.data.map((comment) => this.mapReviewComment(comment));
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Get file content
   */
  async getFileContent(repo: GitHubRepo, path: string, ref?: string): Promise<FileContent> {
    try {
      const response = await this.octokit.repos.getContent({
        owner: repo.owner,
        repo: repo.repo,
        path,
        ref,
      });

      // Ensure we got a file, not a directory
      if (Array.isArray(response.data) || response.data.type !== 'file') {
        throw new GitHubValidationError(`Path ${path} is not a file`);
      }

      const fileData = response.data;

      return {
        content: fileData.content || '',
        sha: fileData.sha,
        path: fileData.path,
        encoding: (fileData.encoding as 'base64' | 'utf-8') || 'base64',
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Create or update a file
   */
  async createOrUpdateFile(
    repo: GitHubRepo,
    options: CreateOrUpdateFileOptions
  ): Promise<{ commit: { sha: string }; content: { sha: string } }> {
    try {
      const content = Buffer.from(options.content).toString('base64');

      const response = await this.octokit.repos.createOrUpdateFileContents({
        owner: repo.owner,
        repo: repo.repo,
        path: options.path,
        message: options.message,
        content,
        branch: options.branch,
        sha: options.sha,
      });

      return {
        commit: {
          sha: response.data.commit.sha || '',
        },
        content: {
          sha: response.data.content?.sha || '',
        },
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Get pull request diff
   */
  async getPullRequestDiff(repo: GitHubRepo, prNumber: number): Promise<PullRequestDiff> {
    try {
      const response = await this.octokit.pulls.listFiles({
        owner: repo.owner,
        repo: repo.repo,
        pull_number: prNumber,
      });

      const files: DiffFile[] = response.data.map((file) => ({
        filename: file.filename,
        status: file.status as 'added' | 'removed' | 'modified' | 'renamed',
        additions: file.additions,
        deletions: file.deletions,
        changes: file.changes,
        patch: file.patch,
        previousFilename: file.previous_filename,
      }));

      const totalAdditions = files.reduce((sum, file) => sum + file.additions, 0);
      const totalDeletions = files.reduce((sum, file) => sum + file.deletions, 0);
      const totalChanges = files.reduce((sum, file) => sum + file.changes, 0);

      return {
        files,
        totalAdditions,
        totalDeletions,
        totalChanges,
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Merge a pull request
   */
  async mergePullRequest(
    repo: GitHubRepo,
    prNumber: number,
    options?: {
      commitTitle?: string;
      commitMessage?: string;
      sha?: string;
      mergeMethod?: 'merge' | 'squash' | 'rebase';
    }
  ): Promise<{ merged: boolean; sha: string; message: string }> {
    try {
      const response = await this.octokit.pulls.merge({
        owner: repo.owner,
        repo: repo.repo,
        pull_number: prNumber,
        commit_title: options?.commitTitle,
        commit_message: options?.commitMessage,
        sha: options?.sha,
        merge_method: options?.mergeMethod || 'merge',
      });

      return {
        merged: true,
        sha: response.data.sha,
        message: response.data.message,
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Map Octokit pull request to our format
   */
  private mapPullRequest(pr: any): PullRequest {
    return {
      number: pr.number,
      title: pr.title,
      body: pr.body || '',
      state: pr.state,
      head: {
        ref: pr.head.ref,
        sha: pr.head.sha,
      },
      base: {
        ref: pr.base.ref,
        sha: pr.base.sha,
      },
      user: {
        login: pr.user.login,
      },
      createdAt: pr.created_at,
      updatedAt: pr.updated_at,
      mergedAt: pr.merged_at,
      url: pr.html_url,
    };
  }

  /**
   * Map Octokit review to our format
   */
  private mapReview(review: any): Review {
    return {
      id: review.id,
      body: review.body || '',
      state: review.state,
      user: {
        login: review.user.login,
      },
      submittedAt: review.submitted_at,
    };
  }

  /**
   * Map Octokit review comment to our format
   */
  private mapReviewComment(comment: any): ReviewComment {
    return {
      id: comment.id,
      body: comment.body,
      user: {
        login: comment.user.login,
      },
      path: comment.path,
      position: comment.position,
      line: comment.line,
      createdAt: comment.created_at,
      updatedAt: comment.updated_at,
    };
  }

  /**
   * Handle GitHub API errors
   */
  private handleError(error: unknown): Error {
    // If error is already a GitHubError, return it as-is
    if (error instanceof GitHubError) {
      return error;
    }

    if (error instanceof Error) {
      const message = error.message;

      // Check for specific error patterns
      if (message.includes('rate limit') || message.includes('403')) {
        return new GitHubRateLimitError(
          `GitHub API rate limit exceeded: ${message}`,
          undefined,
          {
            originalError: message,
          }
        );
      }

      if (message.includes('Not Found') || message.includes('404')) {
        return new GitHubNotFoundError(`GitHub resource not found: ${message}`, {
          originalError: message,
        });
      }

      if (
        message.includes('Bad credentials') ||
        message.includes('401') ||
        message.includes('Unauthorized')
      ) {
        return new GitHubAuthenticationError(`GitHub authentication failed: ${message}`, {
          originalError: message,
        });
      }

      if (message.includes('Validation Failed') || message.includes('422')) {
        return new GitHubValidationError(`GitHub validation failed: ${message}`, {
          originalError: message,
        });
      }

      // General GitHub error
      return new GitHubError(
        `GitHub API error: ${message}`,
        undefined,
        ErrorCode.GITHUB_API_ERROR,
        false,
        {
          originalError: message,
        }
      );
    }

    return new GitHubError(
      `Unexpected error: ${String(error)}`,
      undefined,
      ErrorCode.GITHUB_API_ERROR,
      false
    );
  }
}
