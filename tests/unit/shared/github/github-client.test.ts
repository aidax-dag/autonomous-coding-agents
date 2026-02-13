/**
 * GitHub Client Tests
 */

import { GitHubClient, createGitHubClient } from '../../../../src/shared/github/github-client';
import {
  GitHubAuthenticationError,
  GitHubRateLimitError,
  GitHubNotFoundError,
  GitHubValidationError,
  GitHubError,
} from '../../../../src/shared/errors/custom-errors';

// ============================================================================
// Mock Octokit
// ============================================================================

const mockPullsCreate = jest.fn();
const mockPullsGet = jest.fn();
const mockPullsList = jest.fn();
const mockPullsUpdate = jest.fn();
const mockPullsMerge = jest.fn();
const mockPullsListFiles = jest.fn();
const mockPullsCreateReview = jest.fn();
const mockIssuesCreate = jest.fn();
const mockIssuesGet = jest.fn();
const mockIssuesUpdate = jest.fn();
const mockIssuesListComments = jest.fn();
const mockIssuesCreateComment = jest.fn();
const mockReposGet = jest.fn();
const mockReposGetBranch = jest.fn();
const mockReposListBranches = jest.fn();
const mockReposCompareCommits = jest.fn();

jest.mock('octokit', () => ({
  Octokit: jest.fn().mockImplementation(() => ({
    rest: {
      pulls: {
        create: mockPullsCreate,
        get: mockPullsGet,
        list: mockPullsList,
        update: mockPullsUpdate,
        merge: mockPullsMerge,
        listFiles: mockPullsListFiles,
        createReview: mockPullsCreateReview,
      },
      issues: {
        create: mockIssuesCreate,
        get: mockIssuesGet,
        update: mockIssuesUpdate,
        listComments: mockIssuesListComments,
        createComment: mockIssuesCreateComment,
      },
      repos: {
        get: mockReposGet,
        getBranch: mockReposGetBranch,
        listBranches: mockReposListBranches,
        compareCommits: mockReposCompareCommits,
      },
    },
  })),
}));

