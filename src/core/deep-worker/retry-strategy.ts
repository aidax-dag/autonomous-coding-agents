/**
 * Retry with Strategy Change
 *
 * Retries failed operations with different strategies. Instead of
 * repeating the same approach, it adapts based on the error.
 *
 * @module core/deep-worker
 */

import type {
  IRetryStrategy,
  DeepWorkerContext,
  RetryStrategyInfo,
  RetryResult,
} from './interfaces/deep-worker.interface';

/**
 * Strategy generator — generates the next strategy based on failure context
 */
export type StrategyGenerator = (
  context: DeepWorkerContext,
  previousError: string,
  attempt: number,
) => RetryStrategyInfo | null;

/**
 * RetryStrategy options
 */
export interface RetryStrategyOptions {
  /** Maximum number of retries */
  maxRetries?: number;
  /** Custom strategy generator */
  strategyGenerator?: StrategyGenerator;
  /** Delay between retries in ms */
  retryDelay?: number;
}

/**
 * Built-in strategy names
 */
const DEFAULT_STRATEGIES = [
  'original',
  'simplified',
  'alternative',
  'decomposed',
] as const;

/**
 * Default retry strategy implementation
 */
export class RetryStrategy implements IRetryStrategy {
  private readonly maxRetries: number;
  private readonly strategyGenerator?: StrategyGenerator;
  private readonly retryDelay: number;

  constructor(options: RetryStrategyOptions = {}) {
    this.maxRetries = options.maxRetries ?? 3;
    this.strategyGenerator = options.strategyGenerator;
    this.retryDelay = options.retryDelay ?? 0;
  }

  getNextStrategy(
    context: DeepWorkerContext,
    previousError: string,
    attempt: number,
  ): RetryStrategyInfo | null {
    const maxAttempts = context.maxRetries ?? this.maxRetries;

    if (attempt >= maxAttempts) {
      return null;
    }

    if (this.strategyGenerator) {
      return this.strategyGenerator(context, previousError, attempt);
    }

    // Default strategy progression
    const strategyName =
      DEFAULT_STRATEGIES[Math.min(attempt, DEFAULT_STRATEGIES.length - 1)];

    return {
      name: strategyName,
      reason: this.getDefaultReason(strategyName, previousError),
      changes: this.getDefaultChanges(strategyName),
      attempt,
      maxAttempts,
    };
  }

  async executeWithRetry<T>(
    fn: (strategy: RetryStrategyInfo) => Promise<T>,
    context: DeepWorkerContext,
  ): Promise<RetryResult> {
    const start = Date.now();
    let lastError = '';

    for (let attempt = 0; attempt <= (context.maxRetries ?? this.maxRetries); attempt++) {
      const strategy = this.getNextStrategy(context, lastError, attempt);

      if (!strategy && attempt > 0) {
        return {
          success: false,
          strategy: {
            name: 'exhausted',
            reason: 'All retry strategies exhausted',
            changes: [],
            attempt,
            maxAttempts: context.maxRetries ?? this.maxRetries,
          },
          error: lastError,
          duration: Date.now() - start,
        };
      }

      const currentStrategy = strategy ?? {
        name: 'original',
        reason: 'Initial attempt',
        changes: [],
        attempt: 0,
        maxAttempts: context.maxRetries ?? this.maxRetries,
      };

      try {
        if (attempt > 0 && this.retryDelay > 0) {
          await new Promise((resolve) => setTimeout(resolve, this.retryDelay));
        }

        const output = await fn(currentStrategy);
        return {
          success: true,
          strategy: currentStrategy,
          output,
          duration: Date.now() - start,
        };
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
      }
    }

    return {
      success: false,
      strategy: {
        name: 'exhausted',
        reason: 'All attempts failed',
        changes: [],
        attempt: (context.maxRetries ?? this.maxRetries) + 1,
        maxAttempts: context.maxRetries ?? this.maxRetries,
      },
      error: lastError,
      duration: Date.now() - start,
    };
  }

  private getDefaultReason(strategy: string, previousError: string): string {
    switch (strategy) {
      case 'original':
        return 'Initial approach';
      case 'simplified':
        return `Previous failed: ${previousError}. Trying simplified approach`;
      case 'alternative':
        return `Previous failed: ${previousError}. Trying alternative approach`;
      case 'decomposed':
        return `Previous failed: ${previousError}. Decomposing into smaller steps`;
      default:
        return `Retry with ${strategy} strategy`;
    }
  }

  private getDefaultChanges(strategy: string): string[] {
    switch (strategy) {
      case 'original':
        return [];
      case 'simplified':
        return ['Reduce scope', 'Use simpler approach'];
      case 'alternative':
        return ['Change approach entirely', 'Try different tools'];
      case 'decomposed':
        return ['Break into smaller tasks', 'Sequential execution'];
      default:
        return [`Apply ${strategy} changes`];
    }
  }
}

/**
 * Factory function
 */
export function createRetryStrategy(
  options?: RetryStrategyOptions,
): RetryStrategy {
  return new RetryStrategy(options);
}
