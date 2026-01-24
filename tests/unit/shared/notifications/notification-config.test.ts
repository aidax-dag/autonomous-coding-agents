/**
 * Notification Config Tests
 *
 * Tests for notification configuration loading and validation.
 */

import { NotificationEvent } from '@/shared/notifications/types';
import {
  getNotificationConfig,
  validateNotificationConfig,
} from '@/shared/notifications/notification-config';

// Mock logger
jest.mock('@/core/services/logger', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  })),
}));

describe('Notification Config', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('getNotificationConfig', () => {
    it('should return disabled config by default', () => {
      const config = getNotificationConfig();
      expect(config.enabled).toBe(false);
      expect(config.level).toBe('info');
      expect(config.rateLimit).toBe(60);
    });

    it('should parse enabled flag correctly', () => {
      process.env.NOTIFICATIONS_ENABLED = 'true';
      const config = getNotificationConfig();
      expect(config.enabled).toBe(true);
    });

    it('should parse notification level', () => {
      process.env.NOTIFICATION_LEVEL = 'warning';
      const config = getNotificationConfig();
      expect(config.level).toBe('warning');
    });

    it('should parse rate limit', () => {
      process.env.NOTIFICATION_RATE_LIMIT = '30';
      const config = getNotificationConfig();
      expect(config.rateLimit).toBe(30);
    });

    describe('Slack configuration', () => {
      it('should not include slack when webhook URL is missing', () => {
        const config = getNotificationConfig();
        expect(config.slack).toBeUndefined();
      });

      it('should include slack with webhook URL only', () => {
        process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/services/test';
        const config = getNotificationConfig();
        expect(config.slack).toBeDefined();
        expect(config.slack?.webhookUrl).toBe('https://hooks.slack.com/services/test');
        expect(config.slack?.channel).toBeUndefined();
        expect(config.slack?.username).toBeUndefined();
        expect(config.slack?.iconEmoji).toBeUndefined();
      });

      it('should include all slack options when configured', () => {
        process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/services/test';
        process.env.SLACK_CHANNEL = '#notifications';
        process.env.SLACK_USERNAME = 'TestBot';
        process.env.SLACK_ICON_EMOJI = ':tada:';

        const config = getNotificationConfig();
        expect(config.slack?.channel).toBe('#notifications');
        expect(config.slack?.username).toBe('TestBot');
        expect(config.slack?.iconEmoji).toBe(':tada:');
      });
    });

    describe('Discord configuration', () => {
      it('should not include discord when webhook URL is missing', () => {
        const config = getNotificationConfig();
        expect(config.discord).toBeUndefined();
      });

      it('should include discord with webhook URL only', () => {
        process.env.DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/test';
        const config = getNotificationConfig();
        expect(config.discord).toBeDefined();
        expect(config.discord?.webhookUrl).toBe('https://discord.com/api/webhooks/test');
        expect(config.discord?.username).toBeUndefined();
        expect(config.discord?.avatarUrl).toBeUndefined();
      });

      it('should include all discord options when configured', () => {
        process.env.DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/test';
        process.env.DISCORD_USERNAME = 'TestBot';
        process.env.DISCORD_AVATAR_URL = 'https://example.com/avatar.png';

        const config = getNotificationConfig();
        expect(config.discord?.username).toBe('TestBot');
        expect(config.discord?.avatarUrl).toBe('https://example.com/avatar.png');
      });
    });

    describe('Email configuration', () => {
      it('should not include email when any required field is missing', () => {
        process.env.SMTP_HOST = 'smtp.test.com';
        // Missing other required fields
        const config = getNotificationConfig();
        expect(config.email).toBeUndefined();
      });

      it('should include email when all required fields are present', () => {
        process.env.SMTP_HOST = 'smtp.test.com';
        process.env.SMTP_PORT = '587';
        process.env.SMTP_USER = 'user@test.com';
        process.env.SMTP_PASS = 'password';
        process.env.NOTIFICATION_EMAIL_FROM = 'noreply@test.com';
        process.env.NOTIFICATION_EMAIL_TO = 'admin@test.com';

        const config = getNotificationConfig();
        expect(config.email).toBeDefined();
        expect(config.email?.smtpHost).toBe('smtp.test.com');
        expect(config.email?.smtpPort).toBe(587);
        expect(config.email?.smtpUser).toBe('user@test.com');
        expect(config.email?.smtpPass).toBe('password');
        expect(config.email?.from).toBe('noreply@test.com');
        expect(config.email?.to).toEqual(['admin@test.com']);
        expect(config.email?.secure).toBe(false);
      });

      it('should parse multiple email recipients', () => {
        process.env.SMTP_HOST = 'smtp.test.com';
        process.env.SMTP_PORT = '587';
        process.env.SMTP_USER = 'user@test.com';
        process.env.SMTP_PASS = 'password';
        process.env.NOTIFICATION_EMAIL_FROM = 'noreply@test.com';
        process.env.NOTIFICATION_EMAIL_TO = 'admin@test.com, ops@test.com, dev@test.com';

        const config = getNotificationConfig();
        expect(config.email?.to).toEqual(['admin@test.com', 'ops@test.com', 'dev@test.com']);
      });

      it('should parse secure flag', () => {
        process.env.SMTP_HOST = 'smtp.test.com';
        process.env.SMTP_PORT = '465';
        process.env.SMTP_USER = 'user@test.com';
        process.env.SMTP_PASS = 'password';
        process.env.NOTIFICATION_EMAIL_FROM = 'noreply@test.com';
        process.env.NOTIFICATION_EMAIL_TO = 'admin@test.com';
        process.env.SMTP_SECURE = 'true';

        const config = getNotificationConfig();
        expect(config.email?.secure).toBe(true);
      });
    });

    describe('Event filtering', () => {
      it('should not include events when not configured', () => {
        const config = getNotificationConfig();
        expect(config.events).toBeUndefined();
      });

      it('should parse valid events', () => {
        process.env.NOTIFICATION_EVENTS = 'task.completed,task.failed,pr.created';
        const config = getNotificationConfig();
        expect(config.events).toContain(NotificationEvent.TASK_COMPLETED);
        expect(config.events).toContain(NotificationEvent.TASK_FAILED);
        expect(config.events).toContain(NotificationEvent.PR_CREATED);
      });

      it('should filter out invalid events', () => {
        process.env.NOTIFICATION_EVENTS = 'task.completed,invalid.event,task.failed';
        const config = getNotificationConfig();
        expect(config.events).toHaveLength(2);
        expect(config.events).toContain(NotificationEvent.TASK_COMPLETED);
        expect(config.events).toContain(NotificationEvent.TASK_FAILED);
      });

      it('should handle empty event values', () => {
        process.env.NOTIFICATION_EVENTS = 'task.completed,,task.failed,';
        const config = getNotificationConfig();
        expect(config.events).toHaveLength(2);
      });

      it('should trim whitespace from events', () => {
        process.env.NOTIFICATION_EVENTS = ' task.completed , task.failed ';
        const config = getNotificationConfig();
        expect(config.events).toContain(NotificationEvent.TASK_COMPLETED);
        expect(config.events).toContain(NotificationEvent.TASK_FAILED);
      });
    });
  });

  describe('validateNotificationConfig', () => {
    it('should return true when notifications are disabled', () => {
      const result = validateNotificationConfig({
        enabled: false,
        level: 'info',
      });
      expect(result).toBe(true);
    });

    it('should return false when enabled but no channels configured', () => {
      const result = validateNotificationConfig({
        enabled: true,
        level: 'info',
      });
      expect(result).toBe(false);
    });

    it('should return true with valid Slack config', () => {
      const result = validateNotificationConfig({
        enabled: true,
        level: 'info',
        slack: {
          webhookUrl: 'https://hooks.slack.com/services/test',
        },
      });
      expect(result).toBe(true);
    });

    it('should return false with invalid Slack webhook URL', () => {
      const result = validateNotificationConfig({
        enabled: true,
        level: 'info',
        slack: {
          webhookUrl: 'http://invalid-url',
        },
      });
      expect(result).toBe(false);
    });

    it('should return false with empty Slack webhook URL', () => {
      const result = validateNotificationConfig({
        enabled: true,
        level: 'info',
        slack: {
          webhookUrl: '',
        },
      });
      expect(result).toBe(false);
    });

    it('should return true with valid Discord config', () => {
      const result = validateNotificationConfig({
        enabled: true,
        level: 'info',
        discord: {
          webhookUrl: 'https://discord.com/api/webhooks/test',
        },
      });
      expect(result).toBe(true);
    });

    it('should return false with invalid Discord webhook URL', () => {
      const result = validateNotificationConfig({
        enabled: true,
        level: 'info',
        discord: {
          webhookUrl: 'http://invalid-url',
        },
      });
      expect(result).toBe(false);
    });

    it('should return false with empty Discord webhook URL', () => {
      const result = validateNotificationConfig({
        enabled: true,
        level: 'info',
        discord: {
          webhookUrl: '',
        },
      });
      expect(result).toBe(false);
    });

    it('should return true with valid Email config', () => {
      const result = validateNotificationConfig({
        enabled: true,
        level: 'info',
        email: {
          smtpHost: 'smtp.test.com',
          smtpPort: 587,
          smtpUser: 'user',
          smtpPass: 'pass',
          from: 'noreply@test.com',
          to: ['admin@test.com'],
        },
      });
      expect(result).toBe(true);
    });

    it('should return false with invalid SMTP host', () => {
      const result = validateNotificationConfig({
        enabled: true,
        level: 'info',
        email: {
          smtpHost: '',
          smtpPort: 587,
          smtpUser: 'user',
          smtpPass: 'pass',
          from: 'noreply@test.com',
          to: ['admin@test.com'],
        },
      });
      expect(result).toBe(false);
    });

    it('should return false with invalid SMTP port', () => {
      const result = validateNotificationConfig({
        enabled: true,
        level: 'info',
        email: {
          smtpHost: 'smtp.test.com',
          smtpPort: 0,
          smtpUser: 'user',
          smtpPass: 'pass',
          from: 'noreply@test.com',
          to: ['admin@test.com'],
        },
      });
      expect(result).toBe(false);
    });

    it('should return false with negative SMTP port', () => {
      const result = validateNotificationConfig({
        enabled: true,
        level: 'info',
        email: {
          smtpHost: 'smtp.test.com',
          smtpPort: -1,
          smtpUser: 'user',
          smtpPass: 'pass',
          from: 'noreply@test.com',
          to: ['admin@test.com'],
        },
      });
      expect(result).toBe(false);
    });

    it('should return false with missing from address', () => {
      const result = validateNotificationConfig({
        enabled: true,
        level: 'info',
        email: {
          smtpHost: 'smtp.test.com',
          smtpPort: 587,
          smtpUser: 'user',
          smtpPass: 'pass',
          from: '',
          to: ['admin@test.com'],
        },
      });
      expect(result).toBe(false);
    });

    it('should return false with empty recipients', () => {
      const result = validateNotificationConfig({
        enabled: true,
        level: 'info',
        email: {
          smtpHost: 'smtp.test.com',
          smtpPort: 587,
          smtpUser: 'user',
          smtpPass: 'pass',
          from: 'noreply@test.com',
          to: [],
        },
      });
      expect(result).toBe(false);
    });

    it('should return true with multiple valid channels', () => {
      const result = validateNotificationConfig({
        enabled: true,
        level: 'info',
        slack: {
          webhookUrl: 'https://hooks.slack.com/services/test',
        },
        discord: {
          webhookUrl: 'https://discord.com/api/webhooks/test',
        },
      });
      expect(result).toBe(true);
    });

    it('should return false if any channel is invalid', () => {
      const result = validateNotificationConfig({
        enabled: true,
        level: 'info',
        slack: {
          webhookUrl: 'https://hooks.slack.com/services/test',
        },
        discord: {
          webhookUrl: 'invalid-url',
        },
      });
      expect(result).toBe(false);
    });
  });
});
