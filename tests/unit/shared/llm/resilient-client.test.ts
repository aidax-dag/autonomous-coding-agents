/**
 * Resilient LLM Client Tests
 */

import {
  ResilientLLMClient,
  createResilientClient,
  withResilience,
  DEFAULT_RESILIENT_CONFIG,
} from '../../../../src/shared/llm/resilient-client';
import {
  ILLMClient,
  LLMMessage,
  LLMCompletionResult,
  LLMStreamCallback,
} from '../../../../src/shared/llm/base-client';
import { LLMRateLimitError } from '../../../../src/shared/errors/custom-errors';

// Mock LLM client
class MockLLMClient implements ILLMClient {
  public callCount = 0;
  public shouldFail = false;
  public failCount = 0;
  public failUntil = 0;
  public errorToThrow: Error | null = null;

  getProvider(): string {
    return 'mock';
  }

  getDefaultModel(): string {
    return 'mock-model';
  }

  getMaxContextLength(): number {
    return 100000;
  }

  async chat(): Promise<LLMCompletionResult> {
    this.callCount++;

    if (this.shouldFail || this.callCount <= this.failUntil) {
      this.failCount++;
      throw this.errorToThrow || new Error('Mock error');
    }

    return {
      content: 'Mock response',
      model: 'mock-model',
      usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      finishReason: 'stop',
    };
  }

  async chatStream(
    _messages: LLMMessage[],
    callback: LLMStreamCallback
  ): Promise<LLMCompletionResult> {
    this.callCount++;

    if (this.shouldFail || this.callCount <= this.failUntil) {
      this.failCount++;
      throw this.errorToThrow || new Error('Mock error');
    }

    await callback({ content: 'Mock', isComplete: false });
    await callback({ content: ' response', isComplete: true });

    return {
      content: 'Mock response',
      model: 'mock-model',
      usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      finishReason: 'stop',
    };
  }
}

