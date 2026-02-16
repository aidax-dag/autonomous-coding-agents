/**
 * Ticket/Feature Repository Interface
 *
 * Defines the storage abstraction for ticket and feature persistence.
 * Implementations can back onto JSON files, SQLite, PostgreSQL, or
 * any other storage engine without changing the service layer.
 *
 * SOLID Principles:
 * - S: Focused solely on storage contract
 * - O: New backends extend without modifying consumers
 * - I: Repository interface segregated from service logic
 * - D: Service depends on this abstraction, not concrete storage
 *
 * @module core/ticketing/interfaces/ticket-feature-repository
 */

import type { TicketRecord, FeatureRecord } from '../ticket-feature-service';

// ============================================================================
// Store Shape
// ============================================================================

/**
 * The full in-memory store structure for ticket/feature data.
 *
 * Repositories load and save this entire structure. Individual
 * entity accessors (getTicket, getFeature) are convenience methods
 * that implementations may optimise with indexed lookups.
 */
export interface TicketFeatureStore {
  version: number;
  counters: {
    ticket: number;
    feature: number;
    management: number;
  };
  tickets: TicketRecord[];
  features: FeatureRecord[];
}

// ============================================================================
// Repository Interface
// ============================================================================

/**
 * Storage abstraction for the ticket/feature lifecycle.
 *
 * Every implementation must support:
 * - Full store load/save (for batch operations and migrations)
 * - Individual entity lookups (for targeted reads)
 */
export interface ITicketFeatureRepository {
  /**
   * Load the entire store from the backing storage.
   * Returns the default empty store when no data exists yet.
   */
  load(): Promise<TicketFeatureStore>;

  /**
   * Persist the entire store to the backing storage.
   * Must be atomic -- partial writes should not leave the store corrupted.
   */
  save(store: TicketFeatureStore): Promise<void>;

  /**
   * Retrieve a single ticket by its ID.
   * Returns null when the ticket does not exist.
   */
  getTicket(id: string): Promise<TicketRecord | null>;

  /**
   * Retrieve a single feature by its ID.
   * Returns null when the feature does not exist.
   */
  getFeature(id: string): Promise<FeatureRecord | null>;
}
