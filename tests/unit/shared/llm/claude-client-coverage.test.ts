/**
 * ClaudeClient Coverage Tests
 *
 * Supplements llm-api-clients.test.ts to cover:
 * - chatStream method with all event types
 * - Rate limit error with retry-after header
 * - Server error (5xx) retryable flag
 * - Client error (4xx, non-429, non-408) non-retryable
 * - Timeout error from message content
 * - Unknown (non-APIError) errors
 * - stop_sequences option
 * - Multiple text blocks in response
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

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

import { ClaudeClient } from '@/shared/llm/claude-client';
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

describe('ClaudeClient - Coverage Supplement', () => {
  let client: ClaudeClient;

  beforeEach(() => {
    jest.clearAllMocks();
    client = new ClaudeClient('sk-test-key');
  });

  // =========================================================================
  // chatStream
  // =========================================================================

  describe('chatStream', () => {
    it('should stream content and return accumulated result', async () => {
      const events = [
        {
          type: 'message_start',
          message: {
            model: 'claude-3-5-sonnet-20241022',
            usage: { input_tokens: 10 },
          },
        },
        {
          type: 'content_block_delta',
          delta: { type: 'text_delta', text: 'Hello ' },
        },
        {
          type: 'content_block_delta',
          delta: { type: 'text_delta', text: 'world' },
        },
        {
          type: 'message_delta',
          delta: { stop_reason: 'end_turn' },
          usage: { output_tokens: 5 },
        },
      ];

      mockAnthropicCreate.mockResolvedValueOnce(createAsyncIterable(events));

      const chunks: any[] = [];
      const callback = jest.fn(async (chunk: any) => {
        chunks.push(chunk);
      });

      const result = await client.chatStream(
        [{ role: 'user', content: 'Hi' }],
        callback,
      );

      expect(result.content).toBe('Hello world');
      expect(result.model).toBe('claude-3-5-sonnet-20241022');
      expect(result.usage.promptTokens).toBe(10);
      expect(result.usage.completionTokens).toBe(5);
      expect(result.usage.totalTokens).toBe(15);
      expect(result.finishReason).toBe('end_turn');

      // Callback should have been called with intermediate chunks + final
      expect(callback).toHaveBeenCalledTimes(3); // 2 text chunks + 1 completion
      expect(chunks[0].content).toBe('Hello ');
      expect(chunks[0].isComplete).toBe(false);
      expect(chunks[2].isComplete).toBe(true);
    });

    it('should handle stream with no stop_reason (defaults to stop)', async () => {
      const events = [
        {
          type: 'message_start',
          message: {
            model: 'claude-3-5-sonnet-20241022',
            usage: { input_tokens: 5 },
          },
        },
        {
          type: 'content_block_delta',
          delta: { type: 'text_delta', text: 'Reply' },
        },
        {
          type: 'message_delta',
          delta: { stop_reason: null },
          usage: { output_tokens: 2 },
        },
      ];

      mockAnthropicCreate.mockResolvedValueOnce(createAsyncIterable(events));

      const callback = jest.fn();
      const result = await client.chatStream(
        [{ role: 'user', content: 'Hi' }],
        callback,
      );

      expect(result.finishReason).toBe('stop');
    });

    it('should pass options to stream API call', async () => {
      const events = [
        {
          type: 'message_start',
          message: { model: 'custom-model', usage: { input_tokens: 5 } },
        },
        {
          type: 'message_delta',
          delta: { stop_reason: 'stop' },
          usage: { output_tokens: 2 },
        },
      ];

      mockAnthropicCreate.mockResolvedValueOnce(createAsyncIterable(events));

      const callback = jest.fn();
      await client.chatStream(
        [{ role: 'user', content: 'Hi' }],
        callback,
        {
          model: 'custom-model',
          temperature: 0.3,
          maxTokens: 500,
          topP: 0.8,
          stopSequences: ['END'],
        },
      );

      const callArgs = mockAnthropicCreate.mock.calls[0][0];
      expect(callArgs.model).toBe('custom-model');
      expect(callArgs.temperature).toBe(0.3);
      expect(callArgs.max_tokens).toBe(500);
      expect(callArgs.top_p).toBe(0.8);
      expect(callArgs.stop_sequences).toEqual(['END']);
      expect(callArgs.stream).toBe(true);
    });

    it('should handle non-text_delta events gracefully', async () => {
      const events = [
        {
          type: 'message_start',
          message: { model: 'claude-3-5-sonnet-20241022', usage: { input_tokens: 5 } },
        },
        {
          type: 'content_block_delta',
          delta: { type: 'input_json_delta', partial_json: '{}' },
        },
        {
          type: 'content_block_delta',
          delta: { type: 'text_delta', text: 'Hello' },
        },
        {
          type: 'message_delta',
          delta: { stop_reason: 'stop' },
          usage: { output_tokens: 3 },
        },
      ];

      mockAnthropicCreate.mockResolvedValueOnce(createAsyncIterable(events));

      const callback = jest.fn();
      const result = await client.chatStream(
        [{ role: 'user', content: 'Hi' }],
        callback,
      );

      // Only 'Hello' text delta should be captured
      expect(result.content).toBe('Hello');
    });

    it('should separate system messages in streaming mode', async () => {
      const events = [
        {
          type: 'message_start',
          message: { model: 'claude-3-5-sonnet-20241022', usage: { input_tokens: 8 } },
        },
        {
          type: 'message_delta',
          delta: { stop_reason: 'stop' },
          usage: { output_tokens: 1 },
        },
      ];

      mockAnthropicCreate.mockResolvedValueOnce(createAsyncIterable(events));

      const callback = jest.fn();
      await client.chatStream(
        [
          { role: 'system', content: 'Be concise' },
          { role: 'user', content: 'Hello' },
        ],
        callback,
      );

      const callArgs = mockAnthropicCreate.mock.calls[0][0];
      expect(callArgs.system).toBe('Be concise');
      expect(callArgs.messages).toEqual([{ role: 'user', content: 'Hello' }]);
    });

    it('should throw error for empty messages in stream', async () => {
      const callback = jest.fn();
      await expect(client.chatStream([], callback)).rejects.toThrow('cannot be empty');
    });

    it('should handle stream API errors', async () => {
      const apiError = new MockAnthropicAPIError(429, {}, 'Rate limited');
      mockAnthropicCreate.mockRejectedValueOnce(apiError);

      const callback = jest.fn();
      await expect(
        client.chatStream([{ role: 'user', content: 'Hi' }], callback),
      ).rejects.toThrow(LLMRateLimitError);
    });
  });

  // =========================================================================
  // Error handling details
  // =========================================================================

  describe('error handling - additional coverage', () => {
    it('should include retry-after header in rate limit error', async () => {
      const apiError = new MockAnthropicAPIError(
        429,
        {},
        'Rate limited',
        { 'retry-after': '30' },
      );
      mockAnthropicCreate.mockRejectedValueOnce(apiError);

      try {
        await client.chat([{ role: 'user', content: 'Hi' }]);
      } catch (e) {
        expect(e).toBeInstanceOf(LLMRateLimitError);
        expect((e as LLMRateLimitError).retryAfter).toBe(30000);
      }
    });

    it('should handle rate limit without retry-after header', async () => {
      const apiError = new MockAnthropicAPIError(429, {}, 'Rate limited');
      mockAnthropicCreate.mockRejectedValueOnce(apiError);

      try {
        await client.chat([{ role: 'user', content: 'Hi' }]);
      } catch (e) {
        expect(e).toBeInstanceOf(LLMRateLimitError);
        expect((e as LLMRateLimitError).retryAfter).toBeUndefined();
      }
    });

    it('should mark 500+ errors as retryable', async () => {
      const apiError = new MockAnthropicAPIError(503, {}, 'Service unavailable');
      mockAnthropicCreate.mockRejectedValueOnce(apiError);

      try {
        await client.chat([{ role: 'user', content: 'Hi' }]);
      } catch (e) {
        expect(e).toBeInstanceOf(LLMError);
        expect((e as LLMError).retryable).toBe(true);
      }
    });

    it('should mark 4xx errors as non-retryable', async () => {
      const apiError = new MockAnthropicAPIError(401, {}, 'Unauthorized');
      mockAnthropicCreate.mockRejectedValueOnce(apiError);

      try {
        await client.chat([{ role: 'user', content: 'Hi' }]);
      } catch (e) {
        expect(e).toBeInstanceOf(LLMError);
        expect((e as LLMError).retryable).toBe(false);
      }
    });

    it('should handle timeout-like message in error', async () => {
      const apiError = new MockAnthropicAPIError(500, {}, 'Connection timeout exceeded');
      mockAnthropicCreate.mockRejectedValueOnce(apiError);

      await expect(
        client.chat([{ role: 'user', content: 'Hi' }]),
      ).rejects.toThrow(LLMTimeoutError);
    });

    it('should handle non-Error thrown values', async () => {
      mockAnthropicCreate.mockRejectedValueOnce('string error');

      try {
        await client.chat([{ role: 'user', content: 'Hi' }]);
      } catch (e) {
        expect(e).toBeInstanceOf(LLMError);
        expect((e as LLMError).message).toContain('Unexpected error');
      }
    });
  });

  // =========================================================================
  // extractContent - multiple text blocks
  // =========================================================================

  describe('chat - multiple text blocks', () => {
    it('should join multiple text blocks', async () => {
      mockAnthropicCreate.mockResolvedValueOnce({
        content: [
          { type: 'text', text: 'Part 1 ' },
          { type: 'tool_use', id: 'tool1', name: 'tool', input: {} },
          { type: 'text', text: 'Part 2' },
        ],
        model: 'claude-3-5-sonnet-20241022',
        usage: { input_tokens: 10, output_tokens: 8 },
        stop_reason: 'stop',
        id: 'msg-multi',
        type: 'message',
      });

      const result = await client.chat([{ role: 'user', content: 'Hi' }]);
      expect(result.content).toBe('Part 1 Part 2');
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
});
