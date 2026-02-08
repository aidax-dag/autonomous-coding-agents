import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';

/**
 * Environment Configuration Management
 *
 * Provides type-safe configuration loading and validation.
 * All environment variables are validated using Zod schemas.
 *
 * Feature: F1.4 - Environment Configuration Management
 */

// Load .env file
dotenv.config({ path: path.join(process.cwd(), '.env') });

/**
 * LLM Provider Configuration Schema
 *
 * API-based providers: claude, openai, gemini (require API keys)
 * CLI-based providers: claude-cli, codex-cli, gemini-cli, ollama (use subscription authentication)
 */
const LLMProviderSchema = z.enum([
  'claude',
  'openai',
  'gemini',
  'claude-cli',
  'codex-cli',
  'gemini-cli',
  'ollama',
]);
export type LLMProvider = z.infer<typeof LLMProviderSchema>;

/**
 * Check if provider is CLI-based (uses subscription auth, not API key)
 */
export function isCLIProvider(provider: LLMProvider): boolean {
  return ['claude-cli', 'codex-cli', 'gemini-cli', 'ollama'].includes(provider);
}

/**
 * Log Level Schema
 */
const LogLevelSchema = z.enum(['error', 'warn', 'info', 'debug']);
export type LogLevel = z.infer<typeof LogLevelSchema>;

/**
 * Node Environment Schema
 */
const NodeEnvSchema = z.enum(['development', 'production', 'test']);
export type NodeEnv = z.infer<typeof NodeEnvSchema>;

/**
 * Complete Configuration Schema
 */
const ConfigSchema = z.object({
  // Node Environment
  nodeEnv: NodeEnvSchema.default('development'),

  // LLM Configuration
  llm: z.object({
    provider: LLMProviderSchema.default('claude'),
    anthropicApiKey: z.string().optional(),
    openaiApiKey: z.string().optional(),
    geminiApiKey: z.string().optional(),
    // CLI-specific configuration
    ollamaHost: z.string().url().optional(),
    defaultModel: z.string().optional(),
  }),

  // GitHub Configuration
  github: z.object({
    token: z.string().min(1, 'GitHub token is required'),
    owner: z.string().min(1, 'GitHub owner is required'),
    repo: z.string().optional(),
  }),

  // Agent Configuration
  agent: z.object({
    autoMergeEnabled: z.boolean().default(false),
    humanApprovalRequired: z.boolean().default(true),
    maxConcurrentFeatures: z.number().int().positive().default(3),
    timeoutMinutes: z.number().int().positive().default(240),
    maxTurnsPerFeature: z.number().int().positive().default(50),
  }),

  // Logging Configuration
  logging: z.object({
    level: LogLevelSchema.default('info'),
    toFile: z.boolean().default(true),
    directory: z.string().default('./logs'),
  }),

});

export type Config = z.infer<typeof ConfigSchema>;

/**
 * Parse and validate environment variables
 */
function parseEnv(): Config {
  const env = process.env;

  // Helper to parse boolean
  const parseBoolean = (value: string | undefined, defaultValue: boolean): boolean => {
    if (!value) return defaultValue;
    return value.toLowerCase() === 'true';
  };

  // Helper to parse number
  const parseNumber = (value: string | undefined, defaultValue?: number): number | undefined => {
    if (!value) return defaultValue;
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? defaultValue : parsed;
  };

  const rawConfig = {
    nodeEnv: (env.NODE_ENV || 'development') as NodeEnv,

    llm: {
      provider: (env.LLM_PROVIDER || 'claude') as LLMProvider,
      anthropicApiKey: env.ANTHROPIC_API_KEY,
      openaiApiKey: env.OPENAI_API_KEY,
      geminiApiKey: env.GEMINI_API_KEY,
      ollamaHost: env.OLLAMA_HOST,
      defaultModel: env.LLM_DEFAULT_MODEL,
    },

    github: {
      token: env.GITHUB_TOKEN || '',
      owner: env.GITHUB_OWNER || '',
      repo: env.GITHUB_REPO,
    },

    agent: {
      autoMergeEnabled: parseBoolean(env.AUTO_MERGE_ENABLED, false),
      humanApprovalRequired: parseBoolean(env.HUMAN_APPROVAL_REQUIRED, true),
      maxConcurrentFeatures: parseNumber(env.MAX_CONCURRENT_FEATURES, 3)!,
      timeoutMinutes: parseNumber(env.AGENT_TIMEOUT_MINUTES, 240)!,
      maxTurnsPerFeature: parseNumber(env.MAX_TURNS_PER_FEATURE, 50)!,
    },

    logging: {
      level: (env.LOG_LEVEL || 'info') as LogLevel,
      toFile: parseBoolean(env.LOG_TO_FILE, true),
      directory: env.LOG_DIR || './logs',
    },

  };

  return ConfigSchema.parse(rawConfig);
}

