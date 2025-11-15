import { z } from 'zod';

/**
 * Message Schema Definitions with Zod
 *
 * Provides runtime type validation for all inter-agent messages.
 * All messages must conform to these schemas for type safety.
 *
 * Feature: F1.2 - Message Schema Definitions
 */

// ============================================
// Common Types
// ============================================

export const MessageType = z.enum([
  // Coder Agent Messages
  'FEATURE_ASSIGNED',
  'PLAN_CREATED',
  'IMPLEMENTATION_STARTED',
  'IMPLEMENTATION_PROGRESS',
  'PR_CREATED',
  'ADDRESSING_REVIEW_FEEDBACK',
  'IMPLEMENTATION_COMPLETED',
  'IMPLEMENTATION_FAILED',

  // Reviewer Agent Messages
  'PR_REVIEW_STARTED',
  'REVIEW_COMMENTS_POSTED',
  'PR_APPROVED',
  'PR_CHANGES_REQUESTED',
  'REVIEW_FAILED',

  // Repo Manager Messages
  'FEATURE_QUEUED',
  'FEATURE_STARTED',
  'PR_MERGED',
  'PR_CLOSED',
  'FEATURE_COMPLETED',
  'FEATURE_CANCELLED',

  // System Messages
  'AGENT_STARTED',
  'AGENT_STOPPED',
  'AGENT_ERROR',
  'HEARTBEAT',
]);

export type MessageType = z.infer<typeof MessageType>;

export const AgentType = z.enum(['CODER', 'REVIEWER', 'REPO_MANAGER', 'SYSTEM']);
export type AgentType = z.infer<typeof AgentType>;

export const Priority = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
export type Priority = z.infer<typeof Priority>;

// ============================================
// Base Message Schema
// ============================================

export const BaseMessageSchema = z.object({
  id: z.string().uuid(),
  type: MessageType,
  from: AgentType,
  to: AgentType.or(z.literal('BROADCAST')),
  timestamp: z.number(),
  correlationId: z.string().uuid().optional(),
  priority: Priority.default('MEDIUM'),
});

export type BaseMessage = z.infer<typeof BaseMessageSchema>;

// ============================================
// Feature-Related Messages
// ============================================

export const FeatureAssignedPayloadSchema = z.object({
  featureId: z.string().uuid(),
  title: z.string(),
  description: z.string(),
  acceptanceCriteria: z.array(z.string()),
  priority: Priority,
  estimatedEffort: z.enum(['SMALL', 'MEDIUM', 'LARGE', 'XLARGE']),
  dependencies: z.array(z.string().uuid()).optional(),
});

export const FeatureAssignedMessageSchema = BaseMessageSchema.extend({
  type: z.literal('FEATURE_ASSIGNED'),
  from: z.literal('REPO_MANAGER'),
  to: z.literal('CODER'),
  payload: FeatureAssignedPayloadSchema,
});

export type FeatureAssignedMessage = z.infer<typeof FeatureAssignedMessageSchema>;

// ============================================
// Plan-Related Messages
// ============================================

export const PlanCreatedPayloadSchema = z.object({
  featureId: z.string().uuid(),
  planMarkdown: z.string(),
  estimatedFiles: z.number(),
  estimatedTurns: z.number(),
  approach: z.string(),
  risks: z.array(z.string()).optional(),
});

export const PlanCreatedMessageSchema = BaseMessageSchema.extend({
  type: z.literal('PLAN_CREATED'),
  from: z.literal('CODER'),
  to: z.literal('REPO_MANAGER'),
  payload: PlanCreatedPayloadSchema,
});

export type PlanCreatedMessage = z.infer<typeof PlanCreatedMessageSchema>;

// ============================================
// Implementation Messages
// ============================================

export const ImplementationStartedPayloadSchema = z.object({
  featureId: z.string().uuid(),
  branchName: z.string(),
  startedAt: z.number(),
});

export const ImplementationStartedMessageSchema = BaseMessageSchema.extend({
  type: z.literal('IMPLEMENTATION_STARTED'),
  from: z.literal('CODER'),
  to: z.literal('REPO_MANAGER'),
  payload: ImplementationStartedPayloadSchema,
});

export type ImplementationStartedMessage = z.infer<typeof ImplementationStartedMessageSchema>;

export const ImplementationProgressPayloadSchema = z.object({
  featureId: z.string().uuid(),
  currentTurn: z.number(),
  totalTurns: z.number(),
  filesModified: z.number(),
  status: z.string(),
  message: z.string(),
});

export const ImplementationProgressMessageSchema = BaseMessageSchema.extend({
  type: z.literal('IMPLEMENTATION_PROGRESS'),
  from: z.literal('CODER'),
  to: z.literal('REPO_MANAGER'),
  payload: ImplementationProgressPayloadSchema,
});

