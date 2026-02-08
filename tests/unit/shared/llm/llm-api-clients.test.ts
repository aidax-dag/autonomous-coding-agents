/**
 * LLM API Client Tests (Claude, OpenAI, Gemini)
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

// ============================================================================
// Mock SDK modules
// ============================================================================

const mockAnthropicCreate = jest.fn();

class MockAnthropicAPIError extends Error {
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

jest.mock('@anthropic-ai/sdk', () => {
  const Mock = jest.fn().mockImplementation(() => ({
    messages: { create: mockAnthropicCreate },
  }));
  (Mock as any).APIError = MockAnthropicAPIError;
  return { __esModule: true, default: Mock };
});

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

const mockGeminiSendMessage = jest.fn();
const mockGeminiStartChat = jest.fn().mockReturnValue({
  sendMessage: mockGeminiSendMessage,
});
const mockGeminiGetGenerativeModel = jest.fn().mockReturnValue({
  startChat: mockGeminiStartChat,
});

jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: mockGeminiGetGenerativeModel,
  })),
}));

// ============================================================================
// Imports (after mocks)
// ============================================================================

import { ClaudeClient } from '../../../../src/shared/llm/claude-client';
import { OpenAIClient } from '../../../../src/shared/llm/openai-client';
import { GeminiClient } from '../../../../src/shared/llm/gemini-client';
import { LLMError, LLMRateLimitError, LLMTimeoutError } from '../../../../src/shared/errors/custom-errors';

// ============================================================================
// ClaudeClient
// ============================================================================

describe('ClaudeClient', () => {
  let client: ClaudeClient;

  beforeEach(() => {
    jest.clearAllMocks();
    client = new ClaudeClient('sk-test-key');
  });

  describe('constructor & accessors', () => {
    it('should use default model', () => {
      expect(client.getDefaultModel()).toBe('claude-3-5-sonnet-20241022');
    });

    it('should accept custom model', () => {
      const custom = new ClaudeClient('sk-test', 'claude-3-opus-20240229');
      expect(custom.getDefaultModel()).toBe('claude-3-opus-20240229');
    });

    it('should return claude as provider', () => {
      expect(client.getProvider()).toBe('claude');
    });
  });

  describe('getMaxContextLength', () => {
    it('should return known model context length', () => {
      expect(client.getMaxContextLength('claude-3-5-sonnet-20241022')).toBe(200000);
      expect(client.getMaxContextLength('claude-3-opus-20240229')).toBe(200000);
      expect(client.getMaxContextLength('claude-3-haiku-20240307')).toBe(200000);
    });

    it('should return default for unknown model', () => {
      expect(client.getMaxContextLength('unknown-model')).toBe(200000);
    });

    it('should use default model when no model specified', () => {
      expect(client.getMaxContextLength()).toBe(200000);
    });
  });

  describe('chat', () => {
    it('should call API and return result', async () => {
      mockAnthropicCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'Hello world' }],
        model: 'claude-3-5-sonnet-20241022',
        usage: { input_tokens: 10, output_tokens: 5 },
        stop_reason: 'end_turn',
        id: 'msg-123',
        type: 'message',
      });

      const result = await client.chat([{ role: 'user', content: 'Hi' }]);

      expect(result.content).toBe('Hello world');
      expect(result.model).toBe('claude-3-5-sonnet-20241022');
      expect(result.usage.promptTokens).toBe(10);
      expect(result.usage.completionTokens).toBe(5);
      expect(result.usage.totalTokens).toBe(15);
      expect(result.metadata?.id).toBe('msg-123');
    });

    it('should separate system messages', async () => {
      mockAnthropicCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'ok' }],
        model: 'claude-3-5-sonnet-20241022',
        usage: { input_tokens: 5, output_tokens: 2 },
        stop_reason: 'stop',
        id: 'msg-456',
        type: 'message',
      });

      await client.chat([
        { role: 'system', content: 'Be helpful' },
        { role: 'user', content: 'Hello' },
      ]);

      const callArgs = mockAnthropicCreate.mock.calls[0][0];
      expect(callArgs.system).toBe('Be helpful');
      expect(callArgs.messages).toEqual([{ role: 'user', content: 'Hello' }]);
    });

    it('should join multiple system messages', async () => {
      mockAnthropicCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'ok' }],
        model: 'claude-3-5-sonnet-20241022',
        usage: { input_tokens: 5, output_tokens: 2 },
        stop_reason: 'stop',
        id: 'msg-789',
        type: 'message',
      });

      await client.chat([
        { role: 'system', content: 'Rule A' },
        { role: 'system', content: 'Rule B' },
        { role: 'user', content: 'Go' },
      ]);

      const callArgs = mockAnthropicCreate.mock.calls[0][0];
      expect(callArgs.system).toBe('Rule A\n\nRule B');
    });

    it('should pass options to API', async () => {
      mockAnthropicCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'ok' }],
        model: 'custom-model',
        usage: { input_tokens: 5, output_tokens: 2 },
        stop_reason: 'stop',
        id: 'msg-opt',
        type: 'message',
      });

      await client.chat(
        [{ role: 'user', content: 'Hi' }],
        { model: 'custom-model', temperature: 0.5, maxTokens: 100, topP: 0.9 },
      );

      const callArgs = mockAnthropicCreate.mock.calls[0][0];
      expect(callArgs.model).toBe('custom-model');
      expect(callArgs.temperature).toBe(0.5);
      expect(callArgs.max_tokens).toBe(100);
      expect(callArgs.top_p).toBe(0.9);
    });

    it('should default max_tokens to 4096', async () => {
      mockAnthropicCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'ok' }],
        model: 'claude-3-5-sonnet-20241022',
        usage: { input_tokens: 5, output_tokens: 2 },
        stop_reason: 'stop',
        id: 'msg-def',
        type: 'message',
      });

      await client.chat([{ role: 'user', content: 'Hi' }]);

      const callArgs = mockAnthropicCreate.mock.calls[0][0];
      expect(callArgs.max_tokens).toBe(4096);
    });

    it('should use stop_reason as finishReason', async () => {
      mockAnthropicCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'ok' }],
        model: 'claude-3-5-sonnet-20241022',
        usage: { input_tokens: 5, output_tokens: 2 },
        stop_reason: null,
        id: 'msg-sr',
        type: 'message',
      });

      const result = await client.chat([{ role: 'user', content: 'Hi' }]);
      expect(result.finishReason).toBe('stop'); // null → 'stop' fallback
    });
  });

  describe('error handling', () => {
    it('should throw LLMRateLimitError for 429', async () => {
      const apiError = new MockAnthropicAPIError(429, {}, 'Rate limited');
      mockAnthropicCreate.mockRejectedValueOnce(apiError);

      await expect(client.chat([{ role: 'user', content: 'Hi' }])).rejects.toThrow(LLMRateLimitError);
    });

    it('should throw LLMTimeoutError for 408', async () => {
      const apiError = new MockAnthropicAPIError(408, {}, 'Request timeout');
      mockAnthropicCreate.mockRejectedValueOnce(apiError);

      await expect(client.chat([{ role: 'user', content: 'Hi' }])).rejects.toThrow(LLMTimeoutError);
    });

    it('should throw LLMTimeoutError for timeout message', async () => {
      const apiError = new MockAnthropicAPIError(500, {}, 'Connection timeout');
      mockAnthropicCreate.mockRejectedValueOnce(apiError);

      await expect(client.chat([{ role: 'user', content: 'Hi' }])).rejects.toThrow(LLMTimeoutError);
    });

    it('should throw LLMError for other API errors', async () => {
      const apiError = new MockAnthropicAPIError(400, {}, 'Bad request');
      mockAnthropicCreate.mockRejectedValueOnce(apiError);

      await expect(client.chat([{ role: 'user', content: 'Hi' }])).rejects.toThrow(LLMError);
    });

    it('should throw LLMError for unknown errors', async () => {
      mockAnthropicCreate.mockRejectedValueOnce(new Error('Network failure'));

      await expect(client.chat([{ role: 'user', content: 'Hi' }])).rejects.toThrow(LLMError);
    });

    it('should validate messages', async () => {
      await expect(client.chat([])).rejects.toThrow('cannot be empty');
    });
  });
});

// ============================================================================
// OpenAIClient
// ============================================================================

describe('OpenAIClient', () => {
  let client: OpenAIClient;

  beforeEach(() => {
    jest.clearAllMocks();
    client = new OpenAIClient('sk-test-key');
  });

  describe('constructor & accessors', () => {
    it('should use default model', () => {
      expect(client.getDefaultModel()).toBe('gpt-4o');
    });

    it('should accept custom model', () => {
      const custom = new OpenAIClient('sk-test', 'gpt-4-turbo');
      expect(custom.getDefaultModel()).toBe('gpt-4-turbo');
    });

    it('should return openai as provider', () => {
      expect(client.getProvider()).toBe('openai');
    });
  });

  describe('getMaxContextLength', () => {
    it('should return known model context lengths', () => {
      expect(client.getMaxContextLength('gpt-4o')).toBe(128000);
      expect(client.getMaxContextLength('gpt-4')).toBe(8192);
      expect(client.getMaxContextLength('gpt-4-32k')).toBe(32768);
      expect(client.getMaxContextLength('gpt-3.5-turbo')).toBe(16385);
    });

    it('should return default for unknown model', () => {
      expect(client.getMaxContextLength('unknown')).toBe(128000);
    });
  });

  describe('chat', () => {
    it('should call API and return result', async () => {
      mockOpenAICreate.mockResolvedValueOnce({
        choices: [{
          message: { content: 'Hello from GPT' },
          finish_reason: 'stop',
        }],
        model: 'gpt-4o',
        usage: { prompt_tokens: 8, completion_tokens: 4, total_tokens: 12 },
        id: 'chatcmpl-123',
        created: 1700000000,
        system_fingerprint: 'fp_abc',
      });

      const result = await client.chat([{ role: 'user', content: 'Hi' }]);

      expect(result.content).toBe('Hello from GPT');
      expect(result.model).toBe('gpt-4o');
      expect(result.usage.promptTokens).toBe(8);
      expect(result.usage.completionTokens).toBe(4);
      expect(result.usage.totalTokens).toBe(12);
      expect(result.finishReason).toBe('stop');
      expect(result.metadata?.id).toBe('chatcmpl-123');
    });

    it('should pass messages directly (including system)', async () => {
      mockOpenAICreate.mockResolvedValueOnce({
        choices: [{ message: { content: 'ok' }, finish_reason: 'stop' }],
        model: 'gpt-4o',
        usage: { prompt_tokens: 5, completion_tokens: 1, total_tokens: 6 },
        id: 'chatcmpl-456',
        created: 1700000000,
      });

      await client.chat([
        { role: 'system', content: 'Be concise' },
        { role: 'user', content: 'Hello' },
      ]);

      const callArgs = mockOpenAICreate.mock.calls[0][0];
      expect(callArgs.messages).toHaveLength(2);
      expect(callArgs.messages[0].role).toBe('system');
      expect(callArgs.stream).toBe(false);
    });

    it('should pass options', async () => {
      mockOpenAICreate.mockResolvedValueOnce({
        choices: [{ message: { content: 'ok' }, finish_reason: 'stop' }],
        model: 'gpt-4-turbo',
        usage: { prompt_tokens: 5, completion_tokens: 1, total_tokens: 6 },
        id: 'chatcmpl-789',
        created: 1700000000,
      });

      await client.chat(
        [{ role: 'user', content: 'Hi' }],
        { model: 'gpt-4-turbo', temperature: 0.7, maxTokens: 200 },
      );

      const callArgs = mockOpenAICreate.mock.calls[0][0];
      expect(callArgs.model).toBe('gpt-4-turbo');
      expect(callArgs.temperature).toBe(0.7);
      expect(callArgs.max_tokens).toBe(200);
    });

    it('should throw for empty response', async () => {
      mockOpenAICreate.mockResolvedValueOnce({
        choices: [],
        model: 'gpt-4o',
        usage: { prompt_tokens: 5, completion_tokens: 0, total_tokens: 5 },
        id: 'chatcmpl-empty',
        created: 1700000000,
      });

      await expect(client.chat([{ role: 'user', content: 'Hi' }])).rejects.toThrow(LLMError);
    });

    it('should handle null content', async () => {
      mockOpenAICreate.mockResolvedValueOnce({
        choices: [{ message: { content: null }, finish_reason: 'stop' }],
        model: 'gpt-4o',
        usage: { prompt_tokens: 5, completion_tokens: 0, total_tokens: 5 },
        id: 'chatcmpl-null',
        created: 1700000000,
      });

      const result = await client.chat([{ role: 'user', content: 'Hi' }]);
      expect(result.content).toBe('');
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

    it('should throw LLMError for server errors (retryable)', async () => {
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
// GeminiClient
// ============================================================================

describe('GeminiClient', () => {
  let client: GeminiClient;

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset mock implementations after clearAllMocks
    mockGeminiGetGenerativeModel.mockReturnValue({
      startChat: mockGeminiStartChat,
    });
    mockGeminiStartChat.mockReturnValue({
      sendMessage: mockGeminiSendMessage,
    });
    client = new GeminiClient('test-api-key');
  });

  describe('constructor & accessors', () => {
    it('should use default model', () => {
      expect(client.getDefaultModel()).toBe('gemini-2.0-flash');
    });

    it('should accept custom model', () => {
      const custom = new GeminiClient('key', 'gemini-1.5-pro');
      expect(custom.getDefaultModel()).toBe('gemini-1.5-pro');
    });

    it('should return gemini as provider', () => {
      expect(client.getProvider()).toBe('gemini');
    });
  });

  describe('getMaxContextLength', () => {
    it('should return known model context lengths', () => {
      expect(client.getMaxContextLength('gemini-2.0-flash')).toBe(1048576);
      expect(client.getMaxContextLength('gemini-1.5-pro')).toBe(2097152);
      expect(client.getMaxContextLength('gemini-1.0-pro')).toBe(32768);
    });

    it('should return default for unknown model', () => {
      expect(client.getMaxContextLength('unknown')).toBe(1048576);
    });
  });

  describe('chat', () => {
    it('should call API and return result', async () => {
      mockGeminiSendMessage.mockResolvedValueOnce({
        response: {
          text: () => 'Hello from Gemini',
          usageMetadata: {
            promptTokenCount: 12,
            candidatesTokenCount: 6,
            totalTokenCount: 18,
          },
          candidates: [{ finishReason: 'STOP' }],
        },
      });

      const result = await client.chat([{ role: 'user', content: 'Hi' }]);

      expect(result.content).toBe('Hello from Gemini');
      expect(result.model).toBe('gemini-2.0-flash');
      expect(result.usage.promptTokens).toBe(12);
      expect(result.usage.completionTokens).toBe(6);
      expect(result.usage.totalTokens).toBe(18);
    });

    it('should extract system instruction from system messages', async () => {
      mockGeminiSendMessage.mockResolvedValueOnce({
        response: {
          text: () => 'ok',
          usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 1, totalTokenCount: 6 },
          candidates: [{ finishReason: 'STOP' }],
        },
      });

      await client.chat([
        { role: 'system', content: 'You are helpful' },
        { role: 'user', content: 'Hello' },
      ]);

      // startChat should have been called with systemInstruction
      const chatArgs = mockGeminiStartChat.mock.calls[0][0];
      expect(chatArgs.systemInstruction).toBeDefined();
      expect(chatArgs.systemInstruction.parts[0].text).toBe('You are helpful');
    });

    it('should pass generation config via getGenerativeModel', async () => {
      mockGeminiSendMessage.mockResolvedValueOnce({
        response: {
          text: () => 'ok',
          usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 1, totalTokenCount: 6 },
          candidates: [{ finishReason: 'STOP' }],
        },
      });

      await client.chat(
        [{ role: 'user', content: 'Hi' }],
        { temperature: 0.5, maxTokens: 100 },
      );

      const modelArgs = mockGeminiGetGenerativeModel.mock.calls[0][0];
      expect(modelArgs.generationConfig.temperature).toBe(0.5);
      expect(modelArgs.generationConfig.maxOutputTokens).toBe(100);
    });

    it('should convert assistant role to model role for history', async () => {
      mockGeminiSendMessage.mockResolvedValueOnce({
        response: {
          text: () => 'continuing',
          usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 3, totalTokenCount: 13 },
          candidates: [{ finishReason: 'STOP' }],
        },
      });

      await client.chat([
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there' },
        { role: 'user', content: 'Continue' },
      ]);

      const chatArgs = mockGeminiStartChat.mock.calls[0][0];
      expect(chatArgs.history[0].role).toBe('user');
      expect(chatArgs.history[1].role).toBe('model'); // assistant → model
    });
  });

  describe('error handling', () => {
    it('should throw LLMRateLimitError for rate limit messages', async () => {
      mockGeminiSendMessage.mockRejectedValueOnce(new Error('429 quota exceeded'));

      await expect(client.chat([{ role: 'user', content: 'Hi' }])).rejects.toThrow(LLMRateLimitError);
    });

    it('should throw LLMRateLimitError for quota messages', async () => {
      mockGeminiSendMessage.mockRejectedValueOnce(new Error('Resource quota exhausted'));

      await expect(client.chat([{ role: 'user', content: 'Hi' }])).rejects.toThrow(LLMRateLimitError);
    });

    it('should throw LLMTimeoutError for timeout messages', async () => {
      mockGeminiSendMessage.mockRejectedValueOnce(new Error('Request timeout'));

      await expect(client.chat([{ role: 'user', content: 'Hi' }])).rejects.toThrow(LLMTimeoutError);
    });

    it('should throw retryable LLMError for server errors', async () => {
      mockGeminiSendMessage.mockRejectedValueOnce(new Error('500 server error'));

      try {
        await client.chat([{ role: 'user', content: 'Hi' }]);
      } catch (e) {
        expect(e).toBeInstanceOf(LLMError);
        expect((e as LLMError).retryable).toBe(true);
      }
    });

    it('should throw non-retryable LLMError for other errors', async () => {
      mockGeminiSendMessage.mockRejectedValueOnce(new Error('Invalid API key'));

      try {
        await client.chat([{ role: 'user', content: 'Hi' }]);
      } catch (e) {
        expect(e).toBeInstanceOf(LLMError);
        expect((e as LLMError).retryable).toBe(false);
      }
    });

    it('should handle non-Error thrown values', async () => {
      mockGeminiSendMessage.mockRejectedValueOnce('string error');

      await expect(client.chat([{ role: 'user', content: 'Hi' }])).rejects.toThrow(LLMError);
    });
  });
});
