/**
 * Ollama Client Tests
 */

import { OllamaClient } from '../../../../../src/shared/llm/cli/ollama-client';
import { OllamaServerError, CLIResponseError } from '../../../../../src/shared/llm/cli/errors';

// ============================================================================
// Mock fetch globally
// ============================================================================

const mockFetch = jest.fn();
(global as any).fetch = mockFetch;

// ============================================================================
// Helpers
// ============================================================================

function makeOllamaResponse(overrides: Record<string, unknown> = {}) {
  return {
    model: 'llama3',
    created_at: '2025-01-01T00:00:00Z',
    response: 'Hello world',
    done: true,
    prompt_eval_count: 10,
    eval_count: 5,
    total_duration: 1000000,
    load_duration: 500000,
    prompt_eval_duration: 300000,
    eval_duration: 200000,
    ...overrides,
  };
}

function makeFetchResponse(body: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: jest.fn().mockResolvedValue(body),
    text: jest.fn().mockResolvedValue(typeof body === 'string' ? body : JSON.stringify(body)),
    body: null,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('OllamaClient', () => {
  let client: OllamaClient;

  beforeEach(() => {
    jest.clearAllMocks();
    client = new OllamaClient();
  });

  // ==========================================================================
  // Constructor & Accessors
  // ==========================================================================

  describe('constructor', () => {
    it('should use default model and host', () => {
      expect(client.getDefaultModel()).toBe('llama3');
      expect(client.getProvider()).toBe('ollama');
    });

    it('should accept custom model', () => {
      const custom = new OllamaClient('mistral');
      expect(custom.getDefaultModel()).toBe('mistral');
    });

    it('should accept custom host', () => {
      const custom = new OllamaClient('llama3', 'http://remote:11434');
      expect(custom.getProvider()).toBe('ollama');
    });
  });

  // ==========================================================================
  // getMaxContextLength
  // ==========================================================================

  describe('getMaxContextLength', () => {
    it('should return known model context length', () => {
      expect(client.getMaxContextLength('llama3')).toBe(8192);
    });

    it('should return context length for variant models', () => {
      expect(client.getMaxContextLength('llama3:8b')).toBe(8192);
    });

    it('should return context length for llama3.1', () => {
      expect(client.getMaxContextLength('llama3.1')).toBe(128000);
    });

    it('should return context length for mistral', () => {
      expect(client.getMaxContextLength('mistral')).toBe(32768);
    });

    it('should return context length for codellama', () => {
      expect(client.getMaxContextLength('codellama')).toBe(16384);
    });

    it('should fall back to base model name', () => {
      // codellama:7b should match codellama
      expect(client.getMaxContextLength('codellama:7b')).toBe(16384);
    });

    it('should return default for unknown model', () => {
      expect(client.getMaxContextLength('unknown-model')).toBe(8192);
    });

    it('should use default model when no model specified', () => {
      expect(client.getMaxContextLength()).toBe(8192);
    });
  });

  // ==========================================================================
  // checkServer
  // ==========================================================================

  describe('checkServer', () => {
    it('should return available with model list', async () => {
      mockFetch.mockResolvedValueOnce(makeFetchResponse({
        models: [
          { name: 'llama3', size: 1000, modified_at: '2025-01-01' },
          { name: 'mistral', size: 2000, modified_at: '2025-01-01' },
        ],
      }));

      const result = await client.checkServer();
      expect(result.available).toBe(true);
      expect(result.models).toEqual(['llama3', 'mistral']);
      expect(result.error).toBeUndefined();
    });

    it('should return unavailable on non-ok response', async () => {
      mockFetch.mockResolvedValueOnce(makeFetchResponse({}, false, 500));

      const result = await client.checkServer();
      expect(result.available).toBe(false);
      expect(result.error).toContain('500');
    });

    it('should return unavailable on connection error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

      const result = await client.checkServer();
      expect(result.available).toBe(false);
      expect(result.error).toBe('Connection refused');
    });

    it('should handle non-Error thrown values', async () => {
      mockFetch.mockRejectedValueOnce('string error');

      const result = await client.checkServer();
      expect(result.available).toBe(false);
      expect(result.error).toBe('Connection failed');
    });
  });

  // ==========================================================================
  // chat
  // ==========================================================================

  describe('chat', () => {
    it('should send request and return result', async () => {
      // First call: checkServer
      mockFetch.mockResolvedValueOnce(makeFetchResponse({
        models: [{ name: 'llama3', size: 1000, modified_at: '2025-01-01' }],
      }));
      // Second call: generate
      mockFetch.mockResolvedValueOnce(makeFetchResponse(makeOllamaResponse()));

      const result = await client.chat([
        { role: 'user', content: 'Hello' },
      ]);

      expect(result.content).toBe('Hello world');
      expect(result.model).toBe('llama3');
      expect(result.usage.promptTokens).toBe(10);
      expect(result.usage.completionTokens).toBe(5);
      expect(result.finishReason).toBe('stop');
    });

    it('should include system prompt', async () => {
      mockFetch.mockResolvedValueOnce(makeFetchResponse({
        models: [{ name: 'llama3', size: 1000, modified_at: '2025-01-01' }],
      }));
      mockFetch.mockResolvedValueOnce(makeFetchResponse(makeOllamaResponse()));

      await client.chat([
        { role: 'system', content: 'Be helpful' },
        { role: 'user', content: 'Hello' },
      ]);

      const requestBody = JSON.parse(mockFetch.mock.calls[1][1].body);
      expect(requestBody.system).toBe('Be helpful');
      expect(requestBody.prompt).toBe('Hello');
    });

    it('should pass temperature and maxTokens', async () => {
      mockFetch.mockResolvedValueOnce(makeFetchResponse({
        models: [{ name: 'llama3', size: 1000, modified_at: '2025-01-01' }],
      }));
      mockFetch.mockResolvedValueOnce(makeFetchResponse(makeOllamaResponse()));

      await client.chat(
        [{ role: 'user', content: 'Hi' }],
        { temperature: 0.5, maxTokens: 100 },
      );

      const requestBody = JSON.parse(mockFetch.mock.calls[1][1].body);
      expect(requestBody.options.temperature).toBe(0.5);
      expect(requestBody.options.num_predict).toBe(100);
    });

    it('should use custom model from options', async () => {
      mockFetch.mockResolvedValueOnce(makeFetchResponse({
        models: [{ name: 'mistral', size: 1000, modified_at: '2025-01-01' }],
      }));
      mockFetch.mockResolvedValueOnce(makeFetchResponse(makeOllamaResponse({ model: 'mistral' })));

      await client.chat(
        [{ role: 'user', content: 'Hi' }],
        { model: 'mistral' },
      );

      const requestBody = JSON.parse(mockFetch.mock.calls[1][1].body);
      expect(requestBody.model).toBe('mistral');
    });

    it('should throw OllamaServerError when server unavailable', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

      await expect(client.chat([{ role: 'user', content: 'Hi' }]))
        .rejects.toThrow(OllamaServerError);
    });

    it('should throw CLIResponseError on non-ok API response', async () => {
      mockFetch.mockResolvedValueOnce(makeFetchResponse({
        models: [{ name: 'llama3', size: 1000, modified_at: '2025-01-01' }],
      }));
      mockFetch.mockResolvedValueOnce(makeFetchResponse('model not found', false, 404));

      await expect(client.chat([{ role: 'user', content: 'Hi' }]))
        .rejects.toThrow(CLIResponseError);
    });

    it('should throw on AbortError (timeout)', async () => {
      mockFetch.mockResolvedValueOnce(makeFetchResponse({
        models: [{ name: 'llama3', size: 1000, modified_at: '2025-01-01' }],
      }));
      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';
      mockFetch.mockRejectedValueOnce(abortError);

      await expect(client.chat([{ role: 'user', content: 'Hi' }]))
        .rejects.toThrow(CLIResponseError);
    });

    it('should wrap unknown errors as OllamaServerError', async () => {
      mockFetch.mockResolvedValueOnce(makeFetchResponse({
        models: [{ name: 'llama3', size: 1000, modified_at: '2025-01-01' }],
      }));
      mockFetch.mockRejectedValueOnce(new Error('network error'));

      await expect(client.chat([{ role: 'user', content: 'Hi' }]))
        .rejects.toThrow(OllamaServerError);
    });

    it('should throw when no user message', async () => {
      mockFetch.mockResolvedValueOnce(makeFetchResponse({
        models: [{ name: 'llama3', size: 1000, modified_at: '2025-01-01' }],
      }));

      await expect(client.chat([{ role: 'system', content: 'sys' }]))
        .rejects.toThrow('No user message');
    });

    it('should handle done=false as length finish reason', async () => {
      mockFetch.mockResolvedValueOnce(makeFetchResponse({
        models: [{ name: 'llama3', size: 1000, modified_at: '2025-01-01' }],
      }));
      mockFetch.mockResolvedValueOnce(makeFetchResponse(makeOllamaResponse({ done: false })));

      const result = await client.chat([{ role: 'user', content: 'Hi' }]);
      expect(result.finishReason).toBe('length');
    });

    it('should join multiple system messages', async () => {
      mockFetch.mockResolvedValueOnce(makeFetchResponse({
        models: [{ name: 'llama3', size: 1000, modified_at: '2025-01-01' }],
      }));
      mockFetch.mockResolvedValueOnce(makeFetchResponse(makeOllamaResponse()));

      await client.chat([
        { role: 'system', content: 'Rule A' },
        { role: 'system', content: 'Rule B' },
        { role: 'user', content: 'Hello' },
      ]);

      const requestBody = JSON.parse(mockFetch.mock.calls[1][1].body);
      expect(requestBody.system).toBe('Rule A\n\nRule B');
    });
  });
});
