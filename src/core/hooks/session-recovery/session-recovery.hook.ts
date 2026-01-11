/**
 * Session Recovery Hook
 *
 * Provides session persistence, checkpointing, and recovery for agent operations.
 * Supports automatic checkpointing, manual checkpoints, and session restoration.
 *
 * @module core/hooks/session-recovery
 */

import { IDisposable } from '../../di/interfaces/container.interface.js';
import { BaseHook } from '../base-hook.js';
import { HookEvent, HookContext, HookResult } from '../../interfaces/hook.interface.js';
import {
  SessionRecoveryConfig,
  Session,
  SessionStatus,
  SessionContext,
  SessionMetadata,
  Checkpoint,
  CheckpointType,
  SessionSnapshot,
  StorageBackend,
  IStorageAdapter,
  StorageStats,
  RecoveryOptions,
  RecoveryResult,
  SessionRecoveryEventData,
  SessionRecoveryMetrics,
  SessionRecoverySubscription,
  SessionStartCallback,
  SessionEndCallback,
  CheckpointCreatedCallback,
  CheckpointRestoredCallback,
  RecoveryFailedCallback,
  DEFAULT_SESSION_RECOVERY_CONFIG,
  SESSION_RECOVERY_VERSION,
} from './session-recovery.interface.js';

/**
 * In-memory storage adapter implementation
 */
class MemoryStorageAdapter implements IStorageAdapter {
  private sessions: Map<string, Session> = new Map();
  private checkpoints: Map<string, Checkpoint> = new Map();

  async initialize(): Promise<void> {
    // No initialization needed for memory storage
  }

  async saveSession(session: Session): Promise<void> {
    this.sessions.set(session.id, { ...session });
  }

  async loadSession(sessionId: string): Promise<Session | undefined> {
    const session = this.sessions.get(sessionId);
    return session ? { ...session } : undefined;
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    return this.sessions.delete(sessionId);
  }

  async listSessions(): Promise<Session[]> {
    return Array.from(this.sessions.values()).map((s) => ({ ...s }));
  }

  async saveCheckpoint(checkpoint: Checkpoint): Promise<void> {
    this.checkpoints.set(checkpoint.id, { ...checkpoint });
  }

  async loadCheckpoint(checkpointId: string): Promise<Checkpoint | undefined> {
    const checkpoint = this.checkpoints.get(checkpointId);
    return checkpoint ? { ...checkpoint } : undefined;
  }

  async deleteCheckpoint(checkpointId: string): Promise<boolean> {
    return this.checkpoints.delete(checkpointId);
  }

