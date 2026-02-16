/**
 * External Sync Adapter Interface
 *
 * Defines the contract for synchronizing internal ticket lifecycle events
 * with external project management systems (GitHub Issues, Jira, etc.).
 *
 * All sync operations are designed to be non-blocking -- callers fire-and-forget,
 * and failures are captured in ExternalSyncResult without propagating exceptions.
 *
 * SOLID Principles:
 * - S: Focused on external synchronization contract only
 * - O: New providers implement this interface without modifying consumers
 * - I: Minimal surface -- each method maps to one lifecycle event
 * - D: SyncManager depends on this abstraction, not concrete adapters
 *
 * @module core/ticketing/sync/external-sync.interface
 */

import type { TicketRecord, TicketReview } from '../ticket-feature-service';

// ============================================================================
// Sync Result
// ============================================================================

/**
 * Outcome of a single sync operation against an external system.
 *
 * When `success` is false, callers inspect `retryable` to decide
 * whether the operation should be retried with backoff.
 */
export interface ExternalSyncResult {
  /** Whether the sync operation completed successfully */
  success: boolean;
  /** External system's identifier for the synced entity (e.g. GitHub issue number) */
  externalId?: string;
  /** URL to view the synced entity in the external system */
  externalUrl?: string;
  /** Error message when success is false */
  error?: string;
  /** Whether a failed operation is safe to retry */
  retryable?: boolean;
}

// ============================================================================
// Sync Adapter Interface
// ============================================================================

/**
 * Contract for external project management system adapters.
 *
 * Each method corresponds to a ticket lifecycle event. Implementations
 * translate internal events into the external system's API calls.
 */
export interface IExternalSyncAdapter {
  /** Provider name for logging and configuration routing */
  readonly provider: string;

  /**
   * Sync a newly created ticket to the external system.
   * Typically creates an issue/ticket in the external tracker.
   */
  syncTicketCreated(ticket: TicketRecord): Promise<ExternalSyncResult>;

  /**
   * Sync a ticket status transition to the external system.
   * Typically adds a comment and/or updates labels/status fields.
   */
  syncStatusChange(
    ticketId: string,
    oldStatus: string,
    newStatus: string,
  ): Promise<ExternalSyncResult>;

  /**
   * Sync a review addition to the external system.
   * Typically adds a comment summarizing the review outcome.
   */
  syncReviewAdded(
    ticketId: string,
    review: TicketReview,
  ): Promise<ExternalSyncResult>;

  /**
   * Validate that the adapter can reach the external system.
   * Used for health checks and configuration validation.
   */
  testConnection(): Promise<boolean>;
}

// ============================================================================
// Sync Configuration
// ============================================================================

/**
 * Configuration for external sync behavior.
 *
 * Sync is disabled by default and must be explicitly opted into via config.
 * Provider-specific sub-configs hold credentials and routing information.
 */
export interface ExternalSyncConfig {
  /** Master toggle -- when false, all sync operations are no-ops */
  enabled: boolean;
  /** Which provider adapter to instantiate */
  provider: 'github' | 'jira' | 'none';
  /** Maximum number of retry attempts for transient failures */
  retryAttempts: number;
  /** Base delay in milliseconds between retries (doubled on each attempt) */
  retryDelayMs: number;
  /** GitHub-specific configuration */
  github?: GitHubSyncConfig;
  /** Jira-specific configuration (reserved for future implementation) */
  jira?: JiraSyncConfig;
}

/**
 * GitHub provider configuration.
 */
export interface GitHubSyncConfig {
  /** Repository owner (user or organization) */
  owner: string;
  /** Repository name */
  repo: string;
  /** Personal access token -- when omitted, falls back to GITHUB_TOKEN env var */
  token?: string;
}

/**
 * Jira provider configuration (reserved for future implementation).
 */
export interface JiraSyncConfig {
  /** Jira instance base URL (e.g. https://myorg.atlassian.net) */
  baseUrl: string;
  /** Jira project key (e.g. ACA) */
  project: string;
  /** API token -- when omitted, falls back to JIRA_TOKEN env var */
  token?: string;
}

// ============================================================================
// Default Configuration
// ============================================================================

/**
 * Returns a default ExternalSyncConfig with sync disabled.
 */
export function createDefaultSyncConfig(): ExternalSyncConfig {
  return {
    enabled: false,
    provider: 'none',
    retryAttempts: 3,
    retryDelayMs: 1000,
  };
}
