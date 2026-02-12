/**
 * Session Recovery
 *
 * Detects and recovers incomplete sessions after crashes.
 * A session is "incomplete" when it has no `state_change { action: 'session_end' }` entry.
 * Corrupted trailing lines (crash-truncated) are counted but skipped.
 *
 * @module core/session/session-recovery
 */

import type {
  ISessionRecovery,
  IJSONLPersistence,
  RecoveryResult,
  SessionEntry,
} from './interfaces/session.interface';
import type { JSONLPersistence } from './jsonl-persistence';

export class SessionRecovery implements ISessionRecovery {
  private readonly persistence: IJSONLPersistence & { listSessionIds(): Promise<string[]> };

  constructor(persistence: IJSONLPersistence & { listSessionIds(): Promise<string[]> }) {
    this.persistence = persistence;
  }

  async detectIncompleteSession(sessionId: string): Promise<boolean> {
    const exists = await this.persistence.exists(sessionId);
    if (!exists) return false;

    const lastEntries = await this.persistence.readLast(sessionId, 1);
    if (lastEntries.length === 0) return true;

    const last = lastEntries[0];
    return !(
      last.type === 'state_change' &&
      (last.data as Record<string, unknown>)?.action === 'session_end'
    );
  }

  async recover(sessionId: string): Promise<RecoveryResult> {
    const exists = await this.persistence.exists(sessionId);
    if (!exists) {
      return {
        sessionId,
        entriesRecovered: 0,
        lastValidEntry: null,
        corruptedLines: 0,
        status: 'failed',
      };
    }

    let entriesRecovered = 0;
    let lastValidEntry: SessionEntry | null = null;

    for await (const entry of this.persistence.readAll(sessionId)) {
      entriesRecovered++;
      lastValidEntry = entry;
    }

    // Determine corrupted lines by comparing info entryCount vs raw line count
    const info = await this.persistence.getInfo(sessionId);
    const corruptedLines = info ? Math.max(0, info.entryCount - entriesRecovered) : 0;

    if (entriesRecovered === 0) {
      return {
        sessionId,
        entriesRecovered: 0,
        lastValidEntry: null,
        corruptedLines,
        status: 'empty',
      };
    }

    return {
      sessionId,
      entriesRecovered,
      lastValidEntry,
      corruptedLines,
      status: corruptedLines > 0 ? 'partial' : 'full',
    };
  }

  async recoverAll(): Promise<RecoveryResult[]> {
    const sessionIds = await this.persistence.listSessionIds();
    const results: RecoveryResult[] = [];

    for (const sessionId of sessionIds) {
      const isIncomplete = await this.detectIncompleteSession(sessionId);
      if (isIncomplete) {
        results.push(await this.recover(sessionId));
      }
    }

    return results;
  }
}

export function createSessionRecovery(options: {
  persistence: JSONLPersistence;
}): SessionRecovery {
  return new SessionRecovery(options.persistence);
}