describe('ResilientLLMClient', () => {
  let mockClient: MockLLMClient;
  let resilientClient: ResilientLLMClient;

  beforeEach(() => {
    mockClient = new MockLLMClient();
    resilientClient = new ResilientLLMClient(mockClient, {
      retry: { maxAttempts: 3, initialDelay: 10, maxDelay: 100 },
      enableCircuitBreaker: true,
      circuitBreaker: { failureThreshold: 3, timeout: 100 },
    });
  });

  afterEach(() => {
    resilientClient.dispose();
  });

  describe('constructor', () => {
    it('should create with default config', () => {
      const client = new ResilientLLMClient(mockClient);
      expect(client.getProvider()).toBe('mock');
      client.dispose();
    });

    it('should merge custom config with defaults', () => {
      const client = new ResilientLLMClient(mockClient, {
        retry: { maxAttempts: 5 },
      });
      expect(client.getProvider()).toBe('mock');
      client.dispose();
    });
  });

  describe('getProvider', () => {
    it('should return underlying client provider', () => {
      expect(resilientClient.getProvider()).toBe('mock');
    });
  });

  describe('getDefaultModel', () => {
    it('should return underlying client default model', () => {
      expect(resilientClient.getDefaultModel()).toBe('mock-model');
    });
  });

  describe('getMaxContextLength', () => {
    it('should return underlying client max context length', () => {
      expect(resilientClient.getMaxContextLength()).toBe(100000);
    });
  });

  describe('chat', () => {
    it('should succeed on first attempt', async () => {
      const result = await resilientClient.chat([{ role: 'user', content: 'Hello' }]);

      expect(result.content).toBe('Mock response');
      expect(mockClient.callCount).toBe(1);
    });

    it('should retry on transient error', async () => {
      mockClient.failUntil = 2;
      mockClient.errorToThrow = new Error('ECONNRESET');

      const result = await resilientClient.chat([{ role: 'user', content: 'Hello' }]);

      expect(result.content).toBe('Mock response');
      expect(mockClient.callCount).toBe(3);
    });

    it('should retry on server error', async () => {
      mockClient.failUntil = 1;
      mockClient.errorToThrow = new Error('500 Internal Server Error');

      const result = await resilientClient.chat([{ role: 'user', content: 'Hello' }]);

      expect(result.content).toBe('Mock response');
      expect(mockClient.callCount).toBe(2);
    });

    it('should fail after max retries', async () => {
      mockClient.shouldFail = true;
      mockClient.errorToThrow = new Error('ETIMEDOUT');

      await expect(
        resilientClient.chat([{ role: 'user', content: 'Hello' }])
      ).rejects.toThrow();

      expect(mockClient.callCount).toBe(3);
    });
  });

  describe('chatStream', () => {
    it('should succeed on first attempt', async () => {
      const chunks: string[] = [];
      const callback: LLMStreamCallback = (chunk) => {
        chunks.push(chunk.content);
      };

      const result = await resilientClient.chatStream(
        [{ role: 'user', content: 'Hello' }],
        callback
      );

      expect(result.content).toBe('Mock response');
      expect(chunks).toEqual(['Mock', ' response']);
    });
  });

  describe('circuit breaker', () => {
    it('should track circuit status', () => {
      const status = resilientClient.getCircuitStatus();

      expect(status.state).toBe('CLOSED');
      expect(status.failures).toBe(0);
    });

    it('should open circuit after threshold failures', async () => {
      mockClient.shouldFail = true;
      mockClient.errorToThrow = new Error('Server error 500');

      // Trigger enough failures to open circuit
      for (let i = 0; i < 5; i++) {
        try {
          await resilientClient.chat([{ role: 'user', content: 'Hello' }]);
        } catch {
          // Expected
        }
      }

      const status = resilientClient.getCircuitStatus();
      expect(status.state).toBe('OPEN');
    });

    it('should reset circuit', async () => {
      mockClient.shouldFail = true;
      mockClient.errorToThrow = new Error('Server error 500');

      // Trigger failures
      for (let i = 0; i < 5; i++) {
        try {
          await resilientClient.chat([{ role: 'user', content: 'Hello' }]);
        } catch {
          // Expected
        }
      }

      resilientClient.resetCircuit();
      const status = resilientClient.getCircuitStatus();

      expect(status.state).toBe('CLOSED');
      expect(status.failures).toBe(0);
    });
  });

  describe('rate limit handling', () => {
    it('should handle rate limit errors with backoff', async () => {
      // First call fails with rate limit, second succeeds
      mockClient.failUntil = 1;
      mockClient.errorToThrow = new LLMRateLimitError('Rate limit exceeded', 100);

      const clientWithRateLimit = new ResilientLLMClient(mockClient, {
        handleRateLimits: true,
        rateLimitBackoff: 10,
        maxRateLimitRetries: 3,
        retry: { maxAttempts: 1 }, // Disable normal retry
        enableCircuitBreaker: false,
      });

      const result = await clientWithRateLimit.chat([{ role: 'user', content: 'Hello' }]);

      expect(result.content).toBe('Mock response');
      clientWithRateLimit.dispose();
    });
  });

  describe('callbacks', () => {
    it('should call onRetry callback', async () => {
      const retryAttempts: number[] = [];
      const clientWithCallback = new ResilientLLMClient(mockClient, {
        retry: { maxAttempts: 3, initialDelay: 10 },
        enableCircuitBreaker: false,
        onRetry: (attempt) => retryAttempts.push(attempt),
      });

      mockClient.failUntil = 2;
      mockClient.errorToThrow = new Error('Network error');

      await clientWithCallback.chat([{ role: 'user', content: 'Hello' }]);

      expect(retryAttempts.length).toBeGreaterThan(0);
      clientWithCallback.dispose();
    });
  });

  describe('DEFAULT_RESILIENT_CONFIG', () => {
    it('should have sensible defaults', () => {
      expect(DEFAULT_RESILIENT_CONFIG.retry.maxAttempts).toBe(3);
      expect(DEFAULT_RESILIENT_CONFIG.retry.backoff).toBe('exponential');
      expect(DEFAULT_RESILIENT_CONFIG.enableCircuitBreaker).toBe(true);
      expect(DEFAULT_RESILIENT_CONFIG.handleRateLimits).toBe(true);
    });
  });

  describe('createResilientClient', () => {
    it('should create resilient client with factory function', () => {
      const client = createResilientClient(mockClient);
      expect(client).toBeInstanceOf(ResilientLLMClient);
      client.dispose();
    });
  });

  describe('withResilience', () => {
    it('should wrap client with resilience', () => {
      const client = withResilience(mockClient, { retry: { maxAttempts: 5 } });
      expect(client).toBeInstanceOf(ResilientLLMClient);
      client.dispose();
    });
  });
});