  async listCheckpoints(sessionId: string): Promise<Checkpoint[]> {
    return Array.from(this.checkpoints.values())
      .filter((c) => c.sessionId === sessionId)
      .map((c) => ({ ...c }))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getStats(): Promise<StorageStats> {
    const sessions = Array.from(this.sessions.values());
    const checkpoints = Array.from(this.checkpoints.values());

    let totalSize = 0;
    checkpoints.forEach((c) => (totalSize += c.sizeBytes));

    const timestamps = sessions.map((s) => s.createdAt.getTime());

    return {
      sessionCount: sessions.length,
      checkpointCount: checkpoints.length,
      totalSizeBytes: totalSize,
      oldestSession: timestamps.length > 0 ? new Date(Math.min(...timestamps)) : undefined,
      newestSession: timestamps.length > 0 ? new Date(Math.max(...timestamps)) : undefined,
    };
  }

  async clear(): Promise<void> {
    this.sessions.clear();
    this.checkpoints.clear();
  }

  async dispose(): Promise<void> {
    await this.clear();
  }
}

/**
 * Session Recovery Hook
 *
 * Handles session lifecycle, checkpointing, and recovery operations.
 */
export class SessionRecoveryHook
  extends BaseHook<unknown, SessionRecoveryEventData>
  implements IDisposable
{
  readonly name = 'session-recovery';
  readonly description = 'Manages session persistence, checkpoints, and recovery';
  readonly event = HookEvent.SESSION_START;

  // Configuration
  private readonly storageBackend: StorageBackend;
  private readonly autoCheckpointInterval: number;
  private readonly maxCheckpoints: number;
  private readonly autoRecovery: boolean;
  private readonly sessionExpiry: number;
  private readonly checkpointExpiry: number;
  private readonly _compression: boolean;
  private readonly _encryption: boolean;
  private readonly verbose: boolean;

  // Storage
  private storageAdapter: IStorageAdapter;
  private initialized = false;

  // Current session
  private currentSession: Session | undefined;
  private autoCheckpointTimer: ReturnType<typeof setInterval> | undefined;

  // Metrics
  private metrics: SessionRecoveryMetrics = {
    totalSessions: 0,
    totalCheckpoints: 0,
    totalRecoveries: 0,
    successfulRecoveries: 0,
    failedRecoveries: 0,
    averageCheckpointSize: 0,
    totalStorageBytes: 0,
  };

  // Callbacks
  private sessionStartCallbacks: SessionStartCallback[] = [];
  private sessionEndCallbacks: SessionEndCallback[] = [];
  private checkpointCreatedCallbacks: CheckpointCreatedCallback[] = [];
  private checkpointRestoredCallbacks: CheckpointRestoredCallback[] = [];
  private recoveryFailedCallbacks: RecoveryFailedCallback[] = [];

  // Subscription counter
  private subscriptionCounter = 0;

  constructor(config?: SessionRecoveryConfig) {
    super(config);

    const cfg = { ...DEFAULT_SESSION_RECOVERY_CONFIG, ...config };

    this.storageBackend = cfg.storageBackend;
    this.autoCheckpointInterval = cfg.autoCheckpointInterval;
    this.maxCheckpoints = cfg.maxCheckpoints;
    this.autoRecovery = cfg.autoRecovery;
    this.sessionExpiry = cfg.sessionExpiry;
    this.checkpointExpiry = cfg.checkpointExpiry;
    this._compression = cfg.compression;
    this._encryption = cfg.encryption;
    this.verbose = cfg.verbose;

    // Initialize storage adapter
    if (config?.storageAdapter) {
      this.storageAdapter = config.storageAdapter;
    } else {
      this.storageAdapter = new MemoryStorageAdapter();
    }
  }

  /**
   * Initialize the hook
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    await this.storageAdapter.initialize();
    await this.cleanupExpiredData();
    this.initialized = true;
  }

  /**
   * Execute the hook for session events
   */
  async execute(context: HookContext<unknown>): Promise<HookResult<SessionRecoveryEventData>> {
    if (!this.initialized) {
      await this.initialize();
    }

    const event = context.event;

    switch (event) {
      case HookEvent.SESSION_START:
        return this.handleSessionStart(context);

      case HookEvent.SESSION_END:
        return this.handleSessionEnd(context);

      case HookEvent.SESSION_CHECKPOINT:
        return this.handleCheckpoint(context);

      case HookEvent.SESSION_RESTORE:
        return this.handleRestore(context);

      default:
        return this.continue();
    }
  }

  /**
   * Override shouldRun to handle multiple events
   */
  shouldRun(context: HookContext<unknown>): boolean {
    if (!this.enabled) {
      return false;
    }

    const sessionEvents = [
      HookEvent.SESSION_START,
      HookEvent.SESSION_END,
      HookEvent.SESSION_CHECKPOINT,
      HookEvent.SESSION_RESTORE,
    ];

    return sessionEvents.includes(context.event);
  }

  // === Session Management ===

  /**
   * Handle session start
   */
  private async handleSessionStart(
    context: HookContext<unknown>
  ): Promise<HookResult<SessionRecoveryEventData>> {
    const metadata = (context.data as { metadata?: SessionMetadata })?.metadata || {};
    const sessionId = this.generateId();

    // Check for recoverable session if auto-recovery is enabled
    if (this.autoRecovery) {
      const recoverableSession = await this.findRecoverableSession(metadata);
      if (recoverableSession) {
        const recoveryResult = await this.recoverSession(recoverableSession.id);
        if (recoveryResult.success && recoveryResult.session) {
          return this.modify(
            {
              eventType: 'session_start',
              session: recoveryResult.session,
              recoveryResult,
            },
            `Recovered session from checkpoint`
          );
        }
      }
    }

    // Create new session
    const session = await this.createSession(sessionId, metadata);

    // Start auto-checkpoint timer if configured
    this.startAutoCheckpoint();

    // Notify callbacks
    this.notifySessionStart(session);

    return this.modify(
      {
        eventType: 'session_start',
        session,
      },
      `Session started: ${session.id}`
    );
  }

  /**
   * Handle session end
   */
  private async handleSessionEnd(
    _context: HookContext<unknown>
  ): Promise<HookResult<SessionRecoveryEventData>> {
    if (!this.currentSession) {
      return this.continue(undefined, 'No active session to end');
    }

    // Stop auto-checkpoint timer
    this.stopAutoCheckpoint();

    // Create final checkpoint
    await this.createCheckpoint(CheckpointType.MANUAL, 'session_end');

    // Update session status
    this.currentSession.status = SessionStatus.COMPLETED;
    this.currentSession.updatedAt = new Date();
    await this.storageAdapter.saveSession(this.currentSession);

    // Notify callbacks
    this.notifySessionEnd(this.currentSession);

    const session = this.currentSession;
    this.currentSession = undefined;

    return this.modify(
      {
        eventType: 'session_end',
        session,
      },
      `Session ended: ${session.id}`
    );
  }

  /**
   * Handle checkpoint creation
   */
  private async handleCheckpoint(
    context: HookContext<unknown>
  ): Promise<HookResult<SessionRecoveryEventData>> {
    if (!this.currentSession) {
      return this.continue(undefined, 'No active session for checkpoint');
    }

    const data = context.data as { name?: string; type?: CheckpointType; context?: SessionContext };
    const name = data?.name;
    const type = data?.type || CheckpointType.MANUAL;

    // Update session context if provided
    if (data?.context) {
      this.currentSession.context = { ...this.currentSession.context, ...data.context };
    }

    const checkpoint = await this.createCheckpoint(type, name);

    return this.modify(
      {
        eventType: 'checkpoint_created',
        session: this.currentSession,
        checkpoint,
      },
      `Checkpoint created: ${checkpoint.id}`
    );
  }

  /**
   * Handle session restore
   */
  private async handleRestore(
    context: HookContext<unknown>
  ): Promise<HookResult<SessionRecoveryEventData>> {
    const data = context.data as RecoveryOptions;
    const sessionId = (context.metadata?.sessionId as string) || this.currentSession?.id;

    if (!sessionId) {
      return this.abort('No session ID provided for restore');
    }

    const result = await this.recoverSession(sessionId, data);

    if (!result.success) {
      return this.abort(result.error || 'Recovery failed');
    }

    return this.modify(
      {
        eventType: 'checkpoint_restored',
        session: result.session!,
        checkpoint: result.checkpoint,
        recoveryResult: result,
      },
      `Session restored from checkpoint: ${result.checkpoint?.id}`
    );
  }

  // === Public API ===

  /**
   * Start a new session
   */
  async startSession(metadata?: SessionMetadata): Promise<Session> {
    if (!this.initialized) {
      await this.initialize();
    }

    const sessionId = this.generateId();
    const session = await this.createSession(sessionId, metadata || {});

    this.startAutoCheckpoint();
    this.notifySessionStart(session);

    return session;
  }

  /**
   * End the current session
   */
  async endSession(): Promise<Session | undefined> {
    if (!this.currentSession) {
      return undefined;
    }

    this.stopAutoCheckpoint();

    await this.createCheckpoint(CheckpointType.MANUAL, 'session_end');

    this.currentSession.status = SessionStatus.COMPLETED;
    this.currentSession.updatedAt = new Date();
    await this.storageAdapter.saveSession(this.currentSession);

    this.notifySessionEnd(this.currentSession);

    const session = this.currentSession;
    this.currentSession = undefined;

    return session;
  }

  /**
   * Get current session
   */
  getCurrentSession(): Session | undefined {
    return this.currentSession ? { ...this.currentSession } : undefined;
  }

  /**
   * Update session context
   */
  async updateContext(context: Partial<SessionContext>): Promise<void> {
    if (!this.currentSession) {
      throw new Error('No active session');
    }

    this.currentSession.context = { ...this.currentSession.context, ...context };
    this.currentSession.updatedAt = new Date();
    await this.storageAdapter.saveSession(this.currentSession);
  }

  /**
   * Create a manual checkpoint
   */
  async checkpoint(name?: string): Promise<Checkpoint> {
    if (!this.currentSession) {
      throw new Error('No active session');
    }

    return this.createCheckpoint(CheckpointType.MANUAL, name);
  }

  /**
   * List checkpoints for current or specified session
   */
  async listCheckpoints(sessionId?: string): Promise<Checkpoint[]> {
    const id = sessionId || this.currentSession?.id;
    if (!id) {
      return [];
    }

    return this.storageAdapter.listCheckpoints(id);
  }

  /**
   * Get a specific checkpoint
   */
  async getCheckpoint(checkpointId: string): Promise<Checkpoint | undefined> {
    return this.storageAdapter.loadCheckpoint(checkpointId);
  }

  /**
   * Delete a checkpoint
   */
  async deleteCheckpoint(checkpointId: string): Promise<boolean> {
    const checkpoint = await this.storageAdapter.loadCheckpoint(checkpointId);
    if (!checkpoint) {
      return false;
    }

    // Update session's checkpoint list
    const session = await this.storageAdapter.loadSession(checkpoint.sessionId);
    if (session) {
      session.checkpointIds = session.checkpointIds.filter((id) => id !== checkpointId);
      await this.storageAdapter.saveSession(session);
    }

    return this.storageAdapter.deleteCheckpoint(checkpointId);
  }

  /**
   * Recover a session from checkpoint
   */
  async recoverSession(sessionId: string, options?: RecoveryOptions): Promise<RecoveryResult> {
    const result: RecoveryResult = {
      success: false,
      timestamp: new Date(),
      warnings: [],
    };

    this.metrics.totalRecoveries++;

    try {
      // Load session
      const session = await this.storageAdapter.loadSession(sessionId);
      if (!session) {
        result.error = `Session not found: ${sessionId}`;
        this.metrics.failedRecoveries++;
        this.notifyRecoveryFailed(new Error(result.error), sessionId);
        return result;
      }

      // Get checkpoint
      let checkpoint: Checkpoint | undefined;
      if (options?.checkpointId) {
        checkpoint = await this.storageAdapter.loadCheckpoint(options.checkpointId);
      } else {
        const checkpoints = await this.storageAdapter.listCheckpoints(sessionId);
        checkpoint = checkpoints[0]; // Most recent
      }

      if (!checkpoint) {
        result.error = 'No checkpoint found for recovery';
        this.metrics.failedRecoveries++;
        this.notifyRecoveryFailed(new Error(result.error), sessionId);
        return result;
      }

      // Validate checksum if requested
      if (options?.validateChecksum) {
        const calculatedChecksum = this.calculateChecksum(checkpoint.snapshot);
        if (calculatedChecksum !== checkpoint.checksum) {
          result.error = 'Checkpoint checksum validation failed';
          result.warnings.push('Data integrity check failed');
          this.metrics.failedRecoveries++;
          this.notifyRecoveryFailed(new Error(result.error), sessionId);
          return result;
        }
      }

      // Restore session from snapshot
      session.status = SessionStatus.ACTIVE;
      session.context = checkpoint.snapshot.context;
      session.metadata = checkpoint.snapshot.metadata;
      session.updatedAt = new Date();

      await this.storageAdapter.saveSession(session);
      this.currentSession = session;

      // Create recovery checkpoint if requested
      if (options?.createRecoveryCheckpoint) {
        await this.createCheckpoint(CheckpointType.RECOVERY, 'post_recovery');
      }

      // Start auto-checkpoint timer
      this.startAutoCheckpoint();

      // Notify callbacks
      this.notifyCheckpointRestored(checkpoint, session);
      options?.onRecovery?.(session, checkpoint);

      result.success = true;
      result.session = session;
      result.checkpoint = checkpoint;
      this.metrics.successfulRecoveries++;
      this.metrics.lastRecoveryAt = new Date();

      return result;
    } catch (error) {
      result.error = error instanceof Error ? error.message : String(error);
      this.metrics.failedRecoveries++;
      this.notifyRecoveryFailed(error instanceof Error ? error : new Error(String(error)), sessionId);
      return result;
    }
  }

  /**
   * List all sessions
   */
  async listSessions(): Promise<Session[]> {
    return this.storageAdapter.listSessions();
  }

  /**
   * Get a specific session
   */
  async getSession(sessionId: string): Promise<Session | undefined> {
    return this.storageAdapter.loadSession(sessionId);
  }

  /**
   * Delete a session and its checkpoints
   */
  async deleteSession(sessionId: string): Promise<boolean> {
    // Delete all checkpoints first
    const checkpoints = await this.storageAdapter.listCheckpoints(sessionId);
    for (const checkpoint of checkpoints) {
      await this.storageAdapter.deleteCheckpoint(checkpoint.id);
    }

    return this.storageAdapter.deleteSession(sessionId);
  }

  /**
   * Get metrics
   */
  getMetrics(): SessionRecoveryMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = {
      totalSessions: 0,
      totalCheckpoints: 0,
      totalRecoveries: 0,
      successfulRecoveries: 0,
      failedRecoveries: 0,
      averageCheckpointSize: 0,
      totalStorageBytes: 0,
    };
  }

