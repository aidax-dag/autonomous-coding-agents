/**
 * RetryStrategy Tests
 */

import { RetryStrategy, createRetryStrategy } from '../../../../src/core/deep-worker/retry-strategy';
import type { DeepWorkerContext } from '../../../../src/core/deep-worker/interfaces/deep-worker.interface';

const context: DeepWorkerContext = {
  workspaceDir: '/tmp/test',
  taskDescription: 'Fix build error',
};

describe('RetryStrategy', () => {
  describe('getNextStrategy', () => {
    it('should return progressive strategies', () => {
      const retry = new RetryStrategy({ maxRetries: 4 });

      const s0 = retry.getNextStrategy(context, '', 0);
      expect(s0!.name).toBe('original');

      const s1 = retry.getNextStrategy(context, 'failed', 1);
      expect(s1!.name).toBe('simplified');

      const s2 = retry.getNextStrategy(context, 'failed', 2);
      expect(s2!.name).toBe('alternative');

      const s3 = retry.getNextStrategy(context, 'failed', 3);
      expect(s3!.name).toBe('decomposed');
    });

    it('should return null when max retries exceeded', () => {
      const retry = new RetryStrategy({ maxRetries: 2 });
      const result = retry.getNextStrategy(context, 'error', 2);
      expect(result).toBeNull();
    });

    it('should use custom strategy generator', () => {
      const retry = new RetryStrategy({
        maxRetries: 3,
        strategyGenerator: (_ctx, _err, attempt) => ({
          name: `custom-${attempt}`,
          reason: 'custom',
          changes: [],
          attempt,
          maxAttempts: 3,
        }),
      });

      const s0 = retry.getNextStrategy(context, '', 0);
      expect(s0!.name).toBe('custom-0');
    });

    it('should respect context maxRetries over option', () => {
      const retry = new RetryStrategy({ maxRetries: 10 });
      const ctxWithMax: DeepWorkerContext = { ...context, maxRetries: 1 };

      expect(retry.getNextStrategy(ctxWithMax, 'err', 0)).not.toBeNull();
      expect(retry.getNextStrategy(ctxWithMax, 'err', 1)).toBeNull();
    });
  });

  describe('executeWithRetry', () => {
    it('should succeed on first attempt', async () => {
      const retry = new RetryStrategy();

      const result = await retry.executeWithRetry(
        async () => 'success',
        context,
      );

      expect(result.success).toBe(true);
      expect(result.output).toBe('success');
      expect(result.strategy.name).toBe('original');
    });

    it('should retry on failure and succeed', async () => {
      const retry = new RetryStrategy({ maxRetries: 3 });
      let attempts = 0;

      const result = await retry.executeWithRetry(
        async () => {
          attempts++;
          if (attempts < 3) throw new Error(`fail-${attempts}`);
          return 'recovered';
        },
        context,
      );

      expect(result.success).toBe(true);
      expect(result.output).toBe('recovered');
      expect(attempts).toBe(3);
    });

    it('should fail after exhausting all retries', async () => {
      const retry = new RetryStrategy({ maxRetries: 2 });

      const result = await retry.executeWithRetry(
        async () => { throw new Error('always fails'); },
        context,
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('always fails');
      expect(result.strategy.name).toBe('exhausted');
    });

    it('should include duration', async () => {
      const retry = new RetryStrategy({ maxRetries: 1 });

      const result = await retry.executeWithRetry(
        async () => 'ok',
        context,
      );

      expect(result.duration).toBeGreaterThanOrEqual(0);
    });
  });

  it('should be created via factory', () => {
    expect(createRetryStrategy()).toBeInstanceOf(RetryStrategy);
  });
});
