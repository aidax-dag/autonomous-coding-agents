/**
 * Logger Implementation
 *
 * Provides structured logging with:
 * - JSON format for production (machine-readable)
 * - Text format for development (human-readable)
 * - Correlation IDs for request tracing
 * - Performance timing utilities
 * - Child loggers for component isolation
 *
 * @module core/services/logger
 *
 * @example Basic Usage
 * ```typescript
 * import { createLogger } from './logger';
 *
 * const logger = createLogger('MyService');
 *
 * logger.info('Server started', { port: 3000 });
 * logger.error('Failed to connect', { host: 'db.local', error: 'timeout' });
 * ```
 *
 * @example Correlation IDs (Request Tracing)
 * ```typescript
 * import { createCorrelatedLogger, setCorrelationId, getCorrelationId } from './logger';
 *
 * // Option 1: Create logger with auto-generated correlation ID
 * const logger = createCorrelatedLogger('RequestHandler');
 *
 * // Option 2: Set correlation ID manually
 * setCorrelationId('req-abc123');
 * const logger = createLogger('Service');
 * logger.info('Processing request'); // Includes correlationId in JSON output
 *
 * // Pass correlation ID to downstream services
 * const currentId = getCorrelationId();
 * ```
 *
 * @example Performance Timing
 * ```typescript
 * const logger = createLogger('DatabaseService');
 *
 * // Manual timer
 * const timer = logger.startTimer();
 * await database.query('SELECT * FROM users');
 * timer.end('Query completed', { table: 'users' });
 * // Output: Query completed { durationMs: 45.23, table: 'users' }
 *
 * // Automatic timing with async operations
 * const result = await logger.time('Database query', async () => {
 *   return await database.query('SELECT * FROM orders');
 * }, { table: 'orders' });
 * // Automatically logs duration and success/error status
 * ```
 *
 * @example Child Loggers and Context
 * ```typescript
 * const baseLogger = createLogger('App');
 *
 * // Create child logger with namespace
 * const authLogger = baseLogger.child('Auth');
 * authLogger.info('User logged in'); // Logs as [App:Auth]
 *
 * // Create logger with default context
 * const userLogger = baseLogger.withContext({ userId: '123', role: 'admin' });
 * userLogger.info('Action performed'); // Includes userId and role in every log
 * ```
 *
 * @example JSON Format (Production)
 * ```typescript
 * import { configureLogger, LogFormat } from './logger';
 *
 * // Enable JSON format for production
 * configureLogger({
 *   format: LogFormat.JSON,
 *   level: LogLevel.INFO,
 * });
 *
 * // Output: {"timestamp":"...","level":"INFO","logger":"App","message":"Started","correlationId":"..."}
 * ```
 */

import { ILogger, LogLevel, LogContext } from './logger.interface';

// Re-export types for convenience
export type { ILogger, LogLevel, LogContext };

/**
 * Log output format
 */
export enum LogFormat {
  /** Human-readable text format */
  TEXT = 'text',
  /** Machine-readable JSON format */
  JSON = 'json',
}

/**
 * Logger configuration
 */
export interface LoggerConfig {
  level?: LogLevel;
  prettyPrint?: boolean;
  timestamp?: boolean;
  /** Output format (text or JSON) */
  format?: LogFormat;
  /** Default context fields added to all log entries */
  defaultContext?: LogContext;
}

/**
 * Structured log entry for JSON format
 */
export interface StructuredLogEntry {
  timestamp: string;
  level: string;
  logger: string;
  message: string;
  correlationId?: string;
  durationMs?: number;
  context?: LogContext;
}

/**
 * Correlation ID storage using AsyncLocalStorage-like pattern
 */
const correlationIdStore = {
  current: undefined as string | undefined,
};

/**
 * Set the current correlation ID for request tracing
 */
export function setCorrelationId(id: string): void {
  correlationIdStore.current = id;
}

/**
 * Get the current correlation ID
 */
export function getCorrelationId(): string | undefined {
  return correlationIdStore.current;
}

/**
 * Clear the current correlation ID
 */
export function clearCorrelationId(): void {
  correlationIdStore.current = undefined;
}

/**
 * Generate a new correlation ID
 */
export function generateCorrelationId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Log level priority
 */
const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  [LogLevel.TRACE]: 0,
  [LogLevel.DEBUG]: 1,
  [LogLevel.INFO]: 2,
  [LogLevel.WARN]: 3,
  [LogLevel.ERROR]: 4,
  [LogLevel.FATAL]: 5,
};

/**
 * Timer result from timing operations
 */
export interface TimerResult {
  /** Duration in milliseconds */
  durationMs: number;
  /** End the timer and log the result */
  end: (message?: string, context?: LogContext) => number;
}

/**
 * Console Logger implementation with structured logging support
 */
export class ConsoleLogger implements ILogger {
  readonly name: string;
  private readonly level: LogLevel;
  private readonly prettyPrint: boolean;
  private readonly timestamp: boolean;
  private readonly format: LogFormat;
  private readonly defaultContext: LogContext;

  constructor(name: string, config: LoggerConfig = {}) {
    this.name = name;
    this.level = config.level ?? LogLevel.INFO;
    this.prettyPrint = config.prettyPrint ?? process.env.NODE_ENV !== 'production';
    this.timestamp = config.timestamp ?? true;
    this.format = config.format ?? (process.env.NODE_ENV === 'production' ? LogFormat.JSON : LogFormat.TEXT);
    this.defaultContext = config.defaultContext ?? {};
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[this.level];
  }

