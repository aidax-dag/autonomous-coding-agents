/**
 * Feedback System Types
 *
 * Type definitions for interactive feedback system.
 *
 * Feature: F4.4 - Interactive Feedback System
 */

/**
 * Feedback request types
 */
export enum FeedbackRequestType {
  PLAN_APPROVAL = 'plan-approval',
  CODE_REVIEW = 'code-review',
  DIRECTION_CHANGE = 'direction-change',
  ERROR_RESOLUTION = 'error-resolution',
  GENERAL = 'general',
}

/**
 * Feedback response types
 */
export enum FeedbackResponseType {
  APPROVE = 'approve',
  MODIFY = 'modify',
  REJECT = 'reject',
  CUSTOM = 'custom',
}

/**
 * Feedback request from agent to user
 */
export interface FeedbackRequest {
  id: string;
  taskId: string;
  agentId: string;
  agentType: string;
  type: FeedbackRequestType;
  title: string;
  content: string;
  options?: FeedbackOption[];
  context?: Record<string, unknown>;
  createdAt: number;
  expiresAt?: number;
  requiresResponse: boolean;
}

/**
 * Feedback option for user to choose from
 */
export interface FeedbackOption {
  value: string;
  label: string;
  description?: string;
}

/**
 * User feedback response
 */
export interface FeedbackResponse {
  id: string;
  requestId: string;
  taskId: string;
  type: FeedbackResponseType;
  choice?: string;
  message?: string;
  data?: Record<string, unknown>;
  userId?: string;
  createdAt: number;
}

/**
 * Agent update message
 */
export interface AgentUpdate {
  taskId: string;
  agentId: string;
  agentType: string;
  type: AgentUpdateType;
  title: string;
  message: string;
  progress?: number;
  data?: Record<string, unknown>;
  requiresFeedback?: boolean;
  feedbackRequest?: FeedbackRequest;
  timestamp: number;
}

/**
 * Agent update types
 */
export enum AgentUpdateType {
  STATUS_CHANGE = 'status-change',
  PROGRESS = 'progress',
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  SUCCESS = 'success',
  FEEDBACK_REQUEST = 'feedback-request',
}

/**
 * Feedback history entry
 */
export interface FeedbackHistoryEntry {
  id: string;
  taskId: string;
  request: FeedbackRequest;
  response?: FeedbackResponse;
  status: FeedbackStatus;
  createdAt: number;
  respondedAt?: number;
}

/**
 * Feedback status
 */
export enum FeedbackStatus {
  PENDING = 'pending',
  RESPONDED = 'responded',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled',
}

/**
 * Interactive session state
 */
export interface InteractiveSessionState {
  taskId: string;
  active: boolean;
  startedAt: number;
  lastActivityAt: number;
  feedbackRequests: Map<string, FeedbackRequest>;
  pendingFeedback: string[];
  updates: AgentUpdate[];
}
