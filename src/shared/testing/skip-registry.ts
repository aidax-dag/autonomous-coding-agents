/**
 * Skip Registry
 *
 * Tracks skipped and todo tests with categorization, expiry detection,
 * and JSON serialization. Used by CI scripts to enforce skip hygiene
 * and prevent accumulation of permanently disabled tests.
 *
 * @module shared/testing/skip-registry
 */

// ============================================================================
// Interfaces
// ============================================================================

/**
 * Valid skip categories describing why a test is skipped.
 */
export type SkipCategory =
  | 'not-implemented'
  | 'flaky'
  | 'environment'
  | 'blocked'
  | 'deprecated';

/**
 * A single registry entry for a skipped or todo test.
 */
export interface SkipEntry {
  /** Relative path to the test file */
  testFile: string;
  /** Name of the skipped test or describe block */
  testName: string;
  /** Human-readable reason for skipping */
  reason: string;
  /** Optional issue/ticket reference (e.g. "JIRA-123") */
  ticket?: string;
  /** ISO date string when the skip was added */
  addedDate: string;
  /** Optional ISO date string for when the skip should be resolved */
  targetDate?: string;
  /** Classification category */
  category?: SkipCategory;
}

// ============================================================================
// Implementation
// ============================================================================

/**
 * SkipRegistry
 *
 * In-memory collection of skipped test entries with querying,
 * expiry detection, and JSON serialization support.
 */
export class SkipRegistry {
  private entries: SkipEntry[] = [];

  // --------------------------------------------------------------------------
  // Registration
  // --------------------------------------------------------------------------

  /**
   * Register a skipped test entry.
   */
  register(entry: SkipEntry): void {
    this.entries.push(entry);
  }

  // --------------------------------------------------------------------------
  // Querying
  // --------------------------------------------------------------------------

  /**
   * Return all registered skip entries.
   */
  list(): SkipEntry[] {
    return [...this.entries];
  }

  /**
   * Return the count of registered entries.
   */
  size(): number {
    return this.entries.length;
  }

  /**
   * Return entries whose targetDate has passed relative to the given date.
   * Entries without a targetDate are never considered expired.
   */
  getExpired(asOf?: Date): SkipEntry[] {
    const now = asOf ?? new Date();
    return this.entries.filter((entry) => {
      if (!entry.targetDate) return false;
      return new Date(entry.targetDate) < now;
    });
  }

  /**
   * Return entries matching the given category.
   */
  getByCategory(category: SkipCategory): SkipEntry[] {
    return this.entries.filter((entry) => entry.category === category);
  }

  /**
   * Return entries matching the given reason substring (case-insensitive).
   */
  getByReason(reason: string): SkipEntry[] {
    const lower = reason.toLowerCase();
    return this.entries.filter((entry) =>
      entry.reason.toLowerCase().includes(lower),
    );
  }

  /**
   * Return entries belonging to a specific test file.
   */
  getByFile(testFile: string): SkipEntry[] {
    return this.entries.filter((entry) => entry.testFile === testFile);
  }

  /**
   * Return entries that have an associated ticket.
   */
  getWithTickets(): SkipEntry[] {
    return this.entries.filter(
      (entry) => entry.ticket !== undefined && entry.ticket !== '',
    );
  }

  /**
   * Return entries that lack an associated ticket.
   */
  getWithoutTickets(): SkipEntry[] {
    return this.entries.filter(
      (entry) => entry.ticket === undefined || entry.ticket === '',
    );
  }

  /**
   * Remove all entries from the registry.
   */
  clear(): void {
    this.entries = [];
  }

  // --------------------------------------------------------------------------
  // Serialization
  // --------------------------------------------------------------------------

  /**
   * Serialize the registry to a JSON-compatible structure.
   */
  toJSON(): { entries: SkipEntry[]; count: number; timestamp: string } {
    return {
      entries: [...this.entries],
      count: this.entries.length,
      timestamp: new Date().toISOString(),
    };
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a SkipRegistry instance.
 */
export function createSkipRegistry(): SkipRegistry {
  return new SkipRegistry();
}

export default SkipRegistry;
