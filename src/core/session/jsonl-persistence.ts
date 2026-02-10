/**
 * JSONL Session Persistence
 *
 * Append-only JSONL file storage for crash-safe session data.
 * Each session maps to a single `.jsonl` file. Writes are atomic
 * at the OS level for entries under 4KB (single write syscall).
 *
 * @module core/session/jsonl-persistence
 */

import { readFile, appendFile, writeFile, rename, unlink, stat, mkdir, readdir } from 'fs/promises';
import * as path from 'path';
import type {
  IJSONLPersistence,
  SessionEntry,
  SessionInfo,
} from './interfaces/session.interface.js';

export const SESSION_STORAGE_CONFIG = {
  baseDir: 'data/sessions',
  fileExtension: '.jsonl',
};

export class JSONLPersistence implements IJSONLPersistence {
  private readonly baseDir: string;

  constructor(baseDir: string) {
    this.baseDir = baseDir;
  }

  private filePath(sessionId: string): string {
    return path.join(this.baseDir, `${sessionId}${SESSION_STORAGE_CONFIG.fileExtension}`);
  }

  async append(sessionId: string, entry: SessionEntry): Promise<void> {
    const fp = this.filePath(sessionId);
    await mkdir(path.dirname(fp), { recursive: true });
    await appendFile(fp, JSON.stringify(entry) + '\n');
  }

  async *readAll(sessionId: string): AsyncIterable<SessionEntry> {
    let content: string;
    try {
      content = await readFile(this.filePath(sessionId), 'utf-8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return;
      }
      throw error;
    }

    const lines = content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        yield JSON.parse(trimmed) as SessionEntry;
      } catch {
        // Corrupted line — skip (expected for crash-truncated last line)
      }
    }
  }

  async readLast(sessionId: string, count: number): Promise<SessionEntry[]> {
    const entries: SessionEntry[] = [];
    for await (const entry of this.readAll(sessionId)) {
      entries.push(entry);
    }
    return entries.slice(-count);
  }

  async compact(
    sessionId: string,
    summarizer: (entries: SessionEntry[]) => SessionEntry,
  ): Promise<void> {
    const entries: SessionEntry[] = [];
    for await (const entry of this.readAll(sessionId)) {
      entries.push(entry);
    }
    if (entries.length === 0) return;

    const summary = summarizer(entries);
    const fp = this.filePath(sessionId);
    const tmpPath = `${fp}.tmp`;

    await writeFile(tmpPath, JSON.stringify(summary) + '\n');
    await rename(tmpPath, fp);
  }

  async exists(sessionId: string): Promise<boolean> {
    try {
      await stat(this.filePath(sessionId));
      return true;
    } catch {
      return false;
    }
  }

  async getInfo(sessionId: string): Promise<SessionInfo | null> {
    const fp = this.filePath(sessionId);

    let fileStat;
    try {
      fileStat = await stat(fp);
    } catch {
      return null;
    }

    let entryCount = 0;
    let firstTimestamp: string | null = null;
    let lastTimestamp: string | null = null;
    let lastEntryType: string | null = null;

    for await (const entry of this.readAll(sessionId)) {
      entryCount++;
      if (!firstTimestamp) firstTimestamp = entry.timestamp;
      lastTimestamp = entry.timestamp;
      lastEntryType = entry.type;
    }

    if (entryCount === 0) return null;

    let status: SessionInfo['status'] = 'active';
    if (
      lastEntryType === 'state_change' &&
      entryCount > 0
    ) {
      // Check if last entry is a session_end
      const lastEntries = await this.readLast(sessionId, 1);
      if (
        lastEntries.length > 0 &&
        lastEntries[0].type === 'state_change' &&
        (lastEntries[0].data as Record<string, unknown>)?.action === 'session_end'
      ) {
        status = 'closed';
      }
    }

    return {
      sessionId,
      createdAt: firstTimestamp!,
      lastActivityAt: lastTimestamp!,
      entryCount,
      sizeBytes: fileStat.size,
      status,
    };
  }

  async delete(sessionId: string): Promise<boolean> {
    try {
      await unlink(this.filePath(sessionId));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * List all session IDs by scanning the base directory.
   */
  async listSessionIds(): Promise<string[]> {
    try {
      const files = await readdir(this.baseDir);
      return files
        .filter((f) => f.endsWith(SESSION_STORAGE_CONFIG.fileExtension))
        .map((f) => f.slice(0, -SESSION_STORAGE_CONFIG.fileExtension.length));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }
}

export async function createJSONLPersistence(
  options?: { baseDir?: string },
): Promise<JSONLPersistence> {
  const baseDir = options?.baseDir ?? SESSION_STORAGE_CONFIG.baseDir;
  await mkdir(baseDir, { recursive: true });
  return new JSONLPersistence(baseDir);
}