export type ImplementationProgressMessage = z.infer<typeof ImplementationProgressMessageSchema>;

// ============================================
// PR-Related Messages
// ============================================

export const PRCreatedPayloadSchema = z.object({
  featureId: z.string().uuid(),
  prNumber: z.number(),
  prUrl: z.string().url(),
  title: z.string(),
  description: z.string(),
  branchName: z.string(),
  baseBranch: z.string().default('main'),
  filesChanged: z.number(),
  additions: z.number(),
  deletions: z.number(),
});

export const PRCreatedMessageSchema = BaseMessageSchema.extend({
  type: z.literal('PR_CREATED'),
  from: z.literal('CODER'),
  to: z.literal('BROADCAST'),
  payload: PRCreatedPayloadSchema,
});

export type PRCreatedMessage = z.infer<typeof PRCreatedMessageSchema>;

export const PRMergedPayloadSchema = z.object({
  featureId: z.string().uuid(),
  prNumber: z.number(),
  mergeCommitSha: z.string(),
  mergedAt: z.number(),
  mergedBy: z.string(),
});

export const PRMergedMessageSchema = BaseMessageSchema.extend({
  type: z.literal('PR_MERGED'),
  from: z.literal('REPO_MANAGER'),
  to: z.literal('BROADCAST'),
  payload: PRMergedPayloadSchema,
});

export type PRMergedMessage = z.infer<typeof PRMergedMessageSchema>;

// ============================================
// Review-Related Messages
// ============================================

export const PRReviewStartedPayloadSchema = z.object({
  featureId: z.string().uuid(),
  prNumber: z.number(),
  reviewer: z.string(),
  startedAt: z.number(),
});

export const PRReviewStartedMessageSchema = BaseMessageSchema.extend({
  type: z.literal('PR_REVIEW_STARTED'),
  from: z.literal('REVIEWER'),
  to: z.literal('REPO_MANAGER'),
  payload: PRReviewStartedPayloadSchema,
});

export type PRReviewStartedMessage = z.infer<typeof PRReviewStartedMessageSchema>;

export const ReviewCommentSchema = z.object({
  file: z.string(),
  line: z.number(),
  body: z.string(),
  severity: z.enum(['INFO', 'WARNING', 'ERROR']),
});

export type ReviewComment = z.infer<typeof ReviewCommentSchema>;

export const ReviewCommentsPostedPayloadSchema = z.object({
  featureId: z.string().uuid(),
  prNumber: z.number(),
  comments: z.array(ReviewCommentSchema),
  totalIssues: z.number(),
  criticalIssues: z.number(),
});

export const ReviewCommentsPostedMessageSchema = BaseMessageSchema.extend({
  type: z.literal('REVIEW_COMMENTS_POSTED'),
  from: z.literal('REVIEWER'),
  to: z.literal('BROADCAST'),
  payload: ReviewCommentsPostedPayloadSchema,
});

export type ReviewCommentsPostedMessage = z.infer<typeof ReviewCommentsPostedMessageSchema>;

export const PRApprovedPayloadSchema = z.object({
  featureId: z.string().uuid(),
  prNumber: z.number(),
  approvedAt: z.number(),
  approvedBy: z.string(),
  message: z.string().optional(),
});

export const PRApprovedMessageSchema = BaseMessageSchema.extend({
  type: z.literal('PR_APPROVED'),
  from: z.literal('REVIEWER'),
  to: z.literal('BROADCAST'),
  payload: PRApprovedPayloadSchema,
});

export type PRApprovedMessage = z.infer<typeof PRApprovedMessageSchema>;

export const PRChangesRequestedPayloadSchema = z.object({
  featureId: z.string().uuid(),
  prNumber: z.number(),
  requestedAt: z.number(),
  criticalIssues: z.number(),
  totalIssues: z.number(),
  summary: z.string(),
});

export const PRChangesRequestedMessageSchema = BaseMessageSchema.extend({
  type: z.literal('PR_CHANGES_REQUESTED'),
  from: z.literal('REVIEWER'),
  to: z.literal('CODER'),
  payload: PRChangesRequestedPayloadSchema,
});

export type PRChangesRequestedMessage = z.infer<typeof PRChangesRequestedMessageSchema>;

// ============================================
// Error & Status Messages
// ============================================

export const AgentErrorPayloadSchema = z.object({
  agentType: AgentType,
  errorCode: z.string(),
  errorMessage: z.string(),
  featureId: z.string().uuid().optional(),
  stack: z.string().optional(),
  retryable: z.boolean(),
  context: z.record(z.unknown()).optional(),
});

export const AgentErrorMessageSchema = BaseMessageSchema.extend({
  type: z.literal('AGENT_ERROR'),
  payload: AgentErrorPayloadSchema,
});

export type AgentErrorMessage = z.infer<typeof AgentErrorMessageSchema>;

