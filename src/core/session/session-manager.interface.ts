/**
 * Session Manager Interfaces
 *
 * Provides session lifecycle management, multi-session support, and migration capabilities.
 * Works on top of the Session Recovery Hook for persistence.
 *
 * @module core/session
 */

import {
  Session,
  SessionStatus,
  SessionContext,
  SessionMetadata,
  SessionSnapshot,
  Checkpoint,
  CheckpointType,
  IStorageAdapter,
  StorageBackend,
} from '../hooks/session-recovery/session-recovery.interface.js';

// Re-export types from session-recovery for convenience
export {
  Session,
  SessionStatus,
  SessionContext,
  SessionMetadata,
  SessionSnapshot,
  Checkpoint,
  CheckpointType,
  IStorageAdapter,
  StorageBackend,
};

/**
 * Session creation configuration
 */
export interface SessionCreateConfig {
  /** Optional session name */
  name?: string;
  /** Initial metadata */
  metadata?: Partial<SessionMetadata>;
  /** Initial context */
  context?: Partial<SessionContext>;
  /** Tags for organization */
  tags?: string[];
  /** Parent session ID (for nested sessions) */
  parentSessionId?: string;
  /** Whether to set as current session (default: true) */
  setAsCurrent?: boolean;
}

/**
 * Session query filters
 */
export interface SessionQueryFilter {
  /** Filter by status */
  status?: SessionStatus | SessionStatus[];
  /** Filter by tags (any match) */
  tags?: string[];
  /** Filter by all tags (must have all) */
  allTags?: string[];
  /** Filter by user ID */
  userId?: string;
  /** Filter by agent type */
  agentType?: string;
  /** Filter by project ID */
  projectId?: string;
  /** Filter by workflow ID */
  workflowId?: string;
  /** Created after this date */
  createdAfter?: Date;
  /** Created before this date */
  createdBefore?: Date;
  /** Updated after this date */
  updatedAfter?: Date;
  /** Updated before this date */
  updatedBefore?: Date;
  /** Exclude expired sessions */
  excludeExpired?: boolean;
  /** Limit results */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
  /** Sort by field */
  sortBy?: 'createdAt' | 'updatedAt' | 'name';
  /** Sort order */
  sortOrder?: 'asc' | 'desc';
}

/**
 * Session update data
 */
export interface SessionUpdateData {
  /** Update name */
  name?: string;
  /** Update status */
  status?: SessionStatus;
  /** Update metadata (merged) */
  metadata?: Partial<SessionMetadata>;
  /** Update context (merged) */
  context?: Partial<SessionContext>;
  /** Add tags */
  addTags?: string[];
  /** Remove tags */
  removeTags?: string[];
}

/**
 * Exported session format for migration
 */
export interface ExportedSession {
  /** Export format version */
  version: string;
  /** Export timestamp */
  exportedAt: Date;
  /** Original session data */
  session: Session;
  /** All checkpoints for this session */
  checkpoints: Checkpoint[];
  /** Export metadata */
  exportMetadata: ExportMetadata;
}

/**
 * Export metadata
 */
export interface ExportMetadata {
  /** Source system identifier */
  sourceSystem?: string;
  /** Source environment */
  sourceEnvironment?: string;
  /** Export reason */
  reason?: string;
  /** Custom metadata */
  custom?: Record<string, unknown>;
}

/**
 * Import options
 */
export interface ImportOptions {
  /** Generate new session ID (default: true) */
  generateNewId?: boolean;
  /** Preserve original timestamps (default: false) */
  preserveTimestamps?: boolean;
  /** Merge with existing session if same ID (default: false) */
  mergeIfExists?: boolean;
  /** Skip checkpoints import (default: false) */
  skipCheckpoints?: boolean;
  /** Set as current session after import (default: false) */
  setAsCurrent?: boolean;
  /** Custom ID to use (if generateNewId is false) */
  customId?: string;
  /** Additional tags to add */
  additionalTags?: string[];
  /** Metadata overrides */
  metadataOverrides?: Partial<SessionMetadata>;
}

/**
 * Import result
 */
export interface ImportResult {
  /** Whether import was successful */
  success: boolean;
  /** Imported session */
  session?: Session;
  /** Imported checkpoints count */
  checkpointsImported: number;
  /** Warnings during import */
  warnings: string[];
  /** Error if failed */
  error?: string;
}

