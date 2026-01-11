/**
 * Structured Logger Implementation
 *
 * Feature: F0.4 - Logger Refactor
 * Provides structured logging with context propagation and typed events
 *
 * @module core/logging
 */

import type {
  ITypedLogger,
  ILogTransport,
  ILogFormatter,
  IContextManager,
  LogContext,
  LogEntry,
  LogEntryType,
  LoggerOptions,
  ErrorInfo,
  TypedLogEvent,
  AgentLogEvent,
  TaskLogEvent,
  WorkflowLogEvent,
  ToolLogEvent,
  HookLogEvent,
  ApiLogEvent,
  SecurityLogEvent,
  PerformanceLogEvent,
} from './logging.interface.js';
import { LogLevel } from './logging.interface.js';
import { getContextManager } from './context-manager.js';

/**
 * Convert Error to ErrorInfo
 */
function errorToInfo(error: Error): ErrorInfo {
  const info: ErrorInfo = {
    name: error.name,
    message: error.message,
    stack: error.stack,
  };

  if ('code' in error && typeof error.code === 'string') {
    info.code = error.code;
  }

  if (error.cause instanceof Error) {
    info.cause = errorToInfo(error.cause);
  }

  return info;
}

/**
 * Structured Logger with typed event support
 */
export class StructuredLogger implements ITypedLogger {
  readonly name: string;
  private _level: LogLevel;
  private readonly transports: ILogTransport[];
  private readonly formatter: ILogFormatter | undefined;
  private readonly contextManager: IContextManager;
  private readonly defaultContext: LogContext;
  private readonly options: LoggerOptions;

  constructor(
    name: string,
    options: LoggerOptions = {},
    contextManager?: IContextManager
  ) {
    this.name = name;
    this._level = options.level ?? LogLevel.INFO;
    this.transports = options.transports ?? [];
    this.formatter = options.formatter;
    this.contextManager = contextManager ?? getContextManager();
    this.defaultContext = options.context ?? {};
    this.options = options;
  }

  get level(): LogLevel {
    return this._level;
  }

  setLevel(level: LogLevel): void {
    this._level = level;
  }

  isLevelEnabled(level: LogLevel): boolean {
    return level >= this._level;
  }

  trace(message: string, context?: LogContext): void {
    this.log(LogLevel.TRACE, message, 'general', context);
  }

  debug(message: string, context?: LogContext): void {
    this.log(LogLevel.DEBUG, message, 'general', context);
  }

  info(message: string, context?: LogContext): void {
    this.log(LogLevel.INFO, message, 'general', context);
  }

  warn(message: string, context?: LogContext): void {
    this.log(LogLevel.WARN, message, 'general', context);
  }

  error(message: string, error?: Error | null, context?: LogContext): void {
    this.log(LogLevel.ERROR, message, 'error', context, error ?? undefined);
  }

  fatal(message: string, error?: Error | null, context?: LogContext): void {
    this.log(LogLevel.FATAL, message, 'error', context, error ?? undefined);
  }

  /**
   * Log typed event
   */
  logEvent(level: LogLevel, event: TypedLogEvent, message?: string): void {
    if (!this.isLevelEnabled(level)) {
      return;
    }

    const eventContext = this.eventToContext(event);
    const logMessage = message ?? this.generateEventMessage(event);
    this.log(level, logMessage, event.type, eventContext);
  }

  /**
   * Log agent event
   */
  agent(event: Omit<AgentLogEvent, 'type'>, message?: string): void {
    const fullEvent: AgentLogEvent = { ...event, type: 'agent' };
    const level = this.getEventLevel(fullEvent);
    this.logEvent(level, fullEvent, message);
  }

  /**
   * Log task event
   */
  task(event: Omit<TaskLogEvent, 'type'>, message?: string): void {
    const fullEvent: TaskLogEvent = { ...event, type: 'task' };
    const level = this.getEventLevel(fullEvent);
    this.logEvent(level, fullEvent, message);
  }

