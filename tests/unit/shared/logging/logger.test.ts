import {
  logger,
  AgentLogger,
  createAgentLogger,
  PerformanceTimer,
  startTimer,
  withTiming,
} from '@/shared/logging/logger';
import winston from 'winston';

/**
 * Logging System Tests
 *
 * Tests the centralized logging system with Winston.
 *
 * Feature: F1.3 - Logging System
 */

describe('Logging System', () => {
  describe('Base Logger', () => {
    it('should be a winston logger instance', () => {
      expect(logger).toBeDefined();
      expect(logger).toBeInstanceOf(winston.Logger);
    });

    it('should have correct log levels', () => {
      expect(logger.levels).toBeDefined();
      expect(logger.levels.error).toBe(0);
      expect(logger.levels.warn).toBe(1);
      expect(logger.levels.info).toBe(2);
      expect(logger.levels.debug).toBe(3);
    });

    it('should log messages at different levels', () => {
      // These should not throw
      expect(() => logger.error('Test error')).not.toThrow();
      expect(() => logger.warn('Test warning')).not.toThrow();
      expect(() => logger.info('Test info')).not.toThrow();
      expect(() => logger.debug('Test debug')).not.toThrow();
    });
  });

  describe('AgentLogger', () => {
    let agentLogger: AgentLogger;

    beforeEach(() => {
      agentLogger = new AgentLogger('CODER', 'test-agent-123');
    });

    it('should create agent logger with type and id', () => {
      expect(agentLogger).toBeDefined();
      expect(agentLogger).toBeInstanceOf(AgentLogger);
    });

    it('should log error with Error object', () => {
      const error = new Error('Test error');
      expect(() => agentLogger.error('An error occurred', error)).not.toThrow();
    });

    it('should log error with metadata', () => {
      expect(() =>
        agentLogger.error('Error with context', undefined, {
          userId: '123',
          action: 'create_pr',
        })
      ).not.toThrow();
    });

    it('should log warning', () => {
      expect(() => agentLogger.warn('Warning message')).not.toThrow();
    });

    it('should log info', () => {
      expect(() => agentLogger.info('Info message')).not.toThrow();
    });

    it('should log debug', () => {
      expect(() => agentLogger.debug('Debug message')).not.toThrow();
    });

    it('should log with metadata', () => {
      expect(() =>
        agentLogger.info('Message with metadata', {
          featureId: 'abc-123',
          status: 'in_progress',
        })
      ).not.toThrow();
    });
  });

  describe('AgentLogger - Specialized Methods', () => {
    let agentLogger: AgentLogger;

    beforeEach(() => {
      agentLogger = createAgentLogger('REVIEWER', 'reviewer-456');
    });

    it('should log feature events', () => {
      const featureId = crypto.randomUUID();
      expect(() =>
        agentLogger.featureEvent('started', featureId, {
          title: 'Add authentication',
        })
      ).not.toThrow();
    });

    it('should log PR events', () => {
      const featureId = crypto.randomUUID();
      expect(() =>
        agentLogger.prEvent('created', 42, featureId, {
          url: 'https://github.com/test/repo/pull/42',
        })
      ).not.toThrow();
    });

    it('should log message events', () => {
      const messageId = crypto.randomUUID();
      expect(() =>
        agentLogger.messageEvent('received', 'FEATURE_ASSIGNED', messageId, {
          from: 'REPO_MANAGER',
        })
      ).not.toThrow();
    });

    it('should log LLM interactions', () => {
      expect(() =>
        agentLogger.llmInteraction('anthropic', 'claude-3-5-sonnet-20241022', 1500, {
          promptTokens: 1000,
          completionTokens: 500,
        })
      ).not.toThrow();
    });

    it('should log performance metrics', () => {
      expect(() =>
        agentLogger.performance('code_generation', 2500, {
          linesGenerated: 150,
        })
      ).not.toThrow();
    });
  });

  describe('Child Logger', () => {
    it('should create child logger with additional context', () => {
      const parentLogger = createAgentLogger('CODER', 'coder-1');
      const childLogger = parentLogger.child({
        featureId: crypto.randomUUID(),
        prNumber: 42,
      });

      expect(childLogger).toBeDefined();
      expect(childLogger).toBeInstanceOf(AgentLogger);
      expect(() => childLogger.info('Child logger message')).not.toThrow();
    });

    it('should inherit parent context in child logger', () => {
      const parentLogger = createAgentLogger('REPO_MANAGER', 'manager-1');
      const childLogger = parentLogger.child({
        sessionId: 'session-123',
      });

      expect(() =>
        childLogger.info('Message with parent and child context', {
          additionalData: 'test',
        })
      ).not.toThrow();
    });
  });

  describe('Performance Timer', () => {
    let agentLogger: AgentLogger;

    beforeEach(() => {
      agentLogger = createAgentLogger('CODER', 'coder-timer');
    });

    it('should measure elapsed time', async () => {
      const timer = startTimer(agentLogger, 'test_operation');

      await new Promise((resolve) => setTimeout(resolve, 100));

      const elapsed = timer.elapsed();
      expect(elapsed).toBeGreaterThanOrEqual(100);
      expect(elapsed).toBeLessThan(200);
    });

    it('should end timer and log duration', async () => {
      const timer = startTimer(agentLogger, 'test_operation');

      await new Promise((resolve) => setTimeout(resolve, 50));

      const duration = timer.end({ success: true });
      expect(duration).toBeGreaterThanOrEqual(50);
      expect(duration).toBeLessThan(150);
    });

    it('should support multiple timers', async () => {
      const timer1 = startTimer(agentLogger, 'operation_1');
      await new Promise((resolve) => setTimeout(resolve, 50));

      const timer2 = startTimer(agentLogger, 'operation_2');
      await new Promise((resolve) => setTimeout(resolve, 30));

      const duration2 = timer2.end();
      const duration1 = timer1.end();

      expect(duration1).toBeGreaterThanOrEqual(80);
      expect(duration2).toBeGreaterThanOrEqual(30);
      expect(duration2).toBeLessThan(duration1);
    });
  });

  describe('withTiming Helper', () => {
    let agentLogger: AgentLogger;

    beforeEach(() => {
      agentLogger = createAgentLogger('CODER', 'coder-timing');
    });

    it('should time async operation and return result', async () => {
      const result = await withTiming(agentLogger, 'async_operation', async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return 'success';
      });

      expect(result).toBe('success');
    });

    it('should time operation with additional details', async () => {
      const result = await withTiming(
        agentLogger,
        'complex_operation',
        async () => {
          await new Promise((resolve) => setTimeout(resolve, 30));
          return { data: 'test' };
        },
        { userId: '123' }
      );

      expect(result).toEqual({ data: 'test' });
    });

    it('should log timing even when operation fails', async () => {
      await expect(
        withTiming(agentLogger, 'failing_operation', async () => {
          await new Promise((resolve) => setTimeout(resolve, 20));
          throw new Error('Operation failed');
        })
      ).rejects.toThrow('Operation failed');

      // Timer should still have logged the duration
    });

    it('should handle operations that return undefined', async () => {
      const result = await withTiming(agentLogger, 'void_operation', async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      expect(result).toBeUndefined();
    });
  });

  describe('Error Handling', () => {
    let agentLogger: AgentLogger;

    beforeEach(() => {
      agentLogger = createAgentLogger('SYSTEM', 'error-handler');
    });

    it('should handle Error instances', () => {
      const error = new Error('Test error');
      error.stack = 'Error: Test error\n  at test.ts:10';

      expect(() => agentLogger.error('Error occurred', error)).not.toThrow();
    });

    it('should handle non-Error objects', () => {
      const errorObj = { code: 'ERR_CODE', message: 'Error message' };

      expect(() => agentLogger.error('Error occurred', errorObj)).not.toThrow();
    });

    it('should handle undefined error', () => {
      expect(() => agentLogger.error('Error without details')).not.toThrow();
    });

    it('should include stack trace for Error objects', () => {
      const error = new Error('Stack trace test');
      Error.captureStackTrace(error);

      expect(() =>
        agentLogger.error('Error with stack', error, {
          context: 'test',
        })
      ).not.toThrow();
    });
  });

  describe('createAgentLogger Factory', () => {
    it('should create logger with agent type only', () => {
      const logger1 = createAgentLogger('CODER');
      expect(logger1).toBeDefined();
      expect(logger1).toBeInstanceOf(AgentLogger);
    });

    it('should create logger with agent type and id', () => {
      const logger2 = createAgentLogger('REVIEWER', 'reviewer-999');
      expect(logger2).toBeDefined();
      expect(logger2).toBeInstanceOf(AgentLogger);
    });

    it('should create multiple independent loggers', () => {
      const logger1 = createAgentLogger('CODER', 'coder-1');
      const logger2 = createAgentLogger('REVIEWER', 'reviewer-1');

      expect(logger1).not.toBe(logger2);
      expect(() => logger1.info('Logger 1 message')).not.toThrow();
      expect(() => logger2.info('Logger 2 message')).not.toThrow();
    });
  });

  describe('Complex Logging Scenarios', () => {
    it('should handle deeply nested metadata', () => {
      const logger1 = createAgentLogger('CODER');

      expect(() =>
        logger1.info('Complex metadata', {
          level1: {
            level2: {
              level3: {
                value: 'deeply nested',
                array: [1, 2, 3],
              },
            },
          },
        })
      ).not.toThrow();
    });

    it('should handle large metadata objects', () => {
      const logger1 = createAgentLogger('CODER');
      const largeObject = {
        items: Array.from({ length: 100 }, (_, i) => ({
          id: i,
          name: `Item ${i}`,
        })),
      };

      expect(() => logger1.debug('Large metadata', largeObject)).not.toThrow();
    });

    it('should handle concurrent logging from multiple agents', () => {
      const coderLogger = createAgentLogger('CODER', 'coder-concurrent');
      const reviewerLogger = createAgentLogger('REVIEWER', 'reviewer-concurrent');
      const managerLogger = createAgentLogger('REPO_MANAGER', 'manager-concurrent');

      expect(() => {
        coderLogger.info('Coder message 1');
        reviewerLogger.info('Reviewer message 1');
        managerLogger.info('Manager message 1');
        coderLogger.info('Coder message 2');
        reviewerLogger.warn('Reviewer warning');
        managerLogger.error('Manager error', new Error('Test'));
      }).not.toThrow();
    });

    it('should handle special characters in messages', () => {
      const logger1 = createAgentLogger('CODER');

      expect(() =>
        logger1.info('Special chars: \n\t\r\\" \' 日本語 émojis 🚀')
      ).not.toThrow();
    });
  });

  describe('Performance Characteristics', () => {
    it('should log many messages quickly', () => {
      const logger1 = createAgentLogger('CODER', 'perf-test');
      const startTime = Date.now();

      for (let i = 0; i < 1000; i++) {
        logger1.debug(`Message ${i}`, { index: i });
      }

      const duration = Date.now() - startTime;
      // Should complete in reasonable time (< 1 second for 1000 logs)
      expect(duration).toBeLessThan(1000);
    });

    it('should handle rapid timer creation and completion', () => {
      const logger1 = createAgentLogger('CODER', 'timer-perf');
      const timers: PerformanceTimer[] = [];

      for (let i = 0; i < 100; i++) {
        timers.push(startTimer(logger1, `operation_${i}`));
      }

      timers.forEach((timer) => timer.end());

      expect(timers).toHaveLength(100);
    });
  });
});