jest.mock('../../../../src/shared/logging/logger', () => ({
  createAgentLogger: () => ({
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

// ============================================================================
// Helpers
// ============================================================================

function makeOctokitPR(overrides: Record<string, unknown> = {}) {
  return {
    number: 1,
    title: 'Test PR',
    body: 'PR body',
    state: 'open',
    html_url: 'https://github.com/owner/repo/pull/1',
    head: { ref: 'feature', sha: 'abc123' },
    base: { ref: 'main' },
    draft: false,
    merged: false,
    mergeable: true,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:01:00Z',
    ...overrides,
  };
}

function makeOctokitIssue(overrides: Record<string, unknown> = {}) {
  return {
    number: 10,
    title: 'Test Issue',
    body: 'Issue body',
    state: 'open',
    html_url: 'https://github.com/owner/repo/issues/10',
    labels: [{ name: 'bug' }],
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:01:00Z',
    ...overrides,
  };
}

function makeOctokitRepo(overrides: Record<string, unknown> = {}) {
  return {
    name: 'repo',
    full_name: 'owner/repo',
    description: 'A test repo',
    default_branch: 'main',
    private: false,
    html_url: 'https://github.com/owner/repo',
    ...overrides,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('GitHubClient', () => {
  let client: GitHubClient;

  beforeEach(() => {
    jest.clearAllMocks();
    client = new GitHubClient('ghp_test_token');
  });

  // ==========================================================================
  // Pull Requests
  // ==========================================================================

  describe('createPullRequest', () => {
    it('should create a PR and return mapped result', async () => {
      mockPullsCreate.mockResolvedValue({ data: makeOctokitPR() });

      const pr = await client.createPullRequest('owner', 'repo', {
        title: 'Test PR',
        body: 'PR body',
        head: 'feature',
        base: 'main',
      });

      expect(pr.number).toBe(1);
      expect(pr.title).toBe('Test PR');
      expect(pr.htmlUrl).toBe('https://github.com/owner/repo/pull/1');
      expect(pr.head.ref).toBe('feature');
      expect(pr.base.ref).toBe('main');
      expect(pr.draft).toBe(false);
      expect(mockPullsCreate).toHaveBeenCalledWith(
        expect.objectContaining({ owner: 'owner', repo: 'repo', title: 'Test PR' }),
      );
    });

    it('should create a draft PR', async () => {
      mockPullsCreate.mockResolvedValue({ data: makeOctokitPR({ draft: true }) });

      const pr = await client.createPullRequest('owner', 'repo', {
        title: 'Draft',
        head: 'feature',
        base: 'main',
        draft: true,
      });

      expect(pr.draft).toBe(true);
      expect(mockPullsCreate).toHaveBeenCalledWith(
        expect.objectContaining({ draft: true }),
      );
    });
  });

  describe('getPullRequest', () => {
    it('should get a PR by number', async () => {
      mockPullsGet.mockResolvedValue({ data: makeOctokitPR({ number: 42 }) });

      const pr = await client.getPullRequest('owner', 'repo', 42);

      expect(pr.number).toBe(42);
      expect(mockPullsGet).toHaveBeenCalledWith(
        expect.objectContaining({ owner: 'owner', repo: 'repo', pull_number: 42 }),
      );
    });
  });

  describe('listPullRequests', () => {
    it('should list PRs with default state', async () => {
      mockPullsList.mockResolvedValue({ data: [makeOctokitPR(), makeOctokitPR({ number: 2 })] });

      const prs = await client.listPullRequests('owner', 'repo');

      expect(prs).toHaveLength(2);
      expect(mockPullsList).toHaveBeenCalledWith(
        expect.objectContaining({ state: 'open' }),
      );
    });

    it('should list PRs with specified state', async () => {
      mockPullsList.mockResolvedValue({ data: [] });

      await client.listPullRequests('owner', 'repo', 'closed');

      expect(mockPullsList).toHaveBeenCalledWith(
        expect.objectContaining({ state: 'closed' }),
      );
    });
  });

  describe('updatePullRequest', () => {
    it('should update a PR', async () => {
      mockPullsUpdate.mockResolvedValue({
        data: makeOctokitPR({ title: 'Updated', state: 'closed' }),
      });

      const pr = await client.updatePullRequest('owner', 'repo', 1, {
        title: 'Updated',
        state: 'closed',
      });

      expect(pr.title).toBe('Updated');
      expect(mockPullsUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          pull_number: 1,
          title: 'Updated',
          state: 'closed',
        }),
      );
    });
  });

  describe('mergePullRequest', () => {
    it('should merge with default method', async () => {
      mockPullsMerge.mockResolvedValue({
        data: { merged: true, message: 'Merged', sha: 'def456' },
      });

      const result = await client.mergePullRequest('owner', 'repo', 1);

      expect(result.merged).toBe(true);
      expect(result.sha).toBe('def456');
      expect(mockPullsMerge).toHaveBeenCalledWith(
        expect.objectContaining({ merge_method: 'merge' }),
      );
    });

    it('should merge with squash method', async () => {
      mockPullsMerge.mockResolvedValue({
        data: { merged: true, message: 'Squashed', sha: 'ghi789' },
      });

      await client.mergePullRequest('owner', 'repo', 1, 'squash');

      expect(mockPullsMerge).toHaveBeenCalledWith(
        expect.objectContaining({ merge_method: 'squash' }),
      );
    });
  });

  describe('closePullRequest', () => {
    it('should delegate to updatePullRequest with closed state', async () => {
      mockPullsUpdate.mockResolvedValue({
        data: makeOctokitPR({ state: 'closed' }),
      });

      const pr = await client.closePullRequest('owner', 'repo', 1);

      expect(pr.state).toBe('closed');
      expect(mockPullsUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ state: 'closed' }),
      );
    });
  });

  describe('listPullRequestFiles', () => {
    it('should list files in a PR', async () => {
      mockPullsListFiles.mockResolvedValue({
        data: [
          {
            filename: 'src/foo.ts',
            status: 'modified',
            additions: 10,
            deletions: 2,
            changes: 12,
            patch: '@@ -1 +1 @@',
          },
        ],
      });

      const files = await client.listPullRequestFiles('owner', 'repo', 1);

      expect(files).toHaveLength(1);
      expect(files[0].filename).toBe('src/foo.ts');
      expect(files[0].additions).toBe(10);
      expect(files[0].patch).toBe('@@ -1 +1 @@');
    });
  });

  describe('createPullRequestComment', () => {
    it('should create a comment using issues API', async () => {
      mockIssuesCreateComment.mockResolvedValue({
        data: {
          id: 100,
          body: 'Nice work!',
          user: { login: 'reviewer' },
          created_at: '2025-01-01T00:00:00Z',
        },
      });

      const comment = await client.createPullRequestComment('owner', 'repo', 1, 'Nice work!');

      expect(comment.id).toBe(100);
      expect(comment.body).toBe('Nice work!');
      expect(comment.user).toBe('reviewer');
      expect(mockIssuesCreateComment).toHaveBeenCalledWith(
        expect.objectContaining({ issue_number: 1, body: 'Nice work!' }),
      );
    });
  });

  describe('createPullRequestReview', () => {
    it('should create a review', async () => {
      mockPullsCreateReview.mockResolvedValue({
        data: { id: 200, state: 'APPROVED' },
      });

      const review = await client.createPullRequestReview('owner', 'repo', 1, {
        event: 'APPROVE',
        body: 'LGTM',
      });

      expect(review.id).toBe(200);
      expect(review.state).toBe('APPROVED');
      expect(mockPullsCreateReview).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'APPROVE', body: 'LGTM' }),
      );
    });

    it('should create a review with inline comments', async () => {
      mockPullsCreateReview.mockResolvedValue({
        data: { id: 201, state: 'CHANGES_REQUESTED' },
      });

      const review = await client.createPullRequestReview('owner', 'repo', 1, {
        event: 'REQUEST_CHANGES',
        comments: [{ path: 'src/foo.ts', position: 5, body: 'Fix this' }],
      });

      expect(review.state).toBe('CHANGES_REQUESTED');
    });
  });

  // ==========================================================================
  // Issues
  // ==========================================================================

  describe('createIssue', () => {
    it('should create an issue', async () => {
      mockIssuesCreate.mockResolvedValue({ data: makeOctokitIssue() });

      const issue = await client.createIssue('owner', 'repo', {
        title: 'Test Issue',
        body: 'Issue body',
        labels: ['bug'],
      });

      expect(issue.number).toBe(10);
      expect(issue.title).toBe('Test Issue');
      expect(issue.labels).toEqual(['bug']);
      expect(mockIssuesCreate).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Test Issue', labels: ['bug'] }),
      );
    });
  });

  describe('getIssue', () => {
    it('should get an issue by number', async () => {
      mockIssuesGet.mockResolvedValue({ data: makeOctokitIssue({ number: 20 }) });

      const issue = await client.getIssue('owner', 'repo', 20);

      expect(issue.number).toBe(20);
      expect(mockIssuesGet).toHaveBeenCalledWith(
        expect.objectContaining({ issue_number: 20 }),
      );
    });
  });

  describe('updateIssue', () => {
    it('should update an issue', async () => {
      mockIssuesUpdate.mockResolvedValue({
        data: makeOctokitIssue({ state: 'closed' }),
      });

      const issue = await client.updateIssue('owner', 'repo', 10, {
        state: 'closed',
      });

      expect(issue.state).toBe('closed');
      expect(mockIssuesUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ issue_number: 10, state: 'closed' }),
      );
    });
  });

  describe('listIssueComments', () => {
    it('should list comments on an issue', async () => {
      mockIssuesListComments.mockResolvedValue({
        data: [
          {
            id: 50,
            body: 'Comment 1',
            user: { login: 'user1' },
            created_at: '2025-01-01T00:00:00Z',
          },
          {
            id: 51,
            body: 'Comment 2',
            user: { login: 'user2' },
            created_at: '2025-01-01T00:01:00Z',
          },
        ],
      });

      const comments = await client.listIssueComments('owner', 'repo', 10);

      expect(comments).toHaveLength(2);
      expect(comments[0].user).toBe('user1');
      expect(comments[1].body).toBe('Comment 2');
    });
  });

  describe('createIssueComment', () => {
    it('should create an issue comment', async () => {
      mockIssuesCreateComment.mockResolvedValue({
        data: {
          id: 60,
          body: 'New comment',
          user: { login: 'commenter' },
          created_at: '2025-01-01T00:00:00Z',
        },
      });

      const comment = await client.createIssueComment('owner', 'repo', 10, 'New comment');

      expect(comment.id).toBe(60);
      expect(comment.body).toBe('New comment');
      expect(comment.user).toBe('commenter');
    });
  });

  // ==========================================================================
  // Repository
  // ==========================================================================

  describe('getRepository', () => {
    it('should get repository info', async () => {
      mockReposGet.mockResolvedValue({ data: makeOctokitRepo() });

      const repo = await client.getRepository('owner', 'repo');

      expect(repo.name).toBe('repo');
      expect(repo.fullName).toBe('owner/repo');
      expect(repo.defaultBranch).toBe('main');
      expect(repo.private).toBe(false);
    });
  });

  describe('getBranch', () => {
    it('should get branch info', async () => {
      mockReposGetBranch.mockResolvedValue({
        data: {
          name: 'main',
          commit: { sha: 'sha123' },
          protected: true,
        },
      });

      const branch = await client.getBranch('owner', 'repo', 'main');

      expect(branch.name).toBe('main');
      expect(branch.sha).toBe('sha123');
      expect(branch.protected).toBe(true);
    });
  });

  describe('listBranches', () => {
    it('should list branches', async () => {
      mockReposListBranches.mockResolvedValue({
        data: [
          { name: 'main', commit: { sha: 'a' }, protected: true },
          { name: 'dev', commit: { sha: 'b' }, protected: false },
        ],
      });

      const branches = await client.listBranches('owner', 'repo');

      expect(branches).toHaveLength(2);
      expect(branches[0].name).toBe('main');
      expect(branches[1].protected).toBe(false);
    });
  });

  describe('compareCommits', () => {
    it('should compare two commits', async () => {
      mockReposCompareCommits.mockResolvedValue({
        data: {
          ahead_by: 3,
          behind_by: 1,
          status: 'ahead',
          total_commits: 3,
          files: [
            {
              filename: 'src/bar.ts',
              status: 'added',
              additions: 20,
              deletions: 0,
              changes: 20,
              patch: '@@ +1 @@',
            },
          ],
        },
      });

      const comparison = await client.compareCommits('owner', 'repo', 'main', 'feature');

      expect(comparison.aheadBy).toBe(3);
      expect(comparison.behindBy).toBe(1);
      expect(comparison.status).toBe('ahead');
      expect(comparison.totalCommits).toBe(3);
      expect(comparison.files).toHaveLength(1);
      expect(comparison.files[0].filename).toBe('src/bar.ts');
    });

    it('should handle empty files array', async () => {
      mockReposCompareCommits.mockResolvedValue({
        data: {
          ahead_by: 0,
          behind_by: 0,
          status: 'identical',
          total_commits: 0,
          files: undefined,
        },
      });

      const comparison = await client.compareCommits('owner', 'repo', 'main', 'main');

      expect(comparison.files).toEqual([]);
    });
  });

  // ==========================================================================
  // Error Handling
  // ==========================================================================

  describe('error handling', () => {
    it('should throw GitHubAuthenticationError on 401', async () => {
      mockPullsGet.mockRejectedValue({ status: 401, message: 'Bad credentials' });

      await expect(client.getPullRequest('owner', 'repo', 1)).rejects.toThrow(
        GitHubAuthenticationError,
      );
    });

    it('should throw GitHubRateLimitError on 403', async () => {
      mockPullsGet.mockRejectedValue({
        status: 403,
        message: 'Rate limit',
        response: { headers: { 'x-ratelimit-reset': '1700000000' } },
      });

      await expect(client.getPullRequest('owner', 'repo', 1)).rejects.toThrow(
        GitHubRateLimitError,
      );
    });

    it('should throw GitHubRateLimitError on 429', async () => {
      mockPullsGet.mockRejectedValue({ status: 429, message: 'Too many requests' });

      await expect(client.getPullRequest('owner', 'repo', 1)).rejects.toThrow(
        GitHubRateLimitError,
      );
    });

    it('should throw GitHubNotFoundError on 404', async () => {
      mockReposGet.mockRejectedValue({ status: 404, message: 'Not Found' });

      await expect(client.getRepository('owner', 'repo')).rejects.toThrow(
        GitHubNotFoundError,
      );
    });

    it('should throw GitHubValidationError on 422', async () => {
      mockPullsCreate.mockRejectedValue({ status: 422, message: 'Validation Failed' });

      await expect(
        client.createPullRequest('owner', 'repo', {
          title: '',
          head: 'feature',
          base: 'main',
        }),
      ).rejects.toThrow(GitHubValidationError);
    });

    it('should throw retryable GitHubError on 500', async () => {
      mockReposGet.mockRejectedValue({ status: 500, message: 'Server Error' });

      try {
        await client.getRepository('owner', 'repo');
        fail('Expected error');
      } catch (err) {
        expect(err).toBeInstanceOf(GitHubError);
        expect((err as GitHubError).retryable).toBe(true);
      }
    });

    it('should throw non-retryable GitHubError on unknown status', async () => {
      mockReposGet.mockRejectedValue(new Error('Network failure'));

      try {
        await client.getRepository('owner', 'repo');
        fail('Expected error');
      } catch (err) {
        expect(err).toBeInstanceOf(GitHubError);
        expect((err as GitHubError).retryable).toBe(false);
      }
    });

    it('should re-throw existing GitHubError instances', async () => {
      const original = new GitHubNotFoundError('test-resource');
      mockReposGet.mockRejectedValue(original);

      await expect(client.getRepository('owner', 'repo')).rejects.toBe(original);
    });
  });

  // ==========================================================================
  // Factory
  // ==========================================================================

  describe('createGitHubClient', () => {
    it('should create a GitHubClient instance', () => {
      const instance = createGitHubClient('ghp_token');
      expect(instance).toBeInstanceOf(GitHubClient);
    });
  });

  // ==========================================================================
  // Mapping edge cases
  // ==========================================================================

  describe('mapping edge cases', () => {
    it('should handle null body in PR', async () => {
      mockPullsGet.mockResolvedValue({ data: makeOctokitPR({ body: null }) });

      const pr = await client.getPullRequest('owner', 'repo', 1);
      expect(pr.body).toBeNull();
    });

    it('should handle string labels in issues', async () => {
      mockIssuesGet.mockResolvedValue({
        data: makeOctokitIssue({ labels: ['bug', 'urgent'] }),
      });

      const issue = await client.getIssue('owner', 'repo', 10);
      expect(issue.labels).toEqual(['bug', 'urgent']);
    });

    it('should handle null user in comment', async () => {
      mockIssuesCreateComment.mockResolvedValue({
        data: {
          id: 70,
          body: 'Bot comment',
          user: null,
          created_at: '2025-01-01T00:00:00Z',
        },
      });

      const comment = await client.createIssueComment('owner', 'repo', 10, 'Bot comment');
      expect(comment.user).toBe('');
    });

    it('should handle missing draft/merged fields in PR', async () => {
      mockPullsGet.mockResolvedValue({
        data: makeOctokitPR({ draft: undefined, merged: undefined, mergeable: undefined }),
      });

      const pr = await client.getPullRequest('owner', 'repo', 1);
      expect(pr.draft).toBe(false);
      expect(pr.merged).toBe(false);
      expect(pr.mergeable).toBeNull();
    });
  });
});
