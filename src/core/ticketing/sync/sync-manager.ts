/**
 * External Sync Manager
 *
 * Orchestrates external sync operations for the ticket lifecycle.
 * Manages the adapter lifecycle, retry/backoff strategy, and error isolation.
 *
 * Key design decisions:
 * - All sync operations are fire-and-forget: failures never block internal operations
 * - Retry uses exponential backoff with jitter
 * - Disabled by default; consumers opt-in via ExternalSyncConfig
 * - Success and failure results are logged separately for observability
 *
 * @module core/ticketing/sync/sync-manager
 */

import type { TicketRecord, TicketReview } from '../ticket-feature-service';
import type {
  IExternalSyncAdapter,
  ExternalSyncResult,
  ExternalSyncConfig,
} from './external-sync.interface';
import { createDefaultSyncConfig } from './external-sync.interface';
import { GitHubSyncAdapter } from './github-sync-adapter';

// ============================================================================
// Logger Interface (minimal, avoids hard dependency on shared logger)
// ============================================================================

interface SyncLogger {
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
  debug(message: string, context?: Record<string, unknown>): void;
}

/**
 * Default no-op logger. Replaced when consumers provide their own.
 */
const noopLogger: SyncLogger = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
};

// ============================================================================
// Sync Manager
// ============================================================================

export class ExternalSyncManager {
  private config: ExternalSyncConfig;
  private adapter: IExternalSyncAdapter | null = null;
  private readonly logger: SyncLogger;

  constructor(config?: Partial<ExternalSyncConfig>, logger?: SyncLogger) {
    this.config = { ...createDefaultSyncConfig(), ...config };
    this.logger = logger ?? noopLogger;

    if (this.config.enabled && this.config.provider !== 'none') {
      this.adapter = this.createAdapter();
    }
  }

  // --------------------------------------------------------------------------
  // Configuration
  // --------------------------------------------------------------------------

  /**
   * Returns the current sync configuration.
   */
  getConfig(): Readonly<ExternalSyncConfig> {
    return { ...this.config };
  }

  /**
   * Returns whether sync is currently active (enabled + adapter available).
   */
  isActive(): boolean {
    return this.config.enabled && this.adapter !== null;
  }

  /**
   * Update configuration at runtime. Re-creates the adapter if the provider changes.
   */
  updateConfig(patch: Partial<ExternalSyncConfig>): void {
    const previousProvider = this.config.provider;
    this.config = { ...this.config, ...patch };

    if (!this.config.enabled || this.config.provider === 'none') {
      this.adapter = null;
      this.logger.info('External sync disabled');
      return;
    }

    // Re-create adapter if provider changed or adapter missing
    if (this.config.provider !== previousProvider || !this.adapter) {
      this.adapter = this.createAdapter();
      this.logger.info('External sync adapter updated', {
        provider: this.config.provider,
      });
    }
  }

  /**
   * Inject a custom adapter (useful for testing or custom providers).
   */
  setAdapter(adapter: IExternalSyncAdapter): void {
    this.adapter = adapter;
    this.logger.info('Custom sync adapter injected', {
      provider: adapter.provider,
    });
  }

  // --------------------------------------------------------------------------
  // Lifecycle Event Handlers (fire-and-forget)
  // --------------------------------------------------------------------------

  /**
   * Called after a ticket is created. Non-blocking.
   */
  async onTicketCreated(ticket: TicketRecord): Promise<ExternalSyncResult | null> {
    if (!this.shouldSync()) {
      return null;
    }

    return this.executeWithRetry(
      'syncTicketCreated',
      () => this.adapter!.syncTicketCreated(ticket),
      { ticketId: ticket.ticketId, event: 'ticketCreated' },
    );
  }

  /**
   * Called after a ticket status changes. Non-blocking.
   */
  async onStatusChange(
    ticketId: string,
    oldStatus: string,
    newStatus: string,
  ): Promise<ExternalSyncResult | null> {
    if (!this.shouldSync()) {
      return null;
    }

    return this.executeWithRetry(
      'syncStatusChange',
      () => this.adapter!.syncStatusChange(ticketId, oldStatus, newStatus),
      { ticketId, event: 'statusChange', oldStatus, newStatus },
    );
  }

