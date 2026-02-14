/**
 * Project Memory
 *
 * Cross-session key/value store for project-specific knowledge such as
 * coding conventions, frequently used patterns, team preferences, and
 * domain-specific facts. Data is held in memory and can be persisted to
 * a JSON file for reuse across sessions.
 *
 * @module core/context/project-memory
 */

import * as fs from 'fs/promises';
import { createAgentLogger } from '../../shared/logging/logger';

// ============================================================================
// Implementation
// ============================================================================

const logger = createAgentLogger('project-memory');

/**
 * ProjectMemory
 *
 * Simple typed key/value store with JSON persistence.
 *
 * Typical entries include:
 * - `codingConventions` - style and linting rules
 * - `frequentPatterns` - common code patterns used in the project
 * - `teamPreferences` - naming conventions, review guidelines
 * - `domainKnowledge` - business-specific terminology or constraints
 */
export class ProjectMemory {
  private store: Map<string, unknown> = new Map();

  // --------------------------------------------------------------------------
  // CRUD
  // --------------------------------------------------------------------------

  /**
   * Store a value under the given key, overwriting any previous entry.
   */
  set(key: string, value: unknown): void {
    this.store.set(key, value);
    logger.debug('Memory entry set', { key });
  }

  /**
   * Retrieve the value associated with a key.
   *
   * Returns `undefined` when the key does not exist.
   */
  get<T>(key: string): T | undefined {
    return this.store.get(key) as T | undefined;
  }

  /**
   * Check whether a key exists in the store.
   */
  has(key: string): boolean {
    return this.store.has(key);
  }

  /**
   * Remove a key and its associated value.
   *
   * Returns `true` if the key existed, `false` otherwise.
   */
  delete(key: string): boolean {
    const existed = this.store.delete(key);
    if (existed) {
      logger.debug('Memory entry deleted', { key });
    }
    return existed;
  }

  /**
   * Return a shallow snapshot of all entries as a plain object.
   */
  getAll(): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [key, value] of this.store.entries()) {
      result[key] = value;
    }
    return result;
  }

  // --------------------------------------------------------------------------
  // Persistence
  // --------------------------------------------------------------------------

  /**
   * Persist the current store contents to a JSON file.
   */
  async save(filePath: string): Promise<void> {
    const data = this.getAll();
    const content = JSON.stringify(data, null, 2);
    await fs.writeFile(filePath, content, 'utf-8');
    logger.debug('Project memory saved', { keys: this.store.size, filePath });
  }

  /**
   * Load store contents from a JSON file, replacing in-memory state.
   *
   * If the file does not exist the store is left empty.
   */
  async load(filePath: string): Promise<void> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(content) as Record<string, unknown>;
      this.store.clear();
      for (const [key, value] of Object.entries(data)) {
        this.store.set(key, value);
      }
      logger.debug('Project memory loaded', { keys: this.store.size, filePath });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        this.store.clear();
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
 * Create a ProjectMemory instance.
 */
export function createProjectMemory(): ProjectMemory {
  return new ProjectMemory();
}

export default ProjectMemory;