export const HeartbeatPayloadSchema = z.object({
  agentType: AgentType,
  status: z.enum(['HEALTHY', 'DEGRADED', 'UNHEALTHY']),
  uptime: z.number(),
  memoryUsage: z.number().optional(),
  activeFeatures: z.number(),
  queueSize: z.number(),
});

export const HeartbeatMessageSchema = BaseMessageSchema.extend({
  type: z.literal('HEARTBEAT'),
  payload: HeartbeatPayloadSchema,
});

export type HeartbeatMessage = z.infer<typeof HeartbeatMessageSchema>;

// ============================================
// Union of All Message Types
// ============================================

export const AgentMessageSchema = z.discriminatedUnion('type', [
  FeatureAssignedMessageSchema,
  PlanCreatedMessageSchema,
  ImplementationStartedMessageSchema,
  ImplementationProgressMessageSchema,
  PRCreatedMessageSchema,
  PRMergedMessageSchema,
  PRReviewStartedMessageSchema,
  ReviewCommentsPostedMessageSchema,
  PRApprovedMessageSchema,
  PRChangesRequestedMessageSchema,
  AgentErrorMessageSchema,
  HeartbeatMessageSchema,
]);

export type AgentMessage = z.infer<typeof AgentMessageSchema>;

// ============================================
// Message Validation Helpers
// ============================================

/**
 * Validate and parse a message
 */
export function parseMessage(data: unknown): AgentMessage {
  return AgentMessageSchema.parse(data);
}

/**
 * Safely validate and parse a message
 */
export function safeParseMessage(data: unknown): {
  success: boolean;
  data?: AgentMessage;
  error?: z.ZodError;
} {
  const result = AgentMessageSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  } else {
    return { success: false, error: result.error };
  }
}

/**
 * Type guard to check if data is a specific message type
 */
export function isMessageType<T extends MessageType>(
  message: AgentMessage,
  type: T
): message is Extract<AgentMessage, { type: T }> {
  return message.type === type;
}

// ============================================
// Message Factory Functions
// ============================================

/**
 * Create a feature assigned message
 */
export function createFeatureAssignedMessage(
  payload: z.infer<typeof FeatureAssignedPayloadSchema>,
  correlationId?: string
): FeatureAssignedMessage {
  return {
    id: crypto.randomUUID(),
    type: 'FEATURE_ASSIGNED',
    from: 'REPO_MANAGER',
    to: 'CODER',
    timestamp: Date.now(),
    priority: 'MEDIUM',
    correlationId,
    payload,
  };
}

/**
 * Create a PR created message
 */
export function createPRCreatedMessage(
  payload: z.infer<typeof PRCreatedPayloadSchema>,
  correlationId?: string
): PRCreatedMessage {
  return {
    id: crypto.randomUUID(),
    type: 'PR_CREATED',
    from: 'CODER',
    to: 'BROADCAST',
    timestamp: Date.now(),
    priority: 'MEDIUM',
    correlationId,
    payload,
  };
}

/**
 * Create a review comments posted message
 */
export function createReviewCommentsPostedMessage(
  payload: z.infer<typeof ReviewCommentsPostedPayloadSchema>,
  correlationId?: string
): ReviewCommentsPostedMessage {
  return {
    id: crypto.randomUUID(),
    type: 'REVIEW_COMMENTS_POSTED',
    from: 'REVIEWER',
    to: 'BROADCAST',
    timestamp: Date.now(),
    priority: 'HIGH',
    correlationId,
    payload,
  };
}

/**
 * Create a PR approved message
 */
export function createPRApprovedMessage(
  payload: z.infer<typeof PRApprovedPayloadSchema>,
  correlationId?: string
): PRApprovedMessage {
  return {
    id: crypto.randomUUID(),
    type: 'PR_APPROVED',
    from: 'REVIEWER',
    to: 'BROADCAST',
    timestamp: Date.now(),
    priority: 'HIGH',
    correlationId,
    payload,
  };
}

/**
 * Create an agent error message
 */
export function createAgentErrorMessage(
  from: AgentType,
  payload: z.infer<typeof AgentErrorPayloadSchema>,
  correlationId?: string
): AgentErrorMessage {
  return {
    id: crypto.randomUUID(),
    type: 'AGENT_ERROR',
    from,
    to: 'BROADCAST',
    timestamp: Date.now(),
    priority: 'CRITICAL',
    correlationId,
    payload,
  };
}

/**
 * Create a heartbeat message
 */
export function createHeartbeatMessage(
  from: AgentType,
  payload: z.infer<typeof HeartbeatPayloadSchema>
): HeartbeatMessage {
  return {
    id: crypto.randomUUID(),
    type: 'HEARTBEAT',
    from,
    to: 'REPO_MANAGER',
    timestamp: Date.now(),
    priority: 'LOW',
    payload,
  };
}
