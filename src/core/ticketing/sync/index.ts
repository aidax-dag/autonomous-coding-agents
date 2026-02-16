/**
 * External Sync Module
 *
 * Barrel export for the ticket external sync subsystem.
 * Provides adapters for synchronizing ticket lifecycle events
 * with external project management systems.
 *
 * @module core/ticketing/sync
 */

// Interfaces and types
export type {
  IExternalSyncAdapter,
  ExternalSyncResult,
  ExternalSyncConfig,
  GitHubSyncConfig,
  JiraSyncConfig,
} from './external-sync.interface';
export { createDefaultSyncConfig } from './external-sync.interface';

// Adapters
export { GitHubSyncAdapter } from './github-sync-adapter';

// Manager
export { ExternalSyncManager } from './sync-manager';
