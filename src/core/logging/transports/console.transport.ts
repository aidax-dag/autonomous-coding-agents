/**
 * Console Transport Implementation
 *
 * Feature: F0.4 - Logger Refactor
 * Outputs log entries to console with optional formatting and colors
 *
 * @module core/logging/transports
 */

import type { ILogTransport, ILogFormatter, LogEntry } from '../logging.interface.js';
import { LogLevel, LogLevelUtil } from '../logging.interface.js';

/**
 * Console transport options
 */
export interface ConsoleTransportOptions {
  /** Formatter to use */
  formatter?: ILogFormatter;
  /** Enable colors */
  colorize?: boolean;
  /** Minimum log level */
  level?: LogLevel;
  /** Output stream (stdout/stderr) */
  stream?: 'stdout' | 'stderr' | 'auto';
  /** Include timestamp */
  timestamp?: boolean;
}

/**
 * Console Transport for logging to stdout/stderr
 */
export class ConsoleTransport implements ILogTransport {
  readonly name = 'console';
  private readonly formatter?: ILogFormatter;
  private readonly colorize: boolean;
  private readonly level: LogLevel;
  private readonly stream: 'stdout' | 'stderr' | 'auto';
  private readonly timestamp: boolean;

  constructor(options: ConsoleTransportOptions = {}) {
    this.formatter = options.formatter;
    this.colorize = options.colorize ?? this.supportsColor();
    this.level = options.level ?? LogLevel.TRACE;
    this.stream = options.stream ?? 'auto';
    this.timestamp = options.timestamp ?? true;
  }

  write(entry: LogEntry): void {
    if (entry.level < this.level) {
      return;
    }

    const output = this.formatter
      ? this.formatter.format(entry)
      : this.formatDefault(entry);

    const stream = this.getStream(entry.level);
    stream.write(output + '\n');
  }

  /**
   * Format entry with default format
   */
  private formatDefault(entry: LogEntry): string {
    const parts: string[] = [];

    // Timestamp
    if (this.timestamp) {
      const ts = entry.timestamp.toISOString();
      parts.push(this.colorize ? `\x1b[90m${ts}\x1b[0m` : ts);
    }

    // Level
    const levelStr = LogLevelUtil.toString(entry.level).toUpperCase().padEnd(5);
    if (this.colorize) {
      const color = LogLevelUtil.getColor(entry.level);
      parts.push(`${color}${levelStr}${LogLevelUtil.RESET}`);
    } else {
      parts.push(levelStr);
    }

    // Logger name
    const loggerName = `[${entry.logger}]`;
    parts.push(this.colorize ? `\x1b[36m${loggerName}\x1b[0m` : loggerName);

    // Message
    parts.push(entry.message);

    // Context (selected fields)
    const contextStr = this.formatContext(entry.context);
    if (contextStr) {
      parts.push(this.colorize ? `\x1b[90m${contextStr}\x1b[0m` : contextStr);
    }

    // Error
    if (entry.error) {
      parts.push('\n' + this.formatError(entry.error));
    }

    return parts.join(' ');
  }

  /**
   * Format context for display
   */
  private formatContext(context: Record<string, unknown>): string {
    const displayFields = [
      'requestId',
      'traceId',
      'spanId',
      'agentId',
      'taskId',
      'workflowId',
      'durationMs',
    ];

    const parts: string[] = [];
    for (const field of displayFields) {
      if (context[field] !== undefined) {
        parts.push(`${field}=${context[field]}`);
      }
    }

    return parts.length > 0 ? `{${parts.join(', ')}}` : '';
  }

  /**
   * Format error for display
   */
  private formatError(error: { name: string; message: string; stack?: string; cause?: unknown }): string {
    let output = `  ${error.name}: ${error.message}`;
    if (error.stack) {
      const stackLines = error.stack.split('\n').slice(1);
      output += '\n' + stackLines.map((line) => `  ${line.trim()}`).join('\n');
    }
    if (error.cause) {
      output += '\n  Caused by: ' + this.formatError(error.cause as { name: string; message: string; stack?: string });
    }
    return this.colorize ? `\x1b[31m${output}\x1b[0m` : output;
  }

  /**
   * Get output stream based on level
   */
  private getStream(level: LogLevel): NodeJS.WriteStream {
    if (this.stream === 'stderr') {
      return process.stderr;
    }
    if (this.stream === 'stdout') {
      return process.stdout;
    }
    // Auto: errors go to stderr
    return level >= LogLevel.ERROR ? process.stderr : process.stdout;
  }

  /**
   * Check if terminal supports colors
   */
  private supportsColor(): boolean {
    if (typeof process === 'undefined') {
      return false;
    }
    const term = process.env.TERM;
    const forceColor = process.env.FORCE_COLOR;
    const noColor = process.env.NO_COLOR;

    if (noColor) {
      return false;
    }
    if (forceColor === '1' || forceColor === 'true') {
      return true;
    }
    if (process.stdout.isTTY) {
      return term !== 'dumb';
    }
    return false;
  }
}
