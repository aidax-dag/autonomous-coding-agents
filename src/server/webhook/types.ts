/**
 * Webhook Types
 *
 * Type definitions for GitHub webhook events.
 *
 * Feature: F4.2 - GitHub Webhook Support
 */

import { z } from 'zod';

/**
 * Webhook event types we support
 */
export type WebhookEventType =
  | 'pull_request'
  | 'pull_request_review'
  | 'pull_request_review_comment'
  | 'issue_comment'
  | 'push'
  | 'ping';

/**
 * PR action types
 */
export type PullRequestAction =
  | 'opened'
  | 'edited'
  | 'closed'
  | 'reopened'
  | 'synchronize'
  | 'assigned'
  | 'unassigned'
  | 'labeled'
  | 'unlabeled'
  | 'review_requested'
  | 'review_request_removed';

/**
 * Review action types
 */
export type ReviewAction = 'submitted' | 'edited' | 'dismissed';

/**
 * Webhook payload schemas
 */

/**
 * Base repository schema
 */
const RepositorySchema = z.object({
  id: z.number(),
  name: z.string(),
  full_name: z.string(),
  owner: z.object({
    login: z.string(),
    id: z.number(),
    type: z.string(),
  }),
  private: z.boolean(),
  html_url: z.string(),
  description: z.string().nullable(),
  fork: z.boolean(),
  default_branch: z.string(),
});

/**
 * Pull request schema
 */
const PullRequestSchema = z.object({
  id: z.number(),
  number: z.number(),
  state: z.enum(['open', 'closed']),
  title: z.string(),
  body: z.string().nullable(),
  user: z.object({
    login: z.string(),
    id: z.number(),
  }),
  html_url: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  closed_at: z.string().nullable(),
  merged_at: z.string().nullable(),
  merge_commit_sha: z.string().nullable(),
  head: z.object({
    ref: z.string(),
    sha: z.string(),
    repo: RepositorySchema.nullable(),
  }),
  base: z.object({
    ref: z.string(),
    sha: z.string(),
    repo: RepositorySchema,
  }),
  draft: z.boolean().optional(),
  merged: z.boolean().optional(),
});

/**
 * Review schema
 */
const ReviewSchema = z.object({
  id: z.number(),
  user: z.object({
    login: z.string(),
    id: z.number(),
  }),
  body: z.string().nullable(),
  state: z.enum(['commented', 'approved', 'changes_requested', 'dismissed']),
  html_url: z.string(),
  submitted_at: z.string(),
});

/**
 * Pull request webhook payload
 */
export const PullRequestWebhookPayloadSchema = z.object({
  action: z.string(),
  number: z.number(),
  pull_request: PullRequestSchema,
  repository: RepositorySchema,
  sender: z.object({
    login: z.string(),
    id: z.number(),
    type: z.string(),
  }),
  organization: z
    .object({
      login: z.string(),
      id: z.number(),
    })
    .optional(),
});

/**
 * Pull request review webhook payload
 */
export const PullRequestReviewWebhookPayloadSchema = z.object({
  action: z.string(),
  review: ReviewSchema,
  pull_request: PullRequestSchema,
  repository: RepositorySchema,
  sender: z.object({
    login: z.string(),
    id: z.number(),
    type: z.string(),
  }),
  organization: z
    .object({
      login: z.string(),
      id: z.number(),
    })
    .optional(),
});

/**
 * Ping webhook payload
 */
export const PingWebhookPayloadSchema = z.object({
  zen: z.string(),
  hook_id: z.number(),
  hook: z.object({
    type: z.string(),
    id: z.number(),
    name: z.string(),
    active: z.boolean(),
    events: z.array(z.string()),
    config: z.object({
      content_type: z.string().optional(),
      insecure_ssl: z.string().optional(),
      url: z.string().optional(),
    }),
    created_at: z.string(),
    updated_at: z.string(),
  }),
  repository: RepositorySchema.optional(),
  sender: z.object({
    login: z.string(),
    id: z.number(),
    type: z.string(),
  }),
});

/**
 * Typed webhook payloads
 */
export type PullRequestWebhookPayload = z.infer<typeof PullRequestWebhookPayloadSchema>;
export type PullRequestReviewWebhookPayload = z.infer<
  typeof PullRequestReviewWebhookPayloadSchema
>;
export type PingWebhookPayload = z.infer<typeof PingWebhookPayloadSchema>;

/**
 * Webhook event interface
 */
export interface WebhookEvent {
  id: string;
  type: WebhookEventType;
  payload: PullRequestWebhookPayload | PullRequestReviewWebhookPayload | PingWebhookPayload;
  signature: string;
  deliveryId: string;
  receivedAt: Date;
}

/**
 * Webhook server configuration
 */
export interface WebhookConfig {
  port: number;
  host: string;
  path: string;
  secret: string;
  enabled: boolean;
}

/**
 * Webhook handler function type
 */
export type WebhookHandler = (event: WebhookEvent) => Promise<void>;

/**
 * Webhook server status
 */
export interface WebhookServerStatus {
  running: boolean;
  port: number;
  eventsReceived: number;
  eventsProcessed: number;
  eventsFailed: number;
  lastEventAt?: Date;
  uptime: number;
}
