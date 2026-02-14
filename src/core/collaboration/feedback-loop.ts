/**
 * Feedback Loop
 *
 * Manages bidirectional feedback sessions between agents.
 * Handles feedback routing, session lifecycle, escalation,
 * and handler registration.
 *
 * @module core/collaboration
 */

import { EventEmitter } from 'events';
import type {
  AgentFeedback,
  FeedbackResponse,
  FeedbackType,
  CollaborationSession,
  CollaborationConfig,
} from './types';

// ============================================================================
// Types
// ============================================================================

/**
 * Handler for processing incoming feedback.
 * Returns a FeedbackResponse if the handler can respond, or null to skip.
 */
export type FeedbackHandler = (
  feedback: AgentFeedback,
) => Promise<FeedbackResponse | null>;

/**
 * Events emitted by FeedbackLoop
 */
export interface FeedbackLoopEvents {
  'feedback:sent': (feedback: AgentFeedback) => void;
  'feedback:received': (feedback: AgentFeedback) => void;
  'feedback:response': (response: FeedbackResponse) => void;
  'session:created': (session: CollaborationSession) => void;
  'session:resolved': (session: CollaborationSession) => void;
  'session:escalated': (session: CollaborationSession, reason: string) => void;
}

// ============================================================================
// Feedback Loop
// ============================================================================

/**
 * Manages feedback sessions and routes feedback between agents
 */
// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export class FeedbackLoop extends EventEmitter {
  private readonly sessions: Map<string, CollaborationSession> = new Map();
  private readonly handlers: Map<FeedbackType, FeedbackHandler[]> = new Map();
  private readonly config: CollaborationConfig;

  constructor(config: CollaborationConfig) {
    super();
    this.config = config;
  }

  /**
   * Register a handler for a specific feedback type
   */
  registerHandler(type: FeedbackType, handler: FeedbackHandler): void {
    const existing = this.handlers.get(type) ?? [];
    existing.push(handler);
    this.handlers.set(type, existing);
  }

  /**
   * Send feedback, creating or updating a collaboration session.
   * Enforces maxFeedbackRounds and auto-escalation.
   */
  async sendFeedback(feedback: AgentFeedback): Promise<void> {
    // Find or create session for this task + participant pair
    const sessionKey = this.buildSessionKey(
      feedback.taskId,
      feedback.fromAgent,
      feedback.toAgent,
    );
    let session = this.sessions.get(sessionKey);

    if (!session) {
      session = this.createSession(sessionKey, feedback);
    }

    // Check max feedback rounds
    if (session.feedbackHistory.length >= this.config.maxFeedbackRounds) {
      if (this.config.autoEscalateOnConflict) {
        await this.escalateSession(
          sessionKey,
          `Maximum feedback rounds (${this.config.maxFeedbackRounds}) exceeded`,
        );
      }
      return;
    }

    // Add feedback to session
    session.feedbackHistory.push(feedback);

    // Ensure participants are tracked
    if (!session.participants.includes(feedback.fromAgent)) {
      session.participants.push(feedback.fromAgent);
    }
    if (!session.participants.includes(feedback.toAgent)) {
      session.participants.push(feedback.toAgent);
    }

    this.emit('feedback:sent', feedback);
    this.emit('feedback:received', feedback);

    // Invoke registered handlers for this feedback type
    const handlers = this.handlers.get(feedback.type) ?? [];
    for (const handler of handlers) {
      const response = await handler(feedback);
      if (response) {
        await this.respondToFeedback(response);
      }
    }
  }

  /**
   * Record a response to feedback within the appropriate session
   */
  async respondToFeedback(response: FeedbackResponse): Promise<void> {
    // Find the session containing the referenced feedback
    for (const session of this.sessions.values()) {
      const matchingFeedback = session.feedbackHistory.find(
        (f) => f.id === response.feedbackId,
      );
      if (matchingFeedback) {
        session.responses.push(response);
        this.emit('feedback:response', response);
        return;
      }
    }
  }

  /**
   * Retrieve a session by its ID
   */
  getSession(sessionId: string): CollaborationSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Get all sessions with 'active' status
   */
  getActiveSessions(): CollaborationSession[] {
    return Array.from(this.sessions.values()).filter(
      (s) => s.status === 'active',
    );
  }

  /**
   * Mark a session as resolved
   */
  async resolveSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    if (session.status !== 'active') {
      throw new Error(
        `Cannot resolve session in '${session.status}' status`,
      );
    }
    session.status = 'resolved';
    session.resolvedAt = new Date().toISOString();
    this.emit('session:resolved', session);
  }

  /**
   * Escalate a session due to unresolvable conflict or timeout
   */
  async escalateSession(sessionId: string, reason: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    session.status = 'escalated';
    this.emit('session:escalated', session, reason);
  }

  /**
   * Get all sessions (for testing/debugging)
   */
  getAllSessions(): Map<string, CollaborationSession> {
    return this.sessions;
  }

  // ── Private Helpers ──────────────────────────────────────

  private buildSessionKey(
    taskId: string,
    agentA: string,
    agentB: string,
  ): string {
    // Deterministic key: sorted agents ensure same pair always maps to same session
    const sorted = [agentA, agentB].sort();
    return `session-${taskId}-${sorted[0]}-${sorted[1]}`;
  }

  private createSession(
    id: string,
    feedback: AgentFeedback,
  ): CollaborationSession {
    const session: CollaborationSession = {
      id,
      participants: [feedback.fromAgent, feedback.toAgent],
      taskId: feedback.taskId,
      feedbackHistory: [],
      responses: [],
      status: 'active',
      createdAt: new Date().toISOString(),
    };
    this.sessions.set(id, session);
    this.emit('session:created', session);
    return session;
  }
}

// Type-safe event emitter augmentation
// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export interface FeedbackLoop {
  on<E extends keyof FeedbackLoopEvents>(
    event: E,
    listener: FeedbackLoopEvents[E],
  ): this;
  emit<E extends keyof FeedbackLoopEvents>(
    event: E,
    ...args: Parameters<FeedbackLoopEvents[E]>
  ): boolean;
}
