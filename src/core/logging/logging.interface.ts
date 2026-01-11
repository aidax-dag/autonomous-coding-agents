/**
 * Structured Logging Interfaces
 *
 * Feature: F0.4 - Logger Refactor
 * Provides structured logging, context propagation, and typed log events
 *
 * @module core/logging
 */

import type { IDisposable } from '../di/interfaces/container.interface.js';

/**
 * Log level enumeration
 */
export enum LogLevel {
  TRACE = 0,
  DEBUG = 1,
  INFO = 2,
  WARN = 3,
  ERROR = 4,
  FATAL = 5,
  SILENT = 6,
}

/**
 * Log level string type
 */
export type LogLevelString = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal' | 'silent';

/**
 * Structured log context for context propagation
 */
export interface LogContext {
  /** Unique request/correlation ID for tracing */
  requestId?: string;
  /** Trace ID for distributed tracing */
  traceId?: string;
  /** Parent span ID for trace hierarchy */
  parentSpanId?: string;
  /** Current span ID */
  spanId?: string;
  /** Agent type */
  agentType?: string;
  /** Agent instance ID */
  agentId?: string;
  /** Task ID */
  taskId?: string;
  /** Workflow ID */
  workflowId?: string;
  /** Workflow execution ID */
  executionId?: string;
  /** Step ID */
  stepId?: string;
  /** User ID */
  userId?: string;
  /** Session ID */
  sessionId?: string;
  /** Team ID */
  teamId?: string;
  /** Tool name */
  toolName?: string;
  /** Hook name */
  hookName?: string;
  /** Component name */
  component?: string;
  /** Operation name */
  operation?: string;
  /** Duration in milliseconds */
  durationMs?: number;
  /** Custom attributes */
  [key: string]: unknown;
}

/**
 * Log entry type
 */
export type LogEntryType =
  | 'general'
  | 'agent'
  | 'task'
  | 'workflow'
  | 'tool'
  | 'hook'
  | 'api'
  | 'security'
  | 'performance'
  | 'error';

/**
 * Structured log entry
 */
export interface LogEntry {
  /** Timestamp */
  timestamp: Date;
  /** Log level */
  level: LogLevel;
  /** Logger name */
  logger: string;
  /** Log message */
  message: string;
  /** Entry type */
  type: LogEntryType;
  /** Context */
  context: LogContext;
  /** Error (if applicable) */
  error?: ErrorInfo;
  /** Additional data */
  data?: Record<string, unknown>;
}

/**
 * Error information
 */
export interface ErrorInfo {
  /** Error name */
  name: string;
  /** Error message */
  message: string;
  /** Error code */
  code?: string;
  /** Stack trace */
  stack?: string;
  /** Cause chain */
  cause?: ErrorInfo;
}

/**
 * Logger interface
 */
export interface ILogger {
  /** Logger name */
  readonly name: string;

  /** Current log level */
  readonly level: LogLevel;

  /**
   * Log trace message
   * @param message Log message
   * @param context Optional context
   */
  trace(message: string, context?: LogContext): void;

  /**
   * Log debug message
   * @param message Log message
   * @param context Optional context
   */
  debug(message: string, context?: LogContext): void;

  /**
   * Log info message
   * @param message Log message
   * @param context Optional context
   */
  info(message: string, context?: LogContext): void;

  /**
   * Log warning message
   * @param message Log message
   * @param context Optional context
   */
  warn(message: string, context?: LogContext): void;

  /**
   * Log error message
   * @param message Log message
   * @param error Optional error
   * @param context Optional context
   */
  error(message: string, error?: Error | null, context?: LogContext): void;

  /**
   * Log fatal message
   * @param message Log message
   * @param error Optional error
   * @param context Optional context
   */
  fatal(message: string, error?: Error | null, context?: LogContext): void;

  /**
   * Create child logger with inherited context
   * @param name Child logger name
   * @param context Additional context
   */
  child(name: string, context?: LogContext): ILogger;

  /**
   * Create logger with bound context
   * @param context Context to bind
   */
  withContext(context: LogContext): ILogger;

  /**
   * Check if level is enabled
   * @param level Level to check
   */
  isLevelEnabled(level: LogLevel): boolean;

  /**
   * Set log level
   * @param level New log level
   */
  setLevel(level: LogLevel): void;
}

/**
 * Log transport interface
 */
export interface ILogTransport {
  /** Transport name */
  readonly name: string;

  /**
   * Write log entry
   * @param entry Log entry
   */
  write(entry: LogEntry): void | Promise<void>;

