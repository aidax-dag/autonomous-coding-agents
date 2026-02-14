/**
 * LoopDetector Unit Tests
 */

import {
  LoopDetector,
  createLoopDetector,
} from '../../../../src/core/orchestrator/loop-detector';
import type {
  ExecutionEntry,
  LoopDetectorConfig,
} from '../../../../src/core/orchestrator/loop-detector';

jest.mock('../../../../src/shared/logging/logger', () => ({
  createAgentLogger: () => ({
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

/** Helper: create an ExecutionEntry with defaults */
function makeEntry(
  overrides: Partial<ExecutionEntry> = {},
): ExecutionEntry {
  return {
    taskId: 'task-1',
    operationType: 'build',
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

describe('LoopDetector', () => {
  let detector: LoopDetector;

  beforeEach(() => {
    detector = new LoopDetector();
  });

  // ==========================================================================
  // Basic recording and no false positives
  // ==========================================================================

  describe('recordExecution', () => {
    it('should record an execution without error', () => {
      expect(() => detector.recordExecution(makeEntry())).not.toThrow();
    });

    it('should track unique tasks in metrics', () => {
      detector.recordExecution(makeEntry({ taskId: 'a' }));
      detector.recordExecution(makeEntry({ taskId: 'b' }));
      detector.recordExecution(makeEntry({ taskId: 'a' }));

      const metrics = detector.getMetrics();
      expect(metrics.totalExecutions).toBe(3);
      expect(metrics.uniqueTasks).toBe(2);
    });
  });

  describe('no false positives', () => {
    it('should not detect a loop for a single execution', () => {
      detector.recordExecution(makeEntry());
      const result = detector.checkForLoop('task-1');
      expect(result.detected).toBe(false);
      expect(result.suggestedAction).toBe('continue');
    });

    it('should not detect a loop for varied tasks', () => {
      for (let i = 0; i < 10; i++) {
        detector.recordExecution(makeEntry({ taskId: `task-${i}` }));
      }
      const result = detector.checkForLoop('task-0');
      expect(result.detected).toBe(false);
      expect(result.suggestedAction).toBe('continue');
    });

    it('should not detect a loop with empty history', () => {
      const result = detector.checkForLoop('nonexistent');
      expect(result.detected).toBe(false);
      expect(result.suggestedAction).toBe('continue');
    });
  });

  // ==========================================================================
  // Same-task loop detection
  // ==========================================================================

  describe('same-task detection', () => {
    it('should detect when a task exceeds maxSameTaskRetries', () => {
      const config: LoopDetectorConfig = { maxSameTaskRetries: 3, sequenceWindowSize: 20 };
      detector = new LoopDetector(config);

      for (let i = 0; i < 3; i++) {
        detector.recordExecution(makeEntry({ taskId: 'stuck-task' }));
      }

      const result = detector.checkForLoop('stuck-task');
      expect(result.detected).toBe(true);
      expect(result.loopType).toBe('same-task');
      expect(result.suggestedAction).toBe('block');
      expect(result.executionCount).toBe(3);
    });

    it('should warn one step before threshold', () => {
      const config: LoopDetectorConfig = { maxSameTaskRetries: 4, sequenceWindowSize: 20 };
      detector = new LoopDetector(config);

      for (let i = 0; i < 3; i++) {
        detector.recordExecution(makeEntry({ taskId: 'almost-stuck' }));
      }

      const result = detector.checkForLoop('almost-stuck');
      expect(result.detected).toBe(true);
      expect(result.loopType).toBe('same-task');
      expect(result.suggestedAction).toBe('warn');
    });

    it('should not trigger when count is below warn threshold', () => {
      const config: LoopDetectorConfig = { maxSameTaskRetries: 5, sequenceWindowSize: 20 };
      detector = new LoopDetector(config);

      for (let i = 0; i < 3; i++) {
        detector.recordExecution(makeEntry({ taskId: 'safe-task' }));
      }

      const result = detector.checkForLoop('safe-task');
      expect(result.detected).toBe(false);
      expect(result.suggestedAction).toBe('continue');
    });

    it('should use default maxSameTaskRetries of 5', () => {
      detector = new LoopDetector();

      for (let i = 0; i < 4; i++) {
        detector.recordExecution(makeEntry({ taskId: 'default-task' }));
      }

      // 4 executions with default threshold 5: should warn (threshold - 1)
      const result = detector.checkForLoop('default-task');
      expect(result.detected).toBe(true);
      expect(result.suggestedAction).toBe('warn');
    });
  });

  // ==========================================================================
  // Time window filtering
  // ==========================================================================

  describe('time window filtering', () => {
    it('should not detect old executions outside the time window', () => {
      const config: LoopDetectorConfig = {
        maxSameTaskRetries: 3,
        timeWindowMs: 1000,
        sequenceWindowSize: 20,
        maxSequenceRepeats: 100,
      };
      detector = new LoopDetector(config);

      // Record entries with timestamps older than the window
      const oldTimestamp = new Date(Date.now() - 5000).toISOString();
      for (let i = 0; i < 5; i++) {
        detector.recordExecution(makeEntry({
          taskId: 'old-task',
          timestamp: oldTimestamp,
        }));
      }

      const result = detector.checkForLoop('old-task');
      expect(result.detected).toBe(false);
      expect(result.suggestedAction).toBe('continue');
    });

    it('should detect recent executions within the time window', () => {
      const config: LoopDetectorConfig = {
        maxSameTaskRetries: 3,
        timeWindowMs: 60000,
        sequenceWindowSize: 20,
      };
      detector = new LoopDetector(config);

      for (let i = 0; i < 3; i++) {
        detector.recordExecution(makeEntry({ taskId: 'recent-task' }));
      }

      const result = detector.checkForLoop('recent-task');
      expect(result.detected).toBe(true);
      expect(result.loopType).toBe('same-task');
    });
  });

  // ==========================================================================
  // Task-sequence detection
  // ==========================================================================

  describe('task-sequence detection', () => {
    it('should detect a repeating A->B->C sequence', () => {
      const config: LoopDetectorConfig = {
        maxSequenceRepeats: 3,
        sequenceWindowSize: 20,
        maxSameTaskRetries: 100,
      };
      detector = new LoopDetector(config);

      const sequence = [
        { taskId: 'A', operationType: 'op' },
        { taskId: 'B', operationType: 'op' },
        { taskId: 'C', operationType: 'op' },
      ];

      // Repeat the sequence 3 times
      for (let rep = 0; rep < 3; rep++) {
        for (const item of sequence) {
          detector.recordExecution(makeEntry(item));
        }
      }

      const result = detector.checkForLoop('A');
      expect(result.detected).toBe(true);
      expect(result.loopType).toBe('task-sequence');
      expect(result.suggestedAction).toBe('block');
    });

    it('should detect a repeating A->B sequence', () => {
      const config: LoopDetectorConfig = {
        maxSequenceRepeats: 3,
        sequenceWindowSize: 20,
        maxSameTaskRetries: 100,
      };
      detector = new LoopDetector(config);

      for (let rep = 0; rep < 3; rep++) {
        detector.recordExecution(makeEntry({ taskId: 'X', operationType: 'op' }));
        detector.recordExecution(makeEntry({ taskId: 'Y', operationType: 'op' }));
      }

      const result = detector.checkForLoop('X');
      expect(result.detected).toBe(true);
      expect(result.loopType).toBe('task-sequence');
    });

    it('should warn at threshold - 1 repeats', () => {
      const config: LoopDetectorConfig = {
        maxSequenceRepeats: 4,
        sequenceWindowSize: 20,
        maxSameTaskRetries: 100,
      };
      detector = new LoopDetector(config);

      const sequence = [
        { taskId: 'P', operationType: 'op' },
        { taskId: 'Q', operationType: 'op' },
      ];

      for (let rep = 0; rep < 3; rep++) {
        for (const item of sequence) {
          detector.recordExecution(makeEntry(item));
        }
      }

      const result = detector.checkForLoop('P');
      expect(result.detected).toBe(true);
      expect(result.loopType).toBe('task-sequence');
      expect(result.suggestedAction).toBe('warn');
    });

    it('should not detect when insufficient repeats', () => {
      const config: LoopDetectorConfig = {
        maxSequenceRepeats: 3,
        sequenceWindowSize: 20,
        maxSameTaskRetries: 100,
      };
      detector = new LoopDetector(config);

      // Only 1 occurrence of A->B
      detector.recordExecution(makeEntry({ taskId: 'A', operationType: 'op' }));
      detector.recordExecution(makeEntry({ taskId: 'B', operationType: 'op' }));

      const result = detector.checkForLoop('A');
      expect(result.detected).toBe(false);
    });

    it('should not detect with fewer than 4 entries', () => {
      const config: LoopDetectorConfig = {
        maxSequenceRepeats: 2,
        sequenceWindowSize: 20,
        maxSameTaskRetries: 100,
      };
      detector = new LoopDetector(config);

      detector.recordExecution(makeEntry({ taskId: 'A', operationType: 'op' }));
      detector.recordExecution(makeEntry({ taskId: 'B', operationType: 'op' }));
      detector.recordExecution(makeEntry({ taskId: 'A', operationType: 'op' }));

      const result = detector.checkForLoop('A');
      expect(result.detected).toBe(false);
    });
  });

  // ==========================================================================
  // State-regression detection
  // ==========================================================================

  describe('state-regression detection', () => {
    it('should detect when outputHash recurs beyond threshold', () => {
      const config: LoopDetectorConfig = {
        maxSequenceRepeats: 3,
        sequenceWindowSize: 20,
        maxSameTaskRetries: 100,
      };
      detector = new LoopDetector(config);

      for (let i = 0; i < 3; i++) {
        detector.recordExecution(makeEntry({
          taskId: 'regress-task',
          outputHash: 'abc123',
        }));
      }

      const result = detector.checkForLoop('regress-task');
      expect(result.detected).toBe(true);
      expect(result.loopType).toBe('state-regression');
      expect(result.suggestedAction).toBe('block');
      expect(result.executionCount).toBe(3);
    });

    it('should warn at threshold - 1 regressions', () => {
      const config: LoopDetectorConfig = {
        maxSequenceRepeats: 4,
        sequenceWindowSize: 20,
        maxSameTaskRetries: 100,
      };
      detector = new LoopDetector(config);

      for (let i = 0; i < 3; i++) {
        detector.recordExecution(makeEntry({
          taskId: 'warn-task',
          outputHash: 'def456',
        }));
      }

      const result = detector.checkForLoop('warn-task');
      expect(result.detected).toBe(true);
      expect(result.loopType).toBe('state-regression');
      expect(result.suggestedAction).toBe('warn');
    });

    it('should not detect when outputHash values are unique', () => {
      const config: LoopDetectorConfig = {
        maxSequenceRepeats: 100,
        sequenceWindowSize: 20,
        maxSameTaskRetries: 100,
      };
      detector = new LoopDetector(config);

      for (let i = 0; i < 5; i++) {
        detector.recordExecution(makeEntry({
          taskId: 'unique-task',
          outputHash: `hash-${i}`,
        }));
      }

      // With high thresholds for same-task and sequence, only regression is tested
      const result = detector.checkForLoop('unique-task');
      expect(result.detected).toBe(false);
    });

    it('should not detect regression when no outputHash is provided', () => {
      const config: LoopDetectorConfig = {
        maxSequenceRepeats: 2,
        sequenceWindowSize: 20,
        maxSameTaskRetries: 100,
      };
      detector = new LoopDetector(config);

      for (let i = 0; i < 5; i++) {
        detector.recordExecution(makeEntry({
          taskId: 'no-hash-task',
        }));
      }

      // same-task might trigger, but regression should not
      // Use a high maxSameTaskRetries to isolate regression check
      const result = detector.checkForLoop('no-hash-task');
      // With maxSameTaskRetries: 100, same-task won't trigger
      // With no outputHash, regression won't trigger
      expect(result.loopType).not.toBe('state-regression');
    });
  });

  // ==========================================================================
  // Metrics
  // ==========================================================================

  describe('getMetrics', () => {
    it('should return zero metrics initially', () => {
      const metrics = detector.getMetrics();
      expect(metrics.totalExecutions).toBe(0);
      expect(metrics.loopsDetected).toBe(0);
      expect(metrics.blockedExecutions).toBe(0);
      expect(metrics.uniqueTasks).toBe(0);
    });

    it('should track totalExecutions accurately', () => {
      detector.recordExecution(makeEntry({ taskId: 'a' }));
      detector.recordExecution(makeEntry({ taskId: 'b' }));
      detector.recordExecution(makeEntry({ taskId: 'c' }));

      expect(detector.getMetrics().totalExecutions).toBe(3);
    });

    it('should track uniqueTasks by signature', () => {
      detector.recordExecution(makeEntry({ taskId: 'a', operationType: 'build' }));
      detector.recordExecution(makeEntry({ taskId: 'a', operationType: 'test' }));
      detector.recordExecution(makeEntry({ taskId: 'b', operationType: 'build' }));

      // Signatures: a:build, a:test, b:build = 3 unique
      expect(detector.getMetrics().uniqueTasks).toBe(3);
    });

    it('should increment loopsDetected and blockedExecutions on detection', () => {
      const config: LoopDetectorConfig = { maxSameTaskRetries: 2, sequenceWindowSize: 20 };
      detector = new LoopDetector(config);

      detector.recordExecution(makeEntry({ taskId: 'loop-task' }));
      detector.recordExecution(makeEntry({ taskId: 'loop-task' }));

      detector.checkForLoop('loop-task');

      const metrics = detector.getMetrics();
      expect(metrics.loopsDetected).toBe(1);
      expect(metrics.blockedExecutions).toBe(1);
    });

    it('should increment loopsDetected for warn without incrementing blockedExecutions', () => {
      const config: LoopDetectorConfig = { maxSameTaskRetries: 3, sequenceWindowSize: 20 };
      detector = new LoopDetector(config);

      detector.recordExecution(makeEntry({ taskId: 'warn-task' }));
      detector.recordExecution(makeEntry({ taskId: 'warn-task' }));

      detector.checkForLoop('warn-task');

      const metrics = detector.getMetrics();
      expect(metrics.loopsDetected).toBe(1);
      expect(metrics.blockedExecutions).toBe(0);
    });
  });

  // ==========================================================================
  // Reset
  // ==========================================================================

  describe('reset', () => {
    it('should clear all history and metrics', () => {
      detector.recordExecution(makeEntry({ taskId: 'a' }));
      detector.recordExecution(makeEntry({ taskId: 'b' }));

      detector.reset();

      const metrics = detector.getMetrics();
      expect(metrics.totalExecutions).toBe(0);
      expect(metrics.loopsDetected).toBe(0);
      expect(metrics.blockedExecutions).toBe(0);
      expect(metrics.uniqueTasks).toBe(0);
    });

    it('should not detect loops after reset', () => {
      const config: LoopDetectorConfig = { maxSameTaskRetries: 2, sequenceWindowSize: 20 };
      detector = new LoopDetector(config);

      detector.recordExecution(makeEntry({ taskId: 'x' }));
      detector.recordExecution(makeEntry({ taskId: 'x' }));

      // Confirm detection before reset
      expect(detector.checkForLoop('x').detected).toBe(true);

      detector.reset();

      // After reset, no loop should be detected
      const result = detector.checkForLoop('x');
      expect(result.detected).toBe(false);
    });
  });

  // ==========================================================================
  // Configurable thresholds
  // ==========================================================================

  describe('configurable thresholds', () => {
    it('should respect custom maxSameTaskRetries', () => {
      detector = new LoopDetector({ maxSameTaskRetries: 2 });

      detector.recordExecution(makeEntry({ taskId: 't' }));
      detector.recordExecution(makeEntry({ taskId: 't' }));

      const result = detector.checkForLoop('t');
      expect(result.detected).toBe(true);
      expect(result.loopType).toBe('same-task');
      expect(result.suggestedAction).toBe('block');
    });

    it('should respect custom sequenceWindowSize', () => {
      // Use a small window so older entries get overwritten
      detector = new LoopDetector({
        sequenceWindowSize: 4,
        maxSameTaskRetries: 100,
        maxSequenceRepeats: 2,
      });

      // Fill the buffer so the first entries are overwritten
      detector.recordExecution(makeEntry({ taskId: 'old', operationType: 'op' }));
      detector.recordExecution(makeEntry({ taskId: 'old', operationType: 'op' }));
      detector.recordExecution(makeEntry({ taskId: 'new-a', operationType: 'op' }));
      detector.recordExecution(makeEntry({ taskId: 'new-b', operationType: 'op' }));
      detector.recordExecution(makeEntry({ taskId: 'new-a', operationType: 'op' }));
      detector.recordExecution(makeEntry({ taskId: 'new-b', operationType: 'op' }));

      // Buffer now has [new-a, new-b, new-a, new-b] — 'old' entries are gone
      const result = detector.checkForLoop('new-a');
      expect(result.detected).toBe(true);
      expect(result.loopType).toBe('task-sequence');
    });

    it('should respect custom maxSequenceRepeats', () => {
      detector = new LoopDetector({
        maxSequenceRepeats: 2,
        sequenceWindowSize: 20,
        maxSameTaskRetries: 100,
      });

      // 2 repeats of A->B
      detector.recordExecution(makeEntry({ taskId: 'A', operationType: 'op' }));
      detector.recordExecution(makeEntry({ taskId: 'B', operationType: 'op' }));
      detector.recordExecution(makeEntry({ taskId: 'A', operationType: 'op' }));
      detector.recordExecution(makeEntry({ taskId: 'B', operationType: 'op' }));

      const result = detector.checkForLoop('A');
      expect(result.detected).toBe(true);
      expect(result.loopType).toBe('task-sequence');
      expect(result.suggestedAction).toBe('block');
    });

    it('should respect custom timeWindowMs', () => {
      detector = new LoopDetector({
        maxSameTaskRetries: 2,
        timeWindowMs: 100,
      });

      const oldTs = new Date(Date.now() - 500).toISOString();
      detector.recordExecution(makeEntry({ taskId: 'tw', timestamp: oldTs }));
      detector.recordExecution(makeEntry({ taskId: 'tw', timestamp: oldTs }));
      detector.recordExecution(makeEntry({ taskId: 'tw', timestamp: oldTs }));

      const result = detector.checkForLoop('tw');
      expect(result.detected).toBe(false);
    });
  });

  // ==========================================================================
  // Suggested action escalation
  // ==========================================================================

  describe('suggestedAction escalation', () => {
    it('should return continue when no loop detected', () => {
      detector.recordExecution(makeEntry({ taskId: 'safe' }));
      const result = detector.checkForLoop('safe');
      expect(result.suggestedAction).toBe('continue');
    });

    it('should warn at threshold - 1 and block at threshold for same-task', () => {
      detector = new LoopDetector({ maxSameTaskRetries: 3 });

      detector.recordExecution(makeEntry({ taskId: 'esc' }));
      detector.recordExecution(makeEntry({ taskId: 'esc' }));

      const warnResult = detector.checkForLoop('esc');
      expect(warnResult.suggestedAction).toBe('warn');

      detector.recordExecution(makeEntry({ taskId: 'esc' }));

      const blockResult = detector.checkForLoop('esc');
      expect(blockResult.suggestedAction).toBe('block');
    });
  });

  // ==========================================================================
  // Circular buffer behavior
  // ==========================================================================

  describe('circular buffer', () => {
    it('should not grow beyond sequenceWindowSize', () => {
      detector = new LoopDetector({ sequenceWindowSize: 5, maxSameTaskRetries: 100 });

      for (let i = 0; i < 20; i++) {
        detector.recordExecution(makeEntry({ taskId: `task-${i}` }));
      }

      // totalExecutions tracks all, but metrics.uniqueTasks reflects what was in buffer
      const metrics = detector.getMetrics();
      expect(metrics.totalExecutions).toBe(20);
    });

    it('should overwrite oldest entries when buffer is full', () => {
      detector = new LoopDetector({
        sequenceWindowSize: 3,
        maxSameTaskRetries: 2,
        timeWindowMs: 60000,
      });

      // Fill buffer with task-A
      detector.recordExecution(makeEntry({ taskId: 'task-A' }));
      detector.recordExecution(makeEntry({ taskId: 'task-A' }));

      // This would normally trigger at threshold 2, but let's overwrite
      detector.recordExecution(makeEntry({ taskId: 'task-B' }));
      detector.recordExecution(makeEntry({ taskId: 'task-B' }));
      detector.recordExecution(makeEntry({ taskId: 'task-B' }));

      // Buffer now: [task-B, task-B, task-B] — task-A is gone
      const result = detector.checkForLoop('task-A');
      expect(result.detected).toBe(false);
    });
  });

  // ==========================================================================
  // Factory function
  // ==========================================================================

  describe('factory', () => {
    it('should create instance via createLoopDetector', () => {
      const instance = createLoopDetector();
      expect(instance).toBeInstanceOf(LoopDetector);
    });

    it('should accept config via factory', () => {
      const instance = createLoopDetector({ maxSameTaskRetries: 10 });
      expect(instance).toBeInstanceOf(LoopDetector);

      // Record 9 executions — should not trigger at threshold 10
      for (let i = 0; i < 9; i++) {
        instance.recordExecution(makeEntry({ taskId: 'factory-task' }));
      }
      const result = instance.checkForLoop('factory-task');
      // 9 executions with threshold 10: warn at 9 (threshold - 1)
      expect(result.detected).toBe(true);
      expect(result.suggestedAction).toBe('warn');
    });
  });

  // ==========================================================================
  // Edge cases
  // ==========================================================================

  describe('edge cases', () => {
    it('should handle checking for a task that was never recorded', () => {
      detector.recordExecution(makeEntry({ taskId: 'a' }));
      const result = detector.checkForLoop('nonexistent');
      expect(result.detected).toBe(false);
      expect(result.suggestedAction).toBe('continue');
    });

    it('should handle mixed operation types for same taskId', () => {
      detector = new LoopDetector({ maxSameTaskRetries: 3 });

      // Same taskId but different operations
      detector.recordExecution(makeEntry({ taskId: 'task-1', operationType: 'build' }));
      detector.recordExecution(makeEntry({ taskId: 'task-1', operationType: 'test' }));
      detector.recordExecution(makeEntry({ taskId: 'task-1', operationType: 'deploy' }));

      // same-task checks by taskId, so all 3 match
      const result = detector.checkForLoop('task-1');
      expect(result.detected).toBe(true);
      expect(result.loopType).toBe('same-task');
    });

    it('should handle rapid successive checks', () => {
      detector = new LoopDetector({ maxSameTaskRetries: 5 });

      for (let i = 0; i < 3; i++) {
        detector.recordExecution(makeEntry({ taskId: 'rapid' }));
      }

      const r1 = detector.checkForLoop('rapid');
      const r2 = detector.checkForLoop('rapid');

      // Both should return consistent results
      expect(r1.detected).toBe(r2.detected);
      expect(r1.suggestedAction).toBe(r2.suggestedAction);
    });

    it('should handle entries with undefined outputHash in regression check', () => {
      detector = new LoopDetector({ maxSequenceRepeats: 2, maxSameTaskRetries: 100 });

      detector.recordExecution(makeEntry({ taskId: 't', outputHash: undefined }));
      detector.recordExecution(makeEntry({ taskId: 't', outputHash: undefined }));
      detector.recordExecution(makeEntry({ taskId: 't', outputHash: undefined }));

      const result = detector.checkForLoop('t');
      // No outputHash means no regression detection
      expect(result.loopType).not.toBe('state-regression');
    });
  });
});
