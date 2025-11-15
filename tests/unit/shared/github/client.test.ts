import { GitHubClient } from '@/shared/github/client';
import {
  GitHubError,
  GitHubRateLimitError,
  GitHubNotFoundError,
  GitHubAuthenticationError,
  GitHubValidationError,
} from '@/shared/errors/custom-errors';

/**
 * GitHub Client Tests
 *
 * Tests GitHub API integration.
 * Note: Uses mocked Octokit to avoid actual API calls.
 *
 * Feature: F1.7 - GitHub API Client
 */

// Mock Octokit
jest.mock('@octokit/rest', () => {
  return {
    Octokit: jest.fn().mockImplementation(() => {
      return {
        pulls: {
          create: jest.fn(),
          get: jest.fn(),
          update: jest.fn(),
          list: jest.fn(),
          createReview: jest.fn(),
          getReview: jest.fn(),
          listReviews: jest.fn(),
          listReviewComments: jest.fn(),
          listFiles: jest.fn(),
        },
        repos: {
          getContent: jest.fn(),
          createOrUpdateFileContents: jest.fn(),
        },
      };
    }),
  };
});

describe('GitHubClient', () => {
  let client: GitHubClient;
  let mockOctokit: any;

  beforeEach(() => {
    jest.clearAllMocks();
    client = new GitHubClient('test-token');
    mockOctokit = (client as any).octokit;
  });

  describe('Constructor', () => {
    it('should throw error when token is missing', () => {
      expect(() => new GitHubClient('')).toThrow(GitHubAuthenticationError);
      expect(() => new GitHubClient('')).toThrow('GitHub token is required');
    });

    it('should create client with valid token', () => {
      expect(client).toBeInstanceOf(GitHubClient);
    });
  });

  describe('Pull Request Operations', () => {
    const repo = { owner: 'test-owner', repo: 'test-repo' };

    describe('createPullRequest', () => {
      it('should create a pull request', async () => {
        const mockPR = {
          number: 1,
          title: 'Test PR',
          body: 'Test body',
          state: 'open',
          head: { ref: 'feature', sha: 'abc123' },
          base: { ref: 'main', sha: 'def456' },
          user: { login: 'test-user' },
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          html_url: 'https://github.com/test/pr/1',
        };

        mockOctokit.pulls.create.mockResolvedValue({ data: mockPR });

        const result = await client.createPullRequest(repo, {
          title: 'Test PR',
          body: 'Test body',
          head: 'feature',
          base: 'main',
        });

        expect(result).toEqual({
          number: 1,
          title: 'Test PR',
          body: 'Test body',
          state: 'open',
          head: { ref: 'feature', sha: 'abc123' },
          base: { ref: 'main', sha: 'def456' },
          user: { login: 'test-user' },
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          mergedAt: undefined,
          url: 'https://github.com/test/pr/1',
        });

        expect(mockOctokit.pulls.create).toHaveBeenCalledWith({
          owner: 'test-owner',
          repo: 'test-repo',
          title: 'Test PR',
          body: 'Test body',
          head: 'feature',
          base: 'main',
          draft: undefined,
        });
      });

      it('should create a draft pull request', async () => {
        const mockPR = {
          number: 1,
          title: 'Draft PR',
          body: 'Draft body',
          state: 'open',
          head: { ref: 'feature', sha: 'abc123' },
          base: { ref: 'main', sha: 'def456' },
          user: { login: 'test-user' },
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          html_url: 'https://github.com/test/pr/1',
        };

        mockOctokit.pulls.create.mockResolvedValue({ data: mockPR });

        await client.createPullRequest(repo, {
          title: 'Draft PR',
          body: 'Draft body',
          head: 'feature',
          base: 'main',
          draft: true,
        });

        expect(mockOctokit.pulls.create).toHaveBeenCalledWith(
          expect.objectContaining({
            draft: true,
          })
        );
      });
    });

    describe('getPullRequest', () => {
      it('should get a pull request', async () => {
        const mockPR = {
          number: 1,
          title: 'Test PR',
          body: 'Test body',
          state: 'open',
          head: { ref: 'feature', sha: 'abc123' },
          base: { ref: 'main', sha: 'def456' },
          user: { login: 'test-user' },
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          merged_at: '2024-01-02T00:00:00Z',
          html_url: 'https://github.com/test/pr/1',
        };

        mockOctokit.pulls.get.mockResolvedValue({ data: mockPR });

        const result = await client.getPullRequest(repo, 1);

        expect(result.number).toBe(1);
        expect(result.mergedAt).toBe('2024-01-02T00:00:00Z');
        expect(mockOctokit.pulls.get).toHaveBeenCalledWith({
          owner: 'test-owner',
          repo: 'test-repo',
          pull_number: 1,
        });
      });
    });

    describe('updatePullRequest', () => {
      it('should update a pull request', async () => {
        const mockPR = {
          number: 1,
          title: 'Updated PR',
          body: 'Updated body',
          state: 'open',
          head: { ref: 'feature', sha: 'abc123' },
          base: { ref: 'main', sha: 'def456' },
          user: { login: 'test-user' },
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T01:00:00Z',
          html_url: 'https://github.com/test/pr/1',
        };

        mockOctokit.pulls.update.mockResolvedValue({ data: mockPR });

        const result = await client.updatePullRequest(repo, 1, {
          title: 'Updated PR',
          body: 'Updated body',
        });

        expect(result.title).toBe('Updated PR');
        expect(result.body).toBe('Updated body');
        expect(mockOctokit.pulls.update).toHaveBeenCalledWith({
          owner: 'test-owner',
          repo: 'test-repo',
          pull_number: 1,
          title: 'Updated PR',
          body: 'Updated body',
          state: undefined,
        });
      });

      it('should close a pull request', async () => {
        const mockPR = {
          number: 1,
          title: 'Test PR',
          body: 'Test body',
          state: 'closed',
          head: { ref: 'feature', sha: 'abc123' },
          base: { ref: 'main', sha: 'def456' },
          user: { login: 'test-user' },
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T01:00:00Z',
          html_url: 'https://github.com/test/pr/1',
        };

        mockOctokit.pulls.update.mockResolvedValue({ data: mockPR });

        const result = await client.updatePullRequest(repo, 1, {
          state: 'closed',
        });

        expect(result.state).toBe('closed');
      });
    });

    describe('listPullRequests', () => {
      it('should list open pull requests', async () => {
        const mockPRs = [
          {
            number: 1,
            title: 'PR 1',
            body: 'Body 1',
            state: 'open',
            head: { ref: 'feature-1', sha: 'abc123' },
            base: { ref: 'main', sha: 'def456' },
            user: { login: 'user1' },
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z',
            html_url: 'https://github.com/test/pr/1',
          },
          {
            number: 2,
            title: 'PR 2',
            body: 'Body 2',
            state: 'open',
            head: { ref: 'feature-2', sha: 'ghi789' },
            base: { ref: 'main', sha: 'def456' },
            user: { login: 'user2' },
            created_at: '2024-01-02T00:00:00Z',
            updated_at: '2024-01-02T00:00:00Z',
            html_url: 'https://github.com/test/pr/2',
          },
        ];

        mockOctokit.pulls.list.mockResolvedValue({ data: mockPRs });

        const result = await client.listPullRequests(repo);

        expect(result).toHaveLength(2);
        expect(result[0].number).toBe(1);
        expect(result[1].number).toBe(2);
        expect(mockOctokit.pulls.list).toHaveBeenCalledWith({
          owner: 'test-owner',
          repo: 'test-repo',
          state: 'open',
          head: undefined,
          base: undefined,
        });
      });

      it('should filter pull requests by state', async () => {
        mockOctokit.pulls.list.mockResolvedValue({ data: [] });

        await client.listPullRequests(repo, { state: 'closed' });

        expect(mockOctokit.pulls.list).toHaveBeenCalledWith(
          expect.objectContaining({
            state: 'closed',
          })
        );
      });

      it('should filter pull requests by head and base', async () => {
        mockOctokit.pulls.list.mockResolvedValue({ data: [] });

        await client.listPullRequests(repo, {
          head: 'feature-branch',
          base: 'main',
        });

        expect(mockOctokit.pulls.list).toHaveBeenCalledWith(
          expect.objectContaining({
            head: 'feature-branch',
            base: 'main',
          })
        );
      });
    });
  });

  describe('Review Operations', () => {
    const repo = { owner: 'test-owner', repo: 'test-repo' };

    describe('createReview', () => {
      it('should create an approval review', async () => {
        const mockReview = {
          id: 1,
          body: 'LGTM',
          state: 'APPROVED',
          user: { login: 'reviewer' },
          submitted_at: '2024-01-01T00:00:00Z',
        };

        mockOctokit.pulls.createReview.mockResolvedValue({ data: mockReview });

        const result = await client.createReview(repo, 1, {
          body: 'LGTM',
          event: 'APPROVE',
        });

        expect(result).toEqual({
          id: 1,
          body: 'LGTM',
          state: 'APPROVED',
          user: { login: 'reviewer' },
          submittedAt: '2024-01-01T00:00:00Z',
        });

        expect(mockOctokit.pulls.createReview).toHaveBeenCalledWith({
          owner: 'test-owner',
          repo: 'test-repo',
          pull_number: 1,
          body: 'LGTM',
          event: 'APPROVE',
          comments: undefined,
        });
      });

      it('should create a review with comments', async () => {
        const mockReview = {
          id: 1,
          body: 'Some issues found',
          state: 'CHANGES_REQUESTED',
          user: { login: 'reviewer' },
          submitted_at: '2024-01-01T00:00:00Z',
        };

        mockOctokit.pulls.createReview.mockResolvedValue({ data: mockReview });

        await client.createReview(repo, 1, {
          body: 'Some issues found',
          event: 'REQUEST_CHANGES',
          comments: [
            {
              path: 'src/index.ts',
              position: 10,
              body: 'Fix this',
            },
          ],
        });

        expect(mockOctokit.pulls.createReview).toHaveBeenCalledWith(
          expect.objectContaining({
            comments: [
              {
                path: 'src/index.ts',
                position: 10,
                body: 'Fix this',
              },
            ],
          })
        );
      });
    });

    describe('getReview', () => {
      it('should get a review', async () => {
        const mockReview = {
          id: 1,
          body: 'Review body',
          state: 'COMMENTED',
          user: { login: 'reviewer' },
          submitted_at: '2024-01-01T00:00:00Z',
        };

        mockOctokit.pulls.getReview.mockResolvedValue({ data: mockReview });

        const result = await client.getReview(repo, 1, 1);

        expect(result.id).toBe(1);
        expect(result.state).toBe('COMMENTED');
        expect(mockOctokit.pulls.getReview).toHaveBeenCalledWith({
          owner: 'test-owner',
          repo: 'test-repo',
          pull_number: 1,
          review_id: 1,
        });
      });
    });

    describe('listReviews', () => {
      it('should list reviews', async () => {
        const mockReviews = [
          {
            id: 1,
            body: 'Review 1',
            state: 'APPROVED',
            user: { login: 'reviewer1' },
            submitted_at: '2024-01-01T00:00:00Z',
          },
          {
            id: 2,
            body: 'Review 2',
            state: 'CHANGES_REQUESTED',
            user: { login: 'reviewer2' },
            submitted_at: '2024-01-02T00:00:00Z',
          },
        ];

        mockOctokit.pulls.listReviews.mockResolvedValue({ data: mockReviews });

        const result = await client.listReviews(repo, 1);

        expect(result).toHaveLength(2);
        expect(result[0].state).toBe('APPROVED');
        expect(result[1].state).toBe('CHANGES_REQUESTED');
      });
    });

    describe('listReviewComments', () => {
      it('should list review comments', async () => {
        const mockComments = [
          {
            id: 1,
            body: 'Comment 1',
            user: { login: 'user1' },
            path: 'src/index.ts',
            position: 10,
            line: 5,
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z',
          },
          {
            id: 2,
            body: 'Comment 2',
            user: { login: 'user2' },
            path: 'src/utils.ts',
            position: 20,
            line: 15,
            created_at: '2024-01-02T00:00:00Z',
            updated_at: '2024-01-02T00:00:00Z',
          },
        ];

        mockOctokit.pulls.listReviewComments.mockResolvedValue({ data: mockComments });

        const result = await client.listReviewComments(repo, 1);

        expect(result).toHaveLength(2);
        expect(result[0].path).toBe('src/index.ts');
        expect(result[1].path).toBe('src/utils.ts');
      });
    });
  });

  describe('File Operations', () => {
    const repo = { owner: 'test-owner', repo: 'test-repo' };

    describe('getFileContent', () => {
      it('should get file content', async () => {
        const mockFile = {
          type: 'file',
          content: Buffer.from('Hello World').toString('base64'),
          sha: 'abc123',
          path: 'README.md',
          encoding: 'base64',
        };

        mockOctokit.repos.getContent.mockResolvedValue({ data: mockFile });

        const result = await client.getFileContent(repo, 'README.md');

        expect(result).toEqual({
          content: mockFile.content,
          sha: 'abc123',
          path: 'README.md',
          encoding: 'base64',
        });

        expect(mockOctokit.repos.getContent).toHaveBeenCalledWith({
          owner: 'test-owner',
          repo: 'test-repo',
          path: 'README.md',
          ref: undefined,
        });
      });

      it('should get file content from specific ref', async () => {
        const mockFile = {
          type: 'file',
          content: Buffer.from('Hello').toString('base64'),
          sha: 'abc123',
          path: 'file.txt',
          encoding: 'base64',
        };

        mockOctokit.repos.getContent.mockResolvedValue({ data: mockFile });

        await client.getFileContent(repo, 'file.txt', 'feature-branch');

        expect(mockOctokit.repos.getContent).toHaveBeenCalledWith(
          expect.objectContaining({
            ref: 'feature-branch',
          })
        );
      });

      it('should throw error for directory path', async () => {
        mockOctokit.repos.getContent.mockResolvedValue({
          data: [{ type: 'file', name: 'file1.txt' }],
        });

        await expect(client.getFileContent(repo, 'src')).rejects.toThrow(GitHubValidationError);
      });
    });

    describe('createOrUpdateFile', () => {
      it('should create a new file', async () => {
        const mockResponse = {
          commit: { sha: 'commit123' },
          content: { sha: 'content456' },
        };

        mockOctokit.repos.createOrUpdateFileContents.mockResolvedValue({
          data: mockResponse,
        });

        const result = await client.createOrUpdateFile(repo, {
          path: 'newfile.txt',
          content: 'Hello World',
          message: 'Create newfile.txt',
          branch: 'main',
        });

        expect(result).toEqual({
          commit: { sha: 'commit123' },
          content: { sha: 'content456' },
        });

        expect(mockOctokit.repos.createOrUpdateFileContents).toHaveBeenCalledWith({
          owner: 'test-owner',
          repo: 'test-repo',
          path: 'newfile.txt',
          content: Buffer.from('Hello World').toString('base64'),
          message: 'Create newfile.txt',
          branch: 'main',
          sha: undefined,
        });
      });

      it('should update an existing file', async () => {
        const mockResponse = {
          commit: { sha: 'commit789' },
          content: { sha: 'content012' },
        };

        mockOctokit.repos.createOrUpdateFileContents.mockResolvedValue({
          data: mockResponse,
        });

        await client.createOrUpdateFile(repo, {
          path: 'existing.txt',
          content: 'Updated content',
          message: 'Update existing.txt',
          branch: 'main',
          sha: 'old-sha',
        });

        expect(mockOctokit.repos.createOrUpdateFileContents).toHaveBeenCalledWith(
          expect.objectContaining({
            sha: 'old-sha',
          })
        );
      });
    });
  });

  describe('Diff Operations', () => {
    const repo = { owner: 'test-owner', repo: 'test-repo' };

    describe('getPullRequestDiff', () => {
      it('should get pull request diff', async () => {
        const mockFiles = [
          {
            filename: 'src/index.ts',
            status: 'modified',
            additions: 10,
            deletions: 5,
            changes: 15,
            patch: '@@ -1,5 +1,10 @@\n-old line\n+new line',
          },
          {
            filename: 'src/utils.ts',
            status: 'added',
            additions: 20,
            deletions: 0,
            changes: 20,
            patch: '@@ -0,0 +1,20 @@\n+new file',
          },
          {
            filename: 'old/file.ts',
            status: 'renamed',
            additions: 0,
            deletions: 0,
            changes: 0,
            previous_filename: 'old/file.ts',
          },
        ];

        mockOctokit.pulls.listFiles.mockResolvedValue({ data: mockFiles });

        const result = await client.getPullRequestDiff(repo, 1);

        expect(result).toEqual({
          files: [
            {
              filename: 'src/index.ts',
              status: 'modified',
              additions: 10,
              deletions: 5,
              changes: 15,
              patch: '@@ -1,5 +1,10 @@\n-old line\n+new line',
              previousFilename: undefined,
            },
            {
              filename: 'src/utils.ts',
              status: 'added',
              additions: 20,
              deletions: 0,
              changes: 20,
              patch: '@@ -0,0 +1,20 @@\n+new file',
              previousFilename: undefined,
            },
            {
              filename: 'old/file.ts',
              status: 'renamed',
              additions: 0,
              deletions: 0,
              changes: 0,
              patch: undefined,
              previousFilename: 'old/file.ts',
            },
          ],
          totalAdditions: 30,
          totalDeletions: 5,
          totalChanges: 35,
        });
      });

      it('should handle empty diff', async () => {
        mockOctokit.pulls.listFiles.mockResolvedValue({ data: [] });

        const result = await client.getPullRequestDiff(repo, 1);

        expect(result.files).toHaveLength(0);
        expect(result.totalAdditions).toBe(0);
        expect(result.totalDeletions).toBe(0);
        expect(result.totalChanges).toBe(0);
      });
    });
  });

  describe('Error Handling', () => {
    const repo = { owner: 'test-owner', repo: 'test-repo' };

    it('should handle rate limit errors', async () => {
      mockOctokit.pulls.get.mockRejectedValue(new Error('rate limit exceeded'));

      await expect(client.getPullRequest(repo, 1)).rejects.toThrow(GitHubRateLimitError);
    });

    it('should handle 403 errors as rate limit', async () => {
      mockOctokit.pulls.get.mockRejectedValue(new Error('403 Forbidden'));

      await expect(client.getPullRequest(repo, 1)).rejects.toThrow(GitHubRateLimitError);
    });

    it('should handle not found errors', async () => {
      mockOctokit.pulls.get.mockRejectedValue(new Error('Not Found'));

      await expect(client.getPullRequest(repo, 1)).rejects.toThrow(GitHubNotFoundError);
    });

    it('should handle 404 errors', async () => {
      mockOctokit.pulls.get.mockRejectedValue(new Error('404: Resource not found'));

      await expect(client.getPullRequest(repo, 1)).rejects.toThrow(GitHubNotFoundError);
    });

    it('should handle authentication errors', async () => {
      mockOctokit.pulls.get.mockRejectedValue(new Error('Bad credentials'));

      await expect(client.getPullRequest(repo, 1)).rejects.toThrow(GitHubAuthenticationError);
    });

    it('should handle 401 errors', async () => {
      mockOctokit.pulls.get.mockRejectedValue(new Error('401 Unauthorized'));

      await expect(client.getPullRequest(repo, 1)).rejects.toThrow(GitHubAuthenticationError);
    });

    it('should handle validation errors', async () => {
      mockOctokit.pulls.get.mockRejectedValue(new Error('Validation Failed'));

      await expect(client.getPullRequest(repo, 1)).rejects.toThrow(GitHubValidationError);
    });

    it('should handle 422 errors', async () => {
      mockOctokit.pulls.get.mockRejectedValue(new Error('422: Unprocessable Entity'));

      await expect(client.getPullRequest(repo, 1)).rejects.toThrow(GitHubValidationError);
    });

    it('should handle general API errors', async () => {
      mockOctokit.pulls.get.mockRejectedValue(new Error('Something went wrong'));

      await expect(client.getPullRequest(repo, 1)).rejects.toThrow(GitHubError);
    });

    it('should handle unknown errors', async () => {
      mockOctokit.pulls.get.mockRejectedValue('string error');

      await expect(client.getPullRequest(repo, 1)).rejects.toThrow(GitHubError);
    });
  });
});