  /**
   * Called after a review is added to a ticket. Non-blocking.
   */
  async onReviewAdded(
    ticketId: string,
    review: TicketReview,
  ): Promise<ExternalSyncResult | null> {
    if (!this.shouldSync()) {
      return null;
    }

    return this.executeWithRetry(
      'syncReviewAdded',
      () => this.adapter!.syncReviewAdded(ticketId, review),
      { ticketId, event: 'reviewAdded', reviewerId: review.reviewerId },
    );
  }

  /**
   * Test the adapter's connection to the external system.
   */
  async testConnection(): Promise<boolean> {
    if (!this.adapter) {
      this.logger.warn('Cannot test connection: no adapter configured');
      return false;
    }

    try {
      const ok = await this.adapter.testConnection();
      this.logger.info('Connection test completed', {
        provider: this.adapter.provider,
        success: ok,
      });
      return ok;
    } catch (err) {
      this.logger.error('Connection test threw an exception', {
        provider: this.adapter.provider,
        error: err instanceof Error ? err.message : String(err),
      });
      return false;
    }
  }

  // --------------------------------------------------------------------------
  // Retry Logic
  // --------------------------------------------------------------------------

  /**
   * Execute a sync operation with exponential backoff retry.
   *
   * - Only retries when result.retryable is true
   * - Uses exponential backoff: delay * 2^attempt + jitter
   * - Never throws -- all errors are captured in the result
   */
  private async executeWithRetry(
    operationName: string,
    operation: () => Promise<ExternalSyncResult>,
    context: Record<string, unknown>,
  ): Promise<ExternalSyncResult> {
    const maxAttempts = this.config.retryAttempts;
    const baseDelay = this.config.retryDelayMs;
    let lastResult: ExternalSyncResult | null = null;

    for (let attempt = 0; attempt <= maxAttempts; attempt++) {
      try {
        const result = await operation();

        if (result.success) {
          this.logger.info(`Sync ${operationName} succeeded`, {
            ...context,
            attempt,
            externalId: result.externalId,
            externalUrl: result.externalUrl,
          });
          return result;
        }

        lastResult = result;

        // Don't retry non-retryable failures
        if (!result.retryable) {
          this.logger.warn(`Sync ${operationName} failed (non-retryable)`, {
            ...context,
            attempt,
            error: result.error,
          });
          return result;
        }

        // Don't retry if we've exhausted attempts
        if (attempt >= maxAttempts) {
          break;
        }

        // Wait with exponential backoff + jitter
        const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 100;
        this.logger.debug(`Sync ${operationName} retrying`, {
          ...context,
          attempt,
          nextAttempt: attempt + 1,
          delayMs: Math.round(delay),
          error: result.error,
        });

        await this.sleep(delay);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        lastResult = {
          success: false,
          error: `Unexpected error: ${errorMessage}`,
          retryable: true,
        };

        this.logger.error(`Sync ${operationName} threw exception`, {
          ...context,
          attempt,
          error: errorMessage,
        });

        if (attempt >= maxAttempts) {
          break;
        }

        const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 100;
        await this.sleep(delay);
      }
    }

    // All retries exhausted
    const finalResult = lastResult ?? {
      success: false,
      error: 'All retry attempts exhausted',
      retryable: false,
    };

    this.logger.error(`Sync ${operationName} failed after all retries`, {
      ...context,
      maxAttempts,
      error: finalResult.error,
    });

    return finalResult;
  }

  // --------------------------------------------------------------------------
  // Private Helpers
  // --------------------------------------------------------------------------

  private shouldSync(): boolean {
    if (!this.config.enabled) {
      return false;
    }
    if (!this.adapter) {
      return false;
    }
    return true;
  }

  private createAdapter(): IExternalSyncAdapter | null {
    switch (this.config.provider) {
      case 'github': {
        const githubConfig = this.config.github;
        if (!githubConfig) {
          this.logger.error(
            'GitHub sync enabled but no github config provided',
          );
          return null;
        }
        try {
          return new GitHubSyncAdapter(githubConfig);
        } catch (err) {
          this.logger.error('Failed to create GitHub sync adapter', {
            error: err instanceof Error ? err.message : String(err),
          });
          return null;
        }
      }

      case 'jira':
        this.logger.warn('Jira sync adapter is not yet implemented');
        return null;

      case 'none':
        return null;

      default:
        this.logger.warn(`Unknown sync provider: ${this.config.provider}`);
        return null;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