  /**
   * Log workflow event
   */
  workflow(event: Omit<WorkflowLogEvent, 'type'>, message?: string): void {
    const fullEvent: WorkflowLogEvent = { ...event, type: 'workflow' };
    const level = this.getEventLevel(fullEvent);
    this.logEvent(level, fullEvent, message);
  }

  /**
   * Log tool event
   */
  tool(event: Omit<ToolLogEvent, 'type'>, message?: string): void {
    const fullEvent: ToolLogEvent = { ...event, type: 'tool' };
    const level = this.getEventLevel(fullEvent);
    this.logEvent(level, fullEvent, message);
  }

  /**
   * Log hook event
   */
  hook(event: Omit<HookLogEvent, 'type'>, message?: string): void {
    const fullEvent: HookLogEvent = { ...event, type: 'hook' };
    const level = this.getEventLevel(fullEvent);
    this.logEvent(level, fullEvent, message);
  }

  /**
   * Log API event
   */
  api(event: Omit<ApiLogEvent, 'type'>, message?: string): void {
    const fullEvent: ApiLogEvent = { ...event, type: 'api' };
    const level = this.getEventLevel(fullEvent);
    this.logEvent(level, fullEvent, message);
  }

  /**
   * Log security event
   */
  security(event: Omit<SecurityLogEvent, 'type'>, message?: string): void {
    const fullEvent: SecurityLogEvent = { ...event, type: 'security' };
    const level = this.getEventLevel(fullEvent);
    this.logEvent(level, fullEvent, message);
  }

  /**
   * Log performance event
   */
  performance(event: Omit<PerformanceLogEvent, 'type'>, message?: string): void {
    const fullEvent: PerformanceLogEvent = { ...event, type: 'performance' };
    const level = this.getEventLevel(fullEvent);
    this.logEvent(level, fullEvent, message);
  }

  /**
   * Start a timer and return a function to stop it
   */
  startTimer(name: string): () => void {
    const start = performance.now();
    this.performance({ event: 'timer_start', name }, `Timer started: ${name}`);

    return () => {
      const durationMs = performance.now() - start;
      this.performance(
        { event: 'timer_end', name, durationMs },
        `Timer ended: ${name} (${durationMs.toFixed(2)}ms)`
      );
    };
  }

  /**
   * Create child logger with inherited context
   */
  child(name: string, context?: LogContext): ITypedLogger {
    const childName = `${this.name}.${name}`;
    const childContext = { ...this.defaultContext, ...context };

    return new StructuredLogger(
      childName,
      {
        ...this.options,
        level: this._level,
        context: childContext,
        transports: this.transports,
        formatter: this.formatter,
      },
      this.contextManager
    );
  }

  /**
   * Create logger with bound context
   */
  withContext(context: LogContext): ITypedLogger {
    const boundContext = { ...this.defaultContext, ...context };

    return new StructuredLogger(
      this.name,
      {
        ...this.options,
        level: this._level,
        context: boundContext,
        transports: this.transports,
        formatter: this.formatter,
      },
      this.contextManager
    );
  }

  /**
   * Add transport
   */
  addTransport(transport: ILogTransport): void {
    this.transports.push(transport);
  }

