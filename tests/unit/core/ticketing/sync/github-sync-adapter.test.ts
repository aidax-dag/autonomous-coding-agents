/**
 * GitHubSyncAdapter Unit Tests
 *
 * Tests the GitHub sync adapter with mocked fetch responses.
 * Covers ticket creation, status change sync, review sync,
 * connection testing, error handling, and retry classification.
 */

import { GitHubSyncAdapter } from '../../../../../src/core/ticketing/sync/github-sync-adapter';
import type { TicketRecord, TicketReview } from '../../../../../src/core/ticketing/ticket-feature-service';

// ============================================================================
// Mock Setup
// ============================================================================

const originalFetch = global.fetch;
let mockFetch: jest.Mock;

beforeEach(() => {
  mockFetch = jest.fn();
  global.fetch = mockFetch;
});

afterEach(() => {
  global.fetch = originalFetch;
  delete process.env.GITHUB_TOKEN;
});

// ============================================================================
// Test Helpers
// ============================================================================

function createMockTicket(overrides: Partial<TicketRecord> = {}): TicketRecord {
  return {
    ticketId: 'ticket-2026-000001',
    managementNumber: 'ACA-2026-00001',
    title: 'Implement auth module',
    background: 'Users need to authenticate',
    problem: 'No auth system exists',
    workDescription: 'Build JWT-based auth',
    expectedArtifacts: [
      { name: 'auth-service.ts', type: 'source', description: 'Auth service implementation' },
    ],
    verification: {
      method: 'unit test',
      conditions: ['All tests pass'],
      checklist: ['Login works', 'Logout works'],
    },
    createdBy: { agentId: 'planner-1', role: 'planner' as const },
    assignees: [],
    status: 'created' as const,
    createdAt: '2026-02-16T00:00:00.000Z',
    updatedAt: '2026-02-16T00:00:00.000Z',
    artifacts: [],
    issues: [],
    reviews: [],
    ...overrides,
  };
}

function createMockReview(overrides: Partial<TicketReview> = {}): TicketReview {
  return {
    reviewerId: 'reviewer-1',
    decision: 'approved' as const,
    comment: 'Looks good, well structured',
    ...overrides,
  };
}

function mockFetchResponse(status: number, body: unknown, ok?: boolean): Response {
  return {
    ok: ok ?? (status >= 200 && status < 300),
    status,
    json: () => Promise.resolve(body),
    headers: new Headers(),
    redirected: false,
    statusText: '',
    type: 'basic' as ResponseType,
    url: '',
    clone: () => mockFetchResponse(status, body, ok),
    body: null,
    bodyUsed: false,
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    blob: () => Promise.resolve(new Blob()),
    formData: () => Promise.resolve(new FormData()),
    text: () => Promise.resolve(JSON.stringify(body)),
    bytes: () => Promise.resolve(new Uint8Array()),
  };
}

function createAdapter(
  config: { owner?: string; repo?: string; token?: string } = {},
): GitHubSyncAdapter {
  return new GitHubSyncAdapter({
    owner: config.owner ?? 'test-org',
    repo: config.repo ?? 'test-repo',
    token: config.token ?? 'ghp_test_token_123',
  });
}

// ============================================================================
// Tests
// ============================================================================

