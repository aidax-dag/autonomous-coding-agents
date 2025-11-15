/**
 * Notification System
 *
 * Sends notifications to Slack, Discord, and Email
 * with rate limiting and error handling.
 *
 * Feature: F5.5 - Notification System
 */

import {
  Notification,
  NotificationConfig,
  NotificationResult,
  NotificationLevel,
  NotificationEvent,
  SlackConfig,
  DiscordConfig,
  EmailConfig,
} from './types.js';
import { createAgentLogger } from '../logging/logger.js';

const logger = createAgentLogger('NOTIFICATION', 'notifier');

/**
 * Rate limiter using sliding window
 */
class RateLimiter {
  private timestamps: number[] = [];

  constructor(
    private maxPerMinute: number = 60
  ) {}

  /**
   * Check if request is allowed under rate limit
   */
  isAllowed(): boolean {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;

    // Remove timestamps older than 1 minute
    this.timestamps = this.timestamps.filter((ts) => ts > oneMinuteAgo);

    if (this.timestamps.length >= this.maxPerMinute) {
      return false;
    }

    this.timestamps.push(now);
    return true;
  }

  /**
   * Get current usage count
   */
  getCurrentCount(): number {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    this.timestamps = this.timestamps.filter((ts) => ts > oneMinuteAgo);
    return this.timestamps.length;
  }
}

/**
 * Notifier class for sending notifications
 */
export class Notifier {
  private rateLimiter: RateLimiter;

  constructor(private config: NotificationConfig) {
    this.rateLimiter = new RateLimiter(config.rateLimit || 60);
    logger.info('Notifier initialized', {
      enabled: config.enabled,
      level: config.level,
      hasSlack: !!config.slack,
      hasDiscord: !!config.discord,
      hasEmail: !!config.email,
    });
  }

