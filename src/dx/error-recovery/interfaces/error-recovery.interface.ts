/**
 * Error Recovery Interfaces
 *
 * Provides resilience patterns for handling failures:
 * - Retry strategies (fixed, exponential, linear backoff)
 * - Circuit breaker pattern
 * - Fallback mechanisms
 * - Composite recovery strategies
 *
 * @module dx/error-recovery/interfaces
 */

/**
 * Backoff strategy type
 */
export type BackoffStrategy = 'fixed' | 'exponential' | 'linear';

/**
 * Retry options
 */
export interface RetryOptions {
  /** Maximum number of retry attempts */
  maxAttempts: number;
  /** Backoff strategy */
  backoff: BackoffStrategy;
  /** Initial delay in milliseconds */
  initialDelay: number;
  /** Maximum delay in milliseconds */
  maxDelay?: number;
  /** Multiplier for exponential backoff */
  multiplier?: number;
  /** Function to determine if error is retryable */
  retryOn?: (error: Error) => boolean;
  /** Callback on each retry attempt */
  onRetry?: (attempt: number, error: Error, delay: number) => void;
  /** Jitter factor (0-1) to add randomness */
  jitter?: number;
  /** Timeout for each attempt */
  timeout?: number;
}

/**
 * Circuit breaker state
 */
export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

/**
 * Circuit breaker options
 */
export interface CircuitBreakerOptions {
  /** Number of failures before opening circuit */
  failureThreshold: number;
  /** Number of successes to close circuit from half-open */
  successThreshold: number;
  /** Time in milliseconds before attempting half-open */
  timeout: number;
  /** Callback on state change */
  onStateChange?: (state: CircuitState, previousState: CircuitState) => void;
  /** Callback on failure */
  onFailure?: (error: Error) => void;
  /** Callback on success */
  onSuccess?: () => void;
  /** Function to determine if error should trip circuit */
  shouldTrip?: (error: Error) => boolean;
  /** Name for identification */
  name?: string;
}

/**
 * Fallback options
 */
export interface FallbackOptions {
  /** Timeout before falling back */
  timeout?: number;
  /** Function to determine if should use fallback */
  shouldFallback?: (error: Error) => boolean;
  /** Callback when fallback is used */
  onFallback?: (error: Error) => void;
}

/**
 * Recovery strategy type
 */
export type RecoveryStrategyType = 'retry' | 'circuit-breaker' | 'fallback' | 'timeout';

/**
 * Recovery strategy configuration
 */
export type RecoveryStrategy =
  | { type: 'retry'; options: RetryOptions }
  | { type: 'circuit-breaker'; options: CircuitBreakerOptions }
  | { type: 'fallback'; fallback: () => Promise<unknown>; options?: FallbackOptions }
  | { type: 'timeout'; timeout: number };

/**
 * Recovery result
 */
export interface RecoveryResult<T> {
  /** Whether operation succeeded */
  success: boolean;
  /** Result data if successful */
  data?: T;
  /** Error if failed */
  error?: Error;
  /** Number of attempts made */
  attempts: number;
  /** Total duration in milliseconds */
  duration: number;
  /** Strategy that produced the result */
  strategy: RecoveryStrategyType;
  /** Whether fallback was used */
  usedFallback: boolean;
}

/**
 * Circuit breaker status
 */
export interface CircuitBreakerStatus {
  /** Breaker name */
  name: string;
  /** Current state */
  state: CircuitState;
  /** Failure count */
  failures: number;
  /** Success count (in half-open) */
  successes: number;
  /** Last failure time */
  lastFailure?: Date;
  /** Time until half-open (if open) */
  timeUntilHalfOpen?: number;
}

/**
 * Error Recovery Interface
 *
 * Main interface for error recovery operations
 */
export interface IErrorRecovery {
  // === Retry ===

  /**
   * Execute operation with retry strategy
   */
  retry<T>(
    operation: () => Promise<T>,
    options?: Partial<RetryOptions>
  ): Promise<T>;

  // === Circuit Breaker ===

  /**
   * Execute operation with circuit breaker
   */
  withCircuitBreaker<T>(
    operation: () => Promise<T>,
    options?: Partial<CircuitBreakerOptions>
  ): Promise<T>;

  /**
   * Get circuit breaker status
   */
  getCircuitStatus(name?: string): CircuitBreakerStatus;

  /**
   * Reset circuit breaker
   */
  resetCircuit(name?: string): void;

  // === Fallback ===

  /**
   * Execute with fallback
   */
  withFallback<T>(
    primary: () => Promise<T>,
    fallback: () => Promise<T>,
    options?: FallbackOptions
  ): Promise<T>;

  // === Timeout ===

  /**
   * Execute with timeout
   */
  withTimeout<T>(
    operation: () => Promise<T>,
    timeout: number
  ): Promise<T>;

  // === Composite ===

  /**
   * Execute with multiple recovery strategies
   */
  withRecovery<T>(
    operation: () => Promise<T>,
    strategies: RecoveryStrategy[]
  ): Promise<RecoveryResult<T>>;

  // === Utilities ===

  /**
   * Create a named circuit breaker
   */
  createCircuitBreaker(
    name: string,
    options?: Partial<CircuitBreakerOptions>
  ): ICircuitBreaker;

  /**
   * Get or create a circuit breaker
   */
  getCircuitBreaker(name: string): ICircuitBreaker | undefined;

  /**
   * List all circuit breakers
   */
  listCircuitBreakers(): CircuitBreakerStatus[];

  /**
   * Dispose of resources
   */
  dispose(): void;
}

/**
 * Circuit Breaker Interface
 */
export interface ICircuitBreaker {
  /** Breaker name */
  readonly name: string;

  /** Current state */
  readonly state: CircuitState;

  /**
   * Execute operation through circuit breaker
   */
  execute<T>(operation: () => Promise<T>): Promise<T>;

  /**
   * Check if circuit allows execution
   */
  canExecute(): boolean;

  /**
   * Record success
   */
  recordSuccess(): void;

  /**
   * Record failure
   */
  recordFailure(error: Error): void;

  /**
   * Get status
   */
  getStatus(): CircuitBreakerStatus;

  /**
   * Reset to closed state
   */
  reset(): void;

  /**
   * Force open the circuit
   */
  forceOpen(): void;
}

/**
 * Retry error (thrown after all retries exhausted)
 */
export class RetryExhaustedError extends Error {
  constructor(
    message: string,
    public readonly attempts: number,
    public readonly lastError: Error
  ) {
    super(message);
    this.name = 'RetryExhaustedError';
  }
}

/**
 * Circuit open error
 */
export class CircuitOpenError extends Error {
  constructor(
    public readonly circuitName: string,
    public readonly status: CircuitBreakerStatus
  ) {
    super(`Circuit breaker '${circuitName}' is open`);
    this.name = 'CircuitOpenError';
  }
}

/**
 * Timeout error
 */
export class TimeoutError extends Error {
  constructor(
    message: string,
    public readonly timeout: number
  ) {
    super(message);
    this.name = 'TimeoutError';
  }
}

/**
 * Default retry options
 */
export const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxAttempts: 3,
  backoff: 'exponential',
  initialDelay: 1000,
  maxDelay: 30000,
  multiplier: 2,
  jitter: 0.1,
};

/**
 * Default circuit breaker options
 */
export const DEFAULT_CIRCUIT_OPTIONS: CircuitBreakerOptions = {
  failureThreshold: 5,
  successThreshold: 3,
  timeout: 30000,
};
