/**
 * Structured Logger Tests
 *
 * Feature: F0.4 - Logger Refactor
 * Tests for structured logging with typed events
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import {
  StructuredLogger,
  LogLevel,
  LogEntry,
  ILogTransport,
} from '../../../src/core/logging/index.js';
import { resetContextManager } from '../../../src/core/logging/context-manager.js';

// Mock transport for capturing log entries
class MockTransport implements ILogTransport {
  readonly name = 'mock';
  entries: LogEntry[] = [];

  write(entry: LogEntry): void {
    this.entries.push(entry);
  }

  clear(): void {
    this.entries = [];
  }

  getLastEntry(): LogEntry | undefined {
    return this.entries[this.entries.length - 1];
  }
}

describe('StructuredLogger', () => {
  let logger: StructuredLogger;
  let transport: MockTransport;

  beforeEach(() => {
    transport = new MockTransport();
    logger = new StructuredLogger('test', {
      level: LogLevel.TRACE,
      transports: [transport],
    });
  });

  afterEach(() => {
    transport.clear();
    resetContextManager();
  });

  describe('Basic Logging', () => {
    it('should log trace messages', () => {
      logger.trace('Trace message');

      const entry = transport.getLastEntry();
      expect(entry).toBeDefined();
      expect(entry!.level).toBe(LogLevel.TRACE);
      expect(entry!.message).toBe('Trace message');
      expect(entry!.logger).toBe('test');
    });

    it('should log debug messages', () => {
      logger.debug('Debug message');

      const entry = transport.getLastEntry();
      expect(entry!.level).toBe(LogLevel.DEBUG);
      expect(entry!.message).toBe('Debug message');
    });

    it('should log info messages', () => {
      logger.info('Info message');

      const entry = transport.getLastEntry();
      expect(entry!.level).toBe(LogLevel.INFO);
      expect(entry!.message).toBe('Info message');
    });

    it('should log warn messages', () => {
      logger.warn('Warning message');

      const entry = transport.getLastEntry();
      expect(entry!.level).toBe(LogLevel.WARN);
      expect(entry!.message).toBe('Warning message');
    });

    it('should log error messages', () => {
      const error = new Error('Test error');
      logger.error('Error occurred', error);

      const entry = transport.getLastEntry();
      expect(entry!.level).toBe(LogLevel.ERROR);
      expect(entry!.message).toBe('Error occurred');
      expect(entry!.error).toBeDefined();
      expect(entry!.error!.name).toBe('Error');
      expect(entry!.error!.message).toBe('Test error');
    });

    it('should log fatal messages', () => {
      const error = new Error('Fatal error');
      logger.fatal('System failure', error);

      const entry = transport.getLastEntry();
      expect(entry!.level).toBe(LogLevel.FATAL);
      expect(entry!.error).toBeDefined();
    });
  });

  describe('Log Level Filtering', () => {
    it('should respect log level', () => {
      logger.setLevel(LogLevel.WARN);

      logger.trace('Trace');
      logger.debug('Debug');
      logger.info('Info');
      logger.warn('Warn');
      logger.error('Error', null);

      expect(transport.entries).toHaveLength(2);
      expect(transport.entries[0].level).toBe(LogLevel.WARN);
      expect(transport.entries[1].level).toBe(LogLevel.ERROR);
    });

    it('should check if level is enabled', () => {
      logger.setLevel(LogLevel.INFO);

      expect(logger.isLevelEnabled(LogLevel.TRACE)).toBe(false);
      expect(logger.isLevelEnabled(LogLevel.DEBUG)).toBe(false);
      expect(logger.isLevelEnabled(LogLevel.INFO)).toBe(true);
      expect(logger.isLevelEnabled(LogLevel.ERROR)).toBe(true);
    });

    it('should return current level', () => {
      expect(logger.level).toBe(LogLevel.TRACE);
      logger.setLevel(LogLevel.ERROR);
      expect(logger.level).toBe(LogLevel.ERROR);
    });
  });

  describe('Context Support', () => {
    it('should include context in log entries', () => {
      logger.info('Message', { requestId: 'req-123' });

      const entry = transport.getLastEntry();
      expect(entry!.context.requestId).toBe('req-123');
    });

    it('should merge default context', () => {
      const loggerWithContext = new StructuredLogger('test', {
        level: LogLevel.TRACE,
        transports: [transport],
        context: { agentId: 'agent-1' },
      });

      loggerWithContext.info('Message', { taskId: 'task-1' });

      const entry = transport.getLastEntry();
      expect(entry!.context.agentId).toBe('agent-1');
      expect(entry!.context.taskId).toBe('task-1');
    });
  });

  describe('Child Loggers', () => {
    it('should create child with extended name', () => {
      const child = logger.child('module');

      child.info('Child message');

      const entry = transport.getLastEntry();
      expect(entry!.logger).toBe('test.module');
    });

    it('should inherit parent level', () => {
      logger.setLevel(LogLevel.WARN);
      const child = logger.child('module');

      expect(child.level).toBe(LogLevel.WARN);
    });

    it('should inherit parent context', () => {
      const parentWithContext = new StructuredLogger('parent', {
        level: LogLevel.TRACE,
        transports: [transport],
        context: { requestId: 'parent-req' },
      });

      const child = parentWithContext.child('child', { taskId: 'child-task' });
      child.info('Child message');

      const entry = transport.getLastEntry();
      expect(entry!.context.requestId).toBe('parent-req');
      expect(entry!.context.taskId).toBe('child-task');
    });
  });

  describe('withContext', () => {
    it('should create logger with bound context', () => {
      const boundLogger = logger.withContext({ workflowId: 'wf-1' });

      boundLogger.info('Bound message');

      const entry = transport.getLastEntry();
      expect(entry!.context.workflowId).toBe('wf-1');
    });

    it('should preserve logger name', () => {
      const boundLogger = logger.withContext({ workflowId: 'wf-1' });

      boundLogger.info('Message');

      expect(transport.getLastEntry()!.logger).toBe('test');
    });
  });

  describe('Typed Events', () => {
    it('should log agent events', () => {
      logger.agent({
        event: 'started',
        agentType: 'orchestrator',
        agentId: 'agent-123',
      });

      const entry = transport.getLastEntry();
      expect(entry!.type).toBe('agent');
      expect(entry!.message).toContain('orchestrator');
      expect(entry!.message).toContain('agent-123');
      expect(entry!.context.agentType).toBe('orchestrator');
    });

    it('should log task events', () => {
      logger.task({
        event: 'completed',
        taskId: 'task-456',
        durationMs: 150,
      });

      const entry = transport.getLastEntry();
      expect(entry!.type).toBe('task');
      expect(entry!.context.taskId).toBe('task-456');
      expect(entry!.context.durationMs).toBe(150);
    });

    it('should log workflow events', () => {
      logger.workflow({
        event: 'step_completed',
        workflowId: 'wf-1',
        executionId: 'exec-1',
        stepId: 'step-1',
      });

      const entry = transport.getLastEntry();
      expect(entry!.type).toBe('workflow');
      expect(entry!.context.workflowId).toBe('wf-1');
      expect(entry!.context.stepId).toBe('step-1');
    });

    it('should log tool events', () => {
      logger.tool({
        event: 'invoked',
        toolName: 'code_search',
        durationMs: 45,
      });

      const entry = transport.getLastEntry();
      expect(entry!.type).toBe('tool');
      expect(entry!.context.toolName).toBe('code_search');
    });

    it('should log hook events', () => {
      logger.hook({
        event: 'triggered',
        hookName: 'pre_execute',
        hookEvent: 'task.start',
      });

      const entry = transport.getLastEntry();
      expect(entry!.type).toBe('hook');
      expect(entry!.context.hookName).toBe('pre_execute');
    });

    it('should log API events', () => {
      logger.api({
        event: 'request',
        method: 'POST',
        path: '/api/tasks',
      });

      const entry = transport.getLastEntry();
      expect(entry!.type).toBe('api');
      expect(entry!.context.operation).toBe('POST /api/tasks');
    });

    it('should log security events', () => {
      logger.security({
        event: 'auth_success',
        userId: 'user-123',
        action: 'login',
      });

      const entry = transport.getLastEntry();
      expect(entry!.type).toBe('security');
      expect(entry!.context.userId).toBe('user-123');
    });

    it('should log performance events', () => {
      logger.performance({
        event: 'metric',
        name: 'response_time',
        value: 250,
        unit: 'ms',
      });

      const entry = transport.getLastEntry();
      expect(entry!.type).toBe('performance');
      expect(entry!.context.operation).toBe('response_time');
    });

    it('should set ERROR level for failed events', () => {
      logger.task({
        event: 'failed',
        taskId: 'task-789',
        error: { name: 'Error', message: 'Task failed' },
      });

      const entry = transport.getLastEntry();
      expect(entry!.level).toBe(LogLevel.ERROR);
    });

    it('should set WARN level for denied events', () => {
      logger.security({
        event: 'access_denied',
        userId: 'user-456',
        resource: '/admin',
      });

      const entry = transport.getLastEntry();
      expect(entry!.level).toBe(LogLevel.WARN);
    });
  });

  describe('Timer', () => {
    it('should log timer start and end', async () => {
      const stop = logger.startTimer('operation');

      // Simulate some work
      await new Promise((resolve) => setTimeout(resolve, 10));

      stop();

      expect(transport.entries).toHaveLength(2);
      expect(transport.entries[0].message).toContain('Timer started: operation');
      expect(transport.entries[1].message).toContain('Timer ended: operation');
    });

    it('should include duration in timer end event', async () => {
      const stop = logger.startTimer('operation');
      await new Promise((resolve) => setTimeout(resolve, 15));
      stop();

      const endEntry = transport.entries[1];
      expect(endEntry.context.durationMs).toBeGreaterThan(10);
    });
  });

  describe('Transport Management', () => {
    it('should add transport dynamically', () => {
      const newTransport = new MockTransport();
      (logger as StructuredLogger).addTransport(newTransport);

      logger.info('Test');

      expect(transport.entries).toHaveLength(1);
      expect(newTransport.entries).toHaveLength(1);
    });

    it('should remove transport by name', () => {
      const success = (logger as StructuredLogger).removeTransport('mock');

      expect(success).toBe(true);

      logger.info('Test');
      expect(transport.entries).toHaveLength(0);
    });

    it('should return false when removing non-existent transport', () => {
      const success = (logger as StructuredLogger).removeTransport('non-existent');
      expect(success).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should convert Error to ErrorInfo', () => {
      const error = new Error('Test error');
      error.stack = 'Error: Test error\n    at test.ts:1:1';

      logger.error('Error occurred', error);

      const entry = transport.getLastEntry();
      expect(entry!.error).toEqual({
        name: 'Error',
        message: 'Test error',
        stack: error.stack,
      });
    });

    it('should handle errors with code property', () => {
      const error = new Error('File not found') as Error & { code: string };
      error.code = 'ENOENT';

      logger.error('File error', error);

      const entry = transport.getLastEntry();
      expect(entry!.error!.code).toBe('ENOENT');
    });

    it('should handle error cause chain', () => {
      const cause = new Error('Root cause');
      const error = new Error('Wrapped error', { cause });

      logger.error('Error with cause', error);

      const entry = transport.getLastEntry();
      expect(entry!.error!.cause).toBeDefined();
      expect(entry!.error!.cause!.message).toBe('Root cause');
    });

    it('should continue logging if transport fails', () => {
      const failingTransport: ILogTransport = {
        name: 'failing',
        write: () => {
          throw new Error('Transport failed');
        },
      };

      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

      const loggerWithFailing = new StructuredLogger('test', {
        level: LogLevel.TRACE,
        transports: [failingTransport, transport],
      });

      loggerWithFailing.info('Test message');

      expect(transport.entries).toHaveLength(1);
      expect(consoleError).toHaveBeenCalled();

      consoleError.mockRestore();
    });
  });

  describe('Timestamp', () => {
    it('should include timestamp in log entries', () => {
      const before = new Date();
      logger.info('Test');
      const after = new Date();

      const entry = transport.getLastEntry();
      expect(entry!.timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(entry!.timestamp.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });
});