  /**
   * Remove transport by name
   */
  removeTransport(name: string): boolean {
    const index = this.transports.findIndex((t) => t.name === name);
    if (index >= 0) {
      this.transports.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Flush all transports
   */
  async flush(): Promise<void> {
    await Promise.all(
      this.transports.map((t) => t.flush?.()).filter(Boolean)
    );
  }

  /**
   * Close all transports
   */
  async close(): Promise<void> {
    await Promise.all(
      this.transports.map((t) => t.close?.()).filter(Boolean)
    );
  }

  /**
   * Core logging method
   */
  private log(
    level: LogLevel,
    message: string,
    type: LogEntryType,
    additionalContext?: LogContext,
    error?: Error
  ): void {
    if (!this.isLevelEnabled(level)) {
      return;
    }

    // Get context from AsyncLocalStorage and merge with defaults and additional
    const asyncContext = this.contextManager.getContext();
    const context: LogContext = {
      ...asyncContext,
      ...this.defaultContext,
      ...additionalContext,
    };

    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      logger: this.name,
      message,
      type,
      context,
      error: error ? errorToInfo(error) : undefined,
    };

    // Write to all transports
    for (const transport of this.transports) {
      try {
        transport.write(entry);
      } catch (err) {
        // Fallback to console if transport fails
        console.error(`Transport ${transport.name} failed:`, err);
      }
    }
  }

  /**
   * Convert typed event to context
   */
  private eventToContext(event: TypedLogEvent): LogContext {
    const context: LogContext = {};

    switch (event.type) {
      case 'agent':
        context.agentType = event.agentType;
        context.agentId = event.agentId;
        if (event.taskId) context.taskId = event.taskId;
        if (event.durationMs) context.durationMs = event.durationMs;
        break;

      case 'task':
        context.taskId = event.taskId;
        if (event.taskType) context.operation = event.taskType;
        if (event.durationMs) context.durationMs = event.durationMs;
        break;

      case 'workflow':
        context.workflowId = event.workflowId;
        context.executionId = event.executionId;
        if (event.stepId) context.stepId = event.stepId;
        if (event.durationMs) context.durationMs = event.durationMs;
        break;

      case 'tool':
        context.toolName = event.toolName;
        if (event.durationMs) context.durationMs = event.durationMs;
        break;

      case 'hook':
        context.hookName = event.hookName;
        context.operation = event.hookEvent;
        if (event.durationMs) context.durationMs = event.durationMs;
        break;

      case 'api':
        context.operation = `${event.method} ${event.path}`;
        if (event.durationMs) context.durationMs = event.durationMs;
        break;

      case 'security':
        if (event.userId) context.userId = event.userId;
        if (event.action) context.operation = event.action;
        break;

      case 'performance':
        context.operation = event.name;
        if (event.durationMs) context.durationMs = event.durationMs;
        break;
    }

    return context;
  }

  /**
   * Generate default message for event
   */
  private generateEventMessage(event: TypedLogEvent): string {
    switch (event.type) {
      case 'agent':
        return `Agent ${event.agentType}:${event.agentId} ${event.event}`;
      case 'task':
        return `Task ${event.taskId} ${event.event}`;
      case 'workflow':
        return `Workflow ${event.workflowId} ${event.event}`;
      case 'tool':
        return `Tool ${event.toolName} ${event.event}`;
      case 'hook':
        return `Hook ${event.hookName} ${event.event}`;
      case 'api':
        return `API ${event.method} ${event.path} ${event.event}`;
      case 'security':
        return `Security ${event.event}`;
      case 'performance':
        return `Performance ${event.name} ${event.event}`;
      default:
        return 'Unknown event';
    }
  }

  /**
   * Determine log level from event
   */
  private getEventLevel(event: TypedLogEvent): LogLevel {
    // Error events are ERROR level
    if ('error' in event && event.error) {
      return LogLevel.ERROR;
    }

    // Failed events are ERROR level
    if ('event' in event) {
      const eventName = event.event as string;
      if (eventName.includes('failed') || eventName.includes('failure')) {
        return LogLevel.ERROR;
      }
      if (eventName.includes('denied')) {
        return LogLevel.WARN;
      }
    }

    // Security events are INFO or WARN
    if (event.type === 'security') {
      const secEvent = event as SecurityLogEvent;
      if (secEvent.event === 'auth_failure' || secEvent.event === 'access_denied') {
        return LogLevel.WARN;
      }
    }

    // Default to INFO
    return LogLevel.INFO;
  }
}