/**
 * Session event types
 */
export enum SessionEventType {
  /** Session created */
  CREATED = 'created',
  /** Session updated */
  UPDATED = 'updated',
  /** Session ended */
  ENDED = 'ended',
  /** Session deleted */
  DELETED = 'deleted',
  /** Current session changed */
  CURRENT_CHANGED = 'current_changed',
  /** Checkpoint created */
  CHECKPOINT_CREATED = 'checkpoint_created',
  /** Checkpoint restored */
  CHECKPOINT_RESTORED = 'checkpoint_restored',
  /** Session exported */
  EXPORTED = 'exported',
  /** Session imported */
  IMPORTED = 'imported',
  /** Session recovered */
  RECOVERED = 'recovered',
}

/**
 * Session change event
 */
export interface SessionEvent {
  /** Event type */
  type: SessionEventType;
  /** Event timestamp */
  timestamp: Date;
  /** Associated session ID */
  sessionId: string;
  /** Associated session (if available) */
  session?: Session;
  /** Previous session state (for updates) */
  previousState?: Session;
  /** Associated checkpoint (if applicable) */
  checkpoint?: Checkpoint;
  /** Additional event data */
  data?: Record<string, unknown>;
}

/**
 * Session statistics
 */
export interface SessionStatistics {
  /** Total sessions */
  totalSessions: number;
  /** Active sessions */
  activeSessions: number;
  /** Paused sessions */
  pausedSessions: number;
  /** Completed sessions */
  completedSessions: number;
  /** Failed sessions */
  failedSessions: number;
  /** Total checkpoints */
  totalCheckpoints: number;
  /** Average checkpoints per session */
  avgCheckpointsPerSession: number;
  /** Total storage used (bytes) */
  totalStorageBytes: number;
  /** Oldest session date */
  oldestSessionDate?: Date;
  /** Newest session date */
  newestSessionDate?: Date;
  /** Sessions by agent type */
  sessionsByAgentType: Record<string, number>;
  /** Sessions by project */
  sessionsByProject: Record<string, number>;
}

/**
 * Checkpoint creation options
 */
export interface CheckpointOptions {
  /** Checkpoint name */
  name?: string;
  /** Checkpoint type */
  type?: CheckpointType;
  /** Tags */
  tags?: string[];
  /** Custom metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Session Manager configuration
 */
export interface SessionManagerConfig {
  /** Storage backend to use */
  storageBackend?: StorageBackend;
  /** Storage path for file backend */
  storagePath?: string;
  /** Custom storage adapter */
  storageAdapter?: IStorageAdapter;
  /** Auto-checkpoint interval in milliseconds (0 = disabled) */
  autoCheckpointInterval?: number;
  /** Maximum checkpoints per session */
  maxCheckpointsPerSession?: number;
  /** Session expiry time in milliseconds */
  sessionExpiry?: number;
  /** Checkpoint expiry time in milliseconds */
  checkpointExpiry?: number;
  /** Enable auto-cleanup of expired sessions */
  autoCleanup?: boolean;
  /** Cleanup interval in milliseconds */
  cleanupInterval?: number;
  /** Enable compression */
  compression?: boolean;
  /** Enable encryption */
  encryption?: boolean;
  /** Encryption key */
  encryptionKey?: string;
  /** Enable detailed logging */
  verbose?: boolean;
}

/**
 * Session Manager subscription
 */
export interface SessionManagerSubscription {
  /** Subscription ID */
  id: string;
  /** Unsubscribe function */
  unsubscribe(): void;
}

/**
 * Callback types
 */
export type SessionEventCallback = (event: SessionEvent) => void;
export type SessionCreatedCallback = (session: Session) => void;
export type SessionEndedCallback = (session: Session) => void;
export type CurrentSessionChangedCallback = (
  current: Session | undefined,
  previous: Session | undefined
) => void;

/**
 * Session Manager interface
 */
export interface ISessionManager {
  // ==================== Session Lifecycle ====================

  /**
   * Create a new session
   */
  createSession(config?: SessionCreateConfig): Promise<Session>;

  /**
   * Get a session by ID
   */
  getSession(sessionId: string): Promise<Session | undefined>;

  /**
   * Get the current active session
   */
  getCurrentSession(): Session | undefined;

  /**
   * Set the current session
   */
  setCurrentSession(sessionId: string | undefined): Promise<void>;

