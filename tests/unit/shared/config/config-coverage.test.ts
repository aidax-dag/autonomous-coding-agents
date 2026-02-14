/**
 * Configuration Coverage Tests
 *
 * Supplements index.test.ts to cover:
 * - isCLIProvider function
 * - getConfigValue helper
 * - getLLMApiKey for all providers (gemini, mistral, xai, groq, together, deepseek, fireworks)
 * - validateConfig for CLI providers (skip API key check)
 * - validateConfig for GITHUB_OWNER missing
 * - loadConfig error path for ZodError
 * - getConfig singleton
 * - resetConfig
 * - parseNumber edge cases (NaN)
 * - routing config parsing
 */

import {
  loadConfig,
  validateConfig,
  getLLMApiKey,
  getConfigValue,
  isProduction,
  isDevelopment,
  isTest,
  isCLIProvider,
  resetConfig,
  getConfig,
  Config,
} from '@/shared/config';

describe('Configuration Coverage', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    resetConfig();
  });

  afterEach(() => {
    process.env = originalEnv;
    resetConfig();
  });

  // =========================================================================
  // isCLIProvider
  // =========================================================================

  describe('isCLIProvider', () => {
    it('should return true for claude-cli', () => {
      expect(isCLIProvider('claude-cli')).toBe(true);
    });

    it('should return true for codex-cli', () => {
      expect(isCLIProvider('codex-cli')).toBe(true);
    });

    it('should return true for gemini-cli', () => {
      expect(isCLIProvider('gemini-cli')).toBe(true);
    });

    it('should return true for ollama', () => {
      expect(isCLIProvider('ollama')).toBe(true);
    });

    it('should return false for API-based providers', () => {
      expect(isCLIProvider('claude')).toBe(false);
      expect(isCLIProvider('openai')).toBe(false);
      expect(isCLIProvider('gemini')).toBe(false);
      expect(isCLIProvider('mistral')).toBe(false);
      expect(isCLIProvider('xai')).toBe(false);
      expect(isCLIProvider('groq')).toBe(false);
      expect(isCLIProvider('together')).toBe(false);
      expect(isCLIProvider('deepseek')).toBe(false);
      expect(isCLIProvider('fireworks')).toBe(false);
    });
  });

  // =========================================================================
  // getConfigValue
  // =========================================================================

  describe('getConfigValue', () => {
    it('should return the config value for a top-level key', () => {
      const config: Config = {
        nodeEnv: 'production',
        llm: { provider: 'claude', anthropicApiKey: 'key' },
        github: { token: 't', owner: 'o' },
        agent: {
          autoMergeEnabled: false,
          humanApprovalRequired: true,
          maxConcurrentFeatures: 3,
          timeoutMinutes: 240,
          maxTurnsPerFeature: 50,
        },
        logging: { level: 'info', toFile: true, directory: './logs' },
      };

      expect(getConfigValue(config, 'nodeEnv')).toBe('production');
      expect(getConfigValue(config, 'llm')).toEqual(config.llm);
      expect(getConfigValue(config, 'github')).toEqual(config.github);
      expect(getConfigValue(config, 'agent')).toEqual(config.agent);
      expect(getConfigValue(config, 'logging')).toEqual(config.logging);
    });
  });

  // =========================================================================
  // validateConfig - CLI providers skip API key check
  // =========================================================================

  describe('validateConfig - CLI providers', () => {
    it('should not throw for claude-cli without API key', () => {
      const config: Config = {
        nodeEnv: 'development',
        llm: { provider: 'claude-cli' },
        github: { token: 'test-token', owner: 'test-owner' },
        agent: {
          autoMergeEnabled: false,
          humanApprovalRequired: true,
          maxConcurrentFeatures: 3,
          timeoutMinutes: 240,
          maxTurnsPerFeature: 50,
        },
        logging: { level: 'info', toFile: true, directory: './logs' },
      };

      expect(() => validateConfig(config)).not.toThrow();
    });

    it('should not throw for ollama without API key', () => {
      const config: Config = {
        nodeEnv: 'development',
        llm: { provider: 'ollama' },
        github: { token: 'test-token', owner: 'test-owner' },
        agent: {
          autoMergeEnabled: false,
          humanApprovalRequired: true,
          maxConcurrentFeatures: 3,
          timeoutMinutes: 240,
          maxTurnsPerFeature: 50,
        },
        logging: { level: 'info', toFile: true, directory: './logs' },
      };

      expect(() => validateConfig(config)).not.toThrow();
    });
  });

  // =========================================================================
  // validateConfig - GITHUB_OWNER missing
  // =========================================================================

  describe('validateConfig - GITHUB_OWNER missing', () => {
    it('should throw when GITHUB_OWNER is empty', () => {
      const config: Config = {
        nodeEnv: 'development',
        llm: { provider: 'claude', anthropicApiKey: 'key' },
        github: { token: 'test-token', owner: '' },
        agent: {
          autoMergeEnabled: false,
          humanApprovalRequired: true,
          maxConcurrentFeatures: 3,
          timeoutMinutes: 240,
          maxTurnsPerFeature: 50,
        },
        logging: { level: 'info', toFile: true, directory: './logs' },
      };

      expect(() => validateConfig(config)).toThrow(/GITHUB_OWNER.*required/);
    });
  });

  // =========================================================================
  // validateConfig - Various API provider key checks
  // =========================================================================

  describe('validateConfig - API providers without keys', () => {
    const providers = [
      'openai', 'gemini', 'mistral', 'xai', 'groq', 'together', 'deepseek', 'fireworks',
    ] as const;

    for (const provider of providers) {
      it(`should throw for ${provider} without API key`, () => {
        const config: Config = {
          nodeEnv: 'development',
          llm: { provider },
          github: { token: 'test-token', owner: 'test-owner' },
          agent: {
            autoMergeEnabled: false,
            humanApprovalRequired: true,
            maxConcurrentFeatures: 3,
            timeoutMinutes: 240,
            maxTurnsPerFeature: 50,
          },
          logging: { level: 'info', toFile: true, directory: './logs' },
        };

        expect(() => validateConfig(config)).toThrow(/LLM API key.*required/);
      });
    }
  });

  // =========================================================================
  // getLLMApiKey for all providers
  // =========================================================================

  describe('getLLMApiKey - all providers', () => {
    const baseConfig: Config = {
      nodeEnv: 'development',
      llm: {
        provider: 'claude',
        anthropicApiKey: 'key-a',
        openaiApiKey: 'key-o',
        geminiApiKey: 'key-g',
        mistralApiKey: 'key-m',
        xaiApiKey: 'key-x',
        groqApiKey: 'key-gr',
        togetherApiKey: 'key-t',
        deepseekApiKey: 'key-d',
        fireworksApiKey: 'key-f',
      },
      github: { token: 't', owner: 'o' },
      agent: {
        autoMergeEnabled: false,
        humanApprovalRequired: true,
        maxConcurrentFeatures: 3,
        timeoutMinutes: 240,
        maxTurnsPerFeature: 50,
      },
      logging: { level: 'info', toFile: true, directory: './logs' },
    };

    it('should return gemini key', () => {
      const config = { ...baseConfig, llm: { ...baseConfig.llm, provider: 'gemini' as const } };
      expect(getLLMApiKey(config)).toBe('key-g');
    });

    it('should return mistral key', () => {
      const config = { ...baseConfig, llm: { ...baseConfig.llm, provider: 'mistral' as const } };
      expect(getLLMApiKey(config)).toBe('key-m');
    });

    it('should return xai key', () => {
      const config = { ...baseConfig, llm: { ...baseConfig.llm, provider: 'xai' as const } };
      expect(getLLMApiKey(config)).toBe('key-x');
    });

    it('should return groq key', () => {
      const config = { ...baseConfig, llm: { ...baseConfig.llm, provider: 'groq' as const } };
      expect(getLLMApiKey(config)).toBe('key-gr');
    });

    it('should return together key', () => {
      const config = { ...baseConfig, llm: { ...baseConfig.llm, provider: 'together' as const } };
      expect(getLLMApiKey(config)).toBe('key-t');
    });

    it('should return deepseek key', () => {
      const config = { ...baseConfig, llm: { ...baseConfig.llm, provider: 'deepseek' as const } };
      expect(getLLMApiKey(config)).toBe('key-d');
    });

    it('should return fireworks key', () => {
      const config = { ...baseConfig, llm: { ...baseConfig.llm, provider: 'fireworks' as const } };
      expect(getLLMApiKey(config)).toBe('key-f');
    });

    // Missing key throws

    it('should throw when gemini key is missing', () => {
      const config = { ...baseConfig, llm: { ...baseConfig.llm, provider: 'gemini' as const, geminiApiKey: undefined } };
      expect(() => getLLMApiKey(config)).toThrow(/Gemini API key not configured/);
    });

    it('should throw when mistral key is missing', () => {
      const config = { ...baseConfig, llm: { ...baseConfig.llm, provider: 'mistral' as const, mistralApiKey: undefined } };
      expect(() => getLLMApiKey(config)).toThrow(/Mistral API key not configured/);
    });

    it('should throw when xai key is missing', () => {
      const config = { ...baseConfig, llm: { ...baseConfig.llm, provider: 'xai' as const, xaiApiKey: undefined } };
      expect(() => getLLMApiKey(config)).toThrow(/xAI API key not configured/);
    });

    it('should throw when groq key is missing', () => {
      const config = { ...baseConfig, llm: { ...baseConfig.llm, provider: 'groq' as const, groqApiKey: undefined } };
      expect(() => getLLMApiKey(config)).toThrow(/Groq API key not configured/);
    });

    it('should throw when together key is missing', () => {
      const config = { ...baseConfig, llm: { ...baseConfig.llm, provider: 'together' as const, togetherApiKey: undefined } };
      expect(() => getLLMApiKey(config)).toThrow(/Together API key not configured/);
    });

    it('should throw when deepseek key is missing', () => {
      const config = { ...baseConfig, llm: { ...baseConfig.llm, provider: 'deepseek' as const, deepseekApiKey: undefined } };
      expect(() => getLLMApiKey(config)).toThrow(/DeepSeek API key not configured/);
    });

    it('should throw when fireworks key is missing', () => {
      const config = { ...baseConfig, llm: { ...baseConfig.llm, provider: 'fireworks' as const, fireworksApiKey: undefined } };
      expect(() => getLLMApiKey(config)).toThrow(/Fireworks API key not configured/);
    });
  });

  // =========================================================================
  // loadConfig error handling - Zod error
  // =========================================================================

  describe('loadConfig - Zod validation error', () => {
    it('should throw a descriptive error for invalid LLM_PROVIDER', () => {
      process.env.LLM_PROVIDER = 'not-a-valid-provider';
      process.env.GITHUB_TOKEN = 'test-token';
      process.env.GITHUB_OWNER = 'test-owner';

      expect(() => loadConfig()).toThrow(/Configuration validation failed/);
    });

    it('should throw a descriptive error for invalid LOG_LEVEL', () => {
      process.env.ANTHROPIC_API_KEY = 'key';
      process.env.GITHUB_TOKEN = 'test-token';
      process.env.GITHUB_OWNER = 'test-owner';
      process.env.LOG_LEVEL = 'not-a-level';

      expect(() => loadConfig()).toThrow(/Configuration validation failed/);
    });
  });

  // =========================================================================
  // loadConfig - non-ZodError propagation
  // =========================================================================

  describe('loadConfig - non-Zod error propagation', () => {
    it('should throw missing API key error (non-ZodError) when GitHub and provider are valid but API key missing', () => {
      process.env.LLM_PROVIDER = 'claude';
      process.env.GITHUB_TOKEN = 'test-token';
      process.env.GITHUB_OWNER = 'test-owner';
      delete process.env.ANTHROPIC_API_KEY;

      expect(() => loadConfig()).toThrow(/LLM API key.*required/);
    });
  });

  // =========================================================================
  // getConfig singleton
  // =========================================================================

  describe('getConfig singleton', () => {
    it('should return same instance on second call', () => {
      process.env.ANTHROPIC_API_KEY = 'test-key';
      process.env.GITHUB_TOKEN = 'test-token';
      process.env.GITHUB_OWNER = 'test-owner';

      const config1 = getConfig();
      const config2 = getConfig();

      expect(config1).toBe(config2);
    });

    it('should return new instance after resetConfig', () => {
      process.env.ANTHROPIC_API_KEY = 'test-key';
      process.env.GITHUB_TOKEN = 'test-token';
      process.env.GITHUB_OWNER = 'test-owner';

      const config1 = getConfig();
      resetConfig();
      const config2 = getConfig();

      expect(config1).not.toBe(config2);
      expect(config1).toEqual(config2);
    });
  });

  // =========================================================================
  // parseNumber edge case - NaN
  // =========================================================================

  describe('parseNumber edge cases', () => {
    it('should use default when env var is not a number', () => {
      process.env.ANTHROPIC_API_KEY = 'test-key';
      process.env.GITHUB_TOKEN = 'test-token';
      process.env.GITHUB_OWNER = 'test-owner';
      process.env.MAX_CONCURRENT_FEATURES = 'not-a-number';

      const config = loadConfig();
      expect(config.agent.maxConcurrentFeatures).toBe(3); // default
    });
  });

  // =========================================================================
  // Routing config
  // =========================================================================

  describe('routing config parsing', () => {
    it('should parse routing configuration from env', () => {
      process.env.ANTHROPIC_API_KEY = 'test-key';
      process.env.GITHUB_TOKEN = 'test-token';
      process.env.GITHUB_OWNER = 'test-owner';
      process.env.ROUTING_ENABLED = 'true';
      process.env.ROUTING_DEFAULT_PROFILE = 'performance';
      process.env.ROUTING_BUDGET_LIMIT = '500';

      const config = loadConfig();

      expect(config.routing?.enabled).toBe(true);
      expect(config.routing?.defaultProfile).toBe('performance');
      expect(config.routing?.budgetLimit).toBe(500);
    });

    it('should use default routing values', () => {
      process.env.ANTHROPIC_API_KEY = 'test-key';
      process.env.GITHUB_TOKEN = 'test-token';
      process.env.GITHUB_OWNER = 'test-owner';

      const config = loadConfig();

      expect(config.routing?.enabled).toBe(false);
      expect(config.routing?.defaultProfile).toBe('balanced');
    });
  });

  // =========================================================================
  // LOG_DIR and LOG_TO_FILE
  // =========================================================================

  describe('logging config', () => {
    it('should use custom LOG_DIR', () => {
      process.env.ANTHROPIC_API_KEY = 'test-key';
      process.env.GITHUB_TOKEN = 'test-token';
      process.env.GITHUB_OWNER = 'test-owner';
      process.env.LOG_DIR = '/custom/logs';

      const config = loadConfig();
      expect(config.logging.directory).toBe('/custom/logs');
    });

    it('should parse LOG_TO_FILE=false', () => {
      process.env.ANTHROPIC_API_KEY = 'test-key';
      process.env.GITHUB_TOKEN = 'test-token';
      process.env.GITHUB_OWNER = 'test-owner';
      process.env.LOG_TO_FILE = 'false';

      const config = loadConfig();
      expect(config.logging.toFile).toBe(false);
    });
  });

  // =========================================================================
  // LLM_DEFAULT_MODEL and OLLAMA_HOST
  // =========================================================================

  describe('LLM extra config', () => {
    it('should parse LLM_DEFAULT_MODEL', () => {
      process.env.ANTHROPIC_API_KEY = 'test-key';
      process.env.GITHUB_TOKEN = 'test-token';
      process.env.GITHUB_OWNER = 'test-owner';
      process.env.LLM_DEFAULT_MODEL = 'claude-3-opus';

      const config = loadConfig();
      expect(config.llm.defaultModel).toBe('claude-3-opus');
    });

    it('should parse GITHUB_REPO', () => {
      process.env.ANTHROPIC_API_KEY = 'test-key';
      process.env.GITHUB_TOKEN = 'test-token';
      process.env.GITHUB_OWNER = 'test-owner';
      process.env.GITHUB_REPO = 'my-repo';

      const config = loadConfig();
      expect(config.github.repo).toBe('my-repo');
    });
  });

  // =========================================================================
  // MAX_TURNS_PER_FEATURE
  // =========================================================================

  describe('agent config extras', () => {
    it('should parse MAX_TURNS_PER_FEATURE', () => {
      process.env.ANTHROPIC_API_KEY = 'test-key';
      process.env.GITHUB_TOKEN = 'test-token';
      process.env.GITHUB_OWNER = 'test-owner';
      process.env.MAX_TURNS_PER_FEATURE = '100';

      const config = loadConfig();
      expect(config.agent.maxTurnsPerFeature).toBe(100);
    });
  });
});
