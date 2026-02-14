/**
 * New LLM Provider Client Tests (Mistral, xAI, Groq, Together, DeepSeek, Fireworks)
 *
 * Feature: F-4 - Additional LLM Providers
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

// ============================================================================
// Mock SDK modules
// ============================================================================

// Mock for Mistral SDK
const mockMistralChatComplete = jest.fn();
const mockMistralChatStream = jest.fn();

jest.mock('@mistralai/mistralai', () => ({
  __esModule: true,
  Mistral: jest.fn().mockImplementation(() => ({
    chat: {
      complete: mockMistralChatComplete,
      stream: mockMistralChatStream,
    },
  })),
}), { virtual: true });

// Mock for OpenAI SDK (used by xAI, Groq, Together, DeepSeek, Fireworks)
const mockOpenAICreate = jest.fn();

class MockOpenAIAPIError extends Error {
  status: number;
  headers: Record<string, string>;
  type?: string;
  code?: string;

  constructor(status: number, _body: any, message?: string, headers?: Record<string, string>) {
    super(message || 'API Error');
    this.name = 'APIError';
    this.status = status;
    this.headers = headers || {};
  }
}

jest.mock('openai', () => {
  const Mock = jest.fn().mockImplementation(() => ({
    chat: { completions: { create: mockOpenAICreate } },
  }));
  (Mock as any).APIError = MockOpenAIAPIError;
  return { __esModule: true, default: Mock };
});

// ============================================================================
// Imports (after mocks)
// ============================================================================

import { MistralClient } from '../../../../src/shared/llm/mistral-client';
import { XAIClient } from '../../../../src/shared/llm/xai-client';
import { GroqClient } from '../../../../src/shared/llm/groq-client';
import { TogetherClient } from '../../../../src/shared/llm/together-client';
import { DeepSeekClient } from '../../../../src/shared/llm/deepseek-client';
import { FireworksClient } from '../../../../src/shared/llm/fireworks-client';
import { LLMError, LLMRateLimitError, LLMTimeoutError } from '../../../../src/shared/errors/custom-errors';

// ============================================================================
// Helper: standard OpenAI-compatible mock response
// ============================================================================

function makeOpenAIResponse(overrides: Partial<{
  content: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  finishReason: string;
  id: string;
}> = {}) {
  const {
    content = 'Hello from provider',
    model = 'test-model',
    promptTokens = 10,
    completionTokens = 5,
    totalTokens = 15,
    finishReason = 'stop',
    id = 'chatcmpl-test',
  } = overrides;

  return {
    choices: [{
      message: { content },
      finish_reason: finishReason,
    }],
    model,
    usage: { prompt_tokens: promptTokens, completion_tokens: completionTokens, total_tokens: totalTokens },
    id,
    created: 1700000000,
    system_fingerprint: 'fp_test',
  };
}

// ============================================================================
// MistralClient
// ============================================================================

describe('MistralClient', () => {
  let client: MistralClient;

  beforeEach(() => {
    jest.clearAllMocks();
    client = new MistralClient('sk-test-key');
  });

  describe('constructor & accessors', () => {
    it('should use default model', () => {
      expect(client.getDefaultModel()).toBe('mistral-large-latest');
    });

    it('should accept custom model', () => {
      const custom = new MistralClient('sk-test', 'codestral-latest');
      expect(custom.getDefaultModel()).toBe('codestral-latest');
    });

    it('should return mistral as provider', () => {
      expect(client.getProvider()).toBe('mistral');
    });

    it('should throw for empty API key', () => {
      expect(() => new MistralClient('')).toThrow('API key is required');
    });
  });

  describe('getMaxContextLength', () => {
    it('should return known model context lengths', () => {
      expect(client.getMaxContextLength('mistral-large-latest')).toBe(128000);
      expect(client.getMaxContextLength('mistral-small-latest')).toBe(32000);
      expect(client.getMaxContextLength('codestral-latest')).toBe(32000);
      expect(client.getMaxContextLength('open-mistral-nemo')).toBe(128000);
    });

    it('should return default for unknown model', () => {
      expect(client.getMaxContextLength('unknown-model')).toBe(128000);
    });

    it('should use default model when no model specified', () => {
      expect(client.getMaxContextLength()).toBe(128000);
    });
  });

  describe('chat', () => {
    it('should call API and return result', async () => {
      mockMistralChatComplete.mockResolvedValueOnce({
        choices: [{
          message: { content: 'Hello from Mistral' },
          finishReason: 'stop',
        }],
        model: 'mistral-large-latest',
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        id: 'msg-123',
        created: 1700000000,
      });

      const result = await client.chat([{ role: 'user', content: 'Hi' }]);

      expect(result.content).toBe('Hello from Mistral');
      expect(result.model).toBe('mistral-large-latest');
      expect(result.usage.promptTokens).toBe(10);
      expect(result.usage.completionTokens).toBe(5);
      expect(result.usage.totalTokens).toBe(15);
      expect(result.finishReason).toBe('stop');
    });

    it('should handle empty response', async () => {
      mockMistralChatComplete.mockResolvedValueOnce({
        choices: [],
        model: 'mistral-large-latest',
      });

      await expect(client.chat([{ role: 'user', content: 'Hi' }])).rejects.toThrow(LLMError);
    });

    it('should validate messages', async () => {
      await expect(client.chat([])).rejects.toThrow('cannot be empty');
    });
  });

  describe('error handling', () => {
    it('should throw LLMRateLimitError for rate limit messages', async () => {
      mockMistralChatComplete.mockRejectedValueOnce(new Error('429 rate limit exceeded'));

      await expect(client.chat([{ role: 'user', content: 'Hi' }])).rejects.toThrow(LLMRateLimitError);
    });

    it('should throw LLMTimeoutError for timeout messages', async () => {
      mockMistralChatComplete.mockRejectedValueOnce(new Error('Request timeout'));

      await expect(client.chat([{ role: 'user', content: 'Hi' }])).rejects.toThrow(LLMTimeoutError);
    });

    it('should throw retryable LLMError for server errors', async () => {
      mockMistralChatComplete.mockRejectedValueOnce(new Error('500 server error'));

      try {
        await client.chat([{ role: 'user', content: 'Hi' }]);
      } catch (e) {
        expect(e).toBeInstanceOf(LLMError);
        expect((e as LLMError).retryable).toBe(true);
      }
    });

    it('should throw non-retryable LLMError for other errors', async () => {
      mockMistralChatComplete.mockRejectedValueOnce(new Error('Invalid API key'));

      try {
        await client.chat([{ role: 'user', content: 'Hi' }]);
      } catch (e) {
        expect(e).toBeInstanceOf(LLMError);
        expect((e as LLMError).retryable).toBe(false);
      }
    });

    it('should handle non-Error thrown values', async () => {
      mockMistralChatComplete.mockRejectedValueOnce('string error');

      await expect(client.chat([{ role: 'user', content: 'Hi' }])).rejects.toThrow(LLMError);
    });
  });
});

// ============================================================================
// XAIClient
// ============================================================================

describe('XAIClient', () => {
  let client: XAIClient;

  beforeEach(() => {
    jest.clearAllMocks();
    client = new XAIClient('sk-test-key');
  });

  describe('constructor & accessors', () => {
    it('should use default model', () => {
      expect(client.getDefaultModel()).toBe('grok-2');
    });

    it('should accept custom model', () => {
      const custom = new XAIClient('sk-test', 'grok-2-mini');
      expect(custom.getDefaultModel()).toBe('grok-2-mini');
    });

    it('should return xai as provider', () => {
      expect(client.getProvider()).toBe('xai');
    });

    it('should throw for empty API key', () => {
      expect(() => new XAIClient('')).toThrow('API key is required');
    });
  });

  describe('getMaxContextLength', () => {
    it('should return known model context lengths', () => {
      expect(client.getMaxContextLength('grok-2')).toBe(131072);
      expect(client.getMaxContextLength('grok-2-mini')).toBe(131072);
    });

    it('should return default for unknown model', () => {
      expect(client.getMaxContextLength('unknown')).toBe(131072);
    });
  });

  describe('chat', () => {
    it('should call API and return result', async () => {
      mockOpenAICreate.mockResolvedValueOnce(makeOpenAIResponse({
        content: 'Hello from Grok',
        model: 'grok-2',
        promptTokens: 8,
        completionTokens: 4,
        totalTokens: 12,
      }));

      const result = await client.chat([{ role: 'user', content: 'Hi' }]);

      expect(result.content).toBe('Hello from Grok');
      expect(result.model).toBe('grok-2');
      expect(result.usage.promptTokens).toBe(8);
      expect(result.usage.completionTokens).toBe(4);
      expect(result.usage.totalTokens).toBe(12);
      expect(result.finishReason).toBe('stop');
    });

    it('should throw for empty response', async () => {
      mockOpenAICreate.mockResolvedValueOnce({
        choices: [],
        model: 'grok-2',
        usage: { prompt_tokens: 5, completion_tokens: 0, total_tokens: 5 },
        id: 'chatcmpl-empty',
        created: 1700000000,
      });

      await expect(client.chat([{ role: 'user', content: 'Hi' }])).rejects.toThrow(LLMError);
    });

    it('should validate messages', async () => {
      await expect(client.chat([])).rejects.toThrow('cannot be empty');
    });
  });

  describe('error handling', () => {
    it('should throw LLMRateLimitError for 429', async () => {
      const apiError = new MockOpenAIAPIError(429, {}, 'Rate limited');
      mockOpenAICreate.mockRejectedValueOnce(apiError);

      await expect(client.chat([{ role: 'user', content: 'Hi' }])).rejects.toThrow(LLMRateLimitError);
    });

    it('should throw LLMTimeoutError for 408', async () => {
      const apiError = new MockOpenAIAPIError(408, {}, 'Timeout');
      mockOpenAICreate.mockRejectedValueOnce(apiError);

      await expect(client.chat([{ role: 'user', content: 'Hi' }])).rejects.toThrow(LLMTimeoutError);
    });

    it('should throw retryable LLMError for server errors', async () => {
      const apiError = new MockOpenAIAPIError(500, {}, 'Internal error');
      mockOpenAICreate.mockRejectedValueOnce(apiError);

      try {
        await client.chat([{ role: 'user', content: 'Hi' }]);
      } catch (e) {
        expect(e).toBeInstanceOf(LLMError);
        expect((e as LLMError).retryable).toBe(true);
      }
    });

    it('should throw LLMError for unknown errors', async () => {
      mockOpenAICreate.mockRejectedValueOnce(new Error('Network error'));

      await expect(client.chat([{ role: 'user', content: 'Hi' }])).rejects.toThrow(LLMError);
    });
  });
});

// ============================================================================
// GroqClient
// ============================================================================

describe('GroqClient', () => {
  let client: GroqClient;

  beforeEach(() => {
    jest.clearAllMocks();
    client = new GroqClient('sk-test-key');
  });

  describe('constructor & accessors', () => {
    it('should use default model', () => {
      expect(client.getDefaultModel()).toBe('llama-3.3-70b-versatile');
    });

    it('should accept custom model', () => {
      const custom = new GroqClient('sk-test', 'mixtral-8x7b-32768');
      expect(custom.getDefaultModel()).toBe('mixtral-8x7b-32768');
    });

    it('should return groq as provider', () => {
      expect(client.getProvider()).toBe('groq');
    });

    it('should throw for empty API key', () => {
      expect(() => new GroqClient('')).toThrow('API key is required');
    });
  });

  describe('getMaxContextLength', () => {
    it('should return known model context lengths', () => {
      expect(client.getMaxContextLength('llama-3.3-70b-versatile')).toBe(128000);
      expect(client.getMaxContextLength('mixtral-8x7b-32768')).toBe(32768);
      expect(client.getMaxContextLength('gemma2-9b-it')).toBe(8192);
    });

    it('should return default for unknown model', () => {
      expect(client.getMaxContextLength('unknown')).toBe(128000);
    });
  });

  describe('chat', () => {
    it('should call API and return result', async () => {
      mockOpenAICreate.mockResolvedValueOnce(makeOpenAIResponse({
        content: 'Hello from Groq',
        model: 'llama-3.3-70b-versatile',
      }));

      const result = await client.chat([{ role: 'user', content: 'Hi' }]);

      expect(result.content).toBe('Hello from Groq');
      expect(result.model).toBe('llama-3.3-70b-versatile');
      expect(result.finishReason).toBe('stop');
    });

    it('should pass options to API', async () => {
      mockOpenAICreate.mockResolvedValueOnce(makeOpenAIResponse({
        model: 'mixtral-8x7b-32768',
      }));

      await client.chat(
        [{ role: 'user', content: 'Hi' }],
        { model: 'mixtral-8x7b-32768', temperature: 0.7, maxTokens: 200 },
      );

      const callArgs = mockOpenAICreate.mock.calls[0][0];
      expect(callArgs.model).toBe('mixtral-8x7b-32768');
      expect(callArgs.temperature).toBe(0.7);
      expect(callArgs.max_tokens).toBe(200);
    });

    it('should validate messages', async () => {
      await expect(client.chat([])).rejects.toThrow('cannot be empty');
    });
  });

  describe('error handling', () => {
    it('should throw LLMRateLimitError for 429', async () => {
      const apiError = new MockOpenAIAPIError(429, {}, 'Rate limited');
      mockOpenAICreate.mockRejectedValueOnce(apiError);

      await expect(client.chat([{ role: 'user', content: 'Hi' }])).rejects.toThrow(LLMRateLimitError);
    });

    it('should throw LLMTimeoutError for 408', async () => {
      const apiError = new MockOpenAIAPIError(408, {}, 'Timeout');
      mockOpenAICreate.mockRejectedValueOnce(apiError);

      await expect(client.chat([{ role: 'user', content: 'Hi' }])).rejects.toThrow(LLMTimeoutError);
    });

    it('should throw LLMError for unknown errors', async () => {
      mockOpenAICreate.mockRejectedValueOnce(new Error('Network error'));

      await expect(client.chat([{ role: 'user', content: 'Hi' }])).rejects.toThrow(LLMError);
    });
  });
});

// ============================================================================
// TogetherClient
// ============================================================================

describe('TogetherClient', () => {
  let client: TogetherClient;

  beforeEach(() => {
    jest.clearAllMocks();
    client = new TogetherClient('sk-test-key');
  });

  describe('constructor & accessors', () => {
    it('should use default model', () => {
      expect(client.getDefaultModel()).toBe('meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo');
    });

    it('should accept custom model', () => {
      const custom = new TogetherClient('sk-test', 'Qwen/Qwen2.5-72B-Instruct-Turbo');
      expect(custom.getDefaultModel()).toBe('Qwen/Qwen2.5-72B-Instruct-Turbo');
    });

    it('should return together as provider', () => {
      expect(client.getProvider()).toBe('together');
    });

    it('should throw for empty API key', () => {
      expect(() => new TogetherClient('')).toThrow('API key is required');
    });
  });

  describe('getMaxContextLength', () => {
    it('should return known model context lengths', () => {
      expect(client.getMaxContextLength('meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo')).toBe(128000);
      expect(client.getMaxContextLength('meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo')).toBe(128000);
      expect(client.getMaxContextLength('Qwen/Qwen2.5-72B-Instruct-Turbo')).toBe(32768);
    });

    it('should return default for unknown model', () => {
      expect(client.getMaxContextLength('unknown')).toBe(128000);
    });
  });

  describe('chat', () => {
    it('should call API and return result', async () => {
      mockOpenAICreate.mockResolvedValueOnce(makeOpenAIResponse({
        content: 'Hello from Together',
        model: 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo',
      }));

      const result = await client.chat([{ role: 'user', content: 'Hi' }]);

      expect(result.content).toBe('Hello from Together');
      expect(result.model).toBe('meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo');
    });

    it('should handle null content', async () => {
      mockOpenAICreate.mockResolvedValueOnce({
        choices: [{ message: { content: null }, finish_reason: 'stop' }],
        model: 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo',
        usage: { prompt_tokens: 5, completion_tokens: 0, total_tokens: 5 },
        id: 'chatcmpl-null',
        created: 1700000000,
      });

      const result = await client.chat([{ role: 'user', content: 'Hi' }]);
      expect(result.content).toBe('');
    });

    it('should validate messages', async () => {
      await expect(client.chat([])).rejects.toThrow('cannot be empty');
    });
  });

  describe('error handling', () => {
    it('should throw LLMRateLimitError for 429', async () => {
      const apiError = new MockOpenAIAPIError(429, {}, 'Rate limited');
      mockOpenAICreate.mockRejectedValueOnce(apiError);

      await expect(client.chat([{ role: 'user', content: 'Hi' }])).rejects.toThrow(LLMRateLimitError);
    });

    it('should throw LLMTimeoutError for timeout message', async () => {
      const apiError = new MockOpenAIAPIError(500, {}, 'Connection timeout');
      mockOpenAICreate.mockRejectedValueOnce(apiError);

      await expect(client.chat([{ role: 'user', content: 'Hi' }])).rejects.toThrow(LLMTimeoutError);
    });

    it('should throw LLMError for unknown errors', async () => {
      mockOpenAICreate.mockRejectedValueOnce(new Error('Network error'));

      await expect(client.chat([{ role: 'user', content: 'Hi' }])).rejects.toThrow(LLMError);
    });
  });
});

// ============================================================================
// DeepSeekClient
// ============================================================================

describe('DeepSeekClient', () => {
  let client: DeepSeekClient;

  beforeEach(() => {
    jest.clearAllMocks();
    client = new DeepSeekClient('sk-test-key');
  });

  describe('constructor & accessors', () => {
    it('should use default model', () => {
      expect(client.getDefaultModel()).toBe('deepseek-chat');
    });

    it('should accept custom model', () => {
      const custom = new DeepSeekClient('sk-test', 'deepseek-reasoner');
      expect(custom.getDefaultModel()).toBe('deepseek-reasoner');
    });

    it('should return deepseek as provider', () => {
      expect(client.getProvider()).toBe('deepseek');
    });

    it('should throw for empty API key', () => {
      expect(() => new DeepSeekClient('')).toThrow('API key is required');
    });
  });

  describe('getMaxContextLength', () => {
    it('should return known model context lengths', () => {
      expect(client.getMaxContextLength('deepseek-chat')).toBe(65536);
      expect(client.getMaxContextLength('deepseek-reasoner')).toBe(65536);
    });

    it('should return default for unknown model', () => {
      expect(client.getMaxContextLength('unknown')).toBe(65536);
    });
  });

  describe('chat', () => {
    it('should call API and return result', async () => {
      mockOpenAICreate.mockResolvedValueOnce(makeOpenAIResponse({
        content: 'Hello from DeepSeek',
        model: 'deepseek-chat',
      }));

      const result = await client.chat([{ role: 'user', content: 'Hi' }]);

      expect(result.content).toBe('Hello from DeepSeek');
      expect(result.model).toBe('deepseek-chat');
      expect(result.usage.promptTokens).toBe(10);
      expect(result.usage.completionTokens).toBe(5);
    });

    it('should pass system messages directly', async () => {
      mockOpenAICreate.mockResolvedValueOnce(makeOpenAIResponse({
        model: 'deepseek-chat',
      }));

      await client.chat([
        { role: 'system', content: 'Be concise' },
        { role: 'user', content: 'Hello' },
      ]);

      const callArgs = mockOpenAICreate.mock.calls[0][0];
      expect(callArgs.messages).toHaveLength(2);
      expect(callArgs.messages[0].role).toBe('system');
    });

    it('should validate messages', async () => {
      await expect(client.chat([])).rejects.toThrow('cannot be empty');
    });
  });

  describe('error handling', () => {
    it('should throw LLMRateLimitError for 429', async () => {
      const apiError = new MockOpenAIAPIError(429, {}, 'Rate limited');
      mockOpenAICreate.mockRejectedValueOnce(apiError);

      await expect(client.chat([{ role: 'user', content: 'Hi' }])).rejects.toThrow(LLMRateLimitError);
    });

    it('should throw LLMTimeoutError for 408', async () => {
      const apiError = new MockOpenAIAPIError(408, {}, 'Timeout');
      mockOpenAICreate.mockRejectedValueOnce(apiError);

      await expect(client.chat([{ role: 'user', content: 'Hi' }])).rejects.toThrow(LLMTimeoutError);
    });

    it('should throw retryable LLMError for server errors', async () => {
      const apiError = new MockOpenAIAPIError(500, {}, 'Internal error');
      mockOpenAICreate.mockRejectedValueOnce(apiError);

      try {
        await client.chat([{ role: 'user', content: 'Hi' }]);
      } catch (e) {
        expect(e).toBeInstanceOf(LLMError);
        expect((e as LLMError).retryable).toBe(true);
      }
    });

    it('should throw non-retryable LLMError for client errors', async () => {
      const apiError = new MockOpenAIAPIError(400, {}, 'Bad request');
      mockOpenAICreate.mockRejectedValueOnce(apiError);

      try {
        await client.chat([{ role: 'user', content: 'Hi' }]);
      } catch (e) {
        expect(e).toBeInstanceOf(LLMError);
        expect((e as LLMError).retryable).toBe(false);
      }
    });

    it('should throw LLMError for unknown errors', async () => {
      mockOpenAICreate.mockRejectedValueOnce(new Error('Network error'));

      await expect(client.chat([{ role: 'user', content: 'Hi' }])).rejects.toThrow(LLMError);
    });
  });
});

// ============================================================================
// FireworksClient
// ============================================================================

describe('FireworksClient', () => {
  let client: FireworksClient;

  beforeEach(() => {
    jest.clearAllMocks();
    client = new FireworksClient('sk-test-key');
  });

  describe('constructor & accessors', () => {
    it('should use default model', () => {
      expect(client.getDefaultModel()).toBe('accounts/fireworks/models/llama-v3p1-70b-instruct');
    });

    it('should accept custom model', () => {
      const custom = new FireworksClient('sk-test', 'accounts/fireworks/models/llama-v3p1-8b-instruct');
      expect(custom.getDefaultModel()).toBe('accounts/fireworks/models/llama-v3p1-8b-instruct');
    });

    it('should return fireworks as provider', () => {
      expect(client.getProvider()).toBe('fireworks');
    });

    it('should throw for empty API key', () => {
      expect(() => new FireworksClient('')).toThrow('API key is required');
    });
  });

  describe('getMaxContextLength', () => {
    it('should return known model context lengths', () => {
      expect(client.getMaxContextLength('accounts/fireworks/models/llama-v3p1-70b-instruct')).toBe(128000);
      expect(client.getMaxContextLength('accounts/fireworks/models/llama-v3p1-8b-instruct')).toBe(128000);
      expect(client.getMaxContextLength('accounts/fireworks/models/mixtral-8x22b-instruct')).toBe(65536);
    });

    it('should return default for unknown model', () => {
      expect(client.getMaxContextLength('unknown')).toBe(128000);
    });
  });

  describe('chat', () => {
    it('should call API and return result', async () => {
      mockOpenAICreate.mockResolvedValueOnce(makeOpenAIResponse({
        content: 'Hello from Fireworks',
        model: 'accounts/fireworks/models/llama-v3p1-70b-instruct',
      }));

      const result = await client.chat([{ role: 'user', content: 'Hi' }]);

      expect(result.content).toBe('Hello from Fireworks');
      expect(result.model).toBe('accounts/fireworks/models/llama-v3p1-70b-instruct');
    });

    it('should pass options to API', async () => {
      mockOpenAICreate.mockResolvedValueOnce(makeOpenAIResponse({
        model: 'accounts/fireworks/models/mixtral-8x22b-instruct',
      }));

      await client.chat(
        [{ role: 'user', content: 'Hi' }],
        { model: 'accounts/fireworks/models/mixtral-8x22b-instruct', temperature: 0.5, maxTokens: 100 },
      );

      const callArgs = mockOpenAICreate.mock.calls[0][0];
      expect(callArgs.model).toBe('accounts/fireworks/models/mixtral-8x22b-instruct');
      expect(callArgs.temperature).toBe(0.5);
      expect(callArgs.max_tokens).toBe(100);
    });

    it('should throw for empty response', async () => {
      mockOpenAICreate.mockResolvedValueOnce({
        choices: [],
        model: 'accounts/fireworks/models/llama-v3p1-70b-instruct',
        usage: { prompt_tokens: 5, completion_tokens: 0, total_tokens: 5 },
        id: 'chatcmpl-empty',
        created: 1700000000,
      });

      await expect(client.chat([{ role: 'user', content: 'Hi' }])).rejects.toThrow(LLMError);
    });

    it('should validate messages', async () => {
      await expect(client.chat([])).rejects.toThrow('cannot be empty');
    });
  });

  describe('error handling', () => {
    it('should throw LLMRateLimitError for 429', async () => {
      const apiError = new MockOpenAIAPIError(429, {}, 'Rate limited');
      mockOpenAICreate.mockRejectedValueOnce(apiError);

      await expect(client.chat([{ role: 'user', content: 'Hi' }])).rejects.toThrow(LLMRateLimitError);
    });

    it('should throw LLMTimeoutError for 408', async () => {
      const apiError = new MockOpenAIAPIError(408, {}, 'Timeout');
      mockOpenAICreate.mockRejectedValueOnce(apiError);

      await expect(client.chat([{ role: 'user', content: 'Hi' }])).rejects.toThrow(LLMTimeoutError);
    });

    it('should throw retryable LLMError for server errors', async () => {
      const apiError = new MockOpenAIAPIError(500, {}, 'Internal error');
      mockOpenAICreate.mockRejectedValueOnce(apiError);

      try {
        await client.chat([{ role: 'user', content: 'Hi' }]);
      } catch (e) {
        expect(e).toBeInstanceOf(LLMError);
        expect((e as LLMError).retryable).toBe(true);
      }
    });

    it('should throw LLMError for unknown errors', async () => {
      mockOpenAICreate.mockRejectedValueOnce(new Error('Network error'));

      await expect(client.chat([{ role: 'user', content: 'Hi' }])).rejects.toThrow(LLMError);
    });
  });
});

// ============================================================================
// Factory function tests (via createLLMClient)
// ============================================================================

describe('New Provider Factory Integration', () => {
  // Import after mocks are set up
  const { createLLMClient } = require('../../../../src/shared/llm/index');

  it('should create MistralClient via factory', () => {
    const client = createLLMClient('mistral', 'test-key');
    expect(client.getProvider()).toBe('mistral');
    expect(client.getDefaultModel()).toBe('mistral-large-latest');
  });

  it('should create XAIClient via factory', () => {
    const client = createLLMClient('xai', 'test-key');
    expect(client.getProvider()).toBe('xai');
    expect(client.getDefaultModel()).toBe('grok-2');
  });

  it('should create GroqClient via factory', () => {
    const client = createLLMClient('groq', 'test-key');
    expect(client.getProvider()).toBe('groq');
    expect(client.getDefaultModel()).toBe('llama-3.3-70b-versatile');
  });

  it('should create TogetherClient via factory', () => {
    const client = createLLMClient('together', 'test-key');
    expect(client.getProvider()).toBe('together');
    expect(client.getDefaultModel()).toBe('meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo');
  });

  it('should create DeepSeekClient via factory', () => {
    const client = createLLMClient('deepseek', 'test-key');
    expect(client.getProvider()).toBe('deepseek');
    expect(client.getDefaultModel()).toBe('deepseek-chat');
  });

  it('should create FireworksClient via factory', () => {
    const client = createLLMClient('fireworks', 'test-key');
    expect(client.getProvider()).toBe('fireworks');
    expect(client.getDefaultModel()).toBe('accounts/fireworks/models/llama-v3p1-70b-instruct');
  });

  it('should create clients with custom default model', () => {
    const client = createLLMClient('mistral', 'test-key', 'codestral-latest');
    expect(client.getDefaultModel()).toBe('codestral-latest');
  });
});