  /**
   * Send a notification to all configured channels
   */
  async send(notification: Notification): Promise<NotificationResult[]> {
    // Check if notifications are enabled
    if (!this.config.enabled) {
      logger.debug('Notifications disabled, skipping');
      return [];
    }

    // Check if event should be notified
    if (!this.shouldNotifyEvent(notification.event)) {
      logger.debug('Event not in notification list, skipping', {
        event: notification.event,
      });
      return [];
    }

    // Check notification level
    if (!this.shouldNotifyLevel(notification.level)) {
      logger.debug('Notification level below threshold, skipping', {
        level: notification.level,
        threshold: this.config.level,
      });
      return [];
    }

    // Check rate limit
    if (!this.rateLimiter.isAllowed()) {
      logger.warn('Rate limit exceeded, skipping notification', {
        currentCount: this.rateLimiter.getCurrentCount(),
        limit: this.config.rateLimit,
      });
      return [];
    }

    // Send to all configured channels
    const promises: Promise<NotificationResult>[] = [];

    if (this.config.slack) {
      promises.push(this.sendToSlack(notification, this.config.slack));
    }

    if (this.config.discord) {
      promises.push(this.sendToDiscord(notification, this.config.discord));
    }

    if (this.config.email) {
      promises.push(this.sendToEmail(notification, this.config.email));
    }

    const results = await Promise.allSettled(promises);

    // Convert PromiseSettledResult to NotificationResult
    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        const channel = this.getChannelName(index);
        logger.error('Failed to send notification', {
          channel,
          error: result.reason,
        });
        return {
          success: false,
          channel,
          error: result.reason?.message || 'Unknown error',
          timestamp: Date.now(),
        };
      }
    });
  }

  /**
   * Send notification to Slack
   */
  private async sendToSlack(
    notification: Notification,
    config: SlackConfig
  ): Promise<NotificationResult> {
    const startTime = Date.now();

    try {
      const color = this.getLevelColor(notification.level);
      const emoji = this.getLevelEmoji(notification.level);

      const payload = {
        username: config.username || 'Multi-Agent System',
        icon_emoji: config.iconEmoji || ':robot_face:',
        ...(config.channel && { channel: config.channel }),
        attachments: [
          {
            color,
            fallback: `${emoji} ${notification.title}: ${notification.message}`,
            title: `${emoji} ${notification.title}`,
            text: notification.message,
            fields: [
              {
                title: 'Event',
                value: notification.event,
                short: true,
              },
              {
                title: 'Level',
                value: notification.level.toUpperCase(),
                short: true,
              },
            ],
            ts: Math.floor(notification.timestamp / 1000),
            ...(notification.url && {
              actions: [
                {
                  type: 'button',
                  text: 'View Details',
                  url: notification.url,
                },
              ],
            }),
          },
        ],
      };

      const response = await fetch(config.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Slack API error: ${response.status} ${response.statusText}`);
      }

      logger.info('Notification sent to Slack', {
        title: notification.title,
        level: notification.level,
        duration: Date.now() - startTime,
      });

      return {
        success: true,
        channel: 'slack',
        timestamp: Date.now(),
      };
    } catch (error) {
      logger.error('Failed to send Slack notification', { error });
      throw error;
    }
  }

  /**
   * Send notification to Discord
   */
  private async sendToDiscord(
    notification: Notification,
    config: DiscordConfig
  ): Promise<NotificationResult> {
    const startTime = Date.now();

    try {
      const color = this.getLevelColorDecimal(notification.level);
      const emoji = this.getLevelEmoji(notification.level);

      const payload = {
        username: config.username || 'Multi-Agent System',
        ...(config.avatarUrl && { avatar_url: config.avatarUrl }),
        embeds: [
          {
            title: `${emoji} ${notification.title}`,
            description: notification.message,
            color,
            fields: [
              {
                name: 'Event',
                value: notification.event,
                inline: true,
              },
              {
                name: 'Level',
                value: notification.level.toUpperCase(),
                inline: true,
              },
            ],
            timestamp: new Date(notification.timestamp).toISOString(),
            ...(notification.url && {
              url: notification.url,
            }),
          },
        ],
      };

      const response = await fetch(config.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Discord API error: ${response.status} ${response.statusText}`);
      }

      logger.info('Notification sent to Discord', {
        title: notification.title,
        level: notification.level,
        duration: Date.now() - startTime,
      });

      return {
        success: true,
        channel: 'discord',
        timestamp: Date.now(),
      };
    } catch (error) {
      logger.error('Failed to send Discord notification', { error });
      throw error;
    }
  }

  /**
   * Send notification via Email
   * Note: This is a placeholder. In production, use a library like nodemailer
   */
  private async sendToEmail(
    notification: Notification,
    config: EmailConfig
  ): Promise<NotificationResult> {
    const startTime = Date.now();

    try {
      logger.warn('Email notifications not fully implemented', {
        config: {
          host: config.smtpHost,
          port: config.smtpPort,
          from: config.from,
          to: config.to,
        },
      });

      // TODO: Implement email sending using nodemailer
      // For now, just log the notification
      logger.info('Would send email notification', {
        to: config.to,
        subject: notification.title,
        body: notification.message,
        duration: Date.now() - startTime,
      });

      return {
        success: true,
        channel: 'email',
        timestamp: Date.now(),
      };
    } catch (error) {
      logger.error('Failed to send email notification', { error });
      throw error;
    }
  }

  /**
   * Check if we should notify for this event
   */
  private shouldNotifyEvent(event: NotificationEvent): boolean {
    // If no events specified, notify all
    if (!this.config.events || this.config.events.length === 0) {
      return true;
    }

    return this.config.events.includes(event);
  }

  /**
   * Check if we should notify for this level
   */
  private shouldNotifyLevel(level: NotificationLevel): boolean {
    const levels: NotificationLevel[] = ['info', 'warning', 'error'];
    const configLevelIndex = levels.indexOf(this.config.level);
    const messageLevelIndex = levels.indexOf(level);

    return messageLevelIndex >= configLevelIndex;
  }

  /**
   * Get Slack color for notification level
   */
  private getLevelColor(level: NotificationLevel): string {
    switch (level) {
      case 'info':
        return '#36a64f'; // Green
      case 'warning':
        return '#ff9900'; // Orange
      case 'error':
        return '#ff0000'; // Red
      default:
        return '#808080'; // Gray
    }
  }

  /**
   * Get Discord color (decimal) for notification level
   */
  private getLevelColorDecimal(level: NotificationLevel): number {
    switch (level) {
      case 'info':
        return 0x36a64f; // Green
      case 'warning':
        return 0xff9900; // Orange
      case 'error':
        return 0xff0000; // Red
      default:
        return 0x808080; // Gray
    }
  }

  /**
   * Get emoji for notification level
   */
  private getLevelEmoji(level: NotificationLevel): string {
    switch (level) {
      case 'info':
        return '✅';
      case 'warning':
        return '⚠️';
      case 'error':
        return '❌';
      default:
        return 'ℹ️';
    }
  }

  /**
   * Get channel name by index
   */
  private getChannelName(index: number): string {
    const channels = [];
    if (this.config.slack) channels.push('slack');
    if (this.config.discord) channels.push('discord');
    if (this.config.email) channels.push('email');
    return channels[index] || 'unknown';
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<NotificationConfig>): void {
    this.config = { ...this.config, ...config };
    logger.info('Notifier configuration updated', {
      enabled: this.config.enabled,
      level: this.config.level,
    });
  }

  /**
   * Get current configuration
   */
  getConfig(): NotificationConfig {
    return { ...this.config };
  }
}
