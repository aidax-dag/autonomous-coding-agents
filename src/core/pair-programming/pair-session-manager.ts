/**
 * Pair Session Manager
 * Orchestrates pair programming sessions, coordinating participants,
 * cursor synchronization, and suggestion management within each session.
 *
 * @module core/pair-programming
 */

import { EventEmitter } from 'events';
import { CursorSync } from './cursor-sync';
import { SuggestionManager } from './suggestion-manager';
import type {
  PairSession,
  PairParticipant,
  PairConfig,
  PairSessionMetrics,
  CodeSuggestion,
  CursorPosition,
} from './types';
import { DEFAULT_PAIR_CONFIG } from './types';

interface SessionState {
  session: PairSession;
  cursorSync: CursorSync;
  suggestionManager: SuggestionManager;
}

export class PairSessionManager extends EventEmitter {
  private sessions: Map<string, SessionState> = new Map();
  private idCounter = 0;

  /**
   * Create a new pair programming session with optional config overrides.
   * Session starts in 'waiting' status.
   */
  createSession(config?: Partial<PairConfig>): PairSession {
    const fullConfig: PairConfig = { ...DEFAULT_PAIR_CONFIG, ...config };
    const id = this.generateId();

    const session: PairSession = {
      id,
      participants: [],
      activeSuggestions: [],
      cursorHistory: [],
      status: 'waiting',
      createdAt: Date.now(),
      config: fullConfig,
    };

    const cursorSync = new CursorSync();
    const suggestionManager = new SuggestionManager(fullConfig);

    this.sessions.set(id, { session, cursorSync, suggestionManager });
    this.emit('session:created', session);
    return session;
  }

  /**
   * Add a participant to an existing session.
   * Throws if the session does not exist or has already ended.
   */
  joinSession(
    sessionId: string,
    participant: Omit<PairParticipant, 'connected' | 'cursorPosition'>,
  ): PairParticipant {
    const state = this.getSessionState(sessionId);
    if (!state) {
      throw new Error(`Session '${sessionId}' not found`);
    }
    if (state.session.status === 'ended') {
      throw new Error(`Session '${sessionId}' has ended`);
    }

    const fullParticipant: PairParticipant = {
      ...participant,
      connected: true,
      cursorPosition: undefined,
    };

    state.session.participants.push(fullParticipant);
    this.emit('participant:joined', {
      sessionId,
      participant: fullParticipant,
    });
    return fullParticipant;
  }

  /**
   * Remove a participant from a session.
   * Cleans up their cursor state.
   */
  leaveSession(sessionId: string, participantId: string): void {
    const state = this.getSessionState(sessionId);
    if (!state) {
      throw new Error(`Session '${sessionId}' not found`);
    }

    const idx = state.session.participants.findIndex(
      (p) => p.id === participantId,
    );
    if (idx === -1) {
      throw new Error(
        `Participant '${participantId}' not found in session '${sessionId}'`,
      );
    }

    const participant = state.session.participants[idx];
    participant.connected = false;
    state.cursorSync.removeCursor(participantId);

    this.emit('participant:left', { sessionId, participantId });
  }

  /**
   * Transition a session to 'active' status.
   * The session must be in 'waiting' or 'paused' status.
   */
  startSession(sessionId: string): void {
    const state = this.getSessionState(sessionId);
    if (!state) {
      throw new Error(`Session '${sessionId}' not found`);
    }
    if (state.session.status === 'ended') {
      throw new Error(`Session '${sessionId}' has ended`);
    }
    if (state.session.status === 'active') {
      return;
    }

    state.session.status = 'active';
    this.emit('session:started', { sessionId });
  }

  /**
   * Pause an active session.
   */
  pauseSession(sessionId: string): void {
    const state = this.getSessionState(sessionId);
    if (!state) {
      throw new Error(`Session '${sessionId}' not found`);
    }
    if (state.session.status !== 'active') {
      throw new Error(`Session '${sessionId}' is not active`);
    }

    state.session.status = 'paused';
    this.emit('session:paused', { sessionId });
  }

