/**
 * Pair Programming Types
 * Type definitions for real-time pair programming sessions
 * with cursor sharing, code suggestions, and accept/reject protocol.
 *
 * @module core/pair-programming
 */

export type SuggestionStatus = 'pending' | 'accepted' | 'rejected' | 'expired';
export type CursorAction = 'move' | 'select' | 'insert' | 'delete';
export type SessionRole = 'driver' | 'navigator' | 'observer';

export interface CursorPosition {
  file: string;
  line: number;
  column: number;
  selection?: {
    startLine: number;
    startColumn: number;
    endLine: number;
    endColumn: number;
  };
}

export interface CursorEvent {
  userId: string;
  role: SessionRole;
  action: CursorAction;
  position: CursorPosition;
  timestamp: number;
}

export interface CodeSuggestion {
  id: string;
  agentId: string;
  file: string;
  range: {
    startLine: number;
    startColumn: number;
    endLine: number;
    endColumn: number;
  };
  originalContent: string;
  suggestedContent: string;
  description: string;
  confidence: number;
  status: SuggestionStatus;
  createdAt: number;
  expiresAt: number;
}

export interface PairSession {
  id: string;
  participants: PairParticipant[];
  activeSuggestions: CodeSuggestion[];
  cursorHistory: CursorEvent[];
  status: 'waiting' | 'active' | 'paused' | 'ended';
  createdAt: number;
  config: PairConfig;
}

export interface PairParticipant {
  id: string;
  name: string;
  role: SessionRole;
  isAgent: boolean;
  cursorPosition?: CursorPosition;
  connected: boolean;
}

export interface PairConfig {
  suggestionExpiryMs: number;
  maxActiveSuggestions: number;
  cursorSyncIntervalMs: number;
  autoSuggest: boolean;
  requireApproval: boolean;
}

export const DEFAULT_PAIR_CONFIG: PairConfig = {
  suggestionExpiryMs: 30000,
  maxActiveSuggestions: 5,
  cursorSyncIntervalMs: 100,
  autoSuggest: true,
  requireApproval: true,
};

export interface PairSessionMetrics {
  totalSuggestions: number;
  acceptedSuggestions: number;
  rejectedSuggestions: number;
  expiredSuggestions: number;
  averageResponseTime: number;
  sessionDuration: number;
}
