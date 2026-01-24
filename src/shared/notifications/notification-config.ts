/**
 * Notification Configuration
 *
 * Loads notification configuration from environment variables.
 *
 * Feature: F5.5 - Notification System
 */

import {
  NotificationConfig,
  NotificationLevel,
  NotificationEvent,
  SlackConfig,
  DiscordConfig,
  EmailConfig,
} from './types.js';
import { createLogger, ILogger } from '../../core/services/logger.js';

/**
 * Module-level logger
 */
const logger: ILogger = createLogger('NotificationConfig');

/**
 * Load notification configuration from environment variables
 */
export function getNotificationConfig(): NotificationConfig {
  const enabled = process.env.NOTIFICATIONS_ENABLED === 'true';
  const level = (process.env.NOTIFICATION_LEVEL || 'info') as NotificationLevel;
  const rateLimit = parseInt(process.env.NOTIFICATION_RATE_LIMIT || '60', 10);

  const config: NotificationConfig = {
    enabled,
    level,
    rateLimit,
  };

  // Slack configuration
  if (process.env.SLACK_WEBHOOK_URL) {
    const slack: SlackConfig = {
      webhookUrl: process.env.SLACK_WEBHOOK_URL,
    };

    if (process.env.SLACK_CHANNEL) {
      slack.channel = process.env.SLACK_CHANNEL;
    }

    if (process.env.SLACK_USERNAME) {
      slack.username = process.env.SLACK_USERNAME;
    }

    if (process.env.SLACK_ICON_EMOJI) {
      slack.iconEmoji = process.env.SLACK_ICON_EMOJI;
    }

    config.slack = slack;
  }

  // Discord configuration
  if (process.env.DISCORD_WEBHOOK_URL) {
    const discord: DiscordConfig = {
      webhookUrl: process.env.DISCORD_WEBHOOK_URL,
    };

    if (process.env.DISCORD_USERNAME) {
      discord.username = process.env.DISCORD_USERNAME;
    }

    if (process.env.DISCORD_AVATAR_URL) {
      discord.avatarUrl = process.env.DISCORD_AVATAR_URL;
    }

    config.discord = discord;
  }

  // Email configuration
  if (
    process.env.SMTP_HOST &&
    process.env.SMTP_PORT &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS &&
    process.env.NOTIFICATION_EMAIL_FROM &&
    process.env.NOTIFICATION_EMAIL_TO
  ) {
    const email: EmailConfig = {
      smtpHost: process.env.SMTP_HOST,
      smtpPort: parseInt(process.env.SMTP_PORT, 10),
      smtpUser: process.env.SMTP_USER,
      smtpPass: process.env.SMTP_PASS,
      from: process.env.NOTIFICATION_EMAIL_FROM,
      to: process.env.NOTIFICATION_EMAIL_TO.split(',').map((s) => s.trim()),
      secure: process.env.SMTP_SECURE === 'true',
    };

    config.email = email;
  }

  // Event filtering
  if (process.env.NOTIFICATION_EVENTS) {
    const events = process.env.NOTIFICATION_EVENTS.split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    // Validate events
    const validEvents = Object.values(NotificationEvent);
    config.events = events.filter((event) =>
      validEvents.includes(event as NotificationEvent)
    ) as NotificationEvent[];
  }

  return config;
}

/**
 * Validate notification configuration
 */
export function validateNotificationConfig(config: NotificationConfig): boolean {
  if (!config.enabled) {
    return true; // If disabled, no validation needed
  }

  // Check if at least one notification channel is configured
  const hasChannel = !!(config.slack || config.discord || config.email);

  if (!hasChannel) {
    logger.warn('Notifications enabled but no channels configured');
    return false;
  }

  // Validate Slack config
  if (config.slack) {
    if (!config.slack.webhookUrl || !config.slack.webhookUrl.startsWith('https://')) {
      logger.error('Invalid Slack webhook URL');
      return false;
    }
  }

  // Validate Discord config
  if (config.discord) {
    if (!config.discord.webhookUrl || !config.discord.webhookUrl.startsWith('https://')) {
      logger.error('Invalid Discord webhook URL');
      return false;
    }
  }

  // Validate Email config
  if (config.email) {
    if (!config.email.smtpHost || config.email.smtpPort <= 0) {
      logger.error('Invalid email SMTP configuration');
      return false;
    }

    if (!config.email.from || !config.email.to || config.email.to.length === 0) {
      logger.error('Invalid email from/to configuration');
      return false;
    }
  }

  return true;
}
