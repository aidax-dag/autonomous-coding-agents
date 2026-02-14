/**
 * Session Store
 *
 * Persistent session storage using JSON files in the project's
 * `.aca/sessions/` directory. Provides save, load, list, and delete
 * operations for session lifecycle management.
 *
 * @module core/context/session-store
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { createAgentLogger } from '../../shared/logging/logger';

// ============================================================================
// Interfaces
// ============================================================================

/**
 * Full session data persisted to disk.
 */
export interface SessionData {
  /** Unique session identifier */
  id: string;
  /** Absolute path to the project root */
  projectRoot: string;
  /** ISO timestamp when the session started */
  startedAt: string;
  /** ISO timestamp when the session ended (empty while active) */
  endedAt: string | null;
  /** Arbitrary metadata attached to the session */
  metadata: Record<string, unknown>;
  /** Architectural decisions recorded during the session */
  decisions: string[];
  /** File paths or identifiers of artifacts produced */
  artifacts: string[];
}

/**
 * Lightweight summary returned by {@link SessionStore.list}.
 */
export interface SessionSummary {
  id: string;
  projectRoot: string;
  startedAt: string;
  endedAt: string | null;
  taskCount: number;
}

// ============================================================================
// Constants
// ============================================================================

/** Default storage directory relative to the project root */
const SESSIONS_DIR = '.aca/sessions';

// ============================================================================
// Implementation
// ============================================================================

const logger = createAgentLogger('session-store');

/**
 * SessionStore
 *
 * Manages persistent session storage as individual JSON files inside
 * the `.aca/sessions/` directory. The directory is created automatically
 * on the first write operation.
 */
export class SessionStore {
  private readonly baseDir: string;

  constructor(projectRoot: string) {
    this.baseDir = path.join(projectRoot, SESSIONS_DIR);
  }

  // --------------------------------------------------------------------------
  // Public API
  // --------------------------------------------------------------------------

  /**
   * Persist a session to disk.
   *
   * Creates the storage directory if it does not exist and writes the
   * session as a pretty-printed JSON file named `{id}.json`.
   */
  async save(session: SessionData): Promise<void> {
    await this.ensureDir();
    const filePath = this.sessionPath(session.id);
    const content = JSON.stringify(session, null, 2);
    await fs.writeFile(filePath, content, 'utf-8');
    logger.debug('Session saved', { id: session.id });
  }

  /**
   * Load a session by its identifier.
   *
   * Returns `null` when the session file does not exist.
   */
  async load(sessionId: string): Promise<SessionData | null> {
    const filePath = this.sessionPath(sessionId);
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content) as SessionData;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  /**
   * List stored sessions, optionally filtering by project root.
   *
   * Returns lightweight summaries sorted by `startedAt` descending
   * (most recent first).
   */
  async list(projectRoot?: string): Promise<SessionSummary[]> {
    let files: string[];
    try {
      files = await fs.readdir(this.baseDir);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return [];
      }
      throw error;
    }

    const summaries: SessionSummary[] = [];

    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      const filePath = path.join(this.baseDir, file);
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const session = JSON.parse(content) as SessionData;

        if (projectRoot && session.projectRoot !== projectRoot) {
          continue;
        }

        summaries.push({
          id: session.id,
          projectRoot: session.projectRoot,
          startedAt: session.startedAt,
          endedAt: session.endedAt,
          taskCount: session.artifacts.length,
        });
      } catch {
        logger.warn('Skipping corrupt session file', { file });
      }
    }

    summaries.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
    return summaries;
  }

  /**
   * Delete a session file.
   *
   * Silently succeeds if the session does not exist.
   */
  async delete(sessionId: string): Promise<void> {
    const filePath = this.sessionPath(sessionId);
    try {
      await fs.unlink(filePath);
      logger.debug('Session deleted', { id: sessionId });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  // --------------------------------------------------------------------------
  // Private Helpers
  // --------------------------------------------------------------------------

  private sessionPath(sessionId: string): string {
    return path.join(this.baseDir, `${sessionId}.json`);
  }

  private async ensureDir(): Promise<void> {
    await fs.mkdir(this.baseDir, { recursive: true });
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a SessionStore instance.
 */
export function createSessionStore(projectRoot: string): SessionStore {
  return new SessionStore(projectRoot);
}

export default SessionStore;