  /**
   * Get storage statistics
   */
  async getStorageStats(): Promise<StorageStats> {
    return this.storageAdapter.getStats();
  }

  /**
   * Get configuration
   */
  getRecoveryConfig(): {
    storageBackend: StorageBackend;
    autoCheckpointInterval: number;
    maxCheckpoints: number;
    autoRecovery: boolean;
    compression: boolean;
    encryption: boolean;
    verbose: boolean;
  } {
    return {
      storageBackend: this.storageBackend,
      autoCheckpointInterval: this.autoCheckpointInterval,
      maxCheckpoints: this.maxCheckpoints,
      autoRecovery: this.autoRecovery,
      compression: this._compression,
      encryption: this._encryption,
      verbose: this.verbose,
    };
  }

  // === Event Subscriptions ===

  /**
   * Subscribe to session start events
   */
  onSessionStart(callback: SessionStartCallback): SessionRecoverySubscription {
    this.sessionStartCallbacks.push(callback);
    return this.createSubscription(() => {
      const index = this.sessionStartCallbacks.indexOf(callback);
      if (index > -1) this.sessionStartCallbacks.splice(index, 1);
    });
  }

  /**
   * Subscribe to session end events
   */
  onSessionEnd(callback: SessionEndCallback): SessionRecoverySubscription {
    this.sessionEndCallbacks.push(callback);
    return this.createSubscription(() => {
      const index = this.sessionEndCallbacks.indexOf(callback);
      if (index > -1) this.sessionEndCallbacks.splice(index, 1);
    });
  }

