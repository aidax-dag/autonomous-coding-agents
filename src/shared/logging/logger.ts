import winston from 'winston';
import path from 'path';

/**
 * Centralized Logging System with Winston
 *
 * Provides structured logging with:
 * - Multiple log levels (error, warn, info, debug)
 * - File rotation
 * - Console output with colors
 * - Structured metadata
 * - Agent context tracking
 *
 * Feature: F1.3 - Logging System
 */

// Log levels
const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

// Log level from environment or default to 'info'
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const LOG_TO_FILE = process.env.LOG_TO_FILE === 'true';
const LOG_DIR = process.env.LOG_DIR || path.join(process.cwd(), 'logs');

/**
 * Custom log format with timestamp and metadata
 */
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.metadata({
    fillExcept: ['timestamp', 'level', 'message'],
  }),
  winston.format.printf((info) => {
    const { timestamp, level, message, metadata } = info;
    const meta =
      metadata && typeof metadata === 'object' && Object.keys(metadata).length > 0
        ? JSON.stringify(metadata)
        : '';
    return `${timestamp} [${level.toUpperCase()}]: ${message} ${meta}`;
  })
);

/**
 * Console format with colors
 */
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf((info) => {
    const { timestamp, level, message, ...meta } = info;
    const metaStr =
      Object.keys(meta).length > 0 && meta.metadata
        ? `\n  ${JSON.stringify(meta.metadata, null, 2)}`
        : '';
    return `${timestamp} ${level}: ${message}${metaStr}`;
  })
);

/**
 * Configure transports
 */
const transports: winston.transport[] = [
  // Console transport
  new winston.transports.Console({
    format: consoleFormat,
    level: LOG_LEVEL,
  }),
];

// File transports (if enabled)
if (LOG_TO_FILE) {
  transports.push(
    // Combined log file
    new winston.transports.File({
      filename: path.join(LOG_DIR, 'combined.log'),
      format: logFormat,
      level: LOG_LEVEL,
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 10,
    }),
    // Error log file
    new winston.transports.File({
      filename: path.join(LOG_DIR, 'error.log'),
      format: logFormat,
      level: 'error',
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 10,
    })
  );
}

/**
 * Create the logger instance
 */
export const logger = winston.createLogger({
  levels: LOG_LEVELS,
  level: LOG_LEVEL,
  transports,
  exitOnError: false,
});

/**
 * Agent-specific logger with context
 */
export class AgentLogger {
  private agentType: string;
  private agentId: string;

  constructor(agentType: string, agentId?: string) {
    this.agentType = agentType;
    this.agentId = agentId || 'unknown';
  }

  private log(level: string, message: string, meta?: Record<string, unknown>): void {
    logger.log(level, message, {
      agentType: this.agentType,
      agentId: this.agentId,
      ...meta,
    });
  }

  error(message: string, error?: Error | unknown, meta?: Record<string, unknown>): void {
    const errorMeta: Record<string, unknown> = { ...meta };

    if (error instanceof Error) {
      errorMeta.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    } else if (error) {
      errorMeta.error = error;
    }

    this.log('error', message, errorMeta);
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.log('warn', message, meta);
  }

  info(message: string, meta?: Record<string, unknown>): void {
    this.log('info', message, meta);
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    this.log('debug', message, meta);
  }

  /**
   * Log a feature lifecycle event
   */
  featureEvent(
    event: string,
    featureId: string,
    details?: Record<string, unknown>
  ): void {
    this.info(`Feature ${event}`, {
      featureId,
      event,
      ...details,
    });
  }

  /**
   * Log a PR lifecycle event
   */
  prEvent(
    event: string,
    prNumber: number,
    featureId?: string,
    details?: Record<string, unknown>
  ): void {
    this.info(`PR ${event}`, {
      prNumber,
      featureId,
      event,
      ...details,
    });
  }

  /**
   * Log a message event
   */
  messageEvent(
    event: string,
    messageType: string,
    messageId: string,
    details?: Record<string, unknown>
  ): void {
    this.debug(`Message ${event}`, {
      messageType,
      messageId,
      event,
      ...details,
    });
  }

