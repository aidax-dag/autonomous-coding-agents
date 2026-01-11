/**
 * Session Recovery Interfaces
 *
 * Provides session persistence, checkpointing, and recovery for agent operations.
 *
 * @module core/hooks/session-recovery
 */

import { HookConfig } from '../../interfaces/hook.interface.js';

/**
 * Session status enumeration
 */
export enum SessionStatus {
  /** Session is active */
  ACTIVE = 'active',
  /** Session is paused */
  PAUSED = 'paused',
  /** Session is completed */
  COMPLETED = 'completed',
  /** Session failed */
  FAILED = 'failed',
  /** Session is being recovered */
  RECOVERING = 'recovering',
}

/**
 * Checkpoint type enumeration
 */
export enum CheckpointType {
  /** Automatic checkpoint (periodic) */
  AUTO = 'auto',
  /** Manual checkpoint (user-triggered) */
  MANUAL = 'manual',
  /** Pre-operation checkpoint (before risky operations) */
  PRE_OPERATION = 'pre_operation',
  /** Recovery checkpoint (after recovery) */
  RECOVERY = 'recovery',
}

/**
 * Storage backend type
 */
export enum StorageBackend {
  /** In-memory storage (non-persistent) */
  MEMORY = 'memory',
  /** File system storage */
  FILE = 'file',
  /** Custom storage adapter */
  CUSTOM = 'custom',
}

/**
 * Session recovery configuration
 */
export interface SessionRecoveryConfig extends Partial<HookConfig> {
  /** Storage backend to use (default: MEMORY) */
  storageBackend?: StorageBackend;
  /** Storage path for file backend */
  storagePath?: string;
  /** Custom storage adapter */
  storageAdapter?: IStorageAdapter;
  /** Auto-checkpoint interval in milliseconds (0 = disabled, default: 300000 = 5 min) */
  autoCheckpointInterval?: number;
  /** Maximum number of checkpoints to retain (default: 10) */
  maxCheckpoints?: number;
  /** Enable auto-recovery on session start (default: true) */
  autoRecovery?: boolean;
  /** Session expiry time in milliseconds (default: 86400000 = 24 hours) */
  sessionExpiry?: number;
  /** Checkpoint expiry time in milliseconds (default: 604800000 = 7 days) */
  checkpointExpiry?: number;
  /** Enable compression for stored data (default: false) */
  compression?: boolean;
  /** Enable encryption for stored data (default: false) */
  encryption?: boolean;
  /** Encryption key (required if encryption is enabled) */
  encryptionKey?: string;
  /** Enable detailed logging */
  verbose?: boolean;
}

/**
 * Session data
 */
export interface Session {
  /** Unique session ID */
  id: string;
  /** Session name (optional) */
  name?: string;
  /** Session status */
  status: SessionStatus;
  /** Creation timestamp */
  createdAt: Date;
  /** Last update timestamp */
  updatedAt: Date;
  /** Session metadata */
  metadata: SessionMetadata;
  /** Session context data */
  context: SessionContext;
  /** Associated checkpoints */
  checkpointIds: string[];
  /** Tags for organization */
  tags: string[];
}

/**
 * Session metadata
 */
export interface SessionMetadata {
  /** User or agent ID */
  userId?: string;
  /** Agent type */
  agentType?: string;
  /** Project identifier */
  projectId?: string;
  /** Workflow ID (if part of workflow) */
  workflowId?: string;
  /** Parent session ID (for nested sessions) */
  parentSessionId?: string;
  /** Environment info */
  environment?: Record<string, string>;
  /** Custom properties */
  [key: string]: unknown;
}

/**
 * Session context (the actual session state to be preserved)
 */
export interface SessionContext {
  /** Messages/conversation history */
  messages?: unknown[];
  /** Current task state */
  taskState?: unknown;
  /** Tool execution history */
  toolHistory?: unknown[];
  /** Variables and state */
  variables?: Record<string, unknown>;
  /** File changes tracking */
  fileChanges?: FileChange[];
  /** Custom context data */
  custom?: Record<string, unknown>;
}

/**
 * File change record
 */
export interface FileChange {
  /** File path */
  path: string;
  /** Change type */
  type: 'created' | 'modified' | 'deleted';
  /** Timestamp */
  timestamp: Date;
  /** Previous content hash (for rollback) */
  previousHash?: string;
  /** Current content hash */
  currentHash?: string;
}

/**
 * Checkpoint data
 */
export interface Checkpoint {
  /** Unique checkpoint ID */
  id: string;
  /** Associated session ID */
  sessionId: string;
  /** Checkpoint name (optional) */
  name?: string;
  /** Checkpoint type */
  type: CheckpointType;
  /** Creation timestamp */
  createdAt: Date;
  /** Snapshot of session state */
  snapshot: SessionSnapshot;
  /** Checksum for integrity verification */
  checksum: string;
  /** Size in bytes */
  sizeBytes: number;
  /** Tags for organization */
  tags: string[];
}

/**
 * Session snapshot (serialized session state)
 */
export interface SessionSnapshot {
  /** Session ID */
  sessionId: string;
  /** Snapshot timestamp */
  timestamp: Date;
  /** Session status at snapshot time */
  status: SessionStatus;
  /** Serialized context */
  context: SessionContext;
  /** Metadata at snapshot time */
  metadata: SessionMetadata;
  /** Version for compatibility */
  version: string;
}