  /**
   * Subscribe to checkpoint created events
   */
  onCheckpointCreated(callback: CheckpointCreatedCallback): SessionRecoverySubscription {
    this.checkpointCreatedCallbacks.push(callback);
    return this.createSubscription(() => {
      const index = this.checkpointCreatedCallbacks.indexOf(callback);
      if (index > -1) this.checkpointCreatedCallbacks.splice(index, 1);
    });
  }

  /**
   * Subscribe to checkpoint restored events
   */
  onCheckpointRestored(callback: CheckpointRestoredCallback): SessionRecoverySubscription {
    this.checkpointRestoredCallbacks.push(callback);
    return this.createSubscription(() => {
      const index = this.checkpointRestoredCallbacks.indexOf(callback);
      if (index > -1) this.checkpointRestoredCallbacks.splice(index, 1);
    });
  }

  /**
   * Subscribe to recovery failed events
   */
  onRecoveryFailed(callback: RecoveryFailedCallback): SessionRecoverySubscription {
    this.recoveryFailedCallbacks.push(callback);
    return this.createSubscription(() => {
      const index = this.recoveryFailedCallbacks.indexOf(callback);
      if (index > -1) this.recoveryFailedCallbacks.splice(index, 1);
    });
  }

  // === IDisposable ===

  /**
   * Dispose of resources
   */
  async dispose(): Promise<void> {
    this.stopAutoCheckpoint();

    // End current session if active
    if (this.currentSession) {
      await this.endSession();
    }

    // Clear callbacks
    this.sessionStartCallbacks = [];
    this.sessionEndCallbacks = [];
    this.checkpointCreatedCallbacks = [];
    this.checkpointRestoredCallbacks = [];
    this.recoveryFailedCallbacks = [];

    // Dispose storage
    await this.storageAdapter.dispose();
    this.initialized = false;
  }

