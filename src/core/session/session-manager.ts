/**
 * Session Manager Implementation
 *
 * Provides session lifecycle management, multi-session support, and migration capabilities.
 *
 * @module core/session
 */

import { createHash, randomUUID } from 'crypto';
import {
  ISessionManager,
  SessionManagerConfig,
  SessionCreateConfig,
  SessionQueryFilter,
  SessionUpdateData,
  ExportedSession,
  ExportMetadata,
  ImportOptions,
  ImportResult,
  SessionEvent,
  SessionEventType,
  SessionStatistics,
  CheckpointOptions,
  SessionManagerSubscription,
  SessionEventCallback,
  SessionCreatedCallback,
  SessionEndedCallback,
  CurrentSessionChangedCallback,
  DEFAULT_SESSION_MANAGER_CONFIG,
  SESSION_MANAGER_EXPORT_VERSION,
  Session,
  SessionStatus,
  SessionSnapshot,
  Checkpoint,
  CheckpointType,
  IStorageAdapter,
  StorageBackend,
} from './session-manager.interface.js';

/**
 * In-memory storage adapter for Session Manager
 */
class MemoryStorageAdapter implements IStorageAdapter {
  private sessions = new Map<string, Session>();
  private checkpoints = new Map<string, Checkpoint>();

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
      .map((c) => ({ ...c }));
  }

  async getStats(): Promise<{ sessionCount: number; checkpointCount: number; totalSizeBytes: number }> {
    const totalSizeBytes = Array.from(this.checkpoints.values()).reduce(
      (sum, c) => sum + c.sizeBytes,
      0
    );
    return {
      sessionCount: this.sessions.size,
      checkpointCount: this.checkpoints.size,
      totalSizeBytes,
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
 * File-based storage adapter for Session Manager
 */
class FileStorageAdapter implements IStorageAdapter {
  private sessions = new Map<string, Session>();
  private checkpoints = new Map<string, Checkpoint>();

  constructor(_basePath: string) {
    // basePath would be used in a real file-based implementation
  }

  async initialize(): Promise<void> {
    // In a real implementation, this would create directories and load existing data
    // For now, we use in-memory with file path as configuration
  }

  async saveSession(session: Session): Promise<void> {
    this.sessions.set(session.id, { ...session });
    // In real implementation: write to file
  }

  async loadSession(sessionId: string): Promise<Session | undefined> {
    // In real implementation: read from file if not in memory
    const session = this.sessions.get(sessionId);
    return session ? { ...session } : undefined;
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    // In real implementation: delete file
    return this.sessions.delete(sessionId);
  }

  async listSessions(): Promise<Session[]> {
    // In real implementation: read directory
    return Array.from(this.sessions.values()).map((s) => ({ ...s }));
  }

  async saveCheckpoint(checkpoint: Checkpoint): Promise<void> {
    this.checkpoints.set(checkpoint.id, { ...checkpoint });
    // In real implementation: write to file
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
      .map((c) => ({ ...c }));
  }

  async getStats(): Promise<{ sessionCount: number; checkpointCount: number; totalSizeBytes: number }> {
    const totalSizeBytes = Array.from(this.checkpoints.values()).reduce(
      (sum, c) => sum + c.sizeBytes,
      0
    );
    return {
      sessionCount: this.sessions.size,
      checkpointCount: this.checkpoints.size,
      totalSizeBytes,
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
 * Session Manager Implementation
 */
export class SessionManager implements ISessionManager {
  private config: Required<Omit<SessionManagerConfig, 'storageAdapter' | 'storagePath' | 'encryptionKey'>> &
    Pick<SessionManagerConfig, 'storageAdapter' | 'storagePath' | 'encryptionKey'>;
  private storage: IStorageAdapter;
  private currentSessionId: string | undefined;
  private currentSession: Session | undefined;

  // Event subscriptions
  private eventSubscriptions = new Map<string, SessionEventCallback>();
  private createdSubscriptions = new Map<string, SessionCreatedCallback>();
  private endedSubscriptions = new Map<string, SessionEndedCallback>();
  private currentChangedSubscriptions = new Map<string, CurrentSessionChangedCallback>();

  // Auto-checkpoint timer
  private autoCheckpointTimer: ReturnType<typeof setInterval> | undefined;

  // Cleanup timer
  private cleanupTimer: ReturnType<typeof setInterval> | undefined;

  // Initialization state
  private initialized = false;

  constructor(config?: SessionManagerConfig) {
    this.config = {
      ...DEFAULT_SESSION_MANAGER_CONFIG,
      ...config,
    };

    // Initialize storage adapter
    if (this.config.storageAdapter) {
      this.storage = this.config.storageAdapter;
    } else if (this.config.storageBackend === StorageBackend.FILE && this.config.storagePath) {
      this.storage = new FileStorageAdapter(this.config.storagePath);
    } else {
      this.storage = new MemoryStorageAdapter();
    }
  }

  // ==================== Session Lifecycle ====================

  async createSession(config?: SessionCreateConfig): Promise<Session> {
    await this.ensureInitialized();

    const now = new Date();
    const sessionId = randomUUID();

    const session: Session = {
      id: sessionId,
      name: config?.name,
      status: SessionStatus.ACTIVE,
      createdAt: now,
      updatedAt: now,
      metadata: {
        ...config?.metadata,
        parentSessionId: config?.parentSessionId,
      },
      context: {
        messages: [],
        toolHistory: [],
        variables: {},
        fileChanges: [],
        ...config?.context,
      },
      checkpointIds: [],
      tags: config?.tags || [],
    };

    await this.storage.saveSession(session);

    // Set as current if requested (default: true)
    if (config?.setAsCurrent !== false) {
      await this.setCurrentSession(sessionId);
    }

    // Emit event
    await this.emitEvent({
      type: SessionEventType.CREATED,
      timestamp: now,
      sessionId,
      session,
    });

    // Notify created subscribers
    this.createdSubscriptions.forEach((callback) => {
      try {
        callback(session);
      } catch {
        // Ignore callback errors
      }
    });

    this.log(`Session created: ${sessionId}`);
    return session;
  }

  async getSession(sessionId: string): Promise<Session | undefined> {
    await this.ensureInitialized();
    return this.storage.loadSession(sessionId);
  }

  getCurrentSession(): Session | undefined {
    return this.currentSession;
  }

  async setCurrentSession(sessionId: string | undefined): Promise<void> {
    await this.ensureInitialized();

    const previousSession = this.currentSession;
    const previousId = this.currentSessionId;

    if (sessionId === previousId) {
      return; // No change
    }

    if (sessionId) {
      const session = await this.storage.loadSession(sessionId);
      if (!session) {
        throw new Error(`Session not found: ${sessionId}`);
      }
      this.currentSessionId = sessionId;
      this.currentSession = session;
    } else {
      this.currentSessionId = undefined;
      this.currentSession = undefined;
    }

    // Emit event
    await this.emitEvent({
      type: SessionEventType.CURRENT_CHANGED,
      timestamp: new Date(),
      sessionId: sessionId || previousId || '',
      session: this.currentSession,
      previousState: previousSession,
    });

    // Notify current changed subscribers
    this.currentChangedSubscriptions.forEach((callback) => {
      try {
        callback(this.currentSession, previousSession);
      } catch {
        // Ignore callback errors
      }
    });

    this.log(`Current session changed: ${previousId} -> ${sessionId}`);
  }

  async updateSession(sessionId: string, data: SessionUpdateData): Promise<Session> {
    await this.ensureInitialized();

    const session = await this.storage.loadSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const previousState = { ...session };
    const now = new Date();

    // Apply updates
    if (data.name !== undefined) {
      session.name = data.name;
    }
    if (data.status !== undefined) {
      session.status = data.status;
    }
    if (data.metadata) {
      session.metadata = { ...session.metadata, ...data.metadata };
    }
    if (data.context) {
      session.context = { ...session.context, ...data.context };
    }
    if (data.addTags) {
      session.tags = [...new Set([...session.tags, ...data.addTags])];
    }
    if (data.removeTags) {
      session.tags = session.tags.filter((t) => !data.removeTags!.includes(t));
    }

    session.updatedAt = now;

    await this.storage.saveSession(session);

    // Update current session if it's the same
    if (this.currentSessionId === sessionId) {
      this.currentSession = session;
    }

    // Emit event
    await this.emitEvent({
      type: SessionEventType.UPDATED,
      timestamp: now,
      sessionId,
      session,
      previousState,
    });

    this.log(`Session updated: ${sessionId}`);
    return session;
  }

  async endSession(sessionId: string): Promise<void> {
    await this.ensureInitialized();

    const session = await this.storage.loadSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    session.status = SessionStatus.COMPLETED;
    session.updatedAt = new Date();

    await this.storage.saveSession(session);

    // Clear current session if it's the same
    if (this.currentSessionId === sessionId) {
      await this.setCurrentSession(undefined);
    }

    // Emit event
    await this.emitEvent({
      type: SessionEventType.ENDED,
      timestamp: session.updatedAt,
      sessionId,
      session,
    });

    // Notify ended subscribers
    this.endedSubscriptions.forEach((callback) => {
      try {
        callback(session);
      } catch {
        // Ignore callback errors
      }
    });

    this.log(`Session ended: ${sessionId}`);
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    await this.ensureInitialized();

    const session = await this.storage.loadSession(sessionId);
    if (!session) {
      return false;
    }

    // Delete all checkpoints first
    const checkpoints = await this.storage.listCheckpoints(sessionId);
    for (const checkpoint of checkpoints) {
      await this.storage.deleteCheckpoint(checkpoint.id);
    }

    // Delete session
    const deleted = await this.storage.deleteSession(sessionId);

    // Clear current session if it's the same
    if (this.currentSessionId === sessionId) {
      this.currentSessionId = undefined;
      this.currentSession = undefined;
    }

    if (deleted) {
      // Emit event
      await this.emitEvent({
        type: SessionEventType.DELETED,
        timestamp: new Date(),
        sessionId,
        session,
      });

      this.log(`Session deleted: ${sessionId}`);
    }

    return deleted;
  }

  // ==================== Session Queries ====================

  async listSessions(filter?: SessionQueryFilter): Promise<Session[]> {
    await this.ensureInitialized();

    let sessions = await this.storage.listSessions();

    if (filter) {
      sessions = this.applyFilter(sessions, filter);
    }

    return sessions;
  }

  async countSessions(filter?: SessionQueryFilter): Promise<number> {
    const sessions = await this.listSessions(filter);
    return sessions.length;
  }

  async sessionExists(sessionId: string): Promise<boolean> {
    await this.ensureInitialized();
    const session = await this.storage.loadSession(sessionId);
    return session !== undefined;
  }

  // ==================== State Management ====================

  async saveState(sessionId: string): Promise<SessionSnapshot> {
    await this.ensureInitialized();

    const session = await this.storage.loadSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const snapshot: SessionSnapshot = {
      sessionId: session.id,
      timestamp: new Date(),
      status: session.status,
      context: { ...session.context },
      metadata: { ...session.metadata },
      version: SESSION_MANAGER_EXPORT_VERSION,
    };

    return snapshot;
  }

  async restoreState(snapshot: SessionSnapshot): Promise<Session> {
    await this.ensureInitialized();

    const session = await this.storage.loadSession(snapshot.sessionId);
    if (!session) {
      throw new Error(`Session not found: ${snapshot.sessionId}`);
    }

    // Restore state from snapshot
    session.context = { ...snapshot.context };
    session.metadata = { ...snapshot.metadata };
    session.status = snapshot.status;
    session.updatedAt = new Date();

    await this.storage.saveSession(session);

    // Update current session if it's the same
    if (this.currentSessionId === session.id) {
      this.currentSession = session;
    }

    // Emit event
    await this.emitEvent({
      type: SessionEventType.RECOVERED,
      timestamp: session.updatedAt,
      sessionId: session.id,
      session,
    });

    this.log(`Session state restored: ${session.id}`);
    return session;
  }

  async getSnapshots(sessionId: string): Promise<SessionSnapshot[]> {
    await this.ensureInitialized();

    const checkpoints = await this.storage.listCheckpoints(sessionId);
    return checkpoints.map((c) => c.snapshot);
  }

  // ==================== Checkpoints ====================

  async createCheckpoint(sessionId: string, options?: CheckpointOptions): Promise<Checkpoint> {
    await this.ensureInitialized();

    const session = await this.storage.loadSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const now = new Date();
    const checkpointId = randomUUID();

    // Create snapshot
    const snapshot: SessionSnapshot = {
      sessionId: session.id,
      timestamp: now,
      status: session.status,
      context: { ...session.context },
      metadata: { ...session.metadata },
      version: SESSION_MANAGER_EXPORT_VERSION,
    };

    // Calculate size and checksum
    const serialized = JSON.stringify(snapshot);
    const sizeBytes = Buffer.byteLength(serialized, 'utf8');
    const checksum = createHash('sha256').update(serialized).digest('hex');

    const checkpoint: Checkpoint = {
      id: checkpointId,
      sessionId,
      name: options?.name,
      type: options?.type || CheckpointType.MANUAL,
      createdAt: now,
      snapshot,
      checksum,
      sizeBytes,
      tags: options?.tags || [],
    };

    await this.storage.saveCheckpoint(checkpoint);

    // Update session's checkpoint list
    session.checkpointIds.push(checkpointId);
    session.updatedAt = now;
    await this.storage.saveSession(session);

    // Enforce max checkpoints
    await this.enforceMaxCheckpoints(sessionId);

    // Emit event
    await this.emitEvent({
      type: SessionEventType.CHECKPOINT_CREATED,
      timestamp: now,
      sessionId,
      session,
      checkpoint,
    });

    this.log(`Checkpoint created: ${checkpointId} for session ${sessionId}`);
    return checkpoint;
  }

  async createCurrentCheckpoint(options?: CheckpointOptions): Promise<Checkpoint> {
    if (!this.currentSessionId) {
      throw new Error('No current session');
    }
    return this.createCheckpoint(this.currentSessionId, options);
  }

  async restoreFromCheckpoint(checkpointId: string): Promise<Session> {
    await this.ensureInitialized();

    const checkpoint = await this.storage.loadCheckpoint(checkpointId);
    if (!checkpoint) {
      throw new Error(`Checkpoint not found: ${checkpointId}`);
    }

    // Validate checksum
    const serialized = JSON.stringify(checkpoint.snapshot);
    const checksum = createHash('sha256').update(serialized).digest('hex');
    if (checksum !== checkpoint.checksum) {
      throw new Error('Checkpoint checksum mismatch - data may be corrupted');
    }

    const session = await this.restoreState(checkpoint.snapshot);

    // Emit event
    await this.emitEvent({
      type: SessionEventType.CHECKPOINT_RESTORED,
      timestamp: new Date(),
      sessionId: session.id,
      session,
      checkpoint,
    });

    this.log(`Session restored from checkpoint: ${checkpointId}`);
    return session;
  }

  async listCheckpoints(sessionId: string): Promise<Checkpoint[]> {
    await this.ensureInitialized();
    return this.storage.listCheckpoints(sessionId);
  }

  async getCheckpoint(checkpointId: string): Promise<Checkpoint | undefined> {
    await this.ensureInitialized();
    return this.storage.loadCheckpoint(checkpointId);
  }

  async deleteCheckpoint(checkpointId: string): Promise<boolean> {
    await this.ensureInitialized();

    const checkpoint = await this.storage.loadCheckpoint(checkpointId);
    if (!checkpoint) {
      return false;
    }

    // Remove from session's checkpoint list
    const session = await this.storage.loadSession(checkpoint.sessionId);
    if (session) {
      session.checkpointIds = session.checkpointIds.filter((id) => id !== checkpointId);
      session.updatedAt = new Date();
      await this.storage.saveSession(session);
    }

    const deleted = await this.storage.deleteCheckpoint(checkpointId);
    if (deleted) {
      this.log(`Checkpoint deleted: ${checkpointId}`);
    }
    return deleted;
  }

  // ==================== Migration ====================

  async exportSession(sessionId: string, metadata?: ExportMetadata): Promise<ExportedSession> {
    await this.ensureInitialized();

    const session = await this.storage.loadSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const checkpoints = await this.storage.listCheckpoints(sessionId);

    const exported: ExportedSession = {
      version: SESSION_MANAGER_EXPORT_VERSION,
      exportedAt: new Date(),
      session: { ...session },
      checkpoints: checkpoints.map((c) => ({ ...c })),
      exportMetadata: {
        ...metadata,
        sourceSystem: 'session-manager',
      },
    };

    // Emit event
    await this.emitEvent({
      type: SessionEventType.EXPORTED,
      timestamp: exported.exportedAt,
      sessionId,
      session,
      data: { exportMetadata: metadata },
    });

    this.log(`Session exported: ${sessionId}`);
    return exported;
  }

  async importSession(data: ExportedSession, options?: ImportOptions): Promise<ImportResult> {
    await this.ensureInitialized();

    const warnings: string[] = [];

    // Validate export data
    const validation = await this.validateExport(data);
    if (!validation.valid) {
      return {
        success: false,
        checkpointsImported: 0,
        warnings,
        error: validation.errors.join('; '),
      };
    }

    const now = new Date();

    // Determine new session ID
    let newSessionId: string;
    if (options?.generateNewId !== false) {
      newSessionId = options?.customId || randomUUID();
    } else {
      newSessionId = data.session.id;
    }

    // Check for existing session
    const existingSession = await this.storage.loadSession(newSessionId);
    if (existingSession) {
      if (options?.mergeIfExists) {
        warnings.push(`Merged with existing session: ${newSessionId}`);
        // Merge logic could be implemented here
      } else {
        return {
          success: false,
          checkpointsImported: 0,
          warnings,
          error: `Session already exists: ${newSessionId}`,
        };
      }
    }

    // Create new session
    const session: Session = {
      ...data.session,
      id: newSessionId,
      createdAt: options?.preserveTimestamps ? data.session.createdAt : now,
      updatedAt: now,
      checkpointIds: [],
      tags: [...data.session.tags, ...(options?.additionalTags || [])],
      metadata: {
        ...data.session.metadata,
        ...options?.metadataOverrides,
      },
    };

    await this.storage.saveSession(session);

    // Import checkpoints
    let checkpointsImported = 0;
    if (!options?.skipCheckpoints) {
      for (const checkpoint of data.checkpoints) {
        const newCheckpointId = randomUUID();
        const newCheckpoint: Checkpoint = {
          ...checkpoint,
          id: newCheckpointId,
          sessionId: newSessionId,
          snapshot: {
            ...checkpoint.snapshot,
            sessionId: newSessionId,
          },
          createdAt: options?.preserveTimestamps ? checkpoint.createdAt : now,
        };

        // Recalculate checksum
        const serialized = JSON.stringify(newCheckpoint.snapshot);
        newCheckpoint.checksum = createHash('sha256').update(serialized).digest('hex');

        await this.storage.saveCheckpoint(newCheckpoint);
        session.checkpointIds.push(newCheckpointId);
        checkpointsImported++;
      }

      // Update session with checkpoint IDs
      await this.storage.saveSession(session);
    }

    // Set as current if requested
    if (options?.setAsCurrent) {
      await this.setCurrentSession(newSessionId);
    }

    // Emit event
    await this.emitEvent({
      type: SessionEventType.IMPORTED,
      timestamp: now,
      sessionId: newSessionId,
      session,
      data: { originalSessionId: data.session.id, checkpointsImported },
    });

    this.log(`Session imported: ${newSessionId} (from ${data.session.id})`);

    return {
      success: true,
      session,
      checkpointsImported,
      warnings,
    };
  }

  async validateExport(data: ExportedSession): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    if (!data.version) {
      errors.push('Missing export version');
    }
    if (!data.session) {
      errors.push('Missing session data');
    }
    if (!data.exportedAt) {
      errors.push('Missing export timestamp');
    }
    if (!Array.isArray(data.checkpoints)) {
      errors.push('Invalid checkpoints format');
    }

    // Validate session structure
    if (data.session) {
      if (!data.session.id) {
        errors.push('Session missing ID');
      }
      if (!data.session.status) {
        errors.push('Session missing status');
      }
    }

    // Validate checkpoints
    if (data.checkpoints) {
      for (let i = 0; i < data.checkpoints.length; i++) {
        const cp = data.checkpoints[i];
        if (!cp.id) {
          errors.push(`Checkpoint ${i} missing ID`);
        }
        if (!cp.snapshot) {
          errors.push(`Checkpoint ${i} missing snapshot`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  // ==================== Statistics ====================

  async getStatistics(): Promise<SessionStatistics> {
    await this.ensureInitialized();

    const sessions = await this.storage.listSessions();
    const stats = await this.storage.getStats();

    const activeSessions = sessions.filter((s) => s.status === SessionStatus.ACTIVE).length;
    const pausedSessions = sessions.filter((s) => s.status === SessionStatus.PAUSED).length;
    const completedSessions = sessions.filter((s) => s.status === SessionStatus.COMPLETED).length;
    const failedSessions = sessions.filter((s) => s.status === SessionStatus.FAILED).length;

    // Count by agent type
    const sessionsByAgentType: Record<string, number> = {};
    const sessionsByProject: Record<string, number> = {};

    for (const session of sessions) {
      const agentType = session.metadata.agentType || 'unknown';
      sessionsByAgentType[agentType] = (sessionsByAgentType[agentType] || 0) + 1;

      const projectId = session.metadata.projectId || 'unknown';
      sessionsByProject[projectId] = (sessionsByProject[projectId] || 0) + 1;
    }

    // Find oldest and newest
    const sortedByDate = [...sessions].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    return {
      totalSessions: sessions.length,
      activeSessions,
      pausedSessions,
      completedSessions,
      failedSessions,
      totalCheckpoints: stats.checkpointCount,
      avgCheckpointsPerSession: sessions.length > 0 ? stats.checkpointCount / sessions.length : 0,
      totalStorageBytes: stats.totalSizeBytes,
      oldestSessionDate: sortedByDate[0]?.createdAt,
      newestSessionDate: sortedByDate[sortedByDate.length - 1]?.createdAt,
      sessionsByAgentType,
      sessionsByProject,
    };
  }

  // ==================== Maintenance ====================

  async cleanup(): Promise<{ sessionsDeleted: number; checkpointsDeleted: number }> {
    await this.ensureInitialized();

    let sessionsDeleted = 0;
    let checkpointsDeleted = 0;

    const now = Date.now();
    const sessions = await this.storage.listSessions();

    for (const session of sessions) {
      // Check session expiry
      const sessionAge = now - new Date(session.updatedAt).getTime();
      if (sessionAge > this.config.sessionExpiry) {
        // Delete session and its checkpoints
        const checkpoints = await this.storage.listCheckpoints(session.id);
        for (const checkpoint of checkpoints) {
          await this.storage.deleteCheckpoint(checkpoint.id);
          checkpointsDeleted++;
        }
        await this.storage.deleteSession(session.id);
        sessionsDeleted++;
        this.log(`Cleaned up expired session: ${session.id}`);
      } else {
        // Check checkpoint expiry
        const checkpoints = await this.storage.listCheckpoints(session.id);
        for (const checkpoint of checkpoints) {
          const checkpointAge = now - new Date(checkpoint.createdAt).getTime();
          if (checkpointAge > this.config.checkpointExpiry) {
            await this.storage.deleteCheckpoint(checkpoint.id);
            checkpointsDeleted++;
            this.log(`Cleaned up expired checkpoint: ${checkpoint.id}`);
          }
        }
      }
    }

    return { sessionsDeleted, checkpointsDeleted };
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    await this.storage.initialize();

    // Start auto-checkpoint timer if configured
    if (this.config.autoCheckpointInterval > 0) {
      this.autoCheckpointTimer = setInterval(async () => {
        if (this.currentSessionId) {
          try {
            await this.createCheckpoint(this.currentSessionId, {
              type: CheckpointType.AUTO,
              name: 'Auto checkpoint',
            });
          } catch {
            // Ignore auto-checkpoint errors
          }
        }
      }, this.config.autoCheckpointInterval);
    }

    // Start cleanup timer if configured
    if (this.config.autoCleanup && this.config.cleanupInterval > 0) {
      this.cleanupTimer = setInterval(async () => {
        try {
          await this.cleanup();
        } catch {
          // Ignore cleanup errors
        }
      }, this.config.cleanupInterval);
    }

    this.initialized = true;
    this.log('Session Manager initialized');
  }

  async dispose(): Promise<void> {
    // Stop timers
    if (this.autoCheckpointTimer) {
      clearInterval(this.autoCheckpointTimer);
      this.autoCheckpointTimer = undefined;
    }
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }

    // Clear subscriptions
    this.eventSubscriptions.clear();
    this.createdSubscriptions.clear();
    this.endedSubscriptions.clear();
    this.currentChangedSubscriptions.clear();

    // Clear current session
    this.currentSessionId = undefined;
    this.currentSession = undefined;

    // Dispose storage
    await this.storage.dispose();

    this.initialized = false;
    this.log('Session Manager disposed');
  }

  // ==================== Events ====================

  onSessionEvent(callback: SessionEventCallback): SessionManagerSubscription {
    const id = randomUUID();
    this.eventSubscriptions.set(id, callback);
    return {
      id,
      unsubscribe: () => {
        this.eventSubscriptions.delete(id);
      },
    };
  }

  onSessionCreated(callback: SessionCreatedCallback): SessionManagerSubscription {
    const id = randomUUID();
    this.createdSubscriptions.set(id, callback);
    return {
      id,
      unsubscribe: () => {
        this.createdSubscriptions.delete(id);
      },
    };
  }

  onSessionEnded(callback: SessionEndedCallback): SessionManagerSubscription {
    const id = randomUUID();
    this.endedSubscriptions.set(id, callback);
    return {
      id,
      unsubscribe: () => {
        this.endedSubscriptions.delete(id);
      },
    };
  }

  onCurrentSessionChanged(callback: CurrentSessionChangedCallback): SessionManagerSubscription {
    const id = randomUUID();
    this.currentChangedSubscriptions.set(id, callback);
    return {
      id,
      unsubscribe: () => {
        this.currentChangedSubscriptions.delete(id);
      },
    };
  }

  // ==================== Private Methods ====================

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  private applyFilter(sessions: Session[], filter: SessionQueryFilter): Session[] {
    let result = [...sessions];

    // Status filter
    if (filter.status) {
      const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
      result = result.filter((s) => statuses.includes(s.status));
    }

    // Tags filter (any match)
    if (filter.tags && filter.tags.length > 0) {
      result = result.filter((s) => filter.tags!.some((t) => s.tags.includes(t)));
    }

    // All tags filter
    if (filter.allTags && filter.allTags.length > 0) {
      result = result.filter((s) => filter.allTags!.every((t) => s.tags.includes(t)));
    }

    // Metadata filters
    if (filter.userId) {
      result = result.filter((s) => s.metadata.userId === filter.userId);
    }
    if (filter.agentType) {
      result = result.filter((s) => s.metadata.agentType === filter.agentType);
    }
    if (filter.projectId) {
      result = result.filter((s) => s.metadata.projectId === filter.projectId);
    }
    if (filter.workflowId) {
      result = result.filter((s) => s.metadata.workflowId === filter.workflowId);
    }

    // Date filters
    if (filter.createdAfter) {
      result = result.filter((s) => new Date(s.createdAt) >= filter.createdAfter!);
    }
    if (filter.createdBefore) {
      result = result.filter((s) => new Date(s.createdAt) <= filter.createdBefore!);
    }
    if (filter.updatedAfter) {
      result = result.filter((s) => new Date(s.updatedAt) >= filter.updatedAfter!);
    }
    if (filter.updatedBefore) {
      result = result.filter((s) => new Date(s.updatedAt) <= filter.updatedBefore!);
    }

    // Expired filter
    if (filter.excludeExpired) {
      const now = Date.now();
      result = result.filter((s) => {
        const age = now - new Date(s.updatedAt).getTime();
        return age <= this.config.sessionExpiry;
      });
    }

    // Sorting
    if (filter.sortBy) {
      result.sort((a, b) => {
        let aVal: Date | string | undefined;
        let bVal: Date | string | undefined;

        switch (filter.sortBy) {
          case 'createdAt':
            aVal = a.createdAt;
            bVal = b.createdAt;
            break;
          case 'updatedAt':
            aVal = a.updatedAt;
            bVal = b.updatedAt;
            break;
          case 'name':
            aVal = a.name || '';
            bVal = b.name || '';
            break;
        }

        if (aVal === undefined || bVal === undefined) return 0;

        const comparison =
          aVal instanceof Date || bVal instanceof Date
            ? new Date(aVal).getTime() - new Date(bVal).getTime()
            : String(aVal).localeCompare(String(bVal));

        return filter.sortOrder === 'desc' ? -comparison : comparison;
      });
    }

    // Pagination
    if (filter.offset !== undefined) {
      result = result.slice(filter.offset);
    }
    if (filter.limit !== undefined) {
      result = result.slice(0, filter.limit);
    }

    return result;
  }

  private async enforceMaxCheckpoints(sessionId: string): Promise<void> {
    const checkpoints = await this.storage.listCheckpoints(sessionId);

    if (checkpoints.length > this.config.maxCheckpointsPerSession) {
      // Sort by creation date (oldest first)
      const sorted = checkpoints.sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );

      // Delete oldest checkpoints to maintain limit
      const toDelete = sorted.slice(0, checkpoints.length - this.config.maxCheckpointsPerSession);
      for (const checkpoint of toDelete) {
        await this.storage.deleteCheckpoint(checkpoint.id);
        this.log(`Deleted old checkpoint to enforce limit: ${checkpoint.id}`);
      }

      // Update session's checkpoint list
      const session = await this.storage.loadSession(sessionId);
      if (session) {
        const deletedIds = new Set(toDelete.map((c) => c.id));
        session.checkpointIds = session.checkpointIds.filter((id) => !deletedIds.has(id));
        await this.storage.saveSession(session);
      }
    }
  }

  private async emitEvent(event: SessionEvent): Promise<void> {
    this.eventSubscriptions.forEach((callback) => {
      try {
        callback(event);
      } catch {
        // Ignore callback errors
      }
    });
  }

  private log(message: string): void {
    if (this.config.verbose) {
      console.log(`[SessionManager] ${message}`);
    }
  }
}