/**
 * Validate configuration and throw errors if invalid
 */
export function validateConfig(config: Config): void {
  const { anthropicApiKey, openaiApiKey, geminiApiKey, provider } = config.llm;

  // CLI-based providers don't require API keys (use subscription authentication)
  if (!isCLIProvider(provider)) {
    // Check that API key is provided for API-based providers
    const hasApiKey =
      (provider === 'claude' && anthropicApiKey) ||
      (provider === 'openai' && openaiApiKey) ||
      (provider === 'gemini' && geminiApiKey);

    if (!hasApiKey) {
      throw new Error(
        `LLM API key for provider '${provider}' is required. ` +
          `Set ANTHROPIC_API_KEY, OPENAI_API_KEY, or GEMINI_API_KEY in .env file.\n` +
          `Alternatively, use a CLI-based provider: claude-cli, codex-cli, gemini-cli, or ollama.`
      );
    }
  }

  // Check GitHub configuration
  if (!config.github.token) {
    throw new Error('GITHUB_TOKEN is required in .env file');
  }

  if (!config.github.owner) {
    throw new Error('GITHUB_OWNER is required in .env file');
  }

}

/**
 * Load and validate configuration
 */
export function loadConfig(): Config {
  try {
    const config = parseEnv();
    validateConfig(config);
    return config;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.errors
        .map((err) => `${err.path.join('.')}: ${err.message}`)
        .join('\n');
      throw new Error(`Configuration validation failed:\n${errorMessages}`);
    }
    throw error;
  }
}

/**
 * Get configuration value by path
 */
export function getConfigValue<K extends keyof Config>(
  config: Config,
  key: K
): Config[K] {
  return config[key];
}

/**
 * Get LLM API key based on provider
 */
export function getLLMApiKey(config: Config): string {
  const { provider, anthropicApiKey, openaiApiKey, geminiApiKey } = config.llm;

  switch (provider) {
    case 'claude':
      if (!anthropicApiKey) {
        throw new Error('Anthropic API key not configured');
      }
      return anthropicApiKey;
    case 'openai':
      if (!openaiApiKey) {
        throw new Error('OpenAI API key not configured');
      }
      return openaiApiKey;
    case 'gemini':
      if (!geminiApiKey) {
        throw new Error('Gemini API key not configured');
      }
      return geminiApiKey;
    default:
      throw new Error(`Unknown LLM provider: ${provider}`);
  }
}

/**
 * Get environment-specific settings
 */
export function isProduction(config: Config): boolean {
  return config.nodeEnv === 'production';
}

export function isDevelopment(config: Config): boolean {
  return config.nodeEnv === 'development';
}

export function isTest(config: Config): boolean {
  return config.nodeEnv === 'test';
}

/**
 * Export singleton instance
 */
let configInstance: Config | null = null;

export function getConfig(): Config {
  if (!configInstance) {
    configInstance = loadConfig();
  }
  return configInstance;
}

/**
 * Reset configuration (useful for testing)
 */
export function resetConfig(): void {
  configInstance = null;
}

// Export getConfig for lazy access - do not eagerly load at import time
// This allows tests to set up environment variables before loading config
export { getConfig as default };