  // === Private Helpers ===

  /**
   * Create a new session
   */
  private async createSession(sessionId: string, metadata: SessionMetadata): Promise<Session> {
    const now = new Date();

    const session: Session = {
      id: sessionId,
      status: SessionStatus.ACTIVE,
      createdAt: now,
      updatedAt: now,
      metadata,
      context: {},
      checkpointIds: [],
      tags: [],
    };

    await this.storageAdapter.saveSession(session);
    this.currentSession = session;
    this.metrics.totalSessions++;

    return session;
  }

  /**
   * Create a checkpoint
   */
  private async createCheckpoint(type: CheckpointType, name?: string): Promise<Checkpoint> {
    if (!this.currentSession) {
      throw new Error('No active session for checkpoint');
    }

    const checkpointId = this.generateId();
    const now = new Date();

    const snapshot: SessionSnapshot = {
      sessionId: this.currentSession.id,
      timestamp: now,
      status: this.currentSession.status,
      context: { ...this.currentSession.context },
      metadata: { ...this.currentSession.metadata },
      version: SESSION_RECOVERY_VERSION,
    };

    const serialized = JSON.stringify(snapshot);
    const checksum = this.calculateChecksum(snapshot);

    const checkpoint: Checkpoint = {
      id: checkpointId,
      sessionId: this.currentSession.id,
      name,
      type,
      createdAt: now,
      snapshot,
      checksum,
      sizeBytes: serialized.length,
      tags: [],
    };

    await this.storageAdapter.saveCheckpoint(checkpoint);

    // Update session's checkpoint list
    this.currentSession.checkpointIds.push(checkpointId);
    this.currentSession.updatedAt = now;
    await this.storageAdapter.saveSession(this.currentSession);

    // Enforce max checkpoints
    await this.enforceMaxCheckpoints();

    // Update metrics
    this.metrics.totalCheckpoints++;
    this.metrics.lastCheckpointAt = now;
    this.updateAverageCheckpointSize(checkpoint.sizeBytes);

    // Notify callbacks
    this.notifyCheckpointCreated(checkpoint, this.currentSession);

    return checkpoint;
  }

