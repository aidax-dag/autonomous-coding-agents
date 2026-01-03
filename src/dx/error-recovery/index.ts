/**
 * Error Recovery Module
 *
 * Provides resilience patterns for handling failures:
 * - Retry strategies (fixed, exponential, linear backoff)
 * - Circuit breaker pattern
 * - Fallback mechanisms
 * - Timeout handling
 * - Composite recovery strategies
 *
 * @module dx/error-recovery
 *
 * @example
 * ```typescript
 * import { createErrorRecovery } from '@/dx/error-recovery';
 *
 * const recovery = createErrorRecovery();
 *
 * // Retry with exponential backoff
 * const result = await recovery.retry(
 *   () => fetchData(),
 *   {
 *     maxAttempts: 3,
 *     backoff: 'exponential',
 *     initialDelay: 1000,
 *     onRetry: (attempt, error) => console.log(`Retry ${attempt}:`, error.message),
 *   }
 * );
 *
 * // Circuit breaker
 * const breaker = recovery.createCircuitBreaker('api', {
 *   failureThreshold: 5,
 *   timeout: 30000,
 *   onStateChange: (state) => console.log(`Circuit state: ${state}`),
 * });
 *
 * // Execute with circuit breaker
 * try {
 *   await breaker.execute(() => apiCall());
 * } catch (error) {
 *   if (error instanceof CircuitOpenError) {
 *     console.log('Circuit is open, using fallback');
 *   }
 * }
 *
 * // With fallback
 * const data = await recovery.withFallback(
 *   () => primarySource(),
 *   () => fallbackSource(),
 *   { onFallback: (error) => console.log('Using fallback:', error.message) }
 * );
 *
 * // Composite strategy
 * const result = await recovery.withRecovery(
 *   () => riskyOperation(),
 *   [
 *     { type: 'timeout', timeout: 5000 },
 *     { type: 'retry', options: { maxAttempts: 3 } },
 *     { type: 'circuit-breaker', options: { failureThreshold: 5 } },
 *   ]
 * );
 * ```
 */

// Interfaces
export {
  type IErrorRecovery,
  type ICircuitBreaker,
  type RetryOptions,
  type CircuitBreakerOptions,
  type FallbackOptions,
  type RecoveryStrategy,
  type RecoveryResult,
  type CircuitState,
  type CircuitBreakerStatus,
  type BackoffStrategy,
  type RecoveryStrategyType,
  RetryExhaustedError,
  CircuitOpenError,
  TimeoutError,
  DEFAULT_RETRY_OPTIONS,
  DEFAULT_CIRCUIT_OPTIONS,
} from './interfaces/error-recovery.interface';

// Implementation
export {
  ErrorRecovery,
  CircuitBreaker,
  createErrorRecovery,
} from './impl/error-recovery.impl';
