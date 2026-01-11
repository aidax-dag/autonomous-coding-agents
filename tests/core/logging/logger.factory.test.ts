/**
 * Logger Factory Tests
 *
 * Feature: F0.4 - Logger Refactor
 * Tests for logger factory and global configuration
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import {
  LoggerFactory,
  getLoggerFactory,
  configureLoggerFactory,
  resetLoggerFactory,
  createLogger,
  getLogger,
  LogLevel,
  ILogTransport,
  LogEntry,
} from '../../../src/core/logging/index.js';
import { resetContextManager } from '../../../src/core/logging/context-manager.js';

// Mock transport for testing
class MockTransport implements ILogTransport {
  readonly name = 'mock';
  entries: LogEntry[] = [];

  write(entry: LogEntry): void {
    this.entries.push(entry);
  }

  async flush(): Promise<void> {}
  async close(): Promise<void> {}
}

describe('LoggerFactory', () => {
  let factory: LoggerFactory;
  let transport: MockTransport;

  beforeEach(() => {
    transport = new MockTransport();
    factory = new LoggerFactory({
      level: LogLevel.DEBUG,
      transports: [transport],
    });
  });

  afterEach(() => {
    resetLoggerFactory();
    resetContextManager();
  });

  describe('createLogger', () => {
    it('should create logger with factory defaults', () => {
      const logger = factory.createLogger('test');

      logger.info('Test message');

      expect(transport.entries).toHaveLength(1);
      expect(transport.entries[0].logger).toBe('test');
    });

    it('should create logger with custom options', () => {
      const customTransport = new MockTransport();
      const logger = factory.createLogger('custom', {
        level: LogLevel.ERROR,
        transports: [customTransport],
      });

      logger.info('Info message');  // Should not be logged (level is ERROR)
      logger.error('Error message', null);

      // Both transports should only have error message (level filters INFO)
      expect(transport.entries).toHaveLength(1);
      expect(transport.entries[0].message).toBe('Error message');
      expect(customTransport.entries).toHaveLength(1);
      expect(customTransport.entries[0].message).toBe('Error message');
    });

    it('should apply custom context', () => {
      const logger = factory.createLogger('test', {
        context: { component: 'auth' },
      });

      logger.info('Test');

      expect(transport.entries[0].context.component).toBe('auth');
    });
  });

  describe('getLogger', () => {
    it('should return same logger instance for same name', () => {
      const logger1 = factory.getLogger('shared');
      const logger2 = factory.getLogger('shared');

      expect(logger1).toBe(logger2);
    });

    it('should return different instances for different names', () => {
      const logger1 = factory.getLogger('logger1');
      const logger2 = factory.getLogger('logger2');

      expect(logger1).not.toBe(logger2);
    });

    it('should create logger if not exists', () => {
      const logger = factory.getLogger('new-logger');

      logger.info('Test');

      expect(transport.entries[0].logger).toBe('new-logger');
    });
  });

  describe('getTypedLogger', () => {
    it('should return typed logger with event methods', () => {
      const logger = factory.getTypedLogger('typed');

      expect(typeof logger.agent).toBe('function');
      expect(typeof logger.task).toBe('function');
      expect(typeof logger.workflow).toBe('function');
    });
  });

  describe('setGlobalLevel', () => {
    it('should update level for all cached loggers', () => {
      factory.getLogger('logger1');
      factory.getLogger('logger2');

      factory.setGlobalLevel(LogLevel.ERROR);

      const logger1 = factory.getLogger('logger1');
      const logger2 = factory.getLogger('logger2');

      expect(logger1.level).toBe(LogLevel.ERROR);
      expect(logger2.level).toBe(LogLevel.ERROR);
    });

    it('should affect new loggers', () => {
      factory.setGlobalLevel(LogLevel.WARN);

      const logger = factory.createLogger('new');

      expect(logger.level).toBe(LogLevel.WARN);
    });
  });

  describe('addTransport', () => {
    it('should add transport to all cached loggers', () => {
      const logger = factory.getLogger('test');
      const newTransport = new MockTransport();

      factory.addTransport(newTransport);

      logger.info('Test');

      expect(newTransport.entries).toHaveLength(1);
    });
  });

  describe('removeTransport', () => {
    it('should remove transport from all cached loggers', () => {
      const logger = factory.getLogger('test');

      factory.removeTransport('mock');

      logger.info('Test');

      expect(transport.entries).toHaveLength(0);
    });
  });

  describe('getContextManager', () => {
    it('should return context manager', () => {
      const cm = factory.getContextManager();

      expect(cm).toBeDefined();
      expect(typeof cm.getContext).toBe('function');
      expect(typeof cm.setContext).toBe('function');
    });
  });

  describe('flush', () => {
    it('should flush all loggers', async () => {
      const flushSpy = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
      const flushableTransport: ILogTransport = {
        name: 'flushable',
        write: () => {},
        flush: flushSpy,
      };

      const factoryWithFlushable = new LoggerFactory({
        transports: [flushableTransport],
      });

      factoryWithFlushable.getLogger('logger1');
      factoryWithFlushable.getLogger('logger2');

      await factoryWithFlushable.flush();

      expect(flushSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe('close', () => {
    it('should close all loggers and clear cache', async () => {
      const closeSpy = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
      const closableTransport: ILogTransport = {
        name: 'closable',
        write: () => {},
        close: closeSpy,
      };

      const factoryWithClosable = new LoggerFactory({
        transports: [closableTransport],
      });

      factoryWithClosable.getLogger('logger1');

      await factoryWithClosable.close();

      // After close, getLogger should create a new instance
      const newLogger = factoryWithClosable.getLogger('logger1');
      expect(newLogger).toBeDefined();

      expect(closeSpy).toHaveBeenCalled();
    });
  });
});

describe('LoggerFactory Options', () => {
  afterEach(() => {
    resetLoggerFactory();
    resetContextManager();
  });

  it('should create JSON formatter when json option is true', () => {
    const factory = new LoggerFactory({
      json: true,
    });

    const logger = factory.createLogger('json-test');

    // Should not throw
    expect(logger).toBeDefined();
  });

  it('should create pretty formatter when pretty option is true', () => {
    const factory = new LoggerFactory({
      pretty: true,
    });

    const logger = factory.createLogger('pretty-test');

    expect(logger).toBeDefined();
  });

  it('should respect colorize option', () => {
    const factory = new LoggerFactory({
      colorize: false,
    });

    const logger = factory.createLogger('no-color');

    expect(logger).toBeDefined();
  });
});

describe('Global Logger Factory', () => {
  afterEach(() => {
    resetLoggerFactory();
    resetContextManager();
  });

  describe('getLoggerFactory', () => {
    it('should return singleton instance', () => {
      const factory1 = getLoggerFactory();
      const factory2 = getLoggerFactory();

      expect(factory1).toBe(factory2);
    });

    it('should create factory with default options', () => {
      const factory = getLoggerFactory();

      expect(factory).toBeDefined();
    });
  });

  describe('configureLoggerFactory', () => {
    it('should replace global factory', () => {
      const oldFactory = getLoggerFactory();

      const newFactory = configureLoggerFactory({
        level: LogLevel.ERROR,
      });

      expect(newFactory).not.toBe(oldFactory);
      expect(getLoggerFactory()).toBe(newFactory);
    });

    it('should apply new options', () => {
      configureLoggerFactory({
        level: LogLevel.WARN,
      });

      const logger = createLogger('test');

      expect(logger.level).toBe(LogLevel.WARN);
    });
  });

  describe('resetLoggerFactory', () => {
    it('should clear global factory', () => {
      const oldFactory = getLoggerFactory();

      resetLoggerFactory();

      const newFactory = getLoggerFactory();
      expect(newFactory).not.toBe(oldFactory);
    });
  });

  describe('createLogger shorthand', () => {
    it('should create logger using global factory', () => {
      const logger = createLogger('shorthand');

      expect(logger.name).toBe('shorthand');
    });

    it('should support options', () => {
      const logger = createLogger('with-options', {
        context: { test: true },
      });

      expect(logger).toBeDefined();
    });
  });

  describe('getLogger shorthand', () => {
    it('should get logger using global factory', () => {
      const logger = getLogger('shorthand-get');

      expect(logger.name).toBe('shorthand-get');
    });

    it('should return same instance for same name', () => {
      const logger1 = getLogger('shared');
      const logger2 = getLogger('shared');

      expect(logger1).toBe(logger2);
    });
  });
});
