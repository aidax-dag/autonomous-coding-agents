/**
 * Error Recovery Implementation
 *
 * Provides resilience patterns for handling failures.
 *
 * @module dx/error-recovery/impl
 */

import type {
  IErrorRecovery,
  ICircuitBreaker,
  RetryOptions,
  CircuitBreakerOptions,
  FallbackOptions,
  RecoveryStrategy,
  RecoveryResult,
  CircuitState,
  CircuitBreakerStatus,
} from '../interfaces/error-recovery.interface';
import {
  RetryExhaustedError,
  CircuitOpenError,
  TimeoutError,
  DEFAULT_RETRY_OPTIONS,
  DEFAULT_CIRCUIT_OPTIONS,
} from '../interfaces/error-recovery.interface';

/**
 * Calculate delay with backoff strategy
 */
function calculateDelay(
  attempt: number,
  options: RetryOptions
): number {
  let delay: number;

  switch (options.backoff) {
    case 'fixed':
      delay = options.initialDelay;
      break;
    case 'linear':
      delay = options.initialDelay * attempt;
      break;
    case 'exponential':
    default:
      delay = options.initialDelay * Math.pow(options.multiplier ?? 2, attempt - 1);
      break;
  }

  // Apply max delay
  if (options.maxDelay) {
    delay = Math.min(delay, options.maxDelay);
  }

  // Apply jitter
  if (options.jitter && options.jitter > 0) {
    const jitterAmount = delay * options.jitter;
    delay = delay + (Math.random() * jitterAmount * 2 - jitterAmount);
  }

  return Math.max(0, Math.floor(delay));
}

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Circuit Breaker Implementation
 */
export class CircuitBreaker implements ICircuitBreaker {
  readonly name: string;
  private _state: CircuitState = 'CLOSED';
  private failures = 0;
  private successes = 0;
  private lastFailure?: Date;
  private stateChangeTime?: Date;
  private options: CircuitBreakerOptions;

  constructor(name: string, options: Partial<CircuitBreakerOptions> = {}) {
    this.name = name;
    this.options = { ...DEFAULT_CIRCUIT_OPTIONS, ...options };
  }

  get state(): CircuitState {
    return this._state;
  }

  /**
   * Execute operation through circuit breaker
   */
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (!this.canExecute()) {
      throw new CircuitOpenError(this.name, this.getStatus());
    }

    try {
      const result = await operation();
      this.recordSuccess();
      return result;
    } catch (error) {
      this.recordFailure(error as Error);
      throw error;
    }
  }

  /**
   * Check if circuit allows execution
   */
  canExecute(): boolean {
    if (this._state === 'CLOSED') {
      return true;
    }

    if (this._state === 'OPEN') {
      // Check if timeout has passed
      if (this.stateChangeTime) {
        const elapsed = Date.now() - this.stateChangeTime.getTime();
        if (elapsed >= this.options.timeout) {
          this.transitionTo('HALF_OPEN');
          return true;
        }
      }
      return false;
    }

    // HALF_OPEN - allow one request through
    return true;
  }

  /**
   * Record success
   */
  recordSuccess(): void {
    if (this._state === 'HALF_OPEN') {
      this.successes++;
      if (this.successes >= this.options.successThreshold) {
        this.transitionTo('CLOSED');
      }
    }

    this.options.onSuccess?.();
  }

  /**
   * Record failure
   */
  recordFailure(error: Error): void {
    const shouldTrip = this.options.shouldTrip?.(error) ?? true;

    if (!shouldTrip) {
      return;
    }

    this.failures++;
    this.lastFailure = new Date();

    if (this._state === 'HALF_OPEN') {
      this.transitionTo('OPEN');
    } else if (this._state === 'CLOSED') {
      if (this.failures >= this.options.failureThreshold) {
        this.transitionTo('OPEN');
      }
    }

    this.options.onFailure?.(error);
  }

  /**
   * Get status
   */
  getStatus(): CircuitBreakerStatus {
    let timeUntilHalfOpen: number | undefined;

    if (this._state === 'OPEN' && this.stateChangeTime) {
      const elapsed = Date.now() - this.stateChangeTime.getTime();
      timeUntilHalfOpen = Math.max(0, this.options.timeout - elapsed);
    }

    return {
      name: this.name,
      state: this._state,
      failures: this.failures,
      successes: this.successes,
      lastFailure: this.lastFailure,
      timeUntilHalfOpen,
    };
  }

  /**
   * Reset to closed state
   */
  reset(): void {
    this.transitionTo('CLOSED');
    this.failures = 0;
    this.successes = 0;
    this.lastFailure = undefined;
  }

  /**
   * Force open the circuit
   */
  forceOpen(): void {
    this.transitionTo('OPEN');
  }

  private transitionTo(newState: CircuitState): void {
    const previousState = this._state;

    if (previousState === newState) {
      return;
    }

    this._state = newState;
    this.stateChangeTime = new Date();

    if (newState === 'CLOSED') {
      this.failures = 0;
      this.successes = 0;
    } else if (newState === 'HALF_OPEN') {
      this.successes = 0;
    }

    this.options.onStateChange?.(newState, previousState);
  }
}

/**
 * Error Recovery Implementation
 */
export class ErrorRecovery implements IErrorRecovery {
  private circuitBreakers = new Map<string, CircuitBreaker>();
  private disposed = false;

