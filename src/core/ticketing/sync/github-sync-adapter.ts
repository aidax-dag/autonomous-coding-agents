/**
 * GitHub Sync Adapter
 *
 * Implements IExternalSyncAdapter to synchronize ticket lifecycle events
 * with GitHub Issues. Uses the native fetch API with no external HTTP
 * client dependencies.
 *
 * Mapping:
 * - Ticket created  -> GitHub Issue created (with labels for status)
 * - Status changed   -> Comment added + labels updated
 * - Review added     -> Comment added with review summary
 *
 * Retry logic uses exponential backoff for transient failures (5xx, network).
 * Non-retryable failures (4xx auth/validation) fail immediately.
 *
 * @module core/ticketing/sync/github-sync-adapter
 */

import type { TicketRecord, TicketReview } from '../ticket-feature-service';
import type {
  IExternalSyncAdapter,
  ExternalSyncResult,
  GitHubSyncConfig,
} from './external-sync.interface';

// ============================================================================
// Constants
// ============================================================================

const GITHUB_API_BASE = 'https://api.github.com';
const GITHUB_API_VERSION = '2022-11-28';

/** Label prefix used to track ticket status on GitHub issues */
const STATUS_LABEL_PREFIX = 'aca-status:';

/** Label applied to all ACA-synced issues for easy filtering */
const ACA_LABEL = 'aca-synced';

// ============================================================================
// GitHub API Response Types (minimal subset)
// ============================================================================

interface GitHubIssueResponse {
  number: number;
  html_url: string;
  id: number;
}

interface GitHubErrorResponse {
  message: string;
  documentation_url?: string;
}

interface GitHubLabelResponse {
  name: string;
}

// ============================================================================
// Adapter Implementation
// ============================================================================

export class GitHubSyncAdapter implements IExternalSyncAdapter {
  readonly provider = 'github';

  private readonly owner: string;
  private readonly repo: string;
  private readonly token: string;

  constructor(config: GitHubSyncConfig) {
    this.owner = config.owner;
    this.repo = config.repo;
    this.token = config.token ?? process.env.GITHUB_TOKEN ?? '';

    if (!this.owner || !this.repo) {
      throw new Error('GitHubSyncAdapter requires owner and repo');
    }
  }

  // --------------------------------------------------------------------------
  // IExternalSyncAdapter
  // --------------------------------------------------------------------------

  async syncTicketCreated(ticket: TicketRecord): Promise<ExternalSyncResult> {
    if (!this.token) {
      return this.noTokenResult();
    }

    const body = this.buildIssueBody(ticket);
    const labels = [ACA_LABEL, `${STATUS_LABEL_PREFIX}${ticket.status}`];

    const result = await this.request<GitHubIssueResponse>(
      'POST',
      `/repos/${this.owner}/${this.repo}/issues`,
      {
        title: `[${ticket.managementNumber}] ${ticket.title}`,
        body,
        labels,
      },
    );

    if (!result.ok) {
      return {
        success: false,
        error: result.error,
        retryable: result.retryable,
      };
    }

    return {
      success: true,
      externalId: String(result.data.number),
      externalUrl: result.data.html_url,
    };
  }