  /**
   * Format message as text (human-readable)
   */
  private formatText(level: LogLevel, message: string, context?: LogContext): string {
    const parts: string[] = [];

    if (this.timestamp) {
      parts.push(new Date().toISOString());
    }

    parts.push(`[${level.toUpperCase()}]`);
    parts.push(`[${this.name}]`);
    parts.push(message);

    const mergedContext = { ...this.defaultContext, ...context };
    if (Object.keys(mergedContext).length > 0) {
      if (this.prettyPrint) {
        parts.push(JSON.stringify(mergedContext, null, 2));
      } else {
        parts.push(JSON.stringify(mergedContext));
      }
    }

    return parts.join(' ');
  }

  /**
   * Format message as JSON (machine-readable structured log)
   */
  private formatJson(level: LogLevel, message: string, context?: LogContext): string {
    const entry: StructuredLogEntry = {
      timestamp: new Date().toISOString(),
      level: level.toUpperCase(),
      logger: this.name,
      message,
    };

    const correlationId = getCorrelationId();
    if (correlationId) {
      entry.correlationId = correlationId;
    }

    const mergedContext = { ...this.defaultContext, ...context };
    if (Object.keys(mergedContext).length > 0) {
      entry.context = mergedContext;
    }

    return JSON.stringify(entry);
  }

  private log(level: LogLevel, message: string, context?: LogContext): void {
    if (!this.shouldLog(level)) return;

    const formatted = this.format === LogFormat.JSON
      ? this.formatJson(level, message, context)
      : this.formatText(level, message, context);

    switch (level) {
      case LogLevel.TRACE:
      case LogLevel.DEBUG:
        console.debug(formatted);
        break;
      case LogLevel.INFO:
        console.info(formatted);
        break;
      case LogLevel.WARN:
        console.warn(formatted);
        break;
      case LogLevel.ERROR:
      case LogLevel.FATAL:
        console.error(formatted);
        break;
    }
  }

  trace(message: string, context?: LogContext): void {
    this.log(LogLevel.TRACE, message, context);
  }

  debug(message: string, context?: LogContext): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  info(message: string, context?: LogContext): void {
    this.log(LogLevel.INFO, message, context);
  }

  warn(message: string, context?: LogContext): void {
    this.log(LogLevel.WARN, message, context);
  }

  error(message: string, context?: LogContext): void {
    this.log(LogLevel.ERROR, message, context);
  }

  fatal(message: string, context?: LogContext): void {
    this.log(LogLevel.FATAL, message, context);
  }

  /**
   * Start a timer for performance logging
   *
   * @example
   * ```typescript
   * const timer = logger.startTimer();
   * await someOperation();
   * timer.end('Operation completed', { operationId: '123' });
   * ```
   */
  startTimer(): TimerResult {
    const startTime = process.hrtime.bigint();
    let ended = false;

    const result: TimerResult = {
      get durationMs() {
        const endTime = process.hrtime.bigint();
        return Number(endTime - startTime) / 1_000_000;
      },
      end: (message?: string, context?: LogContext) => {
        if (ended) return result.durationMs;
        ended = true;

        const durationMs = result.durationMs;
        if (message) {
          this.info(message, { ...context, durationMs });
        }
        return durationMs;
      },
    };

    return result;
  }

  /**
   * Log an operation with automatic timing
   *
   * @example
   * ```typescript
   * const result = await logger.time('Database query', async () => {
   *   return await db.query('SELECT * FROM users');
   * }, { query: 'users' });
   * ```
   */
  async time<T>(
    message: string,
    operation: () => Promise<T>,
    context?: LogContext
  ): Promise<T> {
    const timer = this.startTimer();
    try {
      const result = await operation();
      timer.end(message, { ...context, status: 'success' });
      return result;
    } catch (error) {
      timer.end(message, {
        ...context,
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  child(name: string): ConsoleLogger {
    return new ConsoleLogger(`${this.name}:${name}`, {
      level: this.level,
      prettyPrint: this.prettyPrint,
      timestamp: this.timestamp,
      format: this.format,
      defaultContext: this.defaultContext,
    });
  }

  /**
   * Create a child logger with additional default context
   */
  withContext(context: LogContext): ConsoleLogger {
    return new ConsoleLogger(this.name, {
      level: this.level,
      prettyPrint: this.prettyPrint,
      timestamp: this.timestamp,
      format: this.format,
      defaultContext: { ...this.defaultContext, ...context },
    });
  }
}

/**
 * Global logger configuration
 */
let globalConfig: LoggerConfig = {
  level: (process.env.LOG_LEVEL as LogLevel) || LogLevel.INFO,
  prettyPrint: process.env.NODE_ENV !== 'production',
  timestamp: true,
  format: process.env.LOG_FORMAT === 'json' ? LogFormat.JSON : LogFormat.TEXT,
};

/**
 * Configure global logger settings
 */
export function configureLogger(config: LoggerConfig): void {
  globalConfig = { ...globalConfig, ...config };
}

/**
 * Get current global logger configuration
 */
export function getLoggerConfig(): LoggerConfig {
  return { ...globalConfig };
}

/**
 * Create a logger instance
 */
export function createLogger(name: string, config?: LoggerConfig): ConsoleLogger {
  return new ConsoleLogger(name, { ...globalConfig, ...config });
}

/**
 * Create a logger with correlation ID context
 */
export function createCorrelatedLogger(name: string, correlationId?: string): ConsoleLogger {
  const id = correlationId ?? generateCorrelationId();
  setCorrelationId(id);
  return createLogger(name).withContext({ correlationId: id });
}
