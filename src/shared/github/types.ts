/**
 * GitHub API Domain Types
 *
 * Type definitions for GitHub Pull Request, Issue, and Repository operations.
 *
 * @module shared/github/types
 */

// =============================================================================
// Pull Request
// =============================================================================

export interface PullRequest {
  number: number;
  title: string;
  body: string | null;
  state: 'open' | 'closed';
  htmlUrl: string;
  head: { ref: string; sha: string };
  base: { ref: string };
  draft: boolean;
  merged: boolean;
  mergeable: boolean | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePullRequestInput {
  title: string;
  body?: string;
  head: string;
  base: string;
  draft?: boolean;
}

export interface UpdatePullRequestInput {
  title?: string;
  body?: string;
  state?: 'open' | 'closed';
  base?: string;
}

export interface PullRequestFile {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  changes: number;
  patch?: string;
}

export interface PullRequestComment {
  id: number;
  body: string;
  user: string;
  createdAt: string;
}

export type MergeMethod = 'merge' | 'squash' | 'rebase';

export type ReviewEvent = 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT';

export interface CreateReviewInput {
  event: ReviewEvent;
  body?: string;
  comments?: Array<{ path: string; position: number; body: string }>;
}

// =============================================================================
// Issue
// =============================================================================

export interface Issue {
  number: number;
  title: string;
  body: string | null;
  state: 'open' | 'closed';
  htmlUrl: string;
  labels: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateIssueInput {
  title: string;
  body?: string;
  labels?: string[];
  assignees?: string[];
}

export interface UpdateIssueInput {
  title?: string;
  body?: string;
  state?: 'open' | 'closed';
  labels?: string[];
}

export interface IssueComment {
  id: number;
  body: string;
  user: string;
  createdAt: string;
}

// =============================================================================
// Repository
// =============================================================================

export interface Repository {
  name: string;
  fullName: string;
  description: string | null;
  defaultBranch: string;
  private: boolean;
  htmlUrl: string;
}

export interface Branch {
  name: string;
  sha: string;
  protected: boolean;
}

export interface CommitComparison {
  aheadBy: number;
  behindBy: number;
  status: string;
  totalCommits: number;
  files: PullRequestFile[];
}
