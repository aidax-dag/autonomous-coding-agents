/**
 * Session Manager
 *
 * Lifecycle management for sessions: start, append entries, checkpoint, end.
 * Emits typed events for integration with other modules.
 * Supports auto-checkpoint at configurable intervals.
 *
 * @module core/session/session-manager
 */

import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';
import type {
  ISessionManager,
  IJSONLPersistence,
  ISessionRecovery,
  SessionEntry,
  SessionInfo,
} from './interfaces/session.interface';
import type { JSONLPersistence } from './jsonl-persistence';

export interface SessionManagerEvents {
  'session:start': (sessionId: string) => void;
  'session:end': (sessionId: string) => void;
  'session:entry': (sessionId: string, entry: SessionEntry) => void;
  'session:checkpoint': (sessionId: string) => void;
  'session:error': (sessionId: string, error: Error) => void;
}

// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export class SessionManager extends EventEmitter implements ISessionManager {
  private readonly persistence: IJSONLPersistence & { listSessionIds(): Promise<string[]> };
  private readonly recovery: ISessionRecovery | null;
  private readonly autoCheckpointMs: number;

  private activeSessionId: string | null = null;
  private seqCounter = 0;
  private checkpointTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    persistence: IJSONLPersistence & { listSessionIds(): Promise<string[]> },
    recovery: ISessionRecovery | null,
    autoCheckpointMs: number,
  ) {
    super();
    this.persistence = persistence;
    this.recovery = recovery;
    this.autoCheckpointMs = autoCheckpointMs;
  }

  async startSession(sessionId?: string): Promise<string> {
    const id = sessionId ?? randomUUID();

    // Check for incomplete previous session and attempt recovery
    if (this.recovery) {
      const isIncomplete = await this.recovery.detectIncompleteSession(id);
      if (isIncomplete) {
        await this.recovery.recover(id);
      }
    }

    this.activeSessionId = id;
    this.seqCounter = 0;

    const startEntry: SessionEntry = {
      timestamp: new Date().toISOString(),
      type: 'state_change',
      data: { action: 'session_start' },
      seq: this.seqCounter++,
    };

    await this.persistence.append(id, startEntry);
    this.emit('session:start', id);

    // Start auto-checkpoint timer
    if (this.autoCheckpointMs > 0) {
      this.clearCheckpointTimer();
      this.checkpointTimer = setInterval(() => {
        this.checkpoint(id).catch((err) => {
          this.emit('session:error', id, err instanceof Error ? err : new Error(String(err)));
        });
      }, this.autoCheckpointMs);
    }

    return id;
  }

  async endSession(sessionId: string): Promise<void> {
    const endEntry: SessionEntry = {
      timestamp: new Date().toISOString(),
      type: 'state_change',
      data: { action: 'session_end' },
      seq: this.seqCounter++,
    };

    await this.persistence.append(sessionId, endEntry);
    this.clearCheckpointTimer();

    if (this.activeSessionId === sessionId) {
      this.activeSessionId = null;
    }

    this.emit('session:end', sessionId);
  }

  async appendEntry(
    sessionId: string,
    entry: Omit<SessionEntry, 'timestamp' | 'seq'>,
  ): Promise<void> {
    const fullEntry: SessionEntry = {
      ...entry,
      timestamp: new Date().toISOString(),
      seq: this.seqCounter++,
    };

    await this.persistence.append(sessionId, fullEntry);
    this.emit('session:entry', sessionId, fullEntry);
  }

  async checkpoint(sessionId: string): Promise<void> {
    const cpEntry: SessionEntry = {
      timestamp: new Date().toISOString(),
      type: 'checkpoint',
      data: { seq: this.seqCounter },
      seq: this.seqCounter++,
    };

    await this.persistence.append(sessionId, cpEntry);
    this.emit('session:checkpoint', sessionId);
  }

  getActiveSession(): string | null {
    return this.activeSessionId;
  }

  async listSessions(): Promise<SessionInfo[]> {
    const ids = await this.persistence.listSessionIds();
    const infos: SessionInfo[] = [];

    for (const id of ids) {
      const info = await this.persistence.getInfo(id);
      if (info) infos.push(info);
    }

    return infos;
  }

  async dispose(): Promise<void> {
    this.clearCheckpointTimer();

    if (this.activeSessionId) {
      try {
        await this.endSession(this.activeSessionId);
      } catch {
        // Best-effort cleanup
      }
    }

    this.removeAllListeners();
  }

  private clearCheckpointTimer(): void {
    if (this.checkpointTimer) {
      clearInterval(this.checkpointTimer);
      this.checkpointTimer = null;
    }
  }
}

// Declaration merging for type-safe events
// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export interface SessionManager {
  on<E extends keyof SessionManagerEvents>(event: E, listener: SessionManagerEvents[E]): this;
  emit<E extends keyof SessionManagerEvents>(event: E, ...args: Parameters<SessionManagerEvents[E]>): boolean;
}

export async function createSessionManager(options: {
  persistence: JSONLPersistence;
  recovery?: ISessionRecovery;
  autoCheckpointMs?: number;
}): Promise<SessionManager> {
  const { persistence, recovery = null, autoCheckpointMs = 5 * 60 * 1000 } = options;
  return new SessionManager(persistence, recovery, autoCheckpointMs);
}
