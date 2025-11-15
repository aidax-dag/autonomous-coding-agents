/**
 * Notification System Types
 *
 * Defines types and interfaces for the notification system
 * that sends alerts to Slack, Discord, and Email.
 *
 * Feature: F5.5 - Notification System
 */

/**
 * Notification level determines priority and filtering
 */
export type NotificationLevel = 'info' | 'warning' | 'error';

/**
 * Notification event types
 */
export enum NotificationEvent {
  // Task events
  TASK_CREATED = 'task.created',
  TASK_STARTED = 'task.started',
  TASK_COMPLETED = 'task.completed',
  TASK_FAILED = 'task.failed',

  // PR events
  PR_CREATED = 'pr.created',
  PR_APPROVED = 'pr.approved',
  PR_MERGED = 'pr.merged',
  PR_REJECTED = 'pr.rejected',

  // Review events
  REVIEW_STARTED = 'review.started',
  REVIEW_COMPLETED = 'review.completed',
  REVIEW_REQUESTED_CHANGES = 'review.requested_changes',

  // Error events
  AGENT_ERROR = 'agent.error',
  SYSTEM_ERROR = 'system.error',

  // Health events
  AGENT_UNHEALTHY = 'agent.unhealthy',
  AGENT_RECOVERED = 'agent.recovered',
}

/**
 * Notification payload
 */
export interface Notification {
  /** Notification title */
  title: string;

  /** Notification message */
  message: string;

  /** Severity level */
  level: NotificationLevel;

  /** Event type that triggered this notification */
  event: NotificationEvent;

  /** Optional URL to view details */
  url?: string;

  /** Timestamp in milliseconds */
  timestamp: number;

  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Slack webhook configuration
 */
export interface SlackConfig {
  /** Slack webhook URL */
  webhookUrl: string;

  /** Optional channel override (e.g., #notifications) */
  channel?: string;

  /** Optional username override */
  username?: string;

  /** Optional icon emoji (e.g., :robot_face:) */
  iconEmoji?: string;
}

/**
 * Discord webhook configuration
 */
export interface DiscordConfig {
  /** Discord webhook URL */
  webhookUrl: string;

  /** Optional username override */
  username?: string;

  /** Optional avatar URL */
  avatarUrl?: string;
}

/**
 * Email notification configuration
 */
export interface EmailConfig {
  /** SMTP server host */
  smtpHost: string;

  /** SMTP server port */
  smtpPort: number;

  /** SMTP username */
  smtpUser: string;

  /** SMTP password */
  smtpPass: string;

  /** From email address */
  from: string;

  /** Recipients */
  to: string[];

  /** Enable TLS */
  secure?: boolean;
}

/**
 * Notification system configuration
 */
export interface NotificationConfig {
  /** Enable or disable all notifications */
  enabled: boolean;

  /** Minimum notification level to send */
  level: NotificationLevel;

  /** Slack configuration */
  slack?: SlackConfig;

  /** Discord configuration */
  discord?: DiscordConfig;

  /** Email configuration (optional) */
  email?: EmailConfig;

  /** Rate limit: max notifications per minute */
  rateLimit?: number;

  /** Events to notify about (if empty, notify all) */
  events?: NotificationEvent[];
}

/**
 * Notification delivery result
 */
export interface NotificationResult {
  /** Delivery was successful */
  success: boolean;

  /** Channel that was used (slack, discord, email) */
  channel: string;

  /** Error message if failed */
  error?: string;

  /** Timestamp of delivery attempt */
  timestamp: number;
}
