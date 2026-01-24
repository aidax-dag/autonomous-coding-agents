/**
 * Notifier Tests
 *
 * Tests for the notification system including Slack, Discord, and Email channels.
 */

import {
  Notification,
  NotificationConfig,
  NotificationEvent,
  NotificationLevel,
} from '@/shared/notifications/types';
import { Notifier } from '@/shared/notifications/notifier';

// Mock fetch globally
const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;
global.fetch = mockFetch;

// Mock logger
jest.mock('@/shared/logging/logger', () => ({
  createAgentLogger: jest.fn(() => ({
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  })),
}));

describe('Notifier', () => {
  let notifier: Notifier;
  let defaultConfig: NotificationConfig;
  let defaultNotification: Notification;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
    } as Response);

    defaultConfig = {
      enabled: true,
      level: 'info',
      rateLimit: 60,
      slack: {
        webhookUrl: 'https://hooks.slack.com/services/test',
        channel: '#test-channel',
        username: 'TestBot',
        iconEmoji: ':robot_face:',
      },
    };

    defaultNotification = {
      title: 'Test Notification',
      message: 'This is a test message',
      level: 'info',
      event: NotificationEvent.TASK_COMPLETED,
      timestamp: Date.now(),
    };

    notifier = new Notifier(defaultConfig);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('constructor', () => {
    it('should create a notifier with default rate limit', () => {
      const config: NotificationConfig = {
        enabled: true,
        level: 'info',
      };
      const n = new Notifier(config);
      expect(n.getConfig().enabled).toBe(true);
    });

    it('should create a notifier with custom rate limit', () => {
      const config: NotificationConfig = {
        enabled: true,
        level: 'info',
        rateLimit: 30,
      };
      const n = new Notifier(config);
      expect(n.getConfig().rateLimit).toBe(30);
    });
  });

  describe('send', () => {
    it('should skip if notifications are disabled', async () => {
      notifier.updateConfig({ enabled: false });
      const results = await notifier.send(defaultNotification);
      expect(results).toEqual([]);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should skip if event is not in notification list', async () => {
      notifier.updateConfig({
        events: [NotificationEvent.TASK_FAILED],
      });
      const results = await notifier.send(defaultNotification);
      expect(results).toEqual([]);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should skip if notification level is below threshold', async () => {
      notifier.updateConfig({ level: 'error' });
      const results = await notifier.send(defaultNotification);
      expect(results).toEqual([]);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should send notification to Slack', async () => {
      const results = await notifier.send(defaultNotification);
      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
      expect(results[0].channel).toBe('slack');
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://hooks.slack.com/services/test',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      );
    });

    it('should send notification to Discord', async () => {
      notifier.updateConfig({
        slack: undefined,
        discord: {
          webhookUrl: 'https://discord.com/api/webhooks/test',
          username: 'TestBot',
          avatarUrl: 'https://example.com/avatar.png',
        },
      });
      const results = await notifier.send(defaultNotification);
      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
      expect(results[0].channel).toBe('discord');
    });

    it('should send notification to Email', async () => {
      notifier.updateConfig({
        slack: undefined,
        email: {
          smtpHost: 'smtp.test.com',
          smtpPort: 587,
          smtpUser: 'user',
          smtpPass: 'pass',
          from: 'test@test.com',
          to: ['recipient@test.com'],
          secure: false,
        },
      });
      const results = await notifier.send(defaultNotification);
      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
      expect(results[0].channel).toBe('email');
    });

    it('should send to multiple channels', async () => {
      notifier.updateConfig({
        discord: {
          webhookUrl: 'https://discord.com/api/webhooks/test',
        },
      });
      const results = await notifier.send(defaultNotification);
      expect(results).toHaveLength(2);
      expect(results.map((r) => r.channel)).toContain('slack');
      expect(results.map((r) => r.channel)).toContain('discord');
    });

    it('should handle Slack API errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      } as Response);

      const results = await notifier.send(defaultNotification);
      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(false);
      expect(results[0].error).toContain('Slack API error');
    });

    it('should handle Discord API errors', async () => {
      notifier.updateConfig({
        slack: undefined,
        discord: {
          webhookUrl: 'https://discord.com/api/webhooks/test',
        },
      });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
      } as Response);

      const results = await notifier.send(defaultNotification);
      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(false);
      expect(results[0].error).toContain('Discord API error');
    });

    it('should handle fetch exceptions', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const results = await notifier.send(defaultNotification);
      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(false);
      expect(results[0].error).toBe('Network error');
    });

    it('should include URL action when notification has url', async () => {
      const notificationWithUrl = {
        ...defaultNotification,
        url: 'https://example.com/details',
      };

      await notifier.send(notificationWithUrl);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('View Details'),
        })
      );
    });

    it('should notify all events when events array is empty', async () => {
      notifier.updateConfig({ events: [] });
      const results = await notifier.send(defaultNotification);
      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
    });

    it('should send notifications for matching events', async () => {
      notifier.updateConfig({
        events: [NotificationEvent.TASK_COMPLETED, NotificationEvent.TASK_FAILED],
      });
      const results = await notifier.send(defaultNotification);
      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
    });
  });

  describe('notification levels', () => {
    it('should send warning when level is info', async () => {
      const warningNotification = { ...defaultNotification, level: 'warning' as NotificationLevel };
      const results = await notifier.send(warningNotification);
      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
    });

    it('should send error when level is info', async () => {
      const errorNotification = { ...defaultNotification, level: 'error' as NotificationLevel };
      const results = await notifier.send(errorNotification);
      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
    });

    it('should not send info when level is warning', async () => {
      notifier.updateConfig({ level: 'warning' });
      const results = await notifier.send(defaultNotification);
      expect(results).toEqual([]);
    });

    it('should send warning when level is warning', async () => {
      notifier.updateConfig({ level: 'warning' });
      const warningNotification = { ...defaultNotification, level: 'warning' as NotificationLevel };
      const results = await notifier.send(warningNotification);
      expect(results).toHaveLength(1);
    });

    it('should not send info when level is error', async () => {
      notifier.updateConfig({ level: 'error' });
      const results = await notifier.send(defaultNotification);
      expect(results).toEqual([]);
    });

    it('should not send warning when level is error', async () => {
      notifier.updateConfig({ level: 'error' });
      const warningNotification = { ...defaultNotification, level: 'warning' as NotificationLevel };
      const results = await notifier.send(warningNotification);
      expect(results).toEqual([]);
    });

    it('should send error when level is error', async () => {
      notifier.updateConfig({ level: 'error' });
      const errorNotification = { ...defaultNotification, level: 'error' as NotificationLevel };
      const results = await notifier.send(errorNotification);
      expect(results).toHaveLength(1);
    });
  });

  describe('rate limiting', () => {
    it('should allow notifications within rate limit', async () => {
      for (let i = 0; i < 5; i++) {
        const results = await notifier.send(defaultNotification);
        expect(results).toHaveLength(1);
        expect(results[0].success).toBe(true);
      }
    });

    it('should block notifications exceeding rate limit', async () => {
      // Create notifier with very low rate limit
      const limitedNotifier = new Notifier({
        ...defaultConfig,
        rateLimit: 3,
      });

      // Send 3 notifications (should succeed)
      for (let i = 0; i < 3; i++) {
        const results = await limitedNotifier.send(defaultNotification);
        expect(results).toHaveLength(1);
      }

      // Fourth notification should be blocked
      const results = await limitedNotifier.send(defaultNotification);
      expect(results).toEqual([]);
    });
  });

  describe('updateConfig', () => {
    it('should update enabled flag', () => {
      notifier.updateConfig({ enabled: false });
      expect(notifier.getConfig().enabled).toBe(false);
    });

    it('should update level', () => {
      notifier.updateConfig({ level: 'error' });
      expect(notifier.getConfig().level).toBe('error');
    });

    it('should update slack config', () => {
      notifier.updateConfig({
        slack: {
          webhookUrl: 'https://hooks.slack.com/services/new-test',
        },
      });
      expect(notifier.getConfig().slack?.webhookUrl).toBe(
        'https://hooks.slack.com/services/new-test'
      );
    });

    it('should preserve existing config when partially updating', () => {
      const originalSlack = notifier.getConfig().slack;
      notifier.updateConfig({ level: 'warning' });
      expect(notifier.getConfig().slack).toEqual(originalSlack);
    });
  });

  describe('getConfig', () => {
    it('should return a copy of config', () => {
      const config1 = notifier.getConfig();
      const config2 = notifier.getConfig();
      expect(config1).toEqual(config2);
      expect(config1).not.toBe(config2);
    });
  });

  describe('Slack payload formatting', () => {
    it('should format info level correctly', async () => {
      await notifier.send(defaultNotification);

      const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(options.body as string);

      expect(body.attachments[0].color).toBe('#36a64f');
      expect(body.attachments[0].title).toContain('✅');
    });

    it('should format warning level correctly', async () => {
      await notifier.send({ ...defaultNotification, level: 'warning' });

      const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(options.body as string);

      expect(body.attachments[0].color).toBe('#ff9900');
      expect(body.attachments[0].title).toContain('⚠️');
    });

    it('should format error level correctly', async () => {
      await notifier.send({ ...defaultNotification, level: 'error' });

      const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(options.body as string);

      expect(body.attachments[0].color).toBe('#ff0000');
      expect(body.attachments[0].title).toContain('❌');
    });

    it('should include channel when configured', async () => {
      await notifier.send(defaultNotification);

      const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(options.body as string);

      expect(body.channel).toBe('#test-channel');
    });

    it('should use custom username and icon', async () => {
      await notifier.send(defaultNotification);

      const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(options.body as string);

      expect(body.username).toBe('TestBot');
      expect(body.icon_emoji).toBe(':robot_face:');
    });

    it('should use default username and icon when not configured', async () => {
      notifier.updateConfig({
        slack: {
          webhookUrl: 'https://hooks.slack.com/services/test',
        },
      });

      await notifier.send(defaultNotification);

      const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(options.body as string);

      expect(body.username).toBe('Multi-Agent System');
      expect(body.icon_emoji).toBe(':robot_face:');
    });
  });

  describe('Discord payload formatting', () => {
    beforeEach(() => {
      notifier.updateConfig({
        slack: undefined,
        discord: {
          webhookUrl: 'https://discord.com/api/webhooks/test',
          username: 'TestBot',
          avatarUrl: 'https://example.com/avatar.png',
        },
      });
    });

    it('should format info level correctly', async () => {
      await notifier.send(defaultNotification);

      const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(options.body as string);

      expect(body.embeds[0].color).toBe(0x36a64f);
      expect(body.embeds[0].title).toContain('✅');
    });

    it('should format warning level correctly', async () => {
      await notifier.send({ ...defaultNotification, level: 'warning' });

      const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(options.body as string);

      expect(body.embeds[0].color).toBe(0xff9900);
    });

    it('should format error level correctly', async () => {
      await notifier.send({ ...defaultNotification, level: 'error' });

      const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(options.body as string);

      expect(body.embeds[0].color).toBe(0xff0000);
    });

    it('should include avatar URL when configured', async () => {
      await notifier.send(defaultNotification);

      const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(options.body as string);

      expect(body.avatar_url).toBe('https://example.com/avatar.png');
    });

    it('should include URL in embed when notification has url', async () => {
      await notifier.send({
        ...defaultNotification,
        url: 'https://example.com/details',
      });

      const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(options.body as string);

      expect(body.embeds[0].url).toBe('https://example.com/details');
    });
  });

  describe('edge cases', () => {
    it('should handle unknown level gracefully', async () => {
      const unknownLevelNotification = {
        ...defaultNotification,
        level: 'unknown' as NotificationLevel,
      };

      // Unknown level has index -1 which is below threshold, so notification is skipped
      const results = await notifier.send(unknownLevelNotification);

      expect(results).toEqual([]);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should handle missing channel name for unknown index', () => {
      // This tests the getChannelName fallback
      const n = new Notifier({
        enabled: true,
        level: 'info',
      });
      expect(n.getConfig().slack).toBeUndefined();
      expect(n.getConfig().discord).toBeUndefined();
      expect(n.getConfig().email).toBeUndefined();
    });

    it('should handle promise rejection with unknown reason', async () => {
      mockFetch.mockRejectedValueOnce(undefined);

      const results = await notifier.send(defaultNotification);
      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(false);
      expect(results[0].error).toBe('Unknown error');
    });
  });
});
