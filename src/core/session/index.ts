/**
 * Session Persistence Module
 *
 * Crash-safe JSONL-based session storage with recovery and compaction.
 *
 * @module core/session
 */

// Interfaces & types
export type {
  SessionEntryType,
  SessionEntry,
  SessionInfo,
  IJSONLPersistence,
  ISessionManager,
  RecoveryResult,
  ISessionRecovery,
  CompactionResult,
  CompactionPolicy,
  ISessionCompactor,
} from './interfaces/session.interface';

// JSONL Persistence (#22)
export {
  JSONLPersistence,
  createJSONLPersistence,
  SESSION_STORAGE_CONFIG,
} from './jsonl-persistence';

// Session Recovery (#24)
export { SessionRecovery, createSessionRecovery } from './session-recovery';

// Session Compactor (#25)
export {
  SessionCompactor,
  createSessionCompactor,
  DEFAULT_COMPACTION_POLICY,
} from './session-compactor';

// Session Manager (#23)
export {
  SessionManager,
  createSessionManager,
  type SessionManagerEvents,
} from './session-manager';