  async syncStatusChange(
    ticketId: string,
    oldStatus: string,
    newStatus: string,
  ): Promise<ExternalSyncResult> {
    if (!this.token) {
      return this.noTokenResult();
    }

    // Find the GitHub issue number from the ticket's external refs
    const issueNumber = await this.findIssueByTicketId(ticketId);
    if (!issueNumber) {
      return {
        success: false,
        error: `No GitHub issue found for ticket ${ticketId}`,
        retryable: false,
      };
    }

    // Add a comment about the status change
    const commentResult = await this.request(
      'POST',
      `/repos/${this.owner}/${this.repo}/issues/${issueNumber}/comments`,
      {
        body: this.buildStatusChangeComment(ticketId, oldStatus, newStatus),
      },
    );

    if (!commentResult.ok) {
      return {
        success: false,
        error: commentResult.error,
        retryable: commentResult.retryable,
      };
    }

    // Update labels: remove old status label, add new one
    await this.updateStatusLabels(issueNumber, oldStatus, newStatus);

    // Close the issue if terminal status
    if (newStatus === 'completed' || newStatus === 'cancelled') {
      await this.request(
        'PATCH',
        `/repos/${this.owner}/${this.repo}/issues/${issueNumber}`,
        { state: 'closed' },
      );
    }

    return {
      success: true,
      externalId: String(issueNumber),
      externalUrl: `https://github.com/${this.owner}/${this.repo}/issues/${issueNumber}`,
    };
  }

  async syncReviewAdded(
    ticketId: string,
    review: TicketReview,
  ): Promise<ExternalSyncResult> {
    if (!this.token) {
      return this.noTokenResult();
    }

    const issueNumber = await this.findIssueByTicketId(ticketId);
    if (!issueNumber) {
      return {
        success: false,
        error: `No GitHub issue found for ticket ${ticketId}`,
        retryable: false,
      };
    }

    const commentResult = await this.request(
      'POST',
      `/repos/${this.owner}/${this.repo}/issues/${issueNumber}/comments`,
      {
        body: this.buildReviewComment(ticketId, review),
      },
    );

    if (!commentResult.ok) {
      return {
        success: false,
        error: commentResult.error,
        retryable: commentResult.retryable,
      };
    }

    return {
      success: true,
      externalId: String(issueNumber),
      externalUrl: `https://github.com/${this.owner}/${this.repo}/issues/${issueNumber}`,
    };
  }

  async testConnection(): Promise<boolean> {
    if (!this.token) {
      return false;
    }

    const result = await this.request(
      'GET',
      `/repos/${this.owner}/${this.repo}`,
    );
    return result.ok;
  }

  // --------------------------------------------------------------------------
  // Issue Body Builders
  // --------------------------------------------------------------------------

  private buildIssueBody(ticket: TicketRecord): string {
    const sections: string[] = [
      `> Synced from ACA ticket \`${ticket.ticketId}\` (${ticket.managementNumber})`,
      '',
      '## Background',
      ticket.background,
      '',
      '## Problem',
      ticket.problem,
      '',
      '## Work Description',
      ticket.workDescription,
      '',
      '## Expected Artifacts',
      ...ticket.expectedArtifacts.map(
        (a) => `- **${a.name}** (${a.type}): ${a.description}`,
      ),
      '',
      '## Verification',
      `**Method:** ${ticket.verification.method}`,
      '',
      '**Conditions:**',
      ...ticket.verification.conditions.map((c) => `- ${c}`),
      '',
      '**Checklist:**',
      ...ticket.verification.checklist.map((c) => `- [ ] ${c}`),
    ];

    return sections.join('\n');
  }

  private buildStatusChangeComment(
    ticketId: string,
    oldStatus: string,
    newStatus: string,
  ): string {
    const emoji = this.statusEmoji(newStatus);
    return [
      `${emoji} **Status changed:** \`${oldStatus}\` -> \`${newStatus}\``,
      '',
      `Ticket: \`${ticketId}\``,
      `Timestamp: ${new Date().toISOString()}`,
    ].join('\n');
  }

  private buildReviewComment(ticketId: string, review: TicketReview): string {
    const emoji = review.decision === 'approved' ? ':white_check_mark:' : ':warning:';
    return [
      `${emoji} **Review by \`${review.reviewerId}\`:** ${review.decision}`,
      '',
      `> ${review.comment}`,
      '',
      `Ticket: \`${ticketId}\``,
      `Timestamp: ${review.updatedAt ?? new Date().toISOString()}`,
    ].join('\n');
  }