  /**
   * Log an LLM interaction
   */
  llmInteraction(
    provider: string,
    model: string,
    tokensUsed?: number,
    details?: Record<string, unknown>
  ): void {
    this.debug('LLM interaction', {
      provider,
      model,
      tokensUsed,
      ...details,
    });
  }

  /**
   * Log performance metrics
   */
  performance(
    operation: string,
    durationMs: number,
    details?: Record<string, unknown>
  ): void {
    this.debug(`Performance: ${operation}`, {
      operation,
      durationMs,
      ...details,
    });
  }

  /**
   * Create a child logger with additional context
   */
  child(context: Record<string, unknown>): AgentLogger {
    const childLogger = new AgentLogger(this.agentType, this.agentId);
    // Override log method to include additional context
    const originalLog = childLogger.log.bind(childLogger);
    childLogger.log = (level: string, message: string, meta?: Record<string, unknown>) => {
      originalLog(level, message, { ...context, ...meta });
    };
    return childLogger;
  }
}

/**
 * Create a logger for a specific agent
 */
export function createAgentLogger(agentType: string, agentId?: string): AgentLogger {
  return new AgentLogger(agentType, agentId);
}

/**
 * Performance timing helper
 */
export class PerformanceTimer {
  private startTime: number;
  private logger: AgentLogger;
  private operation: string;

  constructor(logger: AgentLogger, operation: string) {
    this.logger = logger;
    this.operation = operation;
    this.startTime = Date.now();
  }

  /**
   * End the timer and log the duration
   */
  end(details?: Record<string, unknown>): number {
    const durationMs = Date.now() - this.startTime;
    this.logger.performance(this.operation, durationMs, details);
    return durationMs;
  }

  /**
   * Get current elapsed time without ending the timer
   */
  elapsed(): number {
    return Date.now() - this.startTime;
  }
}

/**
 * Start a performance timer
 */
export function startTimer(logger: AgentLogger, operation: string): PerformanceTimer {
  return new PerformanceTimer(logger, operation);
}

/**
 * Async wrapper with automatic timing
 */
export async function withTiming<T>(
  logger: AgentLogger,
  operation: string,
  fn: () => Promise<T>,
  details?: Record<string, unknown>
): Promise<T> {
  const timer = startTimer(logger, operation);
  try {
    const result = await fn();
    timer.end({ success: true, ...details });
    return result;
  } catch (error) {
    timer.end({ success: false, error, ...details });
    throw error;
  }
}

/**
 * Middleware to log unhandled errors
 */
export function setupErrorHandlers(agentLogger: AgentLogger): void {
  process.on('uncaughtException', (error: Error) => {
    agentLogger.error('Uncaught Exception', error, { fatal: true });
    // Give time for log to be written
    setTimeout(() => {
      process.exit(1);
    }, 1000);
  });

  process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
    agentLogger.error('Unhandled Promise Rejection', reason as Error, {
      promise: String(promise),
    });
  });

  process.on('warning', (warning: Error) => {
    agentLogger.warn('Node.js Warning', {
      name: warning.name,
      message: warning.message,
      stack: warning.stack,
    });
  });
}

/**
 * Graceful shutdown handler
 */
export async function gracefulShutdown(
  agentLogger: AgentLogger,
  cleanup?: () => Promise<void>
): Promise<void> {
  agentLogger.info('Graceful shutdown initiated');

  try {
    if (cleanup) {
      await cleanup();
    }
    agentLogger.info('Cleanup completed successfully');
  } catch (error) {
    agentLogger.error('Error during cleanup', error as Error);
  }

  // Close Winston transports
  await new Promise<void>((resolve) => {
    logger.on('finish', resolve);
    logger.end();
  });

  process.exit(0);
}

/**
 * Setup graceful shutdown handlers
 */
export function setupShutdownHandlers(
  agentLogger: AgentLogger,
  cleanup?: () => Promise<void>
): void {
  const shutdown = () => gracefulShutdown(agentLogger, cleanup);

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

// Export default logger for convenience
export default logger;
