/**
 * JSON File-Based Ticket/Feature Repository
 *
 * Persists the TicketFeatureStore as a single JSON file on disk.
 * This is the original storage mechanism extracted from the service
 * layer and is the default adapter for backward compatibility.
 *
 * @module core/ticketing/repositories/json-repository
 */

import { mkdir, readFile, writeFile } from 'fs/promises';
import path from 'path';
import type {
  ITicketFeatureRepository,
  TicketFeatureStore,
} from '../interfaces/ticket-feature-repository.interface';
import type { TicketRecord, FeatureRecord } from '../ticket-feature-service';

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_STORE: TicketFeatureStore = {
  version: 1,
  counters: { ticket: 0, feature: 0, management: 0 },
  tickets: [],
  features: [],
};

// ============================================================================
// Options
// ============================================================================

export interface JsonTicketFeatureRepositoryOptions {
  /** Full path to the JSON store file */
  filePath: string;
}

// ============================================================================
// Implementation
// ============================================================================

/**
 * Repository backed by a single JSON file.
 *
 * Reads and writes the entire store atomically. Suitable for
 * low-throughput or single-process deployments.
 */
export class JsonTicketFeatureRepository implements ITicketFeatureRepository {
  private readonly filePath: string;

  constructor(options: JsonTicketFeatureRepositoryOptions) {
    this.filePath = options.filePath;
  }

  async load(): Promise<TicketFeatureStore> {
    await mkdir(path.dirname(this.filePath), { recursive: true });

    try {
      const raw = await readFile(this.filePath, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<TicketFeatureStore>;
      return {
        version: parsed.version ?? DEFAULT_STORE.version,
        counters: {
          ticket: parsed.counters?.ticket ?? 0,
          feature: parsed.counters?.feature ?? 0,
          management: parsed.counters?.management ?? 0,
        },
        tickets: parsed.tickets ?? [],
        features: parsed.features ?? [],
      };
    } catch {
      return structuredClone(DEFAULT_STORE);
    }
  }

  async save(store: TicketFeatureStore): Promise<void> {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(store, null, 2), 'utf-8');
  }

  async getTicket(id: string): Promise<TicketRecord | null> {
    const store = await this.load();
    return store.tickets.find((t) => t.ticketId === id) ?? null;
  }

  async getFeature(id: string): Promise<FeatureRecord | null> {
    const store = await this.load();
    return store.features.find((f) => f.featureId === id) ?? null;
  }
}

// ============================================================================
// Factory
// ============================================================================

/**
 * Create a JSON-backed ticket/feature repository.
 */
export function createJsonTicketFeatureRepository(
  options: JsonTicketFeatureRepositoryOptions,
): JsonTicketFeatureRepository {
  return new JsonTicketFeatureRepository(options);
}
