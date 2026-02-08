/**
 * JSONL Storage Adapter
 *
 * Append-only JSONL file storage for crash-safe session persistence.
 * Each session gets its own `.jsonl` file with append-only entries.
 *
 * Entry format: { type, timestamp, data }
 * - type: 'session' | 'checkpoint' | 'delete_checkpoint' | 'delete_session'
 * - timestamp: ISO string
 * - data: session or checkpoint object
 *
 * On load, replays entries to reconstruct current state.
 * Crash-safe: partial writes on the last line are skipped.
 *
 * @module core/session
 */

import { mkdir, readFile, writeFile, appendFile, readdir, unlink, rename, stat } from 'fs/promises';
import { join, basename } from 'path';
import { createLogger, ILogger } from '../services/logger.js';
import type {
  IStorageAdapter,
  Session,
  Checkpoint,
} from '../hooks/session-recovery/session-recovery.interface.js';

// ============================================================================
// Types
// ============================================================================

/** Entry types in the JSONL log */
type EntryType = 'session' | 'checkpoint' | 'delete_checkpoint' | 'delete_session';

/** A single JSONL entry */
interface JournalEntry {
  type: EntryType;
  timestamp: string;
  data: unknown;
}

/** Reconstructed state from a JSONL file */
interface ReplayedState {
  session: Session | null;
  checkpoints: Map<string, Checkpoint>;
  deleted: boolean;
}

// ============================================================================
// JSONLStorageAdapter
// ============================================================================

export interface JSONLStorageAdapterConfig {
  /** Base directory for JSONL files */
  basePath: string;
  /** Whether to fsync after writes (default: false — better perf, still append-safe) */
  fsync?: boolean;
}

/**
 * JSONL-based storage adapter implementing IStorageAdapter.
 *
 * Each session is stored in `{basePath}/{sessionId}.jsonl`.
 * Entries are appended; the full state is reconstructed by replaying.
 */
export class JSONLStorageAdapter implements IStorageAdapter {
  private readonly basePath: string;
  private readonly logger: ILogger;

  /** In-memory index rebuilt from disk on initialize() */
  private sessionIndex = new Map<string, Session>();
  private checkpointIndex = new Map<string, Checkpoint>();
  private initialized = false;

  constructor(config: JSONLStorageAdapterConfig) {
    this.basePath = config.basePath;
    this.logger = createLogger('JSONLStorageAdapter');
  }

  // =========================================================================
  // IStorageAdapter — Lifecycle
  // =========================================================================

  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Ensure base directory exists
    await mkdir(this.basePath, { recursive: true });

    // Rebuild index from existing JSONL files
    await this.rebuildIndex();