  /**
   * Find a recoverable session
   */
  private async findRecoverableSession(metadata: SessionMetadata): Promise<Session | undefined> {
    const sessions = await this.storageAdapter.listSessions();

    // Find matching session that's not completed and has checkpoints
    return sessions.find(
      (s) =>
        s.status !== SessionStatus.COMPLETED &&
        s.checkpointIds.length > 0 &&
        (metadata.projectId === undefined || s.metadata.projectId === metadata.projectId) &&
        (metadata.userId === undefined || s.metadata.userId === metadata.userId)
    );
  }

  /**
   * Start auto-checkpoint timer
   */
  private startAutoCheckpoint(): void {
    if (this.autoCheckpointInterval <= 0) {
      return;
    }

    this.stopAutoCheckpoint();

    this.autoCheckpointTimer = setInterval(async () => {
      if (this.currentSession) {
        try {
          await this.createCheckpoint(CheckpointType.AUTO, 'auto');
        } catch {
          // Ignore auto-checkpoint errors
        }
      }
    }, this.autoCheckpointInterval);
  }

  /**
   * Stop auto-checkpoint timer
   */
  private stopAutoCheckpoint(): void {
    if (this.autoCheckpointTimer) {
      clearInterval(this.autoCheckpointTimer);
      this.autoCheckpointTimer = undefined;
    }
  }