  /**
   * End a session and return final metrics.
   * Marks all connected participants as disconnected.
   */
  endSession(sessionId: string): PairSessionMetrics {
    const state = this.getSessionState(sessionId);
    if (!state) {
      throw new Error(`Session '${sessionId}' not found`);
    }

    state.session.status = 'ended';

    // Disconnect all participants
    for (const participant of state.session.participants) {
      participant.connected = false;
    }

    const suggestionMetrics = state.suggestionManager.getMetrics();
    const now = Date.now();
    const sessionDuration = now - state.session.createdAt;

    // Compute average response time for non-pending suggestions
    const resolvedSuggestions = Array.from(
      state.session.activeSuggestions,
    ).filter((s) => s.status === 'accepted' || s.status === 'rejected');

    let averageResponseTime = 0;
    if (resolvedSuggestions.length > 0) {
      // No explicit resolvedAt tracking; approximate as 0 for simplicity
      averageResponseTime = 0;
    }

    const metrics: PairSessionMetrics = {
      totalSuggestions: suggestionMetrics.total,
      acceptedSuggestions: suggestionMetrics.accepted,
      rejectedSuggestions: suggestionMetrics.rejected,
      expiredSuggestions: suggestionMetrics.expired,
      averageResponseTime,
      sessionDuration,
    };

    this.emit('session:ended', { sessionId, metrics });
    return metrics;
  }

  /**
   * Retrieve a session by ID.
   */
  getSession(sessionId: string): PairSession | undefined {
    return this.getSessionState(sessionId)?.session;
  }

  /**
   * Get all sessions that are not in 'ended' status.
   */
  getActiveSessions(): PairSession[] {
    const active: PairSession[] = [];
    for (const state of this.sessions.values()) {
      if (state.session.status !== 'ended') {
        active.push(state.session);
      }
    }
    return active;
  }

  /**
   * Create a suggestion within a specific session.
   * The session must be active.
   */
  addSuggestion(
    sessionId: string,
    suggestion: Omit<
      CodeSuggestion,
      'id' | 'status' | 'createdAt' | 'expiresAt'
    >,
  ): CodeSuggestion | null {
    const state = this.getSessionState(sessionId);
    if (!state) {
      throw new Error(`Session '${sessionId}' not found`);
    }
    if (state.session.status !== 'active') {
      return null;
    }

    const created = state.suggestionManager.createSuggestion(suggestion);
    if (created) {
      state.session.activeSuggestions.push(created);
    }
    return created;
  }

  /**
   * Accept or reject a suggestion within a session.
   */
  respondToSuggestion(
    sessionId: string,
    suggestionId: string,
    accept: boolean,
  ): CodeSuggestion | null {
    const state = this.getSessionState(sessionId);
    if (!state) {
      throw new Error(`Session '${sessionId}' not found`);
    }

    if (accept) {
      return state.suggestionManager.acceptSuggestion(suggestionId);
    }
    return state.suggestionManager.rejectSuggestion(suggestionId);
  }

  /**
   * Update a participant's cursor position within a session.
   */
  updateCursor(
    sessionId: string,
    participantId: string,
    position: CursorPosition,
  ): void {
    const state = this.getSessionState(sessionId);
    if (!state) {
      throw new Error(`Session '${sessionId}' not found`);
    }

    const participant = state.session.participants.find(
      (p) => p.id === participantId,
    );
    if (!participant) {
      throw new Error(
        `Participant '${participantId}' not found in session '${sessionId}'`,
      );
    }

    participant.cursorPosition = position;
    state.cursorSync.updateCursor(participantId, participant.role, position);

    // Push event to session-level cursor history
    const history = state.cursorSync.getHistory(1);
    if (history.length > 0) {
      state.session.cursorHistory.push(history[history.length - 1]);
    }
  }

  /**
   * Get the CursorSync instance for a session (useful for direct event subscriptions).
   */
  getCursorSync(sessionId: string): CursorSync | undefined {
    return this.getSessionState(sessionId)?.cursorSync;
  }

  /**
   * Get the SuggestionManager instance for a session.
   */
  getSuggestionManager(sessionId: string): SuggestionManager | undefined {
    return this.getSessionState(sessionId)?.suggestionManager;
  }

  private getSessionState(sessionId: string): SessionState | undefined {
    return this.sessions.get(sessionId);
  }

  private generateId(): string {
    this.idCounter++;
    return `pair-session-${Date.now()}-${this.idCounter}`;
  }
}