  /**
   * Execute operation with retry strategy
   */
  async retry<T>(
    operation: () => Promise<T>,
    options: Partial<RetryOptions> = {}
  ): Promise<T> {
    this.ensureNotDisposed();

    const opts: RetryOptions = { ...DEFAULT_RETRY_OPTIONS, ...options };
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
      try {
        // Apply timeout if specified
        if (opts.timeout) {
          return await this.withTimeout(operation, opts.timeout);
        }
        return await operation();
      } catch (error) {
        lastError = error as Error;

        // Check if should retry
        const shouldRetry = opts.retryOn?.(lastError) ?? true;
        if (!shouldRetry || attempt >= opts.maxAttempts) {
          break;
        }

        // Calculate and apply delay
        const delay = calculateDelay(attempt, opts);
        opts.onRetry?.(attempt, lastError, delay);

        await sleep(delay);
      }
    }

    throw new RetryExhaustedError(
      `Operation failed after ${opts.maxAttempts} attempts: ${lastError?.message}`,
      opts.maxAttempts,
      lastError!
    );
  }

  /**
   * Execute operation with circuit breaker
   */
  async withCircuitBreaker<T>(
    operation: () => Promise<T>,
    options: Partial<CircuitBreakerOptions> = {}
  ): Promise<T> {
    this.ensureNotDisposed();

    const name = options.name ?? 'default';
    let breaker = this.circuitBreakers.get(name);

    if (!breaker) {
      breaker = new CircuitBreaker(name, options);
      this.circuitBreakers.set(name, breaker);
    }

    return breaker.execute(operation);
  }

  /**
   * Get circuit breaker status
   */
  getCircuitStatus(name = 'default'): CircuitBreakerStatus {
    const breaker = this.circuitBreakers.get(name);

    if (!breaker) {
      return {
        name,
        state: 'CLOSED',
        failures: 0,
        successes: 0,
      };
    }

    return breaker.getStatus();
  }

  /**
   * Reset circuit breaker
   */
  resetCircuit(name = 'default'): void {
    const breaker = this.circuitBreakers.get(name);
    breaker?.reset();
  }

  /**
   * Execute with fallback
   */
  async withFallback<T>(
    primary: () => Promise<T>,
    fallback: () => Promise<T>,
    options: FallbackOptions = {}
  ): Promise<T> {
    this.ensureNotDisposed();

    try {
      if (options.timeout) {
        return await this.withTimeout(primary, options.timeout);
      }
      return await primary();
    } catch (error) {
      const shouldFallback = options.shouldFallback?.(error as Error) ?? true;

      if (!shouldFallback) {
        throw error;
      }

      options.onFallback?.(error as Error);
      return fallback();
    }
  }

  /**
   * Execute with timeout
   */
  async withTimeout<T>(
    operation: () => Promise<T>,
    timeout: number
  ): Promise<T> {
    this.ensureNotDisposed();

    return new Promise<T>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new TimeoutError(`Operation timed out after ${timeout}ms`, timeout));
      }, timeout);

      operation()
        .then((result) => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }

  /**
   * Execute with multiple recovery strategies
   */
  async withRecovery<T>(
    operation: () => Promise<T>,
    strategies: RecoveryStrategy[]
  ): Promise<RecoveryResult<T>> {
    this.ensureNotDisposed();

    const startTime = Date.now();
    let attempts = 0;
    let usedFallback = false;
    let lastStrategy: RecoveryStrategy | undefined;

    // Build wrapped operation with all strategies
    let wrappedOperation = operation;

    for (const strategy of strategies) {
      lastStrategy = strategy;
      const currentOperation = wrappedOperation;

      switch (strategy.type) {
        case 'retry':
          wrappedOperation = () => {
            return this.retry(currentOperation, strategy.options).then((result) => {
              attempts = strategy.options.maxAttempts;
              return result;
            });
          };
          break;

        case 'circuit-breaker':
          wrappedOperation = () =>
            this.withCircuitBreaker(currentOperation, strategy.options);
          break;

        case 'fallback':
          wrappedOperation = () =>
            this.withFallback(
              currentOperation,
              strategy.fallback as () => Promise<T>,
              strategy.options
            ).then((result) => {
              usedFallback = true;
              return result;
            });
          break;

        case 'timeout':
          wrappedOperation = () =>
            this.withTimeout(currentOperation, strategy.timeout);
          break;
      }
    }

    try {
      const data = await wrappedOperation();
      return {
        success: true,
        data,
        attempts,
        duration: Date.now() - startTime,
        strategy: lastStrategy?.type ?? 'retry',
        usedFallback,
      };
    } catch (error) {
      return {
        success: false,
        error: error as Error,
        attempts,
        duration: Date.now() - startTime,
        strategy: lastStrategy?.type ?? 'retry',
        usedFallback,
      };
    }
  }

  /**
   * Create a named circuit breaker
   */
  createCircuitBreaker(
    name: string,
    options: Partial<CircuitBreakerOptions> = {}
  ): ICircuitBreaker {
    const breaker = new CircuitBreaker(name, options);
    this.circuitBreakers.set(name, breaker);
    return breaker;
  }

  /**
   * Get or create a circuit breaker
   */
  getCircuitBreaker(name: string): ICircuitBreaker | undefined {
    return this.circuitBreakers.get(name);
  }

  /**
   * List all circuit breakers
   */
  listCircuitBreakers(): CircuitBreakerStatus[] {
    return Array.from(this.circuitBreakers.values()).map((b) => b.getStatus());
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this.circuitBreakers.clear();
    this.disposed = true;
  }

  private ensureNotDisposed(): void {
    if (this.disposed) {
      throw new Error('ErrorRecovery has been disposed');
    }
  }
}

/**
 * Create a new Error Recovery instance
 */
export function createErrorRecovery(): IErrorRecovery {
  return new ErrorRecovery();
}