/**
 * Recovery options
 */
export interface RecoveryOptions {
  /** Checkpoint ID to recover from (uses latest if not specified) */
  checkpointId?: string;
  /** Whether to validate checksum before recovery */
  validateChecksum?: boolean;
  /** Whether to create a recovery checkpoint after restoration */
  createRecoveryCheckpoint?: boolean;
  /** Custom recovery handler */
  onRecovery?: (session: Session, checkpoint: Checkpoint) => void;
}

/**
 * Recovery result
 */
export interface RecoveryResult {
  /** Whether recovery was successful */
  success: boolean;
  /** Recovered session */
  session?: Session;
  /** Checkpoint used for recovery */
  checkpoint?: Checkpoint;
  /** Recovery timestamp */
  timestamp: Date;
  /** Error message if failed */
  error?: string;
  /** Warnings during recovery */
  warnings: string[];
}

/**
 * Session recovery event data
 */
export interface SessionRecoveryEventData {
  /** Event type */
  eventType: 'session_start' | 'session_end' | 'checkpoint_created' | 'checkpoint_restored' | 'auto_checkpoint';
  /** Associated session */
  session: Session;
  /** Associated checkpoint (if applicable) */
  checkpoint?: Checkpoint;
  /** Recovery result (if applicable) */
  recoveryResult?: RecoveryResult;
}

/**
 * Session recovery metrics
 */
export interface SessionRecoveryMetrics {
  /** Total sessions created */
  totalSessions: number;
  /** Total checkpoints created */
  totalCheckpoints: number;
  /** Total recoveries performed */
  totalRecoveries: number;
  /** Successful recoveries */
  successfulRecoveries: number;
  /** Failed recoveries */
  failedRecoveries: number;
  /** Average checkpoint size in bytes */
  averageCheckpointSize: number;
  /** Total storage used in bytes */
  totalStorageBytes: number;
  /** Last checkpoint timestamp */
  lastCheckpointAt?: Date;
  /** Last recovery timestamp */
  lastRecoveryAt?: Date;
}

/**
 * Storage adapter interface
 */
export interface IStorageAdapter {
  /**
   * Initialize the storage
   */
  initialize(): Promise<void>;

  /**
   * Save session data
   */
  saveSession(session: Session): Promise<void>;

  /**
   * Load session data
   */
  loadSession(sessionId: string): Promise<Session | undefined>;

  /**
   * Delete session data
   */
  deleteSession(sessionId: string): Promise<boolean>;

  /**
   * List all sessions
   */
  listSessions(): Promise<Session[]>;

  /**
   * Save checkpoint data
   */
  saveCheckpoint(checkpoint: Checkpoint): Promise<void>;

  /**
   * Load checkpoint data
   */
  loadCheckpoint(checkpointId: string): Promise<Checkpoint | undefined>;

  /**
   * Delete checkpoint data
   */
  deleteCheckpoint(checkpointId: string): Promise<boolean>;

  /**
   * List checkpoints for a session
   */
  listCheckpoints(sessionId: string): Promise<Checkpoint[]>;

  /**
   * Get storage statistics
   */
  getStats(): Promise<StorageStats>;

  /**
   * Clear all data
   */
  clear(): Promise<void>;

  /**
   * Dispose of resources
   */
  dispose(): Promise<void>;
}

/**
 * Storage statistics
 */
export interface StorageStats {
  /** Total sessions stored */
  sessionCount: number;
  /** Total checkpoints stored */
  checkpointCount: number;
  /** Total storage size in bytes */
  totalSizeBytes: number;
  /** Oldest session timestamp */
  oldestSession?: Date;
  /** Newest session timestamp */
  newestSession?: Date;
}

/**
 * Session recovery subscription
 */
export interface SessionRecoverySubscription {
  /** Subscription ID */
  id: string;
  /** Unsubscribe function */
  unsubscribe(): void;
}

/**
 * Callback types
 */
export type SessionStartCallback = (session: Session) => void;
export type SessionEndCallback = (session: Session) => void;
export type CheckpointCreatedCallback = (checkpoint: Checkpoint, session: Session) => void;
export type CheckpointRestoredCallback = (checkpoint: Checkpoint, session: Session) => void;
export type RecoveryFailedCallback = (error: Error, sessionId: string) => void;

/**
 * Default configuration values
 */
export const DEFAULT_SESSION_RECOVERY_CONFIG: Required<
  Omit<
    SessionRecoveryConfig,
    'storageAdapter' | 'storagePath' | 'encryptionKey' | 'name' | 'description' | 'event' | 'conditions'
  >
> = {
  priority: 50, // High priority for session management
  enabled: true,
  timeout: 10000,
  retryOnError: true,
  storageBackend: StorageBackend.MEMORY,
  autoCheckpointInterval: 300000, // 5 minutes
  maxCheckpoints: 10,
  autoRecovery: true,
  sessionExpiry: 86400000, // 24 hours
  checkpointExpiry: 604800000, // 7 days
  compression: false,
  encryption: false,
  verbose: false,
};

/**
 * Session recovery version for compatibility
 */
export const SESSION_RECOVERY_VERSION = '1.0.0';