  /**
   * Flush pending entries
   */
  flush?(): Promise<void>;

  /**
   * Close transport
   */
  close?(): Promise<void>;
}

/**
 * Log formatter interface
 */
export interface ILogFormatter {
  /**
   * Format log entry to string
   * @param entry Log entry
   */
  format(entry: LogEntry): string;
}

/**
 * Context propagation manager interface
 */
export interface IContextManager extends IDisposable {
  /**
   * Get current context
   */
  getContext(): LogContext;

  /**
   * Set context for current execution scope
   * @param context Context to set
   */
  setContext(context: LogContext): void;

  /**
   * Run function with context
   * @param context Context to use
   * @param fn Function to run
   */
  runWithContext<T>(context: LogContext, fn: () => T): T;

  /**
   * Run async function with context
   * @param context Context to use
   * @param fn Async function to run
   */
  runWithContextAsync<T>(context: LogContext, fn: () => Promise<T>): Promise<T>;

  /**
   * Merge context into current context
   * @param context Context to merge
   */
  mergeContext(context: LogContext): void;

  /**
   * Clear current context
   */
  clearContext(): void;

  /**
   * Create new request ID
   */
  createRequestId(): string;

  /**
   * Create new trace ID
   */
  createTraceId(): string;

  /**
   * Create new span ID
   */
  createSpanId(): string;
}

/**
 * Logger factory interface
 */
export interface ILoggerFactory {
  /**
   * Create logger instance
   * @param name Logger name
   * @param options Logger options
   */
  createLogger(name: string, options?: LoggerOptions): ILogger;

  /**
   * Get or create logger
   * @param name Logger name
   */
  getLogger(name: string): ILogger;

  /**
   * Set global log level
   * @param level Log level
   */
  setGlobalLevel(level: LogLevel): void;

  /**
   * Add transport to all loggers
   * @param transport Transport to add
   */
  addTransport(transport: ILogTransport): void;

  /**
   * Remove transport from all loggers
   * @param name Transport name
   */
  removeTransport(name: string): void;

  /**
   * Get context manager
   */
  getContextManager(): IContextManager;
}

/**
 * Logger options
 */
export interface LoggerOptions {
  /** Log level */
  level?: LogLevel;
  /** Default context */
  context?: LogContext;
  /** Transports */
  transports?: ILogTransport[];
  /** Formatter */
  formatter?: ILogFormatter;
  /** Include timestamp */
  timestamp?: boolean;
  /** Pretty print */
  pretty?: boolean;
  /** Colorize output */
  colorize?: boolean;
}

/**
 * Log event types for typed logging
 */
export interface AgentLogEvent {
  type: 'agent';
  event: 'started' | 'stopped' | 'task_received' | 'task_completed' | 'task_failed' | 'health_check';
  agentType: string;
  agentId: string;
  taskId?: string;
  durationMs?: number;
  error?: ErrorInfo;
}

export interface TaskLogEvent {
  type: 'task';
  event: 'created' | 'started' | 'progress' | 'completed' | 'failed' | 'cancelled';
  taskId: string;
  taskType?: string;
  progress?: number;
  durationMs?: number;
  error?: ErrorInfo;
}

export interface WorkflowLogEvent {
  type: 'workflow';
  event: 'started' | 'step_started' | 'step_completed' | 'step_failed' | 'completed' | 'failed' | 'cancelled';
  workflowId: string;
  executionId: string;
  stepId?: string;
  stepName?: string;
  durationMs?: number;
  error?: ErrorInfo;
}

export interface ToolLogEvent {
  type: 'tool';
  event: 'invoked' | 'completed' | 'failed' | 'cached';
  toolName: string;
  durationMs?: number;
  cached?: boolean;
  error?: ErrorInfo;
}

export interface HookLogEvent {
  type: 'hook';
  event: 'triggered' | 'completed' | 'failed' | 'skipped';
  hookName: string;
  hookEvent: string;
  durationMs?: number;
  error?: ErrorInfo;
}

export interface ApiLogEvent {
  type: 'api';
  event: 'request' | 'response' | 'error';
  method: string;
  path: string;
  statusCode?: number;
  durationMs?: number;
  error?: ErrorInfo;
}

export interface SecurityLogEvent {
  type: 'security';
  event: 'auth_success' | 'auth_failure' | 'access_denied' | 'permission_granted' | 'audit';
  userId?: string;
  action?: string;
  resource?: string;
  reason?: string;
}

