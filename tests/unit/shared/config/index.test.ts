import {
  loadConfig,
  validateConfig,
  getLLMApiKey,
  isNotificationConfigured,
  isProduction,
  isDevelopment,
  isTest,
  resetConfig,
  Config,
} from '@/shared/config';

/**
 * Configuration Management Tests
 *
 * Tests environment configuration loading and validation.
 *
 * Feature: F1.4 - Environment Configuration Management
 */

describe('Configuration Management', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset process.env before each test
    process.env = { ...originalEnv };
    resetConfig();
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
    resetConfig();
  });

  describe('loadConfig', () => {
    it('should load configuration with required environment variables', () => {
      process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
      process.env.GITHUB_TOKEN = 'test-github-token';
      process.env.GITHUB_OWNER = 'test-owner';
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';

      const config = loadConfig();

      expect(config).toBeDefined();
      expect(config.llm.anthropicApiKey).toBe('test-anthropic-key');
      expect(config.github.token).toBe('test-github-token');
      expect(config.github.owner).toBe('test-owner');
      expect(config.database.url).toBe('postgresql://user:pass@localhost:5432/db');
    });

    it('should use default values when optional variables are not set', () => {
      process.env.ANTHROPIC_API_KEY = 'test-key';
      process.env.GITHUB_TOKEN = 'test-token';
      process.env.GITHUB_OWNER = 'test-owner';
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
      delete process.env.NODE_ENV; // Clear to test default

      const config = loadConfig();

      expect(config.nodeEnv).toBe('development');
      expect(config.llm.provider).toBe('claude');
      expect(config.nats.url).toBe('nats://localhost:4222');
      expect(config.agent.autoMergeEnabled).toBe(false);
      expect(config.agent.humanApprovalRequired).toBe(true);
      expect(config.agent.maxConcurrentFeatures).toBe(3);
      expect(config.logging.level).toBe('info');
      expect(config.server.port).toBe(3000);
    });

    it('should parse custom values from environment', () => {
      process.env.NODE_ENV = 'production';
      process.env.LLM_PROVIDER = 'openai';
      process.env.OPENAI_API_KEY = 'test-openai-key';
      process.env.GITHUB_TOKEN = 'test-token';
      process.env.GITHUB_OWNER = 'test-owner';
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
      process.env.NATS_URL = 'nats://remote:4222';
      process.env.AUTO_MERGE_ENABLED = 'true';
      process.env.HUMAN_APPROVAL_REQUIRED = 'false';
      process.env.MAX_CONCURRENT_FEATURES = '5';
      process.env.AGENT_TIMEOUT_MINUTES = '360';
      process.env.LOG_LEVEL = 'debug';
      process.env.PORT = '8080';

      const config = loadConfig();

      expect(config.nodeEnv).toBe('production');
      expect(config.llm.provider).toBe('openai');
      expect(config.nats.url).toBe('nats://remote:4222');
      expect(config.agent.autoMergeEnabled).toBe(true);
      expect(config.agent.humanApprovalRequired).toBe(false);
      expect(config.agent.maxConcurrentFeatures).toBe(5);
      expect(config.agent.timeoutMinutes).toBe(360);
      expect(config.logging.level).toBe('debug');
      expect(config.server.port).toBe(8080);
    });

    it('should parse boolean values correctly', () => {
      process.env.ANTHROPIC_API_KEY = 'test-key';
      process.env.GITHUB_TOKEN = 'test-token';
      process.env.GITHUB_OWNER = 'test-owner';
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
      process.env.AUTO_MERGE_ENABLED = 'TRUE';
      process.env.LOG_TO_FILE = 'FALSE';

      const config = loadConfig();

      expect(config.agent.autoMergeEnabled).toBe(true);
      expect(config.logging.toFile).toBe(false);
    });

    it('should parse number values correctly', () => {
      process.env.ANTHROPIC_API_KEY = 'test-key';
      process.env.GITHUB_TOKEN = 'test-token';
      process.env.GITHUB_OWNER = 'test-owner';
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
      process.env.MAX_CONCURRENT_FEATURES = '10';
      process.env.PORT = '9000';

      const config = loadConfig();

      expect(config.agent.maxConcurrentFeatures).toBe(10);
      expect(config.server.port).toBe(9000);
    });
  });

  describe('validateConfig', () => {
    it('should validate config without throwing for valid configuration', () => {
      const validConfig: Config = {
        nodeEnv: 'development',
        llm: {
          provider: 'claude',
          anthropicApiKey: 'test-key',
          openaiApiKey: undefined,
          geminiApiKey: undefined,
        },
        github: {
          token: 'test-token',
          owner: 'test-owner',
          repo: undefined,
        },
        nats: {
          url: 'nats://localhost:4222',
        },
        database: {
          url: 'postgresql://user:pass@localhost:5432/db',
        },
        agent: {
          autoMergeEnabled: false,
          humanApprovalRequired: true,
          maxConcurrentFeatures: 3,
          timeoutMinutes: 240,
          maxTurnsPerFeature: 50,
        },
        logging: {
          level: 'info',
          toFile: true,
          directory: './logs',
        },
        notifications: {
          slackWebhookUrl: undefined,
          discordWebhookUrl: undefined,
          smtpHost: undefined,
          smtpPort: undefined,
          smtpUser: undefined,
          smtpPass: undefined,
          notificationEmail: undefined,
        },
        server: {
          port: 3000,
        },
      };

      expect(() => validateConfig(validConfig)).not.toThrow();
    });

    it('should throw error when LLM API key is missing for selected provider', () => {
      const invalidConfig: Config = {
        nodeEnv: 'development',
        llm: {
          provider: 'claude',
          anthropicApiKey: undefined,
          openaiApiKey: undefined,
          geminiApiKey: undefined,
        },
        github: {
          token: 'test-token',
          owner: 'test-owner',
          repo: undefined,
        },
        nats: {
          url: 'nats://localhost:4222',
        },
        database: {
          url: 'postgresql://user:pass@localhost:5432/db',
        },
        agent: {
          autoMergeEnabled: false,
          humanApprovalRequired: true,
          maxConcurrentFeatures: 3,
          timeoutMinutes: 240,
          maxTurnsPerFeature: 50,
        },
        logging: {
          level: 'info',
          toFile: true,
          directory: './logs',
        },
        notifications: {
          slackWebhookUrl: undefined,
          discordWebhookUrl: undefined,
          smtpHost: undefined,
          smtpPort: undefined,
          smtpUser: undefined,
          smtpPass: undefined,
          notificationEmail: undefined,
        },
        server: {
          port: 3000,
        },
      };

      expect(() => validateConfig(invalidConfig)).toThrow(/LLM API key.*required/);
    });

    it('should throw error when DATABASE_URL is missing', () => {
      const invalidConfig: Config = {
        nodeEnv: 'development',
        llm: {
          provider: 'claude',
          anthropicApiKey: 'test-key',
          openaiApiKey: undefined,
          geminiApiKey: undefined,
        },
        github: {
          token: 'test-token',
          owner: 'test-owner',
          repo: undefined,
        },
        nats: {
          url: 'nats://localhost:4222',
        },
        database: {
          url: '',
        },
        agent: {
          autoMergeEnabled: false,
          humanApprovalRequired: true,
          maxConcurrentFeatures: 3,
          timeoutMinutes: 240,
          maxTurnsPerFeature: 50,
        },
        logging: {
          level: 'info',
          toFile: true,
          directory: './logs',
        },
        notifications: {
          slackWebhookUrl: undefined,
          discordWebhookUrl: undefined,
          smtpHost: undefined,
          smtpPort: undefined,
          smtpUser: undefined,
          smtpPass: undefined,
          notificationEmail: undefined,
        },
        server: {
          port: 3000,
        },
      };

      expect(() => validateConfig(invalidConfig)).toThrow(/DATABASE_URL.*required/);
    });

    it('should throw error when GITHUB_TOKEN is missing', () => {
      const invalidConfig: Config = {
        nodeEnv: 'development',
        llm: {
          provider: 'claude',
          anthropicApiKey: 'test-key',
          openaiApiKey: undefined,
          geminiApiKey: undefined,
        },
        github: {
          token: '',
          owner: 'test-owner',
          repo: undefined,
        },
        nats: {
          url: 'nats://localhost:4222',
        },
        database: {
          url: 'postgresql://user:pass@localhost:5432/db',
        },
        agent: {
          autoMergeEnabled: false,
          humanApprovalRequired: true,
          maxConcurrentFeatures: 3,
          timeoutMinutes: 240,
          maxTurnsPerFeature: 50,
        },
        logging: {
          level: 'info',
          toFile: true,
          directory: './logs',
        },
        notifications: {
          slackWebhookUrl: undefined,
          discordWebhookUrl: undefined,
          smtpHost: undefined,
          smtpPort: undefined,
          smtpUser: undefined,
          smtpPass: undefined,
          notificationEmail: undefined,
        },
        server: {
          port: 3000,
        },
      };

      expect(() => validateConfig(invalidConfig)).toThrow(/GITHUB_TOKEN.*required/);
    });

    it('should throw error when SMTP config is incomplete', () => {
      const invalidConfig: Config = {
        nodeEnv: 'development',
        llm: {
          provider: 'claude',
          anthropicApiKey: 'test-key',
          openaiApiKey: undefined,
          geminiApiKey: undefined,
        },
        github: {
          token: 'test-token',
          owner: 'test-owner',
          repo: undefined,
        },
        nats: {
          url: 'nats://localhost:4222',
        },
        database: {
          url: 'postgresql://user:pass@localhost:5432/db',
        },
        agent: {
          autoMergeEnabled: false,
          humanApprovalRequired: true,
          maxConcurrentFeatures: 3,
          timeoutMinutes: 240,
          maxTurnsPerFeature: 50,
        },
        logging: {
          level: 'info',
          toFile: true,
          directory: './logs',
        },
        notifications: {
          slackWebhookUrl: undefined,
          discordWebhookUrl: undefined,
          smtpHost: 'smtp.gmail.com',
          smtpPort: 587,
          smtpUser: undefined, // Missing
          smtpPass: undefined, // Missing
          notificationEmail: undefined,
        },
        server: {
          port: 3000,
        },
      };

      expect(() => validateConfig(invalidConfig)).toThrow(/Incomplete SMTP configuration/);
    });
  });

  describe('getLLMApiKey', () => {
    it('should return Anthropic API key when provider is claude', () => {
      const config: Config = {
        nodeEnv: 'development',
        llm: {
          provider: 'claude',
          anthropicApiKey: 'test-anthropic-key',
          openaiApiKey: undefined,
          geminiApiKey: undefined,
        },
        github: { token: 'test', owner: 'test', repo: undefined },
        nats: { url: 'nats://localhost:4222' },
        database: { url: 'postgresql://localhost/db' },
        agent: {
          autoMergeEnabled: false,
          humanApprovalRequired: true,
          maxConcurrentFeatures: 3,
          timeoutMinutes: 240,
          maxTurnsPerFeature: 50,
        },
        logging: { level: 'info', toFile: true, directory: './logs' },
        notifications: {
          slackWebhookUrl: undefined,
          discordWebhookUrl: undefined,
          smtpHost: undefined,
          smtpPort: undefined,
          smtpUser: undefined,
          smtpPass: undefined,
          notificationEmail: undefined,
        },
        server: { port: 3000 },
      };

      expect(getLLMApiKey(config)).toBe('test-anthropic-key');
    });

    it('should return OpenAI API key when provider is openai', () => {
      const config: Config = {
        nodeEnv: 'development',
        llm: {
          provider: 'openai',
          anthropicApiKey: undefined,
          openaiApiKey: 'test-openai-key',
          geminiApiKey: undefined,
        },
        github: { token: 'test', owner: 'test', repo: undefined },
        nats: { url: 'nats://localhost:4222' },
        database: { url: 'postgresql://localhost/db' },
        agent: {
          autoMergeEnabled: false,
          humanApprovalRequired: true,
          maxConcurrentFeatures: 3,
          timeoutMinutes: 240,
          maxTurnsPerFeature: 50,
        },
        logging: { level: 'info', toFile: true, directory: './logs' },
        notifications: {
          slackWebhookUrl: undefined,
          discordWebhookUrl: undefined,
          smtpHost: undefined,
          smtpPort: undefined,
          smtpUser: undefined,
          smtpPass: undefined,
          notificationEmail: undefined,
        },
        server: { port: 3000 },
      };

      expect(getLLMApiKey(config)).toBe('test-openai-key');
    });

    it('should throw error when API key is not configured for selected provider', () => {
      const config: Config = {
        nodeEnv: 'development',
        llm: {
          provider: 'claude',
          anthropicApiKey: undefined,
          openaiApiKey: 'test-openai-key',
          geminiApiKey: undefined,
        },
        github: { token: 'test', owner: 'test', repo: undefined },
        nats: { url: 'nats://localhost:4222' },
        database: { url: 'postgresql://localhost/db' },
        agent: {
          autoMergeEnabled: false,
          humanApprovalRequired: true,
          maxConcurrentFeatures: 3,
          timeoutMinutes: 240,
          maxTurnsPerFeature: 50,
        },
        logging: { level: 'info', toFile: true, directory: './logs' },
        notifications: {
          slackWebhookUrl: undefined,
          discordWebhookUrl: undefined,
          smtpHost: undefined,
          smtpPort: undefined,
          smtpUser: undefined,
          smtpPass: undefined,
          notificationEmail: undefined,
        },
        server: { port: 3000 },
      };

      expect(() => getLLMApiKey(config)).toThrow(/Anthropic API key not configured/);
    });
  });

  describe('isNotificationConfigured', () => {
    const baseConfig: Config = {
      nodeEnv: 'development',
      llm: {
        provider: 'claude',
        anthropicApiKey: 'test-key',
        openaiApiKey: undefined,
        geminiApiKey: undefined,
      },
      github: { token: 'test', owner: 'test', repo: undefined },
      nats: { url: 'nats://localhost:4222' },
      database: { url: 'postgresql://localhost/db' },
      agent: {
        autoMergeEnabled: false,
        humanApprovalRequired: true,
        maxConcurrentFeatures: 3,
        timeoutMinutes: 240,
        maxTurnsPerFeature: 50,
      },
      logging: { level: 'info', toFile: true, directory: './logs' },
      notifications: {
        slackWebhookUrl: 'https://hooks.slack.com/test',
        discordWebhookUrl: undefined,
        smtpHost: undefined,
        smtpPort: undefined,
        smtpUser: undefined,
        smtpPass: undefined,
        notificationEmail: undefined,
      },
      server: { port: 3000 },
    };

    it('should return true when Slack is configured', () => {
      expect(isNotificationConfigured(baseConfig, 'slack')).toBe(true);
    });

    it('should return false when Discord is not configured', () => {
      expect(isNotificationConfigured(baseConfig, 'discord')).toBe(false);
    });

    it('should return false when email is not configured', () => {
      expect(isNotificationConfigured(baseConfig, 'email')).toBe(false);
    });

    it('should return true when email is fully configured', () => {
      const emailConfig: Config = {
        ...baseConfig,
        notifications: {
          slackWebhookUrl: undefined,
          discordWebhookUrl: undefined,
          smtpHost: 'smtp.gmail.com',
          smtpPort: 587,
          smtpUser: 'user@gmail.com',
          smtpPass: 'password',
          notificationEmail: 'notifications@example.com',
        },
      };

      expect(isNotificationConfigured(emailConfig, 'email')).toBe(true);
    });
  });

  describe('Environment Helpers', () => {
    const devConfig: Config = {
      nodeEnv: 'development',
      llm: {
        provider: 'claude',
        anthropicApiKey: 'test',
        openaiApiKey: undefined,
        geminiApiKey: undefined,
      },
      github: { token: 'test', owner: 'test', repo: undefined },
      nats: { url: 'nats://localhost:4222' },
      database: { url: 'postgresql://localhost/db' },
      agent: {
        autoMergeEnabled: false,
        humanApprovalRequired: true,
        maxConcurrentFeatures: 3,
        timeoutMinutes: 240,
        maxTurnsPerFeature: 50,
      },
      logging: { level: 'info', toFile: true, directory: './logs' },
      notifications: {
        slackWebhookUrl: undefined,
        discordWebhookUrl: undefined,
        smtpHost: undefined,
        smtpPort: undefined,
        smtpUser: undefined,
        smtpPass: undefined,
        notificationEmail: undefined,
      },
      server: { port: 3000 },
    };

    it('should correctly identify development environment', () => {
      expect(isDevelopment(devConfig)).toBe(true);
      expect(isProduction(devConfig)).toBe(false);
      expect(isTest(devConfig)).toBe(false);
    });

    it('should correctly identify production environment', () => {
      const prodConfig: Config = { ...devConfig, nodeEnv: 'production' };
      expect(isProduction(prodConfig)).toBe(true);
      expect(isDevelopment(prodConfig)).toBe(false);
      expect(isTest(prodConfig)).toBe(false);
    });

    it('should correctly identify test environment', () => {
      const testConfig: Config = { ...devConfig, nodeEnv: 'test' };
      expect(isTest(testConfig)).toBe(true);
      expect(isDevelopment(testConfig)).toBe(false);
      expect(isProduction(testConfig)).toBe(false);
    });
  });
});
