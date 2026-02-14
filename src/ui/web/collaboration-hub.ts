/**
 * Collaboration Hub
 *
 * SSE-based collaboration hub for shared sessions and real-time
 * team communication. Uses SSE for server-to-client push and
 * POST endpoints for client-to-server messages.
 *
 * @module ui/web
 */

import { EventEmitter } from 'events';
import { createAgentLogger } from '../../shared/logging/logger';

const logger = createAgentLogger('Web', 'collaboration-hub');

/**
 * Represents a connected collaboration client
 */
export interface CollaborationClient {
  id: string;
  userId: string;
  sessionId: string;
  connectedAt: string;
}

/**
 * Message types supported by the collaboration hub
 */
export type CollaborationMessageType =
  | 'cursor'
  | 'edit'
  | 'chat'
  | 'status'
  | 'task-update'
  | 'agent-event';

/**
 * A collaboration message sent between participants
 */
export interface CollaborationMessage {
  type: CollaborationMessageType;
  senderId: string;
  sessionId: string;
  payload: unknown;
  timestamp: string;
}

/**
 * A shared collaboration session
 */
export interface SharedSession {
  id: string;
  name: string;
  createdBy: string;
  createdAt: string;
  participants: string[];
  isActive: boolean;
}

/**
 * Options for constructing a CollaborationHub
 */
export interface CollaborationHubOptions {
  /** Maximum number of messages to retain per session (default: 100) */
  maxHistoryPerSession?: number;
}

/**
 * CollaborationHub
 *
 * Manages shared sessions, connected clients, and message broadcasting.
 * Emits typed events for integration with SSE broker and REST endpoints.
 */
export class CollaborationHub extends EventEmitter {
  private clients: Map<string, CollaborationClient> = new Map();
  private sessions: Map<string, SharedSession> = new Map();
  private messageHistory: Map<string, CollaborationMessage[]> = new Map();
  private readonly maxHistoryPerSession: number;

  constructor(options: CollaborationHubOptions = {}) {
    super();
    this.maxHistoryPerSession = options.maxHistoryPerSession ?? 100;
  }

  // ── Session Management ───────────────────────────────────────

  /**
   * Create a new shared session.
   */
  createSession(id: string, name: string, createdBy: string): SharedSession {
    const session: SharedSession = {
      id,
      name,
      createdBy,
      createdAt: new Date().toISOString(),
      participants: [createdBy],
      isActive: true,
    };
    this.sessions.set(id, session);
    this.messageHistory.set(id, []);
    this.emit('session:created', session);
    logger.info(`Session created: ${id} by ${createdBy}`);
    return session;
  }

  /**
   * Join an existing active session. Returns the session or null if not found/inactive.
   */
  joinSession(sessionId: string, userId: string): SharedSession | null {
    const session = this.sessions.get(sessionId);
    if (!session || !session.isActive) return null;
    if (!session.participants.includes(userId)) {
      session.participants.push(userId);
    }
    this.emit('session:joined', { sessionId, userId });
    return session;
  }

  /**
   * Leave a session. Removes participant and disconnects their clients.
   */
  leaveSession(sessionId: string, userId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    session.participants = session.participants.filter(p => p !== userId);
    this.emit('session:left', { sessionId, userId });
    // Remove client connections for this session+user
    for (const [clientId, client] of this.clients) {
      if (client.sessionId === sessionId && client.userId === userId) {
        this.clients.delete(clientId);
      }
    }
    return true;
  }

  /**
   * Close a session. Deactivates and removes all connected clients.
   */
  closeSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    session.isActive = false;
    // Remove all clients in this session
    for (const [clientId, client] of this.clients) {
      if (client.sessionId === sessionId) {
        this.clients.delete(clientId);
      }
    }
    this.emit('session:closed', sessionId);
    logger.info(`Session closed: ${sessionId}`);
    return true;
  }

  // ── Client Management ────────────────────────────────────────

  /**
   * Add a client connection to an active session.
   * Returns the client or null if the session is invalid/inactive.
   */
  addClient(clientId: string, userId: string, sessionId: string): CollaborationClient | null {
    const session = this.sessions.get(sessionId);
    if (!session || !session.isActive) return null;
    const client: CollaborationClient = {
      id: clientId,
      userId,
      sessionId,
      connectedAt: new Date().toISOString(),
    };
    this.clients.set(clientId, client);
    this.emit('client:connected', client);
    return client;
  }

  /**
   * Remove a client connection.
   */
  removeClient(clientId: string): boolean {
    const client = this.clients.get(clientId);
    if (!client) return false;
    this.clients.delete(clientId);
    this.emit('client:disconnected', client);
    return true;
  }

  // ── Messaging ────────────────────────────────────────────────

  /**
   * Broadcast a message to all participants of a session.
   * Stores the message in history and emits events.
   */
  broadcast(message: CollaborationMessage): void {
    // Store in history
    const history = this.messageHistory.get(message.sessionId);
    if (history) {
      history.push(message);
      if (history.length > this.maxHistoryPerSession) {
        history.splice(0, history.length - this.maxHistoryPerSession);
      }
    }
    // Emit to session participants
    this.emit('message', message);
    this.emit(`message:${message.sessionId}`, message);
  }

  // ── Queries ──────────────────────────────────────────────────

  /**
   * Get a session by ID.
   */
  getSession(sessionId: string): SharedSession | null {
    return this.sessions.get(sessionId) ?? null;
  }

  /**
   * List all sessions (active and inactive).
   */
  listSessions(): SharedSession[] {
    return Array.from(this.sessions.values());
  }

  /**
   * List only active sessions.
   */
  getActiveSessions(): SharedSession[] {
    return Array.from(this.sessions.values()).filter(s => s.isActive);
  }

  /**
   * Get all clients connected to a specific session.
   */
  getSessionClients(sessionId: string): CollaborationClient[] {
    return Array.from(this.clients.values()).filter(c => c.sessionId === sessionId);
  }

  /**
   * Get message history for a session.
   */
  getMessageHistory(sessionId: string): CollaborationMessage[] {
    return this.messageHistory.get(sessionId) ?? [];
  }

  /**
   * Get total connected client count.
   */
  getClientCount(): number {
    return this.clients.size;
  }

  /**
   * Get total session count.
   */
  getSessionCount(): number {
    return this.sessions.size;
  }

  // ── Lifecycle ────────────────────────────────────────────────

  /**
   * Dispose all resources and clear state.
   */
  dispose(): void {
    this.clients.clear();
    this.sessions.clear();
    this.messageHistory.clear();
    this.removeAllListeners();
  }
}

/**
 * Factory function for creating a CollaborationHub
 */
export function createCollaborationHub(options?: CollaborationHubOptions): CollaborationHub {
  return new CollaborationHub(options);
}