export interface PerformanceLogEvent {
  type: 'performance';
  event: 'timer_start' | 'timer_end' | 'metric';
  name: string;
  value?: number;
  unit?: string;
  durationMs?: number;
}

export type TypedLogEvent =
  | AgentLogEvent
  | TaskLogEvent
  | WorkflowLogEvent
  | ToolLogEvent
  | HookLogEvent
  | ApiLogEvent
  | SecurityLogEvent
  | PerformanceLogEvent;

/**
 * Extended logger with typed event support
 */
export interface ITypedLogger extends ILogger {
  /**
   * Log typed event
   * @param level Log level
   * @param event Typed event
   * @param message Optional message
   */
  logEvent(level: LogLevel, event: TypedLogEvent, message?: string): void;

  /**
   * Log agent event
   * @param event Agent event
   * @param message Optional message
   */
  agent(event: Omit<AgentLogEvent, 'type'>, message?: string): void;

  /**
   * Log task event
   * @param event Task event
   * @param message Optional message
   */
  task(event: Omit<TaskLogEvent, 'type'>, message?: string): void;

  /**
   * Log workflow event
   * @param event Workflow event
   * @param message Optional message
   */
  workflow(event: Omit<WorkflowLogEvent, 'type'>, message?: string): void;

  /**
   * Log tool event
   * @param event Tool event
   * @param message Optional message
   */
  tool(event: Omit<ToolLogEvent, 'type'>, message?: string): void;

  /**
   * Log hook event
   * @param event Hook event
   * @param message Optional message
   */
  hook(event: Omit<HookLogEvent, 'type'>, message?: string): void;

  /**
   * Log API event
   * @param event API event
   * @param message Optional message
   */
  api(event: Omit<ApiLogEvent, 'type'>, message?: string): void;

  /**
   * Log security event
   * @param event Security event
   * @param message Optional message
   */
  security(event: Omit<SecurityLogEvent, 'type'>, message?: string): void;

  /**
   * Log performance event
   * @param event Performance event
   * @param message Optional message
   */
  performance(event: Omit<PerformanceLogEvent, 'type'>, message?: string): void;

  /**
   * Start a timer
   * @param name Timer name
   */
  startTimer(name: string): () => void;

  /**
   * Create child typed logger
   * @param name Child name
   * @param context Additional context
   */
  child(name: string, context?: LogContext): ITypedLogger;

  /**
   * Create typed logger with bound context
   * @param context Context to bind
   */
  withContext(context: LogContext): ITypedLogger;
}

/**
 * Log level utilities
 */
export const LogLevelUtil = {
  /**
   * Parse log level from string
   * @param level Level string
   */
  fromString(level: string): LogLevel {
    const normalized = level.toLowerCase() as LogLevelString;
    const mapping: Record<LogLevelString, LogLevel> = {
      trace: LogLevel.TRACE,
      debug: LogLevel.DEBUG,
      info: LogLevel.INFO,
      warn: LogLevel.WARN,
      error: LogLevel.ERROR,
      fatal: LogLevel.FATAL,
      silent: LogLevel.SILENT,
    };
    return mapping[normalized] ?? LogLevel.INFO;
  },

  /**
   * Convert log level to string
   * @param level Log level
   */
  toString(level: LogLevel): LogLevelString {
    const mapping: Record<LogLevel, LogLevelString> = {
      [LogLevel.TRACE]: 'trace',
      [LogLevel.DEBUG]: 'debug',
      [LogLevel.INFO]: 'info',
      [LogLevel.WARN]: 'warn',
      [LogLevel.ERROR]: 'error',
      [LogLevel.FATAL]: 'fatal',
      [LogLevel.SILENT]: 'silent',
    };
    return mapping[level] ?? 'info';
  },

  /**
   * Get log level color
   * @param level Log level
   */
  getColor(level: LogLevel): string {
    const colors: Record<LogLevel, string> = {
      [LogLevel.TRACE]: '\x1b[90m', // gray
      [LogLevel.DEBUG]: '\x1b[36m', // cyan
      [LogLevel.INFO]: '\x1b[32m', // green
      [LogLevel.WARN]: '\x1b[33m', // yellow
      [LogLevel.ERROR]: '\x1b[31m', // red
      [LogLevel.FATAL]: '\x1b[35m', // magenta
      [LogLevel.SILENT]: '',
    };
    return colors[level] ?? '';
  },

  /** Reset color */
  RESET: '\x1b[0m',
};
