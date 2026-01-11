/**
 * Logger Factory Implementation
 *
 * Feature: F0.4 - Logger Refactor
 * Provides centralized logger creation and management
 *
 * @module core/logging
 */

import type {
  ILogger,
  ITypedLogger,
  ILoggerFactory,
  ILogTransport,
  IContextManager,
  LoggerOptions,
} from './logging.interface.js';
import { LogLevel } from './logging.interface.js';
import { StructuredLogger } from './structured-logger.js';
import { getContextManager } from './context-manager.js';
import { ConsoleTransport } from './transports/console.transport.js';
import { JsonFormatter } from './formatters/json.formatter.js';
import { PrettyFormatter } from './formatters/pretty.formatter.js';

/**
 * Logger factory options
 */
export interface LoggerFactoryOptions {
  /** Default log level */
  level?: LogLevel;
  /** Default transports */
  transports?: ILogTransport[];
  /** Use JSON format */
  json?: boolean;
  /** Use pretty format */
  pretty?: boolean;
  /** Enable colors (for console) */
  colorize?: boolean;
  /** Context manager instance */
  contextManager?: IContextManager;
}

/**
 * Logger Factory for creating and managing loggers
 */
export class LoggerFactory implements ILoggerFactory {
  private readonly loggers = new Map<string, ITypedLogger>();
  private readonly transports: ILogTransport[];
  private readonly contextManager: IContextManager;
  private globalLevel: LogLevel;

  constructor(options: LoggerFactoryOptions = {}) {
    this.globalLevel = options.level ?? LogLevel.INFO;
    this.contextManager = options.contextManager ?? getContextManager();
    this.transports = options.transports ?? this.createDefaultTransports(options);
  }

  /**
   * Create a new logger instance
   */
  createLogger(name: string, options?: LoggerOptions): ILogger {
    // Destructure to avoid ...options overriding our merged transports
    const { transports: optTransports, ...restOptions } = options ?? {};

    const logger = new StructuredLogger(
      name,
      {
        ...restOptions,
        level: options?.level ?? this.globalLevel,
        transports: [...this.transports, ...(optTransports ?? [])],
      },
      this.contextManager
    );

    return logger;
  }

  /**
   * Get or create logger by name
   */
  getLogger(name: string): ILogger {
    let logger = this.loggers.get(name);
    if (!logger) {
      logger = this.createLogger(name) as ITypedLogger;
      this.loggers.set(name, logger);
    }
    return logger;
  }

  /**
   * Get typed logger by name
   */
  getTypedLogger(name: string): ITypedLogger {
    return this.getLogger(name) as ITypedLogger;
  }

  /**
   * Set global log level for all loggers
   */
  setGlobalLevel(level: LogLevel): void {
    this.globalLevel = level;
    for (const logger of this.loggers.values()) {
      logger.setLevel(level);
    }
  }

  /**
   * Add transport to all loggers
   */
  addTransport(transport: ILogTransport): void {
    this.transports.push(transport);
    for (const logger of this.loggers.values()) {
      (logger as StructuredLogger).addTransport(transport);
    }
  }

  /**
   * Remove transport from all loggers
   */
  removeTransport(name: string): void {
    const index = this.transports.findIndex((t) => t.name === name);
    if (index >= 0) {
      this.transports.splice(index, 1);
    }
    for (const logger of this.loggers.values()) {
      (logger as StructuredLogger).removeTransport(name);
    }
  }

  /**
   * Get context manager
   */
  getContextManager(): IContextManager {
    return this.contextManager;
  }

  /**
   * Flush all loggers
   */
  async flush(): Promise<void> {
    await Promise.all(
      Array.from(this.loggers.values()).map((logger) =>
        (logger as StructuredLogger).flush()
      )
    );
  }

  /**
   * Close all loggers
   */
  async close(): Promise<void> {
    await Promise.all(
      Array.from(this.loggers.values()).map((logger) =>
        (logger as StructuredLogger).close()
      )
    );
    this.loggers.clear();
  }

  /**
   * Create default transports based on options
   */
  private createDefaultTransports(options: LoggerFactoryOptions): ILogTransport[] {
    const transports: ILogTransport[] = [];

    // Console transport with appropriate formatter
    if (options.json) {
      transports.push(
        new ConsoleTransport({
          formatter: new JsonFormatter({ pretty: options.pretty }),
          colorize: false,
        })
      );
    } else {
      transports.push(
        new ConsoleTransport({
          formatter: options.pretty
            ? new PrettyFormatter({ colorize: options.colorize ?? true })
            : undefined,
          colorize: options.colorize ?? true,
        })
      );
    }

    return transports;
  }
}

/**
 * Global logger factory instance
 */
let globalLoggerFactory: LoggerFactory | null = null;

/**
 * Get global logger factory
 */
export function getLoggerFactory(): LoggerFactory {
  if (!globalLoggerFactory) {
    globalLoggerFactory = new LoggerFactory();
  }
  return globalLoggerFactory;
}

/**
 * Configure global logger factory
 */
export function configureLoggerFactory(options: LoggerFactoryOptions): LoggerFactory {
  if (globalLoggerFactory) {
    // Close existing factory
    globalLoggerFactory.close().catch(() => {});
  }
  globalLoggerFactory = new LoggerFactory(options);
  return globalLoggerFactory;
}

/**
 * Reset global logger factory (for testing)
 */
export function resetLoggerFactory(): void {
  if (globalLoggerFactory) {
    globalLoggerFactory.close().catch(() => {});
    globalLoggerFactory = null;
  }
}

/**
 * Create logger shorthand
 */
export function createLogger(name: string, options?: LoggerOptions): ITypedLogger {
  return getLoggerFactory().createLogger(name, options) as ITypedLogger;
}

/**
 * Get logger shorthand
 */
export function getLogger(name: string): ITypedLogger {
  return getLoggerFactory().getTypedLogger(name);
}
