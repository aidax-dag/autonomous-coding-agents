/**
 * Logger Tests
 */

import {
  ConsoleLogger,
  LogFormat,
  setCorrelationId,
  getCorrelationId,
  clearCorrelationId,
  generateCorrelationId,
  configureLogger,
  getLoggerConfig,
  createLogger,
  createCorrelatedLogger,
} from '../../../../src/core/services/logger';
import { LogLevel } from '../../../../src/core/services/logger.interface';

// ============================================================================
// Helpers
// ============================================================================

let consoleSpy: {
  debug: jest.SpyInstance;
  info: jest.SpyInstance;
  warn: jest.SpyInstance;
  error: jest.SpyInstance;
};

beforeEach(() => {
  consoleSpy = {
    debug: jest.spyOn(console, 'debug').mockImplementation(),
    info: jest.spyOn(console, 'info').mockImplementation(),
    warn: jest.spyOn(console, 'warn').mockImplementation(),
    error: jest.spyOn(console, 'error').mockImplementation(),
  };
  clearCorrelationId();
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ============================================================================
// ConsoleLogger
// ============================================================================

describe('ConsoleLogger', () => {
  // ==========================================================================
  // Constructor
  // ==========================================================================

  describe('constructor', () => {
    it('should create with default config', () => {
      const logger = new ConsoleLogger('TestLogger');

      expect(logger.name).toBe('TestLogger');
    });

    it('should accept custom config', () => {
      const logger = new ConsoleLogger('Custom', {
        level: LogLevel.DEBUG,
        format: LogFormat.JSON,
        prettyPrint: false,
        timestamp: false,
      });

      expect(logger.name).toBe('Custom');
    });
  });

  // ==========================================================================
  // Log level filtering
  // ==========================================================================

  describe('log level filtering', () => {
    it('should filter logs below configured level', () => {
      const logger = new ConsoleLogger('Test', { level: LogLevel.WARN, format: LogFormat.TEXT });

      logger.debug('hidden');
      logger.info('hidden');
      logger.warn('shown');
      logger.error('shown');

      expect(consoleSpy.debug).not.toHaveBeenCalled();
      expect(consoleSpy.info).not.toHaveBeenCalled();
      expect(consoleSpy.warn).toHaveBeenCalledTimes(1);
      expect(consoleSpy.error).toHaveBeenCalledTimes(1);
    });

    it('should show all logs at TRACE level', () => {
      const logger = new ConsoleLogger('Test', { level: LogLevel.TRACE, format: LogFormat.TEXT });

      logger.trace('trace');
      logger.debug('debug');
      logger.info('info');

      expect(consoleSpy.debug).toHaveBeenCalledTimes(2); // trace and debug both use console.debug
      expect(consoleSpy.info).toHaveBeenCalledTimes(1);
    });
  });

  // ==========================================================================
  // Log methods
  // ==========================================================================

  describe('log methods', () => {
    let logger: ConsoleLogger;

    beforeEach(() => {
      logger = new ConsoleLogger('App', {
        level: LogLevel.TRACE,
        format: LogFormat.TEXT,
        timestamp: false,
      });
    });

    it('should log trace via console.debug', () => {
      logger.trace('trace msg');

      expect(consoleSpy.debug).toHaveBeenCalledWith(
        expect.stringContaining('trace msg'),
      );
    });

    it('should log debug via console.debug', () => {
      logger.debug('debug msg');

      expect(consoleSpy.debug).toHaveBeenCalledWith(
        expect.stringContaining('debug msg'),
      );
    });

    it('should log info via console.info', () => {
      logger.info('info msg');

      expect(consoleSpy.info).toHaveBeenCalledWith(
        expect.stringContaining('info msg'),
      );
    });

    it('should log warn via console.warn', () => {
      logger.warn('warn msg');

      expect(consoleSpy.warn).toHaveBeenCalledWith(
        expect.stringContaining('warn msg'),
      );
    });

    it('should log error via console.error', () => {
      logger.error('error msg');

      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringContaining('error msg'),
      );
    });

    it('should log fatal via console.error', () => {
      logger.fatal('fatal msg');

      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringContaining('fatal msg'),
      );
    });
  });

  // ==========================================================================
  // Text format
  // ==========================================================================

  describe('text format', () => {
    it('should include logger name and level', () => {
      const logger = new ConsoleLogger('MyService', {
        level: LogLevel.INFO,
        format: LogFormat.TEXT,
        timestamp: false,
      });

      logger.info('Server started');

      const output = consoleSpy.info.mock.calls[0][0];
      expect(output).toContain('[INFO]');
      expect(output).toContain('[MyService]');
      expect(output).toContain('Server started');
    });

    it('should include context', () => {
      const logger = new ConsoleLogger('Test', {
        level: LogLevel.INFO,
        format: LogFormat.TEXT,
        timestamp: false,
        prettyPrint: false,
      });

      logger.info('msg', { port: 3000 });

      const output = consoleSpy.info.mock.calls[0][0];
      expect(output).toContain('"port":3000');
    });

    it('should include timestamp when enabled', () => {
      const logger = new ConsoleLogger('Test', {
        level: LogLevel.INFO,
        format: LogFormat.TEXT,
        timestamp: true,
      });

      logger.info('msg');

      const output = consoleSpy.info.mock.calls[0][0];
      // ISO timestamp pattern
      expect(output).toMatch(/\d{4}-\d{2}-\d{2}T/);
    });
  });

  // ==========================================================================
  // JSON format
  // ==========================================================================

  describe('JSON format', () => {
    it('should produce valid JSON', () => {
      const logger = new ConsoleLogger('JsonLogger', {
        level: LogLevel.INFO,
        format: LogFormat.JSON,
      });

      logger.info('Hello JSON');

      const output = consoleSpy.info.mock.calls[0][0];
      const parsed = JSON.parse(output);

      expect(parsed.level).toBe('INFO');
      expect(parsed.logger).toBe('JsonLogger');
      expect(parsed.message).toBe('Hello JSON');
      expect(parsed.timestamp).toBeDefined();
    });

    it('should include correlation ID in JSON output', () => {
      setCorrelationId('req-abc');
      const logger = new ConsoleLogger('Test', {
        level: LogLevel.INFO,
        format: LogFormat.JSON,
      });

      logger.info('msg');

      const parsed = JSON.parse(consoleSpy.info.mock.calls[0][0]);
      expect(parsed.correlationId).toBe('req-abc');
    });

    it('should include context in JSON output', () => {
      const logger = new ConsoleLogger('Test', {
        level: LogLevel.INFO,
        format: LogFormat.JSON,
      });

      logger.info('msg', { userId: '123' });

      const parsed = JSON.parse(consoleSpy.info.mock.calls[0][0]);
      expect(parsed.context.userId).toBe('123');
    });

    it('should not include correlationId when not set', () => {
      const logger = new ConsoleLogger('Test', {
        level: LogLevel.INFO,
        format: LogFormat.JSON,
      });

      logger.info('msg');

      const parsed = JSON.parse(consoleSpy.info.mock.calls[0][0]);
      expect(parsed.correlationId).toBeUndefined();
    });
  });

  // ==========================================================================
  // Timers
  // ==========================================================================

  describe('startTimer', () => {
    it('should measure elapsed time', () => {
      const logger = new ConsoleLogger('Test', {
        level: LogLevel.INFO,
        format: LogFormat.TEXT,
        timestamp: false,
      });

      const timer = logger.startTimer();
      // durationMs should be >= 0
      expect(timer.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('should log message on end', () => {
      const logger = new ConsoleLogger('Test', {
        level: LogLevel.INFO,
        format: LogFormat.TEXT,
        timestamp: false,
      });

      const timer = logger.startTimer();
      const duration = timer.end('Operation done', { op: 'test' });

      expect(duration).toBeGreaterThanOrEqual(0);
      expect(consoleSpy.info).toHaveBeenCalledWith(
        expect.stringContaining('Operation done'),
      );
    });

    it('should only end once', () => {
      const logger = new ConsoleLogger('Test', {
        level: LogLevel.INFO,
        format: LogFormat.TEXT,
        timestamp: false,
      });

      const timer = logger.startTimer();
      timer.end('First');
      timer.end('Second');

      expect(consoleSpy.info).toHaveBeenCalledTimes(1);
    });
  });

  describe('time', () => {
    it('should return operation result and log timing', async () => {
      const logger = new ConsoleLogger('Test', {
        level: LogLevel.INFO,
        format: LogFormat.TEXT,
        timestamp: false,
      });

      const result = await logger.time('DB query', async () => 42);

      expect(result).toBe(42);
      expect(consoleSpy.info).toHaveBeenCalledWith(
        expect.stringContaining('DB query'),
      );
    });

    it('should log error and rethrow on failure', async () => {
      const logger = new ConsoleLogger('Test', {
        level: LogLevel.INFO,
        format: LogFormat.TEXT,
        timestamp: false,
      });

      await expect(
        logger.time('failing op', async () => {
          throw new Error('boom');
        }),
      ).rejects.toThrow('boom');

      // Should still log the timing with error status
      expect(consoleSpy.info).toHaveBeenCalledWith(
        expect.stringContaining('failing op'),
      );
    });
  });

  // ==========================================================================
  // Child loggers
  // ==========================================================================

  describe('child', () => {
    it('should create child with combined name', () => {
      const parent = new ConsoleLogger('App', {
        level: LogLevel.INFO,
        format: LogFormat.TEXT,
        timestamp: false,
      });

      const child = parent.child('Auth');
      expect(child.name).toBe('App:Auth');

      child.info('msg');
      const output = consoleSpy.info.mock.calls[0][0];
      expect(output).toContain('[App:Auth]');
    });
  });

  describe('withContext', () => {
    it('should create logger with default context', () => {
      const logger = new ConsoleLogger('Test', {
        level: LogLevel.INFO,
        format: LogFormat.TEXT,
        timestamp: false,
        prettyPrint: false,
      });

      const ctxLogger = logger.withContext({ userId: '42' });
      ctxLogger.info('action');

      const output = consoleSpy.info.mock.calls[0][0];
      expect(output).toContain('"userId":"42"');
    });

    it('should merge default context with per-call context', () => {
      const logger = new ConsoleLogger('Test', {
        level: LogLevel.INFO,
        format: LogFormat.JSON,
        defaultContext: { service: 'auth' },
      });

      const ctxLogger = logger.withContext({ region: 'us' });
      ctxLogger.info('msg', { action: 'login' });

      const parsed = JSON.parse(consoleSpy.info.mock.calls[0][0]);
      expect(parsed.context.service).toBe('auth');
      expect(parsed.context.region).toBe('us');
      expect(parsed.context.action).toBe('login');
    });
  });
});

// ============================================================================
// Correlation ID Functions
// ============================================================================

describe('Correlation ID', () => {
  it('should set and get correlation ID', () => {
    setCorrelationId('req-123');

    expect(getCorrelationId()).toBe('req-123');
  });

  it('should return undefined when not set', () => {
    expect(getCorrelationId()).toBeUndefined();
  });

  it('should clear correlation ID', () => {
    setCorrelationId('req-123');
    clearCorrelationId();

    expect(getCorrelationId()).toBeUndefined();
  });

  it('should generate unique IDs', () => {
    const id1 = generateCorrelationId();
    const id2 = generateCorrelationId();

    expect(id1).toBeTruthy();
    expect(id2).toBeTruthy();
    expect(id1).not.toBe(id2);
  });
});

// ============================================================================
// Factory Functions
// ============================================================================

describe('configureLogger', () => {
  it('should update global config', () => {
    const original = getLoggerConfig();

    configureLogger({ level: LogLevel.TRACE });
    const updated = getLoggerConfig();

    expect(updated.level).toBe(LogLevel.TRACE);

    // Restore
    configureLogger(original);
  });
});

describe('createLogger', () => {
  it('should create logger with global config', () => {
    const logger = createLogger('Test');

    expect(logger).toBeInstanceOf(ConsoleLogger);
    expect(logger.name).toBe('Test');
  });

  it('should accept config overrides', () => {
    const logger = createLogger('Test', { level: LogLevel.ERROR });

    logger.info('hidden');
    expect(consoleSpy.info).not.toHaveBeenCalled();

    logger.error('shown');
    expect(consoleSpy.error).toHaveBeenCalledTimes(1);
  });
});

describe('createCorrelatedLogger', () => {
  it('should set correlation ID and create logger', () => {
    const logger = createCorrelatedLogger('CorrTest');

    expect(logger).toBeInstanceOf(ConsoleLogger);
    expect(getCorrelationId()).toBeDefined();
  });

  it('should use provided correlation ID', () => {
    const logger = createCorrelatedLogger('CorrTest', 'custom-id');

    expect(getCorrelationId()).toBe('custom-id');
    expect(logger.name).toBe('CorrTest');
  });

  it('should auto-generate correlation ID when not provided', () => {
    createCorrelatedLogger('Test');

    const id = getCorrelationId();
    expect(id).toBeTruthy();
    expect(typeof id).toBe('string');
  });
});