describe('GitHubSyncAdapter', () => {
  describe('constructor', () => {
    it('should throw when owner is missing', () => {
      expect(() => new GitHubSyncAdapter({ owner: '', repo: 'repo' })).toThrow(
        'GitHubSyncAdapter requires owner and repo',
      );
    });

    it('should throw when repo is missing', () => {
      expect(() => new GitHubSyncAdapter({ owner: 'owner', repo: '' })).toThrow(
        'GitHubSyncAdapter requires owner and repo',
      );
    });

    it('should fall back to GITHUB_TOKEN env var when no token provided', () => {
      process.env.GITHUB_TOKEN = 'ghp_env_token';
      const adapter = new GitHubSyncAdapter({ owner: 'org', repo: 'repo' });
      expect(adapter.provider).toBe('github');
    });

    it('should report provider as github', () => {
      const adapter = createAdapter();
      expect(adapter.provider).toBe('github');
    });
  });

  describe('syncTicketCreated', () => {
    it('should create a GitHub issue on successful sync', async () => {
      const adapter = createAdapter();
      const ticket = createMockTicket();

      mockFetch.mockResolvedValueOnce(
        mockFetchResponse(201, {
          number: 42,
          html_url: 'https://github.com/test-org/test-repo/issues/42',
          id: 100,
        }),
      );

      const result = await adapter.syncTicketCreated(ticket);

      expect(result.success).toBe(true);
      expect(result.externalId).toBe('42');
      expect(result.externalUrl).toBe('https://github.com/test-org/test-repo/issues/42');

      // Verify the fetch call
      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe('https://api.github.com/repos/test-org/test-repo/issues');
      expect(options.method).toBe('POST');

      const body = JSON.parse(options.body);
      expect(body.title).toContain('ACA-2026-00001');
      expect(body.title).toContain('Implement auth module');
      expect(body.labels).toContain('aca-synced');
      expect(body.labels).toContain('aca-status:created');
      expect(body.body).toContain('ticket-2026-000001');
    });

    it('should return error when no token is configured', async () => {
      const adapter = new GitHubSyncAdapter({ owner: 'org', repo: 'repo' });
      const ticket = createMockTicket();

      const result = await adapter.syncTicketCreated(ticket);

      expect(result.success).toBe(false);
      expect(result.error).toContain('GitHub token not configured');
      expect(result.retryable).toBe(false);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should mark 5xx errors as retryable', async () => {
      const adapter = createAdapter();
      const ticket = createMockTicket();

      mockFetch.mockResolvedValueOnce(
        mockFetchResponse(503, { message: 'Service Unavailable' }, false),
      );

      const result = await adapter.syncTicketCreated(ticket);

      expect(result.success).toBe(false);
      expect(result.retryable).toBe(true);
      expect(result.error).toContain('503');
    });

    it('should mark 4xx errors as non-retryable', async () => {
      const adapter = createAdapter();
      const ticket = createMockTicket();

      mockFetch.mockResolvedValueOnce(
        mockFetchResponse(422, { message: 'Validation Failed' }, false),
      );

      const result = await adapter.syncTicketCreated(ticket);

      expect(result.success).toBe(false);
      expect(result.retryable).toBe(false);
      expect(result.error).toContain('422');
    });

    it('should mark 429 rate limit as retryable', async () => {
      const adapter = createAdapter();
      const ticket = createMockTicket();

      mockFetch.mockResolvedValueOnce(
        mockFetchResponse(429, { message: 'rate limit exceeded' }, false),
      );

      const result = await adapter.syncTicketCreated(ticket);

      expect(result.success).toBe(false);
      expect(result.retryable).toBe(true);
    });

    it('should handle network errors as retryable', async () => {
      const adapter = createAdapter();
      const ticket = createMockTicket();

      mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));

      const result = await adapter.syncTicketCreated(ticket);

      expect(result.success).toBe(false);
      expect(result.retryable).toBe(true);
      expect(result.error).toContain('Network error');
      expect(result.error).toContain('ECONNREFUSED');
    });

    it('should include issue body with ticket details', async () => {
      const adapter = createAdapter();
      const ticket = createMockTicket();

      mockFetch.mockResolvedValueOnce(
        mockFetchResponse(201, { number: 1, html_url: 'https://github.com/x/y/issues/1', id: 1 }),
      );

      await adapter.syncTicketCreated(ticket);

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.body).toContain('## Background');
      expect(body.body).toContain('Users need to authenticate');
      expect(body.body).toContain('## Problem');
      expect(body.body).toContain('## Work Description');
      expect(body.body).toContain('## Expected Artifacts');
      expect(body.body).toContain('## Verification');
    });
  });

  describe('syncStatusChange', () => {
    it('should add a comment and update labels on status change', async () => {
      const adapter = createAdapter();

      // Search for issue
      mockFetch.mockResolvedValueOnce(
        mockFetchResponse(200, {
          items: [{ number: 42, html_url: 'https://github.com/test-org/test-repo/issues/42', id: 100 }],
        }),
      );
      // Add comment
      mockFetch.mockResolvedValueOnce(
        mockFetchResponse(201, { id: 200 }),
      );
      // Get labels
      mockFetch.mockResolvedValueOnce(
        mockFetchResponse(200, [
          { name: 'aca-synced' },
          { name: 'aca-status:created' },
        ]),
      );
      // Update labels
      mockFetch.mockResolvedValueOnce(
        mockFetchResponse(200, []),
      );

      const result = await adapter.syncStatusChange('ticket-2026-000001', 'created', 'in_progress');

      expect(result.success).toBe(true);
      expect(result.externalId).toBe('42');
      expect(result.externalUrl).toContain('/issues/42');

      // Verify comment body
      const commentBody = JSON.parse(mockFetch.mock.calls[1][1].body);
      expect(commentBody.body).toContain('created');
      expect(commentBody.body).toContain('in_progress');
    });

    it('should close the issue when status is completed', async () => {
      const adapter = createAdapter();

      // Search for issue
      mockFetch.mockResolvedValueOnce(
        mockFetchResponse(200, {
          items: [{ number: 10, html_url: 'https://github.com/test-org/test-repo/issues/10', id: 10 }],
        }),
      );
      // Add comment
      mockFetch.mockResolvedValueOnce(mockFetchResponse(201, { id: 300 }));
      // Get labels
      mockFetch.mockResolvedValueOnce(mockFetchResponse(200, [{ name: 'aca-synced' }]));
      // Update labels
      mockFetch.mockResolvedValueOnce(mockFetchResponse(200, []));
      // Close issue (PATCH)
      mockFetch.mockResolvedValueOnce(mockFetchResponse(200, { number: 10 }));

      const result = await adapter.syncStatusChange('ticket-2026-000001', 'reviewing', 'completed');

      expect(result.success).toBe(true);

      // Verify PATCH call to close issue
      const patchCall = mockFetch.mock.calls[4];
      expect(patchCall[0]).toContain('/issues/10');
      expect(patchCall[1].method).toBe('PATCH');
      expect(JSON.parse(patchCall[1].body).state).toBe('closed');
    });

    it('should close the issue when status is cancelled', async () => {
      const adapter = createAdapter();

      mockFetch.mockResolvedValueOnce(
        mockFetchResponse(200, { items: [{ number: 5, html_url: 'url', id: 5 }] }),
      );
      mockFetch.mockResolvedValueOnce(mockFetchResponse(201, { id: 1 }));
      mockFetch.mockResolvedValueOnce(mockFetchResponse(200, []));
      mockFetch.mockResolvedValueOnce(mockFetchResponse(200, []));
      mockFetch.mockResolvedValueOnce(mockFetchResponse(200, {}));

      const result = await adapter.syncStatusChange('ticket-2026-000001', 'in_progress', 'cancelled');
      expect(result.success).toBe(true);

      const patchCall = mockFetch.mock.calls[4];
      expect(JSON.parse(patchCall[1].body).state).toBe('closed');
    });

    it('should return error when no issue found for ticket', async () => {
      const adapter = createAdapter();

      mockFetch.mockResolvedValueOnce(
        mockFetchResponse(200, { items: [] }),
      );

      const result = await adapter.syncStatusChange('ticket-unknown', 'created', 'in_progress');

      expect(result.success).toBe(false);
      expect(result.error).toContain('No GitHub issue found');
      expect(result.retryable).toBe(false);
    });

    it('should return error when no token configured', async () => {
      const adapter = new GitHubSyncAdapter({ owner: 'org', repo: 'repo' });

      const result = await adapter.syncStatusChange('ticket-1', 'created', 'in_progress');

      expect(result.success).toBe(false);
      expect(result.error).toContain('GitHub token not configured');
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('syncReviewAdded', () => {
    it('should add a comment with review summary', async () => {
      const adapter = createAdapter();
      const review = createMockReview();

      // Search for issue
      mockFetch.mockResolvedValueOnce(
        mockFetchResponse(200, {
          items: [{ number: 42, html_url: 'https://github.com/test-org/test-repo/issues/42', id: 100 }],
        }),
      );
      // Add comment
      mockFetch.mockResolvedValueOnce(
        mockFetchResponse(201, { id: 500 }),
      );

      const result = await adapter.syncReviewAdded('ticket-2026-000001', review);

      expect(result.success).toBe(true);
      expect(result.externalId).toBe('42');

      const commentBody = JSON.parse(mockFetch.mock.calls[1][1].body);
      expect(commentBody.body).toContain('reviewer-1');
      expect(commentBody.body).toContain('approved');
      expect(commentBody.body).toContain('Looks good, well structured');
    });

    it('should handle changes_requested reviews', async () => {
      const adapter = createAdapter();
      const review = createMockReview({
        decision: 'changes_requested',
        comment: 'Needs error handling',
      });

      mockFetch.mockResolvedValueOnce(
        mockFetchResponse(200, { items: [{ number: 7, html_url: 'url', id: 7 }] }),
      );
      mockFetch.mockResolvedValueOnce(mockFetchResponse(201, { id: 600 }));

      const result = await adapter.syncReviewAdded('ticket-2026-000001', review);

      expect(result.success).toBe(true);

      const commentBody = JSON.parse(mockFetch.mock.calls[1][1].body);
      expect(commentBody.body).toContain('changes_requested');
      expect(commentBody.body).toContain('Needs error handling');
    });

    it('should return error when no issue found', async () => {
      const adapter = createAdapter();
      const review = createMockReview();

      mockFetch.mockResolvedValueOnce(
        mockFetchResponse(200, { items: [] }),
      );

      const result = await adapter.syncReviewAdded('ticket-unknown', review);

      expect(result.success).toBe(false);
      expect(result.error).toContain('No GitHub issue found');
    });

    it('should return error when no token configured', async () => {
      const adapter = new GitHubSyncAdapter({ owner: 'org', repo: 'repo' });
      const review = createMockReview();

      const result = await adapter.syncReviewAdded('ticket-1', review);

      expect(result.success).toBe(false);
      expect(result.error).toContain('GitHub token not configured');
    });
  });

  describe('testConnection', () => {
    it('should return true when repo is accessible', async () => {
      const adapter = createAdapter();

      mockFetch.mockResolvedValueOnce(
        mockFetchResponse(200, { id: 1, name: 'test-repo' }),
      );

      const result = await adapter.testConnection();

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe('https://api.github.com/repos/test-org/test-repo');
      expect(options.method).toBe('GET');
      expect(options.headers.Authorization).toBe('Bearer ghp_test_token_123');
    });

    it('should return false when repo is not accessible', async () => {
      const adapter = createAdapter();

      mockFetch.mockResolvedValueOnce(
        mockFetchResponse(404, { message: 'Not Found' }, false),
      );

      const result = await adapter.testConnection();

      expect(result).toBe(false);
    });

    it('should return false when token is missing', async () => {
      const adapter = new GitHubSyncAdapter({ owner: 'org', repo: 'repo' });

      const result = await adapter.testConnection();

      expect(result).toBe(false);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should return false on network error', async () => {
      const adapter = createAdapter();

      mockFetch.mockRejectedValueOnce(new Error('DNS resolution failed'));

      const result = await adapter.testConnection();

      expect(result).toBe(false);
    });
  });

  describe('request headers', () => {
    it('should include correct GitHub API headers', async () => {
      const adapter = createAdapter();

      mockFetch.mockResolvedValueOnce(
        mockFetchResponse(200, { id: 1 }),
      );

      await adapter.testConnection();

      const headers = mockFetch.mock.calls[0][1].headers;
      expect(headers.Accept).toBe('application/vnd.github+json');
      expect(headers.Authorization).toBe('Bearer ghp_test_token_123');
      expect(headers['X-GitHub-Api-Version']).toBe('2022-11-28');
    });
  });
});