  /**
   * Update a session
   */
  updateSession(sessionId: string, data: SessionUpdateData): Promise<Session>;

  /**
   * End a session (marks as completed)
   */
  endSession(sessionId: string): Promise<void>;

  /**
   * Delete a session and its checkpoints
   */
  deleteSession(sessionId: string): Promise<boolean>;

  // ==================== Session Queries ====================

  /**
   * List all sessions
   */
  listSessions(filter?: SessionQueryFilter): Promise<Session[]>;

  /**
   * Count sessions matching filter
   */
  countSessions(filter?: SessionQueryFilter): Promise<number>;

  /**
   * Check if session exists
   */
  sessionExists(sessionId: string): Promise<boolean>;

  // ==================== State Management ====================

  /**
   * Save current state of a session as a snapshot
   */
  saveState(sessionId: string): Promise<SessionSnapshot>;

  /**
   * Restore session from a snapshot
   */
  restoreState(snapshot: SessionSnapshot): Promise<Session>;

  /**
   * Get all snapshots for a session (from checkpoints)
   */
  getSnapshots(sessionId: string): Promise<SessionSnapshot[]>;

  // ==================== Checkpoints ====================

  /**
   * Create a checkpoint for a session
   */
  createCheckpoint(sessionId: string, options?: CheckpointOptions): Promise<Checkpoint>;

  /**
   * Create a checkpoint for the current session
   */
  createCurrentCheckpoint(options?: CheckpointOptions): Promise<Checkpoint>;

  /**
   * Restore session from a checkpoint
   */
  restoreFromCheckpoint(checkpointId: string): Promise<Session>;

  /**
   * List checkpoints for a session
   */
  listCheckpoints(sessionId: string): Promise<Checkpoint[]>;

  /**
   * Get a specific checkpoint
   */
  getCheckpoint(checkpointId: string): Promise<Checkpoint | undefined>;

  /**
   * Delete a checkpoint
   */
  deleteCheckpoint(checkpointId: string): Promise<boolean>;

  // ==================== Migration ====================

  /**
   * Export a session for migration
   */
  exportSession(sessionId: string, metadata?: ExportMetadata): Promise<ExportedSession>;

  /**
   * Import a session from export data
   */
  importSession(data: ExportedSession, options?: ImportOptions): Promise<ImportResult>;

  /**
   * Validate export data before import
   */
  validateExport(data: ExportedSession): Promise<{ valid: boolean; errors: string[] }>;

  // ==================== Statistics ====================

  /**
   * Get session statistics
   */
  getStatistics(): Promise<SessionStatistics>;

  // ==================== Maintenance ====================

  /**
   * Clean up expired sessions and checkpoints
   */
  cleanup(): Promise<{ sessionsDeleted: number; checkpointsDeleted: number }>;

  /**
   * Initialize the session manager
   */
  initialize(): Promise<void>;

  /**
   * Dispose of resources
   */
  dispose(): Promise<void>;

  // ==================== Events ====================

  /**
   * Subscribe to all session events
   */
  onSessionEvent(callback: SessionEventCallback): SessionManagerSubscription;

  /**
   * Subscribe to session created events
   */
  onSessionCreated(callback: SessionCreatedCallback): SessionManagerSubscription;

  /**
   * Subscribe to session ended events
   */
  onSessionEnded(callback: SessionEndedCallback): SessionManagerSubscription;

  /**
   * Subscribe to current session changes
   */
  onCurrentSessionChanged(callback: CurrentSessionChangedCallback): SessionManagerSubscription;
}

/**
 * Default configuration values
 */
export const DEFAULT_SESSION_MANAGER_CONFIG: Required<
  Omit<SessionManagerConfig, 'storageAdapter' | 'storagePath' | 'encryptionKey'>
> = {
  storageBackend: StorageBackend.MEMORY,
  autoCheckpointInterval: 300000, // 5 minutes
  maxCheckpointsPerSession: 10,
  sessionExpiry: 86400000, // 24 hours
  checkpointExpiry: 604800000, // 7 days
  autoCleanup: true,
  cleanupInterval: 3600000, // 1 hour
  compression: false,
  encryption: false,
  verbose: false,
};

/**
 * Session Manager export version
 */
export const SESSION_MANAGER_EXPORT_VERSION = '1.0.0';
