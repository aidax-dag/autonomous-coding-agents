/**
 * Resilient LLM Client Wrapper
 *
 * Provides error recovery capabilities for LLM clients:
 * - Automatic retry with exponential backoff
 * - Circuit breaker for API protection
 * - Rate limit handling
 * - Timeout management
 *
 * @module shared/llm/resilient-client
 */

import {
  ILLMClient,
  LLMMessage,
  LLMCompletionOptions,
  LLMCompletionResult,
  LLMStreamCallback,
} from './base-client';
import {
  ErrorRecovery,
  CircuitBreaker,
  RetryOptions,
  CircuitBreakerOptions,
  CircuitOpenError,
  RetryExhaustedError,
  TimeoutError,
} from '@/dx/error-recovery';
import { LLMRateLimitError, LLMTimeoutError, LLMError, ErrorCode } from '@/shared/errors/custom-errors';

// ============================================================================
// Configuration
// ============================================================================

/**
 * Resilient client configuration
 */
export interface ResilientClientConfig {
  /** Retry configuration */
  retry?: Partial<RetryOptions>;
  /** Circuit breaker configuration */
  circuitBreaker?: Partial<CircuitBreakerOptions>;
  /** Default timeout in ms */
  defaultTimeout?: number;
  /** Enable rate limit detection and backoff */
  handleRateLimits?: boolean;
  /** Rate limit backoff base delay in ms */
  rateLimitBackoff?: number;
  /** Maximum rate limit retries */
  maxRateLimitRetries?: number;
  /** Enable circuit breaker */
  enableCircuitBreaker?: boolean;
  /** Callback for retry events */
  onRetry?: (attempt: number, error: Error, delay: number) => void;
  /** Callback for circuit state changes */
  onCircuitStateChange?: (state: 'CLOSED' | 'OPEN' | 'HALF_OPEN', previous: string) => void;
  /** Callback for fallback activation */
  onFallback?: (error: Error) => void;
}

/**
 * Default resilient client configuration
 */
export const DEFAULT_RESILIENT_CONFIG: Required<ResilientClientConfig> = {
  retry: {
    maxAttempts: 3,
    backoff: 'exponential',
    initialDelay: 1000,
    maxDelay: 30000,
    multiplier: 2,
    jitter: 0.1,
  },
  circuitBreaker: {
    failureThreshold: 5,
    successThreshold: 2,
    timeout: 60000, // 1 minute
  },
  defaultTimeout: 120000, // 2 minutes
  handleRateLimits: true,
  rateLimitBackoff: 5000,
  maxRateLimitRetries: 5,
  enableCircuitBreaker: true,
  onRetry: () => {},
  onCircuitStateChange: () => {},
  onFallback: () => {},
};

// ============================================================================
// Resilient Client Wrapper
// ============================================================================

/**
 * Resilient LLM Client Wrapper
 *
 * Wraps any LLM client with error recovery capabilities.
 *
 * @example
 * ```typescript
 * const baseClient = new ClaudeClient(apiKey);
 * const resilientClient = new ResilientLLMClient(baseClient, {
 *   retry: { maxAttempts: 3 },
 *   enableCircuitBreaker: true,
 * });
 *
 * // Now all calls have automatic retry and circuit breaker
 * const result = await resilientClient.chat(messages);
 * ```
 */
export class ResilientLLMClient implements ILLMClient {
  private readonly client: ILLMClient;
  private readonly config: Required<ResilientClientConfig>;
  private readonly recovery: ErrorRecovery;
  private readonly circuitBreaker: CircuitBreaker;
  private rateLimitRetryCount = 0;

  constructor(client: ILLMClient, config: ResilientClientConfig = {}) {
    this.client = client;
    this.config = {
      ...DEFAULT_RESILIENT_CONFIG,
      ...config,
      retry: { ...DEFAULT_RESILIENT_CONFIG.retry, ...config.retry },
      circuitBreaker: { ...DEFAULT_RESILIENT_CONFIG.circuitBreaker, ...config.circuitBreaker },
    };

    this.recovery = new ErrorRecovery();
    this.circuitBreaker = new CircuitBreaker(
      `llm-${client.getProvider()}`,
      {
        ...this.config.circuitBreaker,
        onStateChange: (state, prev) => {
          this.config.onCircuitStateChange(state, prev);
        },
      }
    );
  }

  getProvider(): string {
    return this.client.getProvider();
  }

  getDefaultModel(): string {
    return this.client.getDefaultModel();
  }

  getMaxContextLength(model?: string): number {
    return this.client.getMaxContextLength(model);
  }

  /**
   * Get circuit breaker status
   */
  getCircuitStatus() {
    return this.circuitBreaker.getStatus();
  }

  /**
   * Reset circuit breaker
   */
  resetCircuit(): void {
    this.circuitBreaker.reset();
  }

  /**
   * Chat with error recovery
   */
  async chat(
    messages: LLMMessage[],
    options?: LLMCompletionOptions
  ): Promise<LLMCompletionResult> {
    const timeout = options?.timeout || this.config.defaultTimeout;

    const operation = async (): Promise<LLMCompletionResult> => {
      // Apply circuit breaker if enabled
      if (this.config.enableCircuitBreaker) {
        return this.circuitBreaker.execute(() => this.client.chat(messages, options));
      }
      return this.client.chat(messages, options);
    };

    return this.executeWithRecovery(operation, timeout);
  }

