/**
 * Logger Interface
 *
 * @module core/services/logger
 */

/**
 * Log level enum
 */
export enum LogLevel {
  TRACE = 'trace',
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  FATAL = 'fatal',
}

/**
 * Log context
 */
export interface LogContext {
  [key: string]: unknown;
}

/**
 * Logger interface
 */
export interface ILogger {
  /**
   * Logger name/context
   */
  readonly name: string;

  /**
   * Log at trace level
   */
  trace(message: string, context?: LogContext): void;

  /**
   * Log at debug level
   */
  debug(message: string, context?: LogContext): void;

  /**
   * Log at info level
   */
  info(message: string, context?: LogContext): void;

  /**
   * Log at warn level
   */
  warn(message: string, context?: LogContext): void;

  /**
   * Log at error level
   */
  error(message: string, context?: LogContext): void;

  /**
   * Log at fatal level
   */
  fatal(message: string, context?: LogContext): void;

  /**
   * Create a child logger with additional context
   */
  child(name: string): ILogger;
}
