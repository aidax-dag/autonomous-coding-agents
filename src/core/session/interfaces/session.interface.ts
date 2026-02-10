/**
 * Session Persistence Interfaces
 *
 * Types and contracts for JSONL-based crash-safe session storage.
 *
 * @module core/session/interfaces
 */

// --- Core Types ---

export type SessionEntryType =
  | 'user_message'
  | 'agent_response'
  | 'tool_call'
  | 'tool_result'
  | 'state_change'
  | 'checkpoint'
  | 'compaction_summary';

export interface SessionEntry {
  timestamp: string;
  type: SessionEntryType;
  data: unknown;
  metadata?: Record<string, unknown>;
  seq?: number;
}

export interface SessionInfo {
  sessionId: string;
  createdAt: string;
  lastActivityAt: string;
  entryCount: number;
  sizeBytes: number;
  status: 'active' | 'closed' | 'recovering';
}

// --- Persistence (#22) ---

export interface IJSONLPersistence {
  append(sessionId: string, entry: SessionEntry): Promise<void>;
  readAll(sessionId: string): AsyncIterable<SessionEntry>;
  readLast(sessionId: string, count: number): Promise<SessionEntry[]>;
  compact(
    sessionId: string,
    summarizer: (entries: SessionEntry[]) => SessionEntry,
  ): Promise<void>;
  exists(sessionId: string): Promise<boolean>;
  getInfo(sessionId: string): Promise<SessionInfo | null>;
  delete(sessionId: string): Promise<boolean>;
}

// --- Manager (#23) ---

export interface ISessionManager {
  startSession(sessionId?: string): Promise<string>;
  endSession(sessionId: string): Promise<void>;
  appendEntry(
    sessionId: string,
    entry: Omit<SessionEntry, 'timestamp' | 'seq'>,
  ): Promise<void>;
  checkpoint(sessionId: string): Promise<void>;
  getActiveSession(): string | null;
  listSessions(): Promise<SessionInfo[]>;
  dispose(): Promise<void>;
}

// --- Recovery (#24) ---

export interface RecoveryResult {
  sessionId: string;
  entriesRecovered: number;
  lastValidEntry: SessionEntry | null;
  corruptedLines: number;
  status: 'full' | 'partial' | 'empty' | 'failed';
}

export interface ISessionRecovery {
  detectIncompleteSession(sessionId: string): Promise<boolean>;
  recover(sessionId: string): Promise<RecoveryResult>;
  recoverAll(): Promise<RecoveryResult[]>;
}

// --- Compactor (#25) ---

export interface CompactionResult {
  sessionId: string;
  originalEntries: number;
  compactedEntries: number;
  bytesReclaimed: number;
}

export interface CompactionPolicy {
  maxEntries: number;
  maxSizeBytes: number;
  maxAgeMs: number;
  keepRecentCount: number;
}

export interface ISessionCompactor {
  shouldCompact(sessionId: string): Promise<boolean>;
  compact(
    sessionId: string,
    summarizer?: (entries: SessionEntry[]) => SessionEntry,
  ): Promise<CompactionResult>;
  compactAll(): Promise<CompactionResult[]>;
}
