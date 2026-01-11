/**
 * Logger Implementation
 *
 * @module core/services/logger
 */

import { ILogger, LogLevel, LogContext } from './logger.interface.js';

// Re-export types for convenience
export type { ILogger, LogLevel, LogContext };

/**
 * Logger configuration
 */
export interface LoggerConfig {
  level?: LogLevel;
  prettyPrint?: boolean;
  timestamp?: boolean;
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
 * Console Logger implementation
 */
export class ConsoleLogger implements ILogger {
  readonly name: string;
  private readonly level: LogLevel;
  private readonly prettyPrint: boolean;
  private readonly timestamp: boolean;

  constructor(name: string, config: LoggerConfig = {}) {
    this.name = name;
    this.level = config.level ?? LogLevel.INFO;
    this.prettyPrint = config.prettyPrint ?? process.env.NODE_ENV !== 'production';
    this.timestamp = config.timestamp ?? true;
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[this.level];
  }

  private formatMessage(level: LogLevel, message: string, context?: LogContext): string {
    const parts: string[] = [];

    if (this.timestamp) {
      parts.push(new Date().toISOString());
    }

    parts.push(`[${level.toUpperCase()}]`);
    parts.push(`[${this.name}]`);
    parts.push(message);

    if (context && Object.keys(context).length > 0) {
      if (this.prettyPrint) {
        parts.push(JSON.stringify(context, null, 2));
      } else {
        parts.push(JSON.stringify(context));
      }
    }

    return parts.join(' ');
  }

  private log(level: LogLevel, message: string, context?: LogContext): void {
    if (!this.shouldLog(level)) return;

    const formatted = this.formatMessage(level, message, context);

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

  child(name: string): ILogger {
    return new ConsoleLogger(`${this.name}:${name}`, {
      level: this.level,
      prettyPrint: this.prettyPrint,
      timestamp: this.timestamp,
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
};

/**
 * Configure global logger settings
 */
export function configureLogger(config: LoggerConfig): void {
  globalConfig = { ...globalConfig, ...config };
}

/**
 * Create a logger instance
 */
export function createLogger(name: string, config?: LoggerConfig): ILogger {
  return new ConsoleLogger(name, { ...globalConfig, ...config });
}