  /**
   * Stream chat with error recovery
   */
  async chatStream(
    messages: LLMMessage[],
    callback: LLMStreamCallback,
    options?: LLMCompletionOptions
  ): Promise<LLMCompletionResult> {
    const timeout = options?.timeout || this.config.defaultTimeout;

    const operation = async (): Promise<LLMCompletionResult> => {
      // Apply circuit breaker if enabled
      if (this.config.enableCircuitBreaker) {
        return this.circuitBreaker.execute(() =>
          this.client.chatStream(messages, callback, options)
        );
      }
      return this.client.chatStream(messages, callback, options);
    };

    return this.executeWithRecovery(operation, timeout);
  }

  /**
   * Count tokens (if supported)
   */
  async countTokens(messages: LLMMessage[]): Promise<number> {
    if (!this.client.countTokens) {
      throw new Error('Token counting not supported by this provider');
    }
    return this.client.countTokens(messages);
  }

  /**
   * Execute operation with full recovery strategy
   */
  private async executeWithRecovery<T>(
    operation: () => Promise<T>,
    timeout: number
  ): Promise<T> {
    const retryOptions: RetryOptions = {
      ...this.config.retry,
      timeout,
      retryOn: (error) => this.shouldRetry(error),
      onRetry: (attempt, error, delay) => {
        this.config.onRetry(attempt, error, delay);
      },
    } as RetryOptions;

    try {
      return await this.recovery.retry(operation, retryOptions);
    } catch (error) {
      // Handle rate limits with special backoff
      if (this.isRateLimitError(error as Error)) {
        return this.handleRateLimit(operation, timeout);
      }

      // Transform errors for better context
      throw this.transformError(error as Error);
    }
  }

  /**
   * Handle rate limit with extended backoff
   */
  private async handleRateLimit<T>(
    operation: () => Promise<T>,
    timeout: number
  ): Promise<T> {
    if (!this.config.handleRateLimits) {
      throw new LLMRateLimitError('Rate limit exceeded', this.config.rateLimitBackoff);
    }

    if (this.rateLimitRetryCount >= this.config.maxRateLimitRetries) {
      this.rateLimitRetryCount = 0;
      throw new LLMRateLimitError(
        `Rate limit exceeded after ${this.config.maxRateLimitRetries} retries`,
        this.config.rateLimitBackoff
      );
    }

    this.rateLimitRetryCount++;
    const delay = this.config.rateLimitBackoff * Math.pow(2, this.rateLimitRetryCount - 1);

    await this.sleep(delay);
    return this.executeWithRecovery(operation, timeout);
  }

  /**
   * Check if error is retryable
   */
  private shouldRetry(error: Error): boolean {
    // Don't retry circuit open errors
    if (error instanceof CircuitOpenError) {
      return false;
    }

    // Retry rate limit errors (handled separately)
    if (this.isRateLimitError(error)) {
      return false; // Handle separately with longer backoff
    }

    // Retry timeout errors
    if (error instanceof TimeoutError || error instanceof LLMTimeoutError) {
      return true;
    }

    // Retry transient network errors
    if (this.isTransientError(error)) {
      return true;
    }

    // Retry server errors (5xx)
    if (this.isServerError(error)) {
      return true;
    }

    return false;
  }

  /**
   * Check if error is a rate limit error
   */
  private isRateLimitError(error: Error): boolean {
    if (error instanceof LLMRateLimitError) {
      return true;
    }

    const message = error.message.toLowerCase();
    return (
      message.includes('rate limit') ||
      message.includes('too many requests') ||
      message.includes('429')
    );
  }

  /**
   * Check if error is a transient error
   */
  private isTransientError(error: Error): boolean {
    const message = error.message.toLowerCase();
    return (
      message.includes('network') ||
      message.includes('econnreset') ||
      message.includes('econnrefused') ||
      message.includes('etimedout') ||
      message.includes('socket hang up')
    );
  }

  /**
   * Check if error is a server error
   */
  private isServerError(error: Error): boolean {
    const message = error.message.toLowerCase();
    return (
      message.includes('500') ||
      message.includes('502') ||
      message.includes('503') ||
      message.includes('504') ||
      message.includes('internal server error') ||
      message.includes('service unavailable')
    );
  }

  /**
   * Transform error for better context
   */
  private transformError(error: Error): Error {
    if (error instanceof RetryExhaustedError) {
      return new LLMError(
        `LLM request failed after ${error.attempts} attempts: ${error.lastError?.message}`,
        ErrorCode.LLM_API_ERROR,
        true,
        { provider: this.getProvider(), attempts: error.attempts }
      );
    }

    if (error instanceof CircuitOpenError) {
      return new LLMError(
        `LLM circuit breaker open for ${this.getProvider()}: ${error.message}`,
        ErrorCode.LLM_API_ERROR,
        false,
        { provider: this.getProvider(), circuitState: 'OPEN' }
      );
    }

    if (error instanceof TimeoutError) {
      return new LLMTimeoutError(`LLM request timed out: ${error.message}`, error.timeout);
    }

    return error;
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    this.recovery.dispose();
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a resilient LLM client
 */
export function createResilientClient(
  client: ILLMClient,
  config?: ResilientClientConfig
): ResilientLLMClient {
  return new ResilientLLMClient(client, config);
}

/**
 * Wrap an existing client with resilience
 */
export function withResilience<T extends ILLMClient>(
  client: T,
  config?: ResilientClientConfig
): ResilientLLMClient {
  return new ResilientLLMClient(client, config);
}
