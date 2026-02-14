/**
 * Suggestion Manager
 * Manages the lifecycle of code suggestions within a pair programming session,
 * including creation, acceptance, rejection, expiry, and metrics tracking.
 *
 * @module core/pair-programming
 */

import { EventEmitter } from 'events';
import type { CodeSuggestion, PairConfig } from './types';

export class SuggestionManager extends EventEmitter {
  private suggestions: Map<string, CodeSuggestion> = new Map();
  private idCounter = 0;

  constructor(private config: PairConfig) {
    super();
  }

  /**
   * Create a new code suggestion. Returns null if the maximum number
   * of active (pending) suggestions has been reached.
   */
  createSuggestion(
    params: Omit<CodeSuggestion, 'id' | 'status' | 'createdAt' | 'expiresAt'>,
  ): CodeSuggestion | null {
    const activePending = this.getActiveSuggestions();
    if (activePending.length >= this.config.maxActiveSuggestions) {
      return null;
    }

    const now = Date.now();
    const suggestion: CodeSuggestion = {
      ...params,
      id: this.generateId(),
      status: 'pending',
      createdAt: now,
      expiresAt: now + this.config.suggestionExpiryMs,
    };

    this.suggestions.set(suggestion.id, suggestion);
    this.emit('suggestion:created', suggestion);
    return suggestion;
  }

  /**
   * Accept a pending suggestion. Returns the updated suggestion or null
   * if the suggestion does not exist or is not in pending status.
   */
  acceptSuggestion(suggestionId: string): CodeSuggestion | null {
    const suggestion = this.suggestions.get(suggestionId);
    if (!suggestion || suggestion.status !== 'pending') {
      return null;
    }

    suggestion.status = 'accepted';
    this.emit('suggestion:accepted', suggestion);
    return suggestion;
  }

  /**
   * Reject a pending suggestion. Returns the updated suggestion or null
   * if the suggestion does not exist or is not in pending status.
   */
  rejectSuggestion(suggestionId: string): CodeSuggestion | null {
    const suggestion = this.suggestions.get(suggestionId);
    if (!suggestion || suggestion.status !== 'pending') {
      return null;
    }

    suggestion.status = 'rejected';
    this.emit('suggestion:rejected', suggestion);
    return suggestion;
  }

  /**
   * Get all suggestions currently in pending status.
   */
  getActiveSuggestions(): CodeSuggestion[] {
    return Array.from(this.suggestions.values()).filter(
      (s) => s.status === 'pending',
    );
  }

  /**
   * Get a single suggestion by ID.
   */
  getSuggestion(id: string): CodeSuggestion | undefined {
    return this.suggestions.get(id);
  }

  /**
   * Expire all pending suggestions that have passed their expiresAt timestamp.
   * Returns the list of newly expired suggestions.
   */
  expireOld(): CodeSuggestion[] {
    const now = Date.now();
    const expired: CodeSuggestion[] = [];

    for (const suggestion of this.suggestions.values()) {
      if (suggestion.status === 'pending' && now >= suggestion.expiresAt) {
        suggestion.status = 'expired';
        expired.push(suggestion);
        this.emit('suggestion:expired', suggestion);
      }
    }

    return expired;
  }

  /**
   * Get aggregate metrics across all suggestions.
   */
  getMetrics(): {
    total: number;
    accepted: number;
    rejected: number;
    expired: number;
    pending: number;
  } {
    let accepted = 0;
    let rejected = 0;
    let expired = 0;
    let pending = 0;

    for (const suggestion of this.suggestions.values()) {
      switch (suggestion.status) {
        case 'accepted':
          accepted++;
          break;
        case 'rejected':
          rejected++;
          break;
        case 'expired':
          expired++;
          break;
        case 'pending':
          pending++;
          break;
      }
    }

    return {
      total: this.suggestions.size,
      accepted,
      rejected,
      expired,
      pending,
    };
  }

  /**
   * Remove all suggestions and reset the internal state.
   */
  clear(): void {
    this.suggestions.clear();
  }

  private generateId(): string {
    this.idCounter++;
    return `suggestion-${Date.now()}-${this.idCounter}`;
  }
}
