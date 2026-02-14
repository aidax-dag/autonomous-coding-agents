/**
 * Pair Programming Module
 * Real-time pair programming system with cursor sharing,
 * code suggestions, and accept/reject UI protocol.
 *
 * @module core/pair-programming
 */

export { CursorSync } from './cursor-sync';
export { SuggestionManager } from './suggestion-manager';
export { PairSessionManager } from './pair-session-manager';
export { DEFAULT_PAIR_CONFIG } from './types';
export type {
  SuggestionStatus,
  CursorAction,
  SessionRole,
  CursorPosition,
  CursorEvent,
  CodeSuggestion,
  PairSession,
  PairParticipant,
  PairConfig,
  PairSessionMetrics,
} from './types';
