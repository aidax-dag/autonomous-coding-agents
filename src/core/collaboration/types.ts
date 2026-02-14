/**
 * Multi-Agent Collaboration Types
 *
 * Defines the core types for bidirectional feedback loops,
 * collaboration sessions, and inter-agent communication.
 *
 * @module core/collaboration
 */

// ============================================================================
// Feedback Enums
// ============================================================================

/**
 * Type of feedback being communicated between agents
 */
export type FeedbackType =
  | 'approval'
  | 'rejection'
  | 'clarification'
  | 'suggestion'
  | 'dependency'
  | 'conflict';

/**
 * Priority level for feedback messages
 */
export type FeedbackPriority = 'low' | 'normal' | 'high' | 'critical';

// ============================================================================
// Feedback Messages
// ============================================================================

/**
 * Feedback sent from one agent to another regarding a task
 */
export interface AgentFeedback {
  /** Unique feedback identifier */
  id: string;
  /** Agent sending the feedback */
  fromAgent: string;
  /** Agent receiving the feedback */
  toAgent: string;
  /** Task this feedback relates to */
  taskId: string;
  /** Type of feedback */
  type: FeedbackType;
  /** Priority level */
  priority: FeedbackPriority;
  /** Feedback content/message */
  content: string;
  /** Optional improvement suggestions */
  suggestions?: string[];
  /** Related task identifiers */
  relatedTaskIds?: string[];
  /** ISO timestamp of when feedback was created */
  timestamp: string;
  /** Whether the recipient must respond */
  requiresResponse: boolean;
}

/**
 * Response to a feedback message
 */
export interface FeedbackResponse {
  /** ID of the feedback being responded to */
  feedbackId: string;
  /** Agent sending the response */
  fromAgent: string;
  /** Whether the feedback was accepted */
  accepted: boolean;
  /** Action taken or planned */
  action: string;
  /** Additional details about the response */
  details?: string;
}

// ============================================================================
// Collaboration Sessions
// ============================================================================

/**
 * Status of a collaboration session
 */
export type CollaborationSessionStatus = 'active' | 'resolved' | 'escalated';

/**
 * A collaboration session tracks the feedback exchange between agents for a task
 */
export interface CollaborationSession {
  /** Unique session identifier */
  id: string;
  /** Agent IDs participating in this session */
  participants: string[];
  /** Task this session relates to */
  taskId: string;
  /** Ordered history of feedback messages */
  feedbackHistory: AgentFeedback[];
  /** Responses to feedback */
  responses: FeedbackResponse[];
  /** Current session status */
  status: CollaborationSessionStatus;
  /** ISO timestamp of session creation */
  createdAt: string;
  /** ISO timestamp of resolution (if resolved) */
  resolvedAt?: string;
}

// ============================================================================
// Metrics & Configuration
// ============================================================================

/**
 * Metrics tracking collaboration effectiveness
 */
export interface CollaborationMetrics {
  /** Total feedback messages sent */
  totalFeedbacksSent: number;
  /** Total feedback messages received */
  totalFeedbacksReceived: number;
  /** Average time to resolve sessions in ms */
  averageResolutionTime: number;
  /** Number of conflicts successfully resolved */
  conflictsResolved: number;
  /** Number of task delegations completed */
  delegationsCompleted: number;
}

/**
 * Configuration for collaboration behavior
 */
export interface CollaborationConfig {
  /** Maximum feedback rounds before auto-escalation (default: 5) */
  maxFeedbackRounds: number;
  /** Timeout for feedback responses in ms (default: 30000) */
  feedbackTimeoutMs: number;
  /** Automatically escalate on unresolved conflicts (default: true) */
  autoEscalateOnConflict: boolean;
  /** Enable metrics collection (default: true) */
  enableMetrics: boolean;
}

/**
 * Default collaboration configuration
 */
export const DEFAULT_COLLABORATION_CONFIG: CollaborationConfig = {
  maxFeedbackRounds: 5,
  feedbackTimeoutMs: 30_000,
  autoEscalateOnConflict: true,
  enableMetrics: true,
};