    this.initialized = true;
  }

  async dispose(): Promise<void> {
    this.sessionIndex.clear();
    this.checkpointIndex.clear();
    this.initialized = false;
  }

  // =========================================================================
  // IStorageAdapter — Sessions
  // =========================================================================

  async saveSession(session: Session): Promise<void> {
    const entry: JournalEntry = {
      type: 'session',
      timestamp: new Date().toISOString(),
      data: session,
    };
    await this.appendEntry(session.id, entry);
    this.sessionIndex.set(session.id, { ...session });
  }

  async loadSession(sessionId: string): Promise<Session | undefined> {
    const session = this.sessionIndex.get(sessionId);
    return session ? { ...session } : undefined;
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    if (!this.sessionIndex.has(sessionId)) return false;

    // Append a delete marker
    const entry: JournalEntry = {
      type: 'delete_session',
      timestamp: new Date().toISOString(),
      data: { sessionId },
    };
    await this.appendEntry(sessionId, entry);

    // Remove from index
    this.sessionIndex.delete(sessionId);

    // Remove associated checkpoints from index
    for (const [id, cp] of this.checkpointIndex) {
      if (cp.sessionId === sessionId) {
        this.checkpointIndex.delete(id);
      }
    }

    return true;
  }

  async listSessions(): Promise<Session[]> {
    return Array.from(this.sessionIndex.values()).map((s) => ({ ...s }));
  }

  // =========================================================================
  // IStorageAdapter — Checkpoints
  // =========================================================================

  async saveCheckpoint(checkpoint: Checkpoint): Promise<void> {
    const entry: JournalEntry = {
      type: 'checkpoint',
      timestamp: new Date().toISOString(),
      data: checkpoint,
    };
    await this.appendEntry(checkpoint.sessionId, entry);
    this.checkpointIndex.set(checkpoint.id, { ...checkpoint });
  }

  async loadCheckpoint(checkpointId: string): Promise<Checkpoint | undefined> {
    const checkpoint = this.checkpointIndex.get(checkpointId);
    return checkpoint ? { ...checkpoint } : undefined;
  }

  async deleteCheckpoint(checkpointId: string): Promise<boolean> {
    const checkpoint = this.checkpointIndex.get(checkpointId);
    if (!checkpoint) return false;

    const entry: JournalEntry = {
      type: 'delete_checkpoint',
      timestamp: new Date().toISOString(),
      data: { checkpointId },
    };
    await this.appendEntry(checkpoint.sessionId, entry);

    this.checkpointIndex.delete(checkpointId);
    return true;
  }

  async listCheckpoints(sessionId: string): Promise<Checkpoint[]> {
    return Array.from(this.checkpointIndex.values())
      .filter((c) => c.sessionId === sessionId)
      .map((c) => ({ ...c }));
  }

  // =========================================================================
  // IStorageAdapter — Stats
  // =========================================================================

  async getStats(): Promise<{ sessionCount: number; checkpointCount: number; totalSizeBytes: number }> {
    let totalSizeBytes = 0;

    try {
      const files = await readdir(this.basePath);
      for (const file of files) {
        if (file.endsWith('.jsonl')) {
          const fileStat = await stat(join(this.basePath, file)).catch(() => null);
          if (fileStat) totalSizeBytes += fileStat.size;
        }
      }
    } catch {
      // Directory might not exist yet
    }

    return {
      sessionCount: this.sessionIndex.size,
      checkpointCount: this.checkpointIndex.size,
      totalSizeBytes,
    };
  }

  async clear(): Promise<void> {
    try {
      const files = await readdir(this.basePath);
      for (const file of files) {
        if (file.endsWith('.jsonl')) {
          await unlink(join(this.basePath, file)).catch(() => {});
        }
      }
    } catch {
      // Directory might not exist
    }

    this.sessionIndex.clear();
    this.checkpointIndex.clear();
  }

  // =========================================================================
  // Public — Compaction
  // =========================================================================

  /**
   * Compact a session's JSONL file.
   * Replays all entries, then writes a single snapshot with only current state.
   * Uses atomic rename for crash safety.
   */
  async compact(sessionId: string): Promise<{ entriesBefore: number; entriesAfter: number }> {
    const filePath = this.sessionFilePath(sessionId);
    const state = await this.replayFile(filePath);

    if (!state.session || state.deleted) {
      // Session is deleted — remove the file entirely
      await unlink(filePath).catch(() => {});
      return { entriesBefore: 0, entriesAfter: 0 };
    }

    // Count entries before
    const rawContent = await readFile(filePath, 'utf-8').catch(() => '');
    const entriesBefore = rawContent.split('\n').filter((l) => l.trim()).length;

    // Build compacted entries: one session + each active checkpoint
    const lines: string[] = [];
    lines.push(JSON.stringify({ type: 'session', timestamp: new Date().toISOString(), data: state.session }));
    for (const checkpoint of state.checkpoints.values()) {
      lines.push(JSON.stringify({ type: 'checkpoint', timestamp: new Date().toISOString(), data: checkpoint }));
    }

    // Atomic write: write to temp, then rename
    const tmpPath = filePath + '.tmp';
    await writeFile(tmpPath, lines.join('\n') + '\n', 'utf-8');
    await rename(tmpPath, filePath);

    return { entriesBefore, entriesAfter: lines.length };
  }

  /**
   * Compact all session files.
   */
  async compactAll(): Promise<{ filesCompacted: number; totalEntriesReduced: number }> {
    let filesCompacted = 0;
    let totalEntriesReduced = 0;

    try {
      const files = await readdir(this.basePath);
      for (const file of files) {
        if (!file.endsWith('.jsonl')) continue;
        const sessionId = basename(file, '.jsonl');
        const result = await this.compact(sessionId);
        filesCompacted++;
        totalEntriesReduced += result.entriesBefore - result.entriesAfter;
      }
    } catch {
      // Directory might not exist
    }

    return { filesCompacted, totalEntriesReduced };
  }

  // =========================================================================
  // Private — File I/O
  // =========================================================================

  private sessionFilePath(sessionId: string): string {
    return join(this.basePath, `${sessionId}.jsonl`);
  }

  private async appendEntry(sessionId: string, entry: JournalEntry): Promise<void> {
    const filePath = this.sessionFilePath(sessionId);
    const line = JSON.stringify(entry) + '\n';
    await appendFile(filePath, line, 'utf-8');
  }

  /**
   * Replay a JSONL file to reconstruct session + checkpoint state.
   * Skips malformed lines (crash-safe: partial last line is ignored).
   */
  private async replayFile(filePath: string): Promise<ReplayedState> {
    const state: ReplayedState = {
      session: null,
      checkpoints: new Map(),
      deleted: false,
    };

    let content: string;
    try {
      content = await readFile(filePath, 'utf-8');
    } catch {
      return state; // File doesn't exist
    }

    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      let entry: JournalEntry;
      try {
        entry = JSON.parse(trimmed);
      } catch {
        // Skip malformed line (crash-safe: partial write on last line)
        continue;
      }

      switch (entry.type) {
        case 'session':
          state.session = entry.data as Session;
          state.deleted = false;
          break;
        case 'checkpoint':
          const cp = entry.data as Checkpoint;
          state.checkpoints.set(cp.id, cp);
          break;
        case 'delete_checkpoint':
          const dcData = entry.data as { checkpointId: string };
          state.checkpoints.delete(dcData.checkpointId);
          break;
        case 'delete_session':
          state.session = null;
          state.checkpoints.clear();
          state.deleted = true;
          break;
      }
    }

    return state;
  }

  /**
   * Rebuild the in-memory index by scanning all JSONL files.
   */
  private async rebuildIndex(): Promise<void> {
    this.sessionIndex.clear();
    this.checkpointIndex.clear();

    let files: string[];
    try {
      files = await readdir(this.basePath);
    } catch {
      return; // Directory doesn't exist yet
    }

    for (const file of files) {
      if (!file.endsWith('.jsonl')) continue;

      const filePath = join(this.basePath, file);
      const state = await this.replayFile(filePath);

      if (state.session && !state.deleted) {
        this.sessionIndex.set(state.session.id, state.session);
        for (const cp of state.checkpoints.values()) {
          this.checkpointIndex.set(cp.id, cp);
        }
      }
    }

    this.logger.debug(`Rebuilt index: ${this.sessionIndex.size} sessions, ${this.checkpointIndex.size} checkpoints`);
  }
}

// ============================================================================
// Factory
// ============================================================================

/**
 * Create a JSONL storage adapter
 */
export function createJSONLStorageAdapter(config: JSONLStorageAdapterConfig): JSONLStorageAdapter {
  return new JSONLStorageAdapter(config);
}
