/**
 * OpenAIClient Coverage Tests
 *
 * Supplements llm-api-clients.test.ts to cover:
 * - chatStream method with all chunk types
 * - Rate limit error with retry-after header
 * - Server error (5xx) retryable flag
 * - Timeout error from message content
 * - stop_sequences (stop) option
 * - stream_options usage chunks
 * - model name from stream chunks
 * - Usage with null values in response
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

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

jest.mock('@/shared/logging/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
  createAgentLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }),
}));

import { OpenAIClient } from '@/shared/llm/openai-client';
import { LLMError, LLMRateLimitError, LLMTimeoutError } from '@/shared/errors/custom-errors';

// Async iterable helper for simulating streaming
function createAsyncIterable<T>(items: T[]): AsyncIterable<T> {
  return {
    [Symbol.asyncIterator]() {
      let index = 0;
      return {
        async next() {
          if (index < items.length) {
            return { done: false, value: items[index++] };
          }
          return { done: true, value: undefined as any };
        },
      };
    },
  };
}

describe('OpenAIClient - Coverage Supplement', () => {
  let client: OpenAIClient;

  beforeEach(() => {
    jest.clearAllMocks();
    client = new OpenAIClient('sk-test-key');
  });

  // =========================================================================
  // chatStream
  // =========================================================================

  describe('chatStream', () => {
    it('should stream content and return accumulated result', async () => {
      const chunks = [
        {
          choices: [{ delta: { content: 'Hello ' }, finish_reason: null }],
          model: 'gpt-4o',
          usage: null,
        },
        {
          choices: [{ delta: { content: 'world' }, finish_reason: null }],
          model: 'gpt-4o',
          usage: null,
        },
        {
          choices: [{ delta: {}, finish_reason: 'stop' }],
          model: 'gpt-4o',
          usage: null,
        },
        {
          choices: [],
          model: 'gpt-4o',
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        },
      ];

      mockOpenAICreate.mockResolvedValueOnce(createAsyncIterable(chunks));

      const callbackChunks: any[] = [];
      const callback = jest.fn(async (chunk: any) => {
        callbackChunks.push(chunk);
      });

      const result = await client.chatStream(
        [{ role: 'user', content: 'Hi' }],
        callback,
      );

      expect(result.content).toBe('Hello world');
      expect(result.model).toBe('gpt-4o');
      expect(result.usage.promptTokens).toBe(10);
      expect(result.usage.completionTokens).toBe(5);
      expect(result.usage.totalTokens).toBe(15);
      expect(result.finishReason).toBe('stop');

      // 2 text callbacks + 1 final completion callback
      expect(callback).toHaveBeenCalledTimes(3);
      expect(callbackChunks[0].content).toBe('Hello ');
      expect(callbackChunks[0].isComplete).toBe(false);
      expect(callbackChunks[2].isComplete).toBe(true);
    });

    it('should pass options to stream API call', async () => {
      const chunks = [
        {
          choices: [{ delta: { content: 'ok' }, finish_reason: 'stop' }],
          model: 'gpt-4-turbo',
          usage: { prompt_tokens: 5, completion_tokens: 1, total_tokens: 6 },
        },
      ];

      mockOpenAICreate.mockResolvedValueOnce(createAsyncIterable(chunks));

      const callback = jest.fn();
      await client.chatStream(
        [{ role: 'user', content: 'Hi' }],
        callback,
        {
          model: 'gpt-4-turbo',
          temperature: 0.3,
          maxTokens: 500,
          topP: 0.8,
          stopSequences: ['END'],
        },
      );

      const callArgs = mockOpenAICreate.mock.calls[0][0];
      expect(callArgs.model).toBe('gpt-4-turbo');
      expect(callArgs.temperature).toBe(0.3);
      expect(callArgs.max_tokens).toBe(500);
      expect(callArgs.top_p).toBe(0.8);
      expect(callArgs.stop).toEqual(['END']);
      expect(callArgs.stream).toBe(true);
      expect(callArgs.stream_options).toEqual({ include_usage: true });
    });

    it('should handle chunks without delta content', async () => {
      const chunks = [
        {
          choices: [{ delta: { role: 'assistant' }, finish_reason: null }],
          model: 'gpt-4o',
          usage: null,
        },
        {
          choices: [{ delta: { content: 'Hello' }, finish_reason: null }],
          model: 'gpt-4o',
          usage: null,
        },
        {
          choices: [{ delta: {}, finish_reason: 'stop' }],
          model: 'gpt-4o',
          usage: { prompt_tokens: 5, completion_tokens: 2, total_tokens: 7 },
        },
      ];

      mockOpenAICreate.mockResolvedValueOnce(createAsyncIterable(chunks));

      const callback = jest.fn();
      const result = await client.chatStream(
        [{ role: 'user', content: 'Hi' }],
        callback,
      );

      expect(result.content).toBe('Hello');
    });

    it('should handle stream with empty choices array', async () => {
      const chunks = [
        { choices: [], model: 'gpt-4o', usage: null },
        {
          choices: [{ delta: { content: 'ok' }, finish_reason: 'stop' }],
          model: 'gpt-4o',
          usage: { prompt_tokens: 3, completion_tokens: 1, total_tokens: 4 },
        },
      ];

      mockOpenAICreate.mockResolvedValueOnce(createAsyncIterable(chunks));

      const callback = jest.fn();
      const result = await client.chatStream(
        [{ role: 'user', content: 'Hi' }],
        callback,
      );

      expect(result.content).toBe('ok');
    });

    it('should throw error for empty messages in stream', async () => {
      const callback = jest.fn();
      await expect(client.chatStream([], callback)).rejects.toThrow('cannot be empty');
    });

    it('should handle stream API errors', async () => {
      const apiError = new MockOpenAIAPIError(429, {}, 'Rate limited');
      mockOpenAICreate.mockRejectedValueOnce(apiError);

      const callback = jest.fn();
      await expect(
        client.chatStream([{ role: 'user', content: 'Hi' }], callback),
      ).rejects.toThrow(LLMRateLimitError);
    });

    it('should update model name from stream chunks', async () => {
      const chunks = [
        {
          choices: [{ delta: { content: 'ok' }, finish_reason: 'stop' }],
          model: 'gpt-4o-2025-01-01',
          usage: { prompt_tokens: 3, completion_tokens: 1, total_tokens: 4 },
        },
      ];

      mockOpenAICreate.mockResolvedValueOnce(createAsyncIterable(chunks));

      const callback = jest.fn();
      const result = await client.chatStream(
        [{ role: 'user', content: 'Hi' }],
        callback,
      );

      expect(result.model).toBe('gpt-4o-2025-01-01');
    });
  });

  // =========================================================================
  // Error handling details
  // =========================================================================

  describe('error handling - additional coverage', () => {
    it('should include retry-after header in rate limit error', async () => {
      const apiError = new MockOpenAIAPIError(
        429,
        {},
        'Rate limited',
        { 'retry-after': '60' },
      );
      mockOpenAICreate.mockRejectedValueOnce(apiError);

      try {
        await client.chat([{ role: 'user', content: 'Hi' }]);
      } catch (e) {
        expect(e).toBeInstanceOf(LLMRateLimitError);
        expect((e as LLMRateLimitError).retryAfter).toBe(60000);
      }
    });

    it('should handle rate limit without retry-after header', async () => {
      const apiError = new MockOpenAIAPIError(429, {}, 'Rate limited');
      mockOpenAICreate.mockRejectedValueOnce(apiError);

      try {
        await client.chat([{ role: 'user', content: 'Hi' }]);
      } catch (e) {
        expect(e).toBeInstanceOf(LLMRateLimitError);
        expect((e as LLMRateLimitError).retryAfter).toBeUndefined();
      }
    });

    it('should mark 500+ errors as retryable', async () => {
      const apiError = new MockOpenAIAPIError(502, {}, 'Bad Gateway');
      mockOpenAICreate.mockRejectedValueOnce(apiError);

      try {
        await client.chat([{ role: 'user', content: 'Hi' }]);
      } catch (e) {
        expect(e).toBeInstanceOf(LLMError);
        expect((e as LLMError).retryable).toBe(true);
      }
    });

    it('should mark 4xx client errors as non-retryable', async () => {
      const apiError = new MockOpenAIAPIError(401, {}, 'Unauthorized');
      mockOpenAICreate.mockRejectedValueOnce(apiError);

      try {
        await client.chat([{ role: 'user', content: 'Hi' }]);
      } catch (e) {
        expect(e).toBeInstanceOf(LLMError);
        expect((e as LLMError).retryable).toBe(false);
      }
    });

    it('should handle timeout-like message in error', async () => {
      const apiError = new MockOpenAIAPIError(500, {}, 'Request timeout reached');
      mockOpenAICreate.mockRejectedValueOnce(apiError);

      await expect(
        client.chat([{ role: 'user', content: 'Hi' }]),
      ).rejects.toThrow(LLMTimeoutError);
    });

    it('should handle non-Error thrown values', async () => {
      mockOpenAICreate.mockRejectedValueOnce('string error');

      try {
        await client.chat([{ role: 'user', content: 'Hi' }]);
      } catch (e) {
        expect(e).toBeInstanceOf(LLMError);
        expect((e as LLMError).message).toContain('Unexpected error');
      }
    });

    it('should include type and code in error context', async () => {
      const apiError = new MockOpenAIAPIError(400, {}, 'Bad request');
      apiError.type = 'invalid_request_error';
      apiError.code = 'invalid_api_key';
      mockOpenAICreate.mockRejectedValueOnce(apiError);

      try {
        await client.chat([{ role: 'user', content: 'Hi' }]);
      } catch (e) {
        expect(e).toBeInstanceOf(LLMError);
        expect((e as LLMError).context?.type).toBe('invalid_request_error');
        expect((e as LLMError).context?.code).toBe('invalid_api_key');
      }
    });
  });

  // =========================================================================
  // Chat - edge cases
  // =========================================================================

  describe('chat - edge cases', () => {
    it('should handle missing usage in response', async () => {
      mockOpenAICreate.mockResolvedValueOnce({
        choices: [{ message: { content: 'ok' }, finish_reason: 'stop' }],
        model: 'gpt-4o',
        usage: null,
        id: 'chatcmpl-no-usage',
        created: 1700000000,
      });

      const result = await client.chat([{ role: 'user', content: 'Hi' }]);
      expect(result.usage.promptTokens).toBe(0);
      expect(result.usage.completionTokens).toBe(0);
      expect(result.usage.totalTokens).toBe(0);
    });

    it('should handle null finish_reason', async () => {
      mockOpenAICreate.mockResolvedValueOnce({
        choices: [{ message: { content: 'ok' }, finish_reason: null }],
        model: 'gpt-4o',
        usage: { prompt_tokens: 3, completion_tokens: 1, total_tokens: 4 },
        id: 'chatcmpl-null-fr',
        created: 1700000000,
      });

      const result = await client.chat([{ role: 'user', content: 'Hi' }]);
      expect(result.finishReason).toBe('stop');
    });

    it('should pass stopSequences as stop parameter', async () => {
      mockOpenAICreate.mockResolvedValueOnce({
        choices: [{ message: { content: 'ok' }, finish_reason: 'stop' }],
        model: 'gpt-4o',
        usage: { prompt_tokens: 3, completion_tokens: 1, total_tokens: 4 },
        id: 'chatcmpl-stop',
        created: 1700000000,
      });

      await client.chat(
        [{ role: 'user', content: 'Hi' }],
        { stopSequences: ['STOP', 'END'] },
      );

      const callArgs = mockOpenAICreate.mock.calls[0][0];
      expect(callArgs.stop).toEqual(['STOP', 'END']);
    });
  });

  // =========================================================================
  // Message validation
  // =========================================================================

  describe('message validation', () => {
    it('should reject messages with invalid role', async () => {
      await expect(
        client.chat([{ role: 'invalid' as any, content: 'Hi' }]),
      ).rejects.toThrow('Invalid message role');
    });

    it('should reject messages with non-string content', async () => {
      await expect(
        client.chat([{ role: 'user', content: 123 as any }]),
      ).rejects.toThrow('Message content must be a string');
    });
  });

  // =========================================================================
  // Constructor
  // =========================================================================

  describe('constructor', () => {
    it('should throw when API key is empty', () => {
      expect(() => new OpenAIClient('')).toThrow('API key is required');
    });

    it('should use default model gpt-4o', () => {
      expect(client.getDefaultModel()).toBe('gpt-4o');
    });

    it('should return openai as provider', () => {
      expect(client.getProvider()).toBe('openai');
    });
  });
});
