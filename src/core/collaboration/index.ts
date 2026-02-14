/**
 * Multi-Agent Collaboration Module
 *
 * Provides bidirectional feedback loops, collaboration session management,
 * and multi-agent coordination for task delegation and conflict resolution.
 *
 * @module core/collaboration
 */

export {
  type FeedbackType,
  type FeedbackPriority,
  type AgentFeedback,
  type FeedbackResponse,
  type CollaborationSessionStatus,
  type CollaborationSession,
  type CollaborationMetrics,
  type CollaborationConfig,
  DEFAULT_COLLABORATION_CONFIG,
} from './types';

export {
  FeedbackLoop,
  type FeedbackHandler,
  type FeedbackLoopEvents,
} from './feedback-loop';

export {
  CollaborationManager,
  type RegisteredAgent,
  type CollaborationManagerEvents,
} from './collaboration-manager';
