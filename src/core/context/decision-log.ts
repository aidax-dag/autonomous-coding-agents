/**
 * Decision Log
 *
 * Tracks architectural decisions made during development sessions.
 * Supports recording, querying by category, free-text search, and
 * persistence to a JSON file.
 *
 * @module core/context/decision-log
 */

import * as fs from 'fs/promises';
import { createAgentLogger } from '../../shared/logging/logger';

// ============================================================================
// Interfaces
// ============================================================================

/**
 * A single recorded architectural decision.
 */
export interface ArchitecturalDecision {
  /** Unique decision identifier */
  id: string;
  /** Short descriptive title */
  title: string;
  /** Detailed description of the decision */
  description: string;
  /** Reasoning behind the decision */
  rationale: string;
  /** Alternatives that were considered */
  alternatives: string[];
  /** Classification category (e.g. "database", "api", "security") */
  category: string;
  /** ISO timestamp when the decision was recorded */
  timestamp: string;
  /** Current status: accepted, superseded, or deprecated */
  status: 'accepted' | 'superseded' | 'deprecated';
}

// ============================================================================
// Implementation
// ============================================================================

const logger = createAgentLogger('decision-log');

/**
 * DecisionLog
 *
 * In-memory collection of architectural decisions with persistence
 * support. Decisions are stored in insertion order and can be queried
 * by category or free-text search across title, description, and rationale.
 */
export class DecisionLog {
  private decisions: ArchitecturalDecision[] = [];

  // --------------------------------------------------------------------------
  // Recording
  // --------------------------------------------------------------------------

  /**
   * Record a new architectural decision.
   */
  record(decision: ArchitecturalDecision): void {
    this.decisions.push(decision);
    logger.debug('Decision recorded', { id: decision.id, category: decision.category });
  }

  // --------------------------------------------------------------------------
  // Querying
  // --------------------------------------------------------------------------

  /**
   * Return all recorded decisions.
   */
  getAll(): ArchitecturalDecision[] {
    return [...this.decisions];
  }

  /**
   * Return decisions matching the given category (case-insensitive).
   */
  getByCategory(category: string): ArchitecturalDecision[] {
    const lower = category.toLowerCase();
    return this.decisions.filter((d) => d.category.toLowerCase() === lower);
  }

  /**
   * Search decisions by a free-text query.
   *
   * Matches against title, description, and rationale fields
   * using case-insensitive substring matching.
   */
  search(query: string): ArchitecturalDecision[] {
    const lower = query.toLowerCase();
    return this.decisions.filter((d) => {
      return (
        d.title.toLowerCase().includes(lower) ||
        d.description.toLowerCase().includes(lower) ||
        d.rationale.toLowerCase().includes(lower)
      );
    });
  }

  // --------------------------------------------------------------------------
  // Persistence
  // --------------------------------------------------------------------------

  /**
   * Save all decisions to a JSON file.
   */
  async save(filePath: string): Promise<void> {
    const content = JSON.stringify(this.decisions, null, 2);
    await fs.writeFile(filePath, content, 'utf-8');
    logger.debug('Decisions saved', { count: this.decisions.length, filePath });
  }

  /**
   * Load decisions from a JSON file, replacing in-memory state.
   *
   * If the file does not exist the log is left empty.
   */
  async load(filePath: string): Promise<void> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      this.decisions = JSON.parse(content) as ArchitecturalDecision[];
      logger.debug('Decisions loaded', { count: this.decisions.length, filePath });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        this.decisions = [];
        return;
      }
      throw error;
    }
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a DecisionLog instance.
 */
export function createDecisionLog(): DecisionLog {
  return new DecisionLog();
}

export default DecisionLog;