  private statusEmoji(status: string): string {
    const map: Record<string, string> = {
      created: ':new:',
      in_progress: ':hammer_and_wrench:',
      pending: ':hourglass:',
      reviewing: ':mag:',
      completed: ':white_check_mark:',
      cancelled: ':x:',
    };
    return map[status] ?? ':arrow_right:';
  }

  // --------------------------------------------------------------------------
  // Issue Lookup
  // --------------------------------------------------------------------------

  /**
   * Search for a GitHub issue that was created for the given ticket ID.
   * Uses the GitHub search API to find issues with the ACA label
   * and ticket ID in the title or body.
   */
  private async findIssueByTicketId(
    ticketId: string,
  ): Promise<number | null> {
    const query = `repo:${this.owner}/${this.repo} label:${ACA_LABEL} "${ticketId}" in:body`;
    const result = await this.request<{ items: GitHubIssueResponse[] }>(
      'GET',
      `/search/issues?q=${encodeURIComponent(query)}`,
    );

    if (!result.ok || !result.data.items || result.data.items.length === 0) {
      return null;
    }

    return result.data.items[0].number;
  }

  // --------------------------------------------------------------------------
  // Label Management
  // --------------------------------------------------------------------------

  /**
   * Remove old status label and add new status label to an issue.
   * Label operations are best-effort -- failures are silently ignored
   * since the comment already records the status change.
   */
  private async updateStatusLabels(
    issueNumber: number,
    oldStatus: string,
    newStatus: string,
  ): Promise<void> {
    const oldLabel = `${STATUS_LABEL_PREFIX}${oldStatus}`;
    const newLabel = `${STATUS_LABEL_PREFIX}${newStatus}`;

    // Get current labels
    const labelsResult = await this.request<GitHubLabelResponse[]>(
      'GET',
      `/repos/${this.owner}/${this.repo}/issues/${issueNumber}/labels`,
    );

    if (!labelsResult.ok) {
      return;
    }

    const currentLabels = labelsResult.data.map((l) => l.name);
    const nextLabels = currentLabels
      .filter((l) => l !== oldLabel)
      .concat(newLabel);

    // Deduplicate
    const uniqueLabels = [...new Set(nextLabels)];

    await this.request(
      'PUT',
      `/repos/${this.owner}/${this.repo}/issues/${issueNumber}/labels`,
      { labels: uniqueLabels },
    );
  }

  // --------------------------------------------------------------------------
  // HTTP Client (fetch-based)
  // --------------------------------------------------------------------------

  private async request<T = unknown>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<{ ok: true; data: T } | { ok: false; error: string; retryable: boolean }> {
    const url = path.startsWith('http') ? path : `${GITHUB_API_BASE}${path}`;

    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${this.token}`,
      'X-GitHub-Api-Version': GITHUB_API_VERSION,
    };

    if (body) {
      headers['Content-Type'] = 'application/json';
    }

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      if (response.ok) {
        // Handle 204 No Content
        if (response.status === 204) {
          return { ok: true, data: undefined as unknown as T };
        }
        const data = (await response.json()) as T;
        return { ok: true, data };
      }

      // Determine retryability
      const retryable = response.status >= 500 || response.status === 429;
      let errorMessage = `GitHub API ${response.status}`;

      try {
        const errorBody = (await response.json()) as GitHubErrorResponse;
        errorMessage = `GitHub API ${response.status}: ${errorBody.message}`;
      } catch {
        // response body not JSON, use status-only message
      }

      return { ok: false, error: errorMessage, retryable };
    } catch (err) {
      // Network errors are retryable
      const message = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        error: `Network error: ${message}`,
        retryable: true,
      };
    }
  }

  // --------------------------------------------------------------------------
  // Helpers
  // --------------------------------------------------------------------------

  private noTokenResult(): ExternalSyncResult {
    return {
      success: false,
      error: 'GitHub token not configured. Set GITHUB_TOKEN or provide token in config.',
      retryable: false,
    };
  }
}
