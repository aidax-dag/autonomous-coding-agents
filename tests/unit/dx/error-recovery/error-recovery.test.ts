/**
 * Error Recovery Tests
 */

import {
  createErrorRecovery,
  RetryExhaustedError,
  CircuitOpenError,
  TimeoutError,
  type IErrorRecovery,
} from '../../../../src/dx/error-recovery';

describe('Error Recovery', () => {
  let recovery: IErrorRecovery;

  beforeEach(() => {
    recovery = createErrorRecovery();
  });

  afterEach(() => {
    recovery.dispose();
  });

  describe('Retry', () => {
    it('should succeed on first try', async () => {
      let attempts = 0;
      const result = await recovery.retry(async () => {
        attempts++;
        return 'success';
      });

      expect(result).toBe('success');
      expect(attempts).toBe(1);
    });

    it('should retry on failure and succeed', async () => {
      let attempts = 0;
      const result = await recovery.retry(
        async () => {
          attempts++;
          if (attempts < 3) {
            throw new Error('temporary failure');
          }
          return 'success';
        },
        { maxAttempts: 5, initialDelay: 10 }
      );

      expect(result).toBe('success');
      expect(attempts).toBe(3);
    });

    it('should throw RetryExhaustedError after max attempts', async () => {
      let attempts = 0;

      await expect(
        recovery.retry(
          async () => {
            attempts++;
            throw new Error('always fails');
          },
          { maxAttempts: 3, initialDelay: 10 }
        )
      ).rejects.toThrow(RetryExhaustedError);

      expect(attempts).toBe(3);
    });

    it('should call onRetry callback', async () => {
      const retries: { attempt: number; delay: number }[] = [];

      try {
        await recovery.retry(
          async () => {
            throw new Error('fail');
          },
          {
            maxAttempts: 3,
            initialDelay: 10,
            backoff: 'fixed',
            onRetry: (attempt, _error, delay) => {
              retries.push({ attempt, delay });
            },
          }
        );
      } catch {
        // Expected
      }

      expect(retries).toHaveLength(2); // Only called on retries, not final attempt
      expect(retries[0].attempt).toBe(1);
      expect(retries[1].attempt).toBe(2);
    });

    it('should respect retryOn filter', async () => {
      let attempts = 0;

      await expect(
        recovery.retry(
          async () => {
            attempts++;
            throw new Error('not retryable');
          },
          {
            maxAttempts: 5,
            initialDelay: 10,
            retryOn: (error) => error.message !== 'not retryable',
          }
        )
      ).rejects.toThrow('not retryable');

      expect(attempts).toBe(1); // Should not retry
    });

    describe('Backoff Strategies', () => {
      it('should use fixed backoff', async () => {
        const delays: number[] = [];

        try {
          await recovery.retry(
            async () => {
              throw new Error('fail');
            },
            {
              maxAttempts: 4,
              initialDelay: 100,
              backoff: 'fixed',
              jitter: 0, // Disable jitter for predictable test
              onRetry: (_attempt, _error, delay) => delays.push(delay),
            }
          );
        } catch {
          // Expected
        }

        // All delays should be the same
        expect(delays.every((d) => d === 100)).toBe(true);
      });

      it('should use exponential backoff', async () => {
        const delays: number[] = [];

        try {
          await recovery.retry(
            async () => {
              throw new Error('fail');
            },
            {
              maxAttempts: 4,
              initialDelay: 100,
              backoff: 'exponential',
              multiplier: 2,
              jitter: 0, // Disable jitter for predictable test
              onRetry: (_attempt, _error, delay) => delays.push(delay),
            }
          );
        } catch {
          // Expected
        }

        expect(delays[0]).toBe(100);
        expect(delays[1]).toBe(200);
        expect(delays[2]).toBe(400);
      });

      it('should use linear backoff', async () => {
        const delays: number[] = [];

        try {
          await recovery.retry(
            async () => {
              throw new Error('fail');
            },
            {
              maxAttempts: 4,
              initialDelay: 100,
              backoff: 'linear',
              jitter: 0,
              onRetry: (_attempt, _error, delay) => delays.push(delay),
            }
          );
        } catch {
          // Expected
        }

        expect(delays[0]).toBe(100);
        expect(delays[1]).toBe(200);
        expect(delays[2]).toBe(300);
      });

      it('should respect maxDelay', async () => {
        const delays: number[] = [];

        try {
          await recovery.retry(
            async () => {
              throw new Error('fail');
            },
            {
              maxAttempts: 5,
              initialDelay: 100,
              backoff: 'exponential',
              multiplier: 10,
              maxDelay: 500,
              jitter: 0,
              onRetry: (_attempt, _error, delay) => delays.push(delay),
            }
          );
        } catch {
          // Expected
        }

        expect(delays.every((d) => d <= 500)).toBe(true);
      });
    });
  });

  describe('Circuit Breaker', () => {
    it('should allow execution when closed', async () => {
      const result = await recovery.withCircuitBreaker(
        async () => 'success',
        { name: 'test-circuit', failureThreshold: 5 }
      );

      expect(result).toBe('success');
    });

    it('should open after failure threshold', async () => {
      const circuitName = 'threshold-test';
      const options = { name: circuitName, failureThreshold: 3, timeout: 10000 };

      // Fail 3 times to open the circuit
      for (let i = 0; i < 3; i++) {
        try {
          await recovery.withCircuitBreaker(async () => {
            throw new Error('fail');
          }, options);
        } catch {
          // Expected
        }
      }

      const status = recovery.getCircuitStatus(circuitName);
      expect(status.state).toBe('OPEN');

      // Next call should throw CircuitOpenError
      await expect(
        recovery.withCircuitBreaker(async () => 'should not run', options)
      ).rejects.toThrow(CircuitOpenError);
    });

    it('should transition to half-open after timeout', async () => {
      const circuitName = 'halfopen-test';
      const breaker = recovery.createCircuitBreaker(circuitName, {
        failureThreshold: 2,
        timeout: 50, // 50ms timeout
        successThreshold: 1,
      });

      // Fail to open the circuit
      for (let i = 0; i < 2; i++) {
        try {
          await breaker.execute(async () => {
            throw new Error('fail');
          });
        } catch {
          // Expected
        }
      }

      expect(breaker.state).toBe('OPEN');

      // Wait for timeout
      await new Promise((r) => setTimeout(r, 100));

      // Should now allow one request (half-open)
      expect(breaker.canExecute()).toBe(true);
    });

    it('should close after success threshold in half-open', async () => {
      const breaker = recovery.createCircuitBreaker('close-test', {
        failureThreshold: 2,
        timeout: 50,
        successThreshold: 2,
      });

      // Open the circuit
      for (let i = 0; i < 2; i++) {
        try {
          await breaker.execute(async () => {
            throw new Error('fail');
          });
        } catch {
          // Expected
        }
      }

      // Wait for half-open
      await new Promise((r) => setTimeout(r, 100));

      // Succeed to close
      await breaker.execute(async () => 'success');
      await breaker.execute(async () => 'success');

      expect(breaker.state).toBe('CLOSED');
    });

    it('should reset circuit', async () => {
      const circuitName = 'reset-test';

      // Open the circuit
      for (let i = 0; i < 5; i++) {
        try {
          await recovery.withCircuitBreaker(
            async () => {
              throw new Error('fail');
            },
            { name: circuitName, failureThreshold: 3 }
          );
        } catch {
          // Expected
        }
      }

      expect(recovery.getCircuitStatus(circuitName).state).toBe('OPEN');

      recovery.resetCircuit(circuitName);

      expect(recovery.getCircuitStatus(circuitName).state).toBe('CLOSED');
    });

    it('should list all circuit breakers', () => {
      recovery.createCircuitBreaker('circuit-1', { failureThreshold: 5 });
      recovery.createCircuitBreaker('circuit-2', { failureThreshold: 3 });

      const circuits = recovery.listCircuitBreakers();
      expect(circuits).toHaveLength(2);
      expect(circuits.map((c) => c.name).sort()).toEqual(['circuit-1', 'circuit-2']);
    });
  });

  describe('Fallback', () => {
    it('should return primary result on success', async () => {
      const result = await recovery.withFallback(
        async () => 'primary',
        async () => 'fallback'
      );

      expect(result).toBe('primary');
    });

    it('should return fallback on primary failure', async () => {
      const result = await recovery.withFallback(
        async () => {
          throw new Error('primary failed');
        },
        async () => 'fallback'
      );

      expect(result).toBe('fallback');
    });

    it('should call onFallback callback', async () => {
      let fallbackCalled = false;
      let fallbackError: Error | undefined;

      await recovery.withFallback(
        async () => {
          throw new Error('primary error');
        },
        async () => 'fallback',
        {
          onFallback: (error) => {
            fallbackCalled = true;
            fallbackError = error;
          },
        }
      );

      expect(fallbackCalled).toBe(true);
      expect(fallbackError?.message).toBe('primary error');
    });

    it('should respect shouldFallback filter', async () => {
      await expect(
        recovery.withFallback(
          async () => {
            throw new Error('critical error');
          },
          async () => 'fallback',
          {
            shouldFallback: (error) => !error.message.includes('critical'),
          }
        )
      ).rejects.toThrow('critical error');
    });
  });

  describe('Timeout', () => {
    it('should complete before timeout', async () => {
      const result = await recovery.withTimeout(async () => {
        await new Promise((r) => setTimeout(r, 10));
        return 'success';
      }, 1000);

      expect(result).toBe('success');
    });

    it('should throw TimeoutError when exceeded', async () => {
      await expect(
        recovery.withTimeout(async () => {
          await new Promise((r) => setTimeout(r, 200));
          return 'too slow';
        }, 50)
      ).rejects.toThrow(TimeoutError);
    });
  });

  describe('Composite Recovery', () => {
    it('should apply multiple strategies', async () => {
      let attempts = 0;

      const result = await recovery.withRecovery(
        async () => {
          attempts++;
          if (attempts < 2) {
            throw new Error('temporary');
          }
          return 'success';
        },
        [
          { type: 'timeout', timeout: 5000 },
          {
            type: 'retry',
            options: {
              maxAttempts: 3,
              initialDelay: 10,
              backoff: 'fixed',
            },
          },
        ]
      );

      expect(result.success).toBe(true);
      expect(result.data).toBe('success');
    });

    it('should return failure result when all strategies fail', async () => {
      const result = await recovery.withRecovery(
        async () => {
          throw new Error('always fails');
        },
        [
          {
            type: 'retry',
            options: {
              maxAttempts: 2,
              initialDelay: 10,
              backoff: 'fixed',
            },
          },
        ]
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should use fallback strategy', async () => {
      const result = await recovery.withRecovery(
        async () => {
          throw new Error('primary fails');
        },
        [
          {
            type: 'fallback',
            fallback: async () => 'fallback-value',
          },
        ]
      );

      expect(result.success).toBe(true);
      expect(result.usedFallback).toBe(true);
    });

    it('should report duration', async () => {
      const result = await recovery.withRecovery(
        async () => {
          await new Promise((r) => setTimeout(r, 50));
          return 'done';
        },
        []
      );

      expect(result.duration).toBeGreaterThanOrEqual(50);
    });
  });

  describe('Dispose', () => {
    it('should throw after dispose', async () => {
      recovery.dispose();

      await expect(recovery.retry(async () => 'test')).rejects.toThrow(
        /disposed/
      );
    });
  });
});