  /**
   * Enforce maximum checkpoint limit
   */
  private async enforceMaxCheckpoints(): Promise<void> {
    if (!this.currentSession || this.maxCheckpoints <= 0) {
      return;
    }

    const checkpoints = await this.storageAdapter.listCheckpoints(this.currentSession.id);

    if (checkpoints.length > this.maxCheckpoints) {
      // Sort by date (oldest first)
      const sorted = checkpoints.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

      // Delete oldest checkpoints
      const toDelete = sorted.slice(0, checkpoints.length - this.maxCheckpoints);
      for (const checkpoint of toDelete) {
        await this.storageAdapter.deleteCheckpoint(checkpoint.id);
        this.currentSession.checkpointIds = this.currentSession.checkpointIds.filter(
          (id) => id !== checkpoint.id
        );
      }

      await this.storageAdapter.saveSession(this.currentSession);
    }
  }

  /**
   * Cleanup expired data
   */
  private async cleanupExpiredData(): Promise<void> {
    const now = Date.now();
    const sessions = await this.storageAdapter.listSessions();

    for (const session of sessions) {
      // Check session expiry
      if (
        session.status === SessionStatus.COMPLETED &&
        now - session.updatedAt.getTime() > this.sessionExpiry
      ) {
        await this.deleteSession(session.id);
        continue;
      }

      // Check checkpoint expiry
      const checkpoints = await this.storageAdapter.listCheckpoints(session.id);
      for (const checkpoint of checkpoints) {
        if (now - checkpoint.createdAt.getTime() > this.checkpointExpiry) {
          await this.storageAdapter.deleteCheckpoint(checkpoint.id);
          session.checkpointIds = session.checkpointIds.filter((id) => id !== checkpoint.id);
        }
      }

      if (session.checkpointIds.length !== checkpoints.length) {
        await this.storageAdapter.saveSession(session);
      }
    }
  }

  /**
   * Calculate checksum for snapshot
   */
  private calculateChecksum(snapshot: SessionSnapshot): string {
    const str = JSON.stringify(snapshot);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Update average checkpoint size
   */
  private updateAverageCheckpointSize(newSize: number): void {
    const total = this.metrics.averageCheckpointSize * (this.metrics.totalCheckpoints - 1) + newSize;
    this.metrics.averageCheckpointSize = total / this.metrics.totalCheckpoints;
    this.metrics.totalStorageBytes += newSize;
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Create subscription helper
   */
  private createSubscription(unsubscribeFn: () => void): SessionRecoverySubscription {
    const id = `sub-${++this.subscriptionCounter}`;
    return {
      id,
      unsubscribe: unsubscribeFn,
    };
  }

  // === Callback Notifications ===

  private notifySessionStart(session: Session): void {
    this.sessionStartCallbacks.forEach((cb) => {
      try {
        cb(session);
      } catch {
        // Ignore callback errors
      }
    });
  }

  private notifySessionEnd(session: Session): void {
    this.sessionEndCallbacks.forEach((cb) => {
      try {
        cb(session);
      } catch {
        // Ignore callback errors
      }
    });
  }

  private notifyCheckpointCreated(checkpoint: Checkpoint, session: Session): void {
    this.checkpointCreatedCallbacks.forEach((cb) => {
      try {
        cb(checkpoint, session);
      } catch {
        // Ignore callback errors
      }
    });
  }

  private notifyCheckpointRestored(checkpoint: Checkpoint, session: Session): void {
    this.checkpointRestoredCallbacks.forEach((cb) => {
      try {
        cb(checkpoint, session);
      } catch {
        // Ignore callback errors
      }
    });
  }

  private notifyRecoveryFailed(error: Error, sessionId: string): void {
    this.recoveryFailedCallbacks.forEach((cb) => {
      try {
        cb(error, sessionId);
      } catch {
        // Ignore callback errors
      }
    });
  }
}
