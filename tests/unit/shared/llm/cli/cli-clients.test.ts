import {
  ClaudeCLIClient,
  CodexCLIClient,
  GeminiCLIClient,
  OllamaClient,
  CLIError,
  CLINotFoundError,
  CLIAuthenticationError,
  CLITimeoutError,
  CLIRateLimitError,
  CLIResponseError,
  CLIParseError,
  OllamaServerError,
  isCLIProvider,
} from '@/shared/llm/cli';
import { isCLIProvider as configIsCLIProvider } from '@/shared/config';

/**
 * CLI LLM Client Tests
 *
 * Tests CLI-based LLM clients that use subscription authentication
 * instead of API keys.
 *
 * Note: Actual CLI calls are mocked to avoid requiring CLI installation.
 */

describe('CLI LLM Clients', () => {
  describe('Error Classes', () => {
    it('should create CLIError with correct properties', () => {
      const error = new CLIError('Test error', 'test-cli');

      expect(error.message).toBe('Test error');
      expect(error.cli).toBe('test-cli');
      expect(error.name).toBe('CLIError');
    });

    it('should create CLINotFoundError with installation instructions', () => {
      const error = new CLINotFoundError('claude');

      expect(error.message).toContain("CLI 'claude' not found");
      expect(error.message).toContain('npm install -g @anthropic-ai/claude-code');
      expect(error.cli).toBe('claude');
      expect(error.name).toBe('CLINotFoundError');
    });

    it('should create CLIAuthenticationError with login instructions', () => {
      const error = new CLIAuthenticationError('claude', 'Token expired');

      expect(error.message).toContain("CLI 'claude' not authenticated");
      expect(error.message).toContain('Token expired');
      expect(error.cli).toBe('claude');
      expect(error.name).toBe('CLIAuthenticationError');
    });

    it('should create CLITimeoutError with timeout value', () => {
      const error = new CLITimeoutError('claude', 60000);

      expect(error.message).toContain('timed out after 60000ms');
      expect(error.timeoutMs).toBe(60000);
      expect(error.name).toBe('CLITimeoutError');
    });

    it('should create CLIRateLimitError with retry info', () => {
      const error = new CLIRateLimitError('claude', 5000);

      expect(error.message).toContain('rate limit exceeded');
      expect(error.message).toContain('Retry after 5000ms');
      expect(error.retryAfterMs).toBe(5000);
      expect(error.name).toBe('CLIRateLimitError');
    });

    it('should create CLIResponseError with exit code', () => {
      const error = new CLIResponseError('claude', 'API error', 1);

      expect(error.message).toContain('returned an error');
      expect(error.response).toBe('API error');
      expect(error.exitCode).toBe(1);
      expect(error.name).toBe('CLIResponseError');
    });

    it('should create CLIParseError with output', () => {
      const error = new CLIParseError('claude', 'invalid json', new Error('Parse failed'));

      expect(error.message).toContain('Failed to parse');
      expect(error.output).toBe('invalid json');
      expect(error.name).toBe('CLIParseError');
    });

    it('should create OllamaServerError with details', () => {
      const error = new OllamaServerError('Connection refused');

      expect(error.message).toContain('Ollama server is not running');
      expect(error.message).toContain('Connection refused');
      expect(error.cli).toBe('ollama');
      expect(error.name).toBe('OllamaServerError');
    });
  });

  describe('ClaudeCLIClient', () => {
    it('should create client with default model', () => {
      const client = new ClaudeCLIClient();

      expect(client.getProvider()).toBe('claude-cli');
      expect(client.getDefaultModel()).toBe('sonnet');
    });

    it('should create client with custom model', () => {
      const client = new ClaudeCLIClient('opus');

      expect(client.getDefaultModel()).toBe('opus');
    });

    it('should return correct max context length', () => {
      const client = new ClaudeCLIClient();

      expect(client.getMaxContextLength()).toBe(200000);
      expect(client.getMaxContextLength('opus')).toBe(200000);
      expect(client.getMaxContextLength('sonnet')).toBe(200000);
      expect(client.getMaxContextLength('haiku')).toBe(200000);
      expect(client.getMaxContextLength('unknown')).toBe(200000);
    });
  });

  describe('CodexCLIClient', () => {
    it('should create client with default model', () => {
      const client = new CodexCLIClient();

      expect(client.getProvider()).toBe('codex-cli');
      expect(client.getDefaultModel()).toBe('o3');
    });

    it('should create client with custom model', () => {
      const client = new CodexCLIClient('gpt-4o');

      expect(client.getDefaultModel()).toBe('gpt-4o');
    });

    it('should return correct max context length', () => {
      const client = new CodexCLIClient();

      expect(client.getMaxContextLength()).toBe(128000);
      expect(client.getMaxContextLength('o3')).toBe(128000);
      expect(client.getMaxContextLength('gpt-4o')).toBe(128000);
      expect(client.getMaxContextLength('unknown')).toBe(128000);
    });
  });

  describe('GeminiCLIClient', () => {
    it('should create client with default model', () => {
      const client = new GeminiCLIClient();

      expect(client.getProvider()).toBe('gemini-cli');
      expect(client.getDefaultModel()).toBe('gemini-2.0-flash');
    });

    it('should create client with custom model', () => {
      const client = new GeminiCLIClient('gemini-1.5-pro');

      expect(client.getDefaultModel()).toBe('gemini-1.5-pro');
    });

    it('should return correct max context length', () => {
      const client = new GeminiCLIClient();

      expect(client.getMaxContextLength()).toBe(1000000);
      expect(client.getMaxContextLength('gemini-2.0-flash')).toBe(1000000);
      expect(client.getMaxContextLength('gemini-1.5-pro')).toBe(2000000);
      expect(client.getMaxContextLength('unknown')).toBe(1000000);
    });
  });

  describe('OllamaClient', () => {
    it('should create client with default settings', () => {
      const client = new OllamaClient();

      expect(client.getProvider()).toBe('ollama');
      expect(client.getDefaultModel()).toBe('llama3');
    });

    it('should create client with custom model', () => {
      const client = new OllamaClient('codellama');

      expect(client.getDefaultModel()).toBe('codellama');
    });

    it('should create client with custom host', () => {
      const client = new OllamaClient('llama3', 'http://localhost:5000');

      expect(client.getProvider()).toBe('ollama');
    });

    it('should return correct max context length', () => {
      const client = new OllamaClient();

      expect(client.getMaxContextLength()).toBe(8192);
      expect(client.getMaxContextLength('llama3')).toBe(8192);
      expect(client.getMaxContextLength('llama3.1')).toBe(128000);
      expect(client.getMaxContextLength('mistral')).toBe(32768);
      expect(client.getMaxContextLength('codellama')).toBe(16384);
      expect(client.getMaxContextLength('unknown')).toBe(8192);
    });
  });

  describe('CLI Provider Factory', () => {
    it('should create ClaudeCLIClient', () => {
      const client = createCLIClient('claude-cli');

      expect(client).toBeInstanceOf(ClaudeCLIClient);
      expect(client.getProvider()).toBe('claude-cli');
    });

    it('should create CodexCLIClient', () => {
      const client = createCLIClient('codex-cli');

      expect(client).toBeInstanceOf(CodexCLIClient);
      expect(client.getProvider()).toBe('codex-cli');
    });

    it('should create GeminiCLIClient', () => {
      const client = createCLIClient('gemini-cli');

      expect(client).toBeInstanceOf(GeminiCLIClient);
      expect(client.getProvider()).toBe('gemini-cli');
    });

    it('should create OllamaClient', () => {
      const client = createCLIClient('ollama');

      expect(client).toBeInstanceOf(OllamaClient);
      expect(client.getProvider()).toBe('ollama');
    });

    it('should throw error for unknown CLI provider', () => {
      expect(() => createCLIClient('unknown' as any)).toThrow('Unknown CLI provider');
    });
  });

  describe('Provider Type Checking', () => {
    it('should identify CLI providers', () => {
      expect(isCLIProvider('claude-cli')).toBe(true);
      expect(isCLIProvider('codex-cli')).toBe(true);
      expect(isCLIProvider('gemini-cli')).toBe(true);
      expect(isCLIProvider('ollama')).toBe(true);
    });

    it('should not identify API providers as CLI', () => {
      expect(isCLIProvider('claude')).toBe(false);
      expect(isCLIProvider('openai')).toBe(false);
      expect(isCLIProvider('gemini')).toBe(false);
    });

    it('should match config isCLIProvider function', () => {
      expect(configIsCLIProvider('claude-cli')).toBe(true);
      expect(configIsCLIProvider('codex-cli')).toBe(true);
      expect(configIsCLIProvider('gemini-cli')).toBe(true);
      expect(configIsCLIProvider('ollama')).toBe(true);
      expect(configIsCLIProvider('claude')).toBe(false);
      expect(configIsCLIProvider('openai')).toBe(false);
      expect(configIsCLIProvider('gemini')).toBe(false);
    });
  });

  describe('Message Validation', () => {
    it('should throw error for empty messages array', async () => {
      const client = new ClaudeCLIClient();

      await expect(client.chat([])).rejects.toThrow('Messages array cannot be empty');
    });

    it('should throw error for invalid role', async () => {
      const client = new ClaudeCLIClient();

      await expect(client.chat([{ role: 'invalid' as any, content: 'test' }])).rejects.toThrow(
        'Invalid message role'
      );
    });

    it('should throw error for non-string content', async () => {
      const client = new ClaudeCLIClient();

      await expect(client.chat([{ role: 'user', content: 123 as any }])).rejects.toThrow(
        'Message content must be a string'
      );
    });

    it('should throw error when no user message found', async () => {
      const client = new ClaudeCLIClient();

      await expect(client.chat([{ role: 'system', content: 'You are helpful' }])).rejects.toThrow(
        'No user message found'
      );
    });
  });
});

// Helper to import createCLIClient
function createCLIClient(provider: string, defaultModel?: string, host?: string) {
  switch (provider) {
    case 'claude-cli':
      return new ClaudeCLIClient(defaultModel);
    case 'codex-cli':
      return new CodexCLIClient(defaultModel);
    case 'gemini-cli':
      return new GeminiCLIClient(defaultModel);
    case 'ollama':
      return new OllamaClient(defaultModel, host);
    default:
      throw new Error(`Unknown CLI provider: ${provider}`);
  }
}
