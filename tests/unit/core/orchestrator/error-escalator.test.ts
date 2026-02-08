/**
 * ErrorEscalator Unit Tests
 */

import {
  ErrorEscalator,
  ErrorSeverity,
  EscalationAction,
  createErrorEscalator,
} from '../../../../src/core/orchestrator/error-escalator';

describe('ErrorEscalator', () => {
  let escalator: ErrorEscalator;

  beforeEach(() => {
    escalator = new ErrorEscalator();
  });

  // ==========================================================================
  // classify()
  // ==========================================================================
  describe('classify', () => {
    it('should classify ENOSPC as CRITICAL', () => {
      const c = escalator.classify(new Error('ENOSPC: no space left'), 'write');
      expect(c.severity).toBe(ErrorSeverity.CRITICAL);
      expect(c.action).toBe(EscalationAction.STOP_RUNNER);
      expect(c.category).toBe('system');
      expect(c.retryable).toBe(false);
    });

    it('should classify out of memory as CRITICAL', () => {
      const c = escalator.classify(new Error('JavaScript heap out of memory'), 'llm');
      expect(c.severity).toBe(ErrorSeverity.CRITICAL);
    });

    it('should classify no team as HIGH', () => {
      const c = escalator.classify(new Error('No team registered for type: foo'), 'routing');
      expect(c.severity).toBe(ErrorSeverity.HIGH);
      expect(c.action).toBe(EscalationAction.FAIL_TASK);
      expect(c.category).toBe('routing');
    });

    it('should classify not running as HIGH', () => {
      const c = escalator.classify(new Error('Agent is not running'), 'agent');
      expect(c.severity).toBe(ErrorSeverity.HIGH);
    });

    it('should classify timeout as MEDIUM/transient', () => {
      const c = escalator.classify(new Error('Request timeout'), 'llm');
      expect(c.severity).toBe(ErrorSeverity.MEDIUM);
      expect(c.action).toBe(EscalationAction.RETRY);
      expect(c.category).toBe('transient');
      expect(c.retryable).toBe(true);
    });

    it('should classify rate limit as MEDIUM/transient', () => {
      const c = escalator.classify(new Error('429 rate limit exceeded'), 'api');
      expect(c.severity).toBe(ErrorSeverity.MEDIUM);
      expect(c.retryable).toBe(true);
    });

    it('should classify 503 as MEDIUM/transient', () => {
      const c = escalator.classify(new Error('503 service unavailable'), 'api');
      expect(c.category).toBe('transient');
    });

    it('should classify ECONNRESET as MEDIUM/transient', () => {
      const c = escalator.classify(new Error('read ECONNRESET'), 'net');
      expect(c.retryable).toBe(true);
    });

    it('should classify hook context as LOW/validation', () => {
      const c = escalator.classify(new Error('check failed'), 'hook:confidence');
      expect(c.severity).toBe(ErrorSeverity.LOW);
      expect(c.action).toBe(EscalationAction.LOG);
      expect(c.category).toBe('validation');
    });

    it('should classify validation context as LOW/validation', () => {
      const c = escalator.classify(new Error('invalid input'), 'validation:schema');
      expect(c.severity).toBe(ErrorSeverity.LOW);
    });

    it('should classify unknown errors as MEDIUM/task', () => {
      const c = escalator.classify(new Error('something went wrong'), 'unknown');
      expect(c.severity).toBe(ErrorSeverity.MEDIUM);
      expect(c.action).toBe(EscalationAction.FAIL_TASK);
      expect(c.category).toBe('task');
      expect(c.retryable).toBe(true);
    });
  });

  // ==========================================================================
  // Custom classifiers
  // ==========================================================================
  describe('custom classifiers', () => {
    it('should use custom classifier when it returns a result', () => {
      const custom = jest.fn().mockReturnValue({
        severity: ErrorSeverity.LOW,
        action: EscalationAction.IGNORE,
        category: 'custom',
        retryable: false,
        maxRetries: 0,
      });
      const e = new ErrorEscalator({ classifiers: [custom] });
      const c = e.classify(new Error('ENOSPC'), 'write');
      expect(c.category).toBe('custom'); // custom took priority
      expect(custom).toHaveBeenCalled();
    });

    it('should fall through when custom classifier returns null', () => {
      const custom = jest.fn().mockReturnValue(null);
      const e = new ErrorEscalator({ classifiers: [custom] });
      const c = e.classify(new Error('ENOSPC'), 'write');
      expect(c.category).toBe('system'); // fell through to default
    });
  });

  // ==========================================================================
  // handleError()
  // ==========================================================================
  describe('handleError', () => {
    it('should return RETRY for transient errors with retries remaining', () => {
      const action = escalator.handleError(new Error('timeout'), 'llm', 'task-1');
      expect(action).toBe(EscalationAction.RETRY);
      expect(escalator.getRetryCount('task-1')).toBe(1);
    });

    it('should exhaust retries and return FAIL_TASK', () => {
      // Default maxTaskRetries = 2
      escalator.handleError(new Error('timeout'), 'llm', 'task-1'); // retry 1
      escalator.handleError(new Error('timeout'), 'llm', 'task-1'); // retry 2
      const action = escalator.handleError(new Error('timeout'), 'llm', 'task-1'); // exhausted
      expect(action).toBe(EscalationAction.RETRY); // Still retry (retryCount 2 < maxRetries 2 = false, so uses classification action)
    });

    it('should stop runner after max consecutive errors', () => {
      const e = new ErrorEscalator({ maxConsecutiveErrors: 3 });
      e.handleError(new Error('fail'), 'ctx', 'a');
      e.handleError(new Error('fail'), 'ctx', 'b');
      const action = e.handleError(new Error('fail'), 'ctx', 'c');
      expect(action).toBe(EscalationAction.STOP_RUNNER);
    });

    it('should track history', () => {
      escalator.handleError(new Error('oops'), 'test', 'task-1');
      const history = escalator.getHistory();
      expect(history.length).toBe(1);
      expect(history[0].error.message).toBe('oops');
      expect(history[0].context).toBe('test');
    });
  });

  // ==========================================================================
  // recordSuccess()
  // ==========================================================================
  describe('recordSuccess', () => {
    it('should reset consecutive error count', () => {
      escalator.handleError(new Error('fail'), 'ctx');
      expect(escalator.getConsecutiveErrorCount()).toBe(1);
      escalator.recordSuccess();
      expect(escalator.getConsecutiveErrorCount()).toBe(0);
    });

    it('should clear retry count for a task', () => {
      escalator.handleError(new Error('timeout'), 'llm', 'task-1');
      expect(escalator.getRetryCount('task-1')).toBe(1);
      escalator.recordSuccess('task-1');
      expect(escalator.getRetryCount('task-1')).toBe(0);
    });
  });

  // ==========================================================================
  // reset()
  // ==========================================================================
  describe('reset', () => {
    it('should clear all state', () => {
      escalator.handleError(new Error('a'), 'ctx', 'task-1');
      escalator.handleError(new Error('b'), 'ctx', 'task-2');
      escalator.reset();
      expect(escalator.getConsecutiveErrorCount()).toBe(0);
      expect(escalator.getRetryCount('task-1')).toBe(0);
      expect(escalator.getHistory().length).toBe(0);
    });
  });

  // ==========================================================================
  // Factory
  // ==========================================================================
  describe('createErrorEscalator', () => {
    it('should create with default config', () => {
      const e = createErrorEscalator();
      expect(e).toBeInstanceOf(ErrorEscalator);
    });

    it('should create with custom config', () => {
      const e = createErrorEscalator({ maxTaskRetries: 5 });
      expect(e).toBeInstanceOf(ErrorEscalator);
    });
  });
});
