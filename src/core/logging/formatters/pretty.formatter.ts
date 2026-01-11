/**
 * Pretty Formatter Implementation
 *
 * Feature: F0.4 - Logger Refactor
 * Formats log entries for human-readable console output
 *
 * @module core/logging/formatters
 */

import type { ILogFormatter, LogEntry, LogContext } from '../logging.interface.js';
import { LogLevel, LogLevelUtil } from '../logging.interface.js';

/**
 * Pretty formatter options
 */
export interface PrettyFormatterOptions {
  /** Enable colors */
  colorize?: boolean;
  /** Include timestamp */
  timestamp?: boolean;
  /** Timestamp format */
  timestampFormat?: 'iso' | 'time' | 'relative';
  /** Include logger name */
  loggerName?: boolean;
  /** Include context fields */
  context?: boolean;
  /** Context fields to display */
  contextFields?: string[];
  /** Max message width (0 = unlimited) */
  maxWidth?: number;
}

/**
 * Level icons for visual distinction
 */
const LEVEL_ICONS: Record<LogLevel, string> = {
  [LogLevel.TRACE]: '🔍',
  [LogLevel.DEBUG]: '🐛',
  [LogLevel.INFO]: '📋',
  [LogLevel.WARN]: '⚠️',
  [LogLevel.ERROR]: '❌',
  [LogLevel.FATAL]: '💀',
  [LogLevel.SILENT]: '',
};

/**
 * Pretty Formatter for human-readable log output
 */
export class PrettyFormatter implements ILogFormatter {
  private readonly colorize: boolean;
  private readonly timestamp: boolean;
  private readonly timestampFormat: 'iso' | 'time' | 'relative';
  private readonly loggerName: boolean;
  private readonly context: boolean;
  private readonly contextFields: string[];
  private readonly maxWidth: number;
  private readonly startTime: number;

  constructor(options: PrettyFormatterOptions = {}) {
    this.colorize = options.colorize ?? true;
    this.timestamp = options.timestamp ?? true;
    this.timestampFormat = options.timestampFormat ?? 'time';
    this.loggerName = options.loggerName ?? true;
    this.context = options.context ?? true;
    this.contextFields = options.contextFields ?? [
      'requestId',
      'traceId',
      'agentId',
      'taskId',
      'durationMs',
    ];
    this.maxWidth = options.maxWidth ?? 0;
    this.startTime = Date.now();
  }

  format(entry: LogEntry): string {
    const lines: string[] = [];

    // Main line
    const mainLine = this.formatMainLine(entry);
    lines.push(mainLine);

    // Context line (if enabled and has relevant fields)
    if (this.context) {
      const contextLine = this.formatContextLine(entry.context);
      if (contextLine) {
        lines.push(contextLine);
      }
    }

    // Error lines
    if (entry.error) {
      lines.push(this.formatErrorLines(entry.error));
    }

    return lines.join('\n');
  }

  /**
   * Format the main log line
   */
  private formatMainLine(entry: LogEntry): string {
    const parts: string[] = [];

    // Timestamp
    if (this.timestamp) {
      const ts = this.formatTimestamp(entry.timestamp);
      parts.push(this.applyColor(ts, '90')); // dim
    }

    // Level with icon
    const icon = LEVEL_ICONS[entry.level];
    const levelStr = LogLevelUtil.toString(entry.level).toUpperCase().padEnd(5);
    const levelColor = this.getLevelColor(entry.level);
    parts.push(`${icon} ${this.applyColor(levelStr, levelColor)}`);

    // Logger name
    if (this.loggerName) {
      const name = `[${entry.logger}]`;
      parts.push(this.applyColor(name, '36')); // cyan
    }

    // Message
    let message = entry.message;
    if (this.maxWidth > 0) {
      const usedWidth = parts.join(' ').length + 1;
      const remaining = this.maxWidth - usedWidth;
      if (message.length > remaining && remaining > 3) {
        message = message.substring(0, remaining - 3) + '...';
      }
    }
    parts.push(message);

    return parts.join(' ');
  }

  /**
   * Format context fields for display
   */
  private formatContextLine(context: LogContext): string | null {
    const fields: string[] = [];

    for (const field of this.contextFields) {
      const value = context[field];
      if (value !== undefined) {
        const formattedValue = this.formatValue(value);
        fields.push(`${field}=${formattedValue}`);
      }
    }

    if (fields.length === 0) {
      return null;
    }

    const content = `    └─ ${fields.join(' │ ')}`;
    return this.applyColor(content, '90'); // dim
  }

  /**
   * Format error with stack trace
   */
  private formatErrorLines(error: {
    name: string;
    message: string;
    stack?: string;
    cause?: unknown;
  }): string {
    const lines: string[] = [];

    // Error header
    const header = `    ${this.applyColor('Error:', '31')} ${error.name}: ${error.message}`;
    lines.push(header);

    // Stack trace
    if (error.stack) {
      const stackLines = error.stack
        .split('\n')
        .slice(1)
        .map((line) => `      ${line.trim()}`);
      lines.push(this.applyColor(stackLines.join('\n'), '90'));
    }

    // Cause chain
    if (error.cause) {
      lines.push(this.applyColor('    Caused by:', '33'));
      lines.push(this.formatErrorLines(error.cause as {
        name: string;
        message: string;
        stack?: string;
        cause?: unknown;
      }));
    }

    return lines.join('\n');
  }

  /**
   * Format timestamp according to options
   */
  private formatTimestamp(date: Date): string {
    switch (this.timestampFormat) {
      case 'iso':
        return date.toISOString();
      case 'relative': {
        const elapsed = date.getTime() - this.startTime;
        const seconds = (elapsed / 1000).toFixed(3);
        return `+${seconds}s`;
      }
      case 'time':
      default:
        return date.toISOString().split('T')[1].replace('Z', '');
    }
  }

  /**
   * Format a value for display
   */
  private formatValue(value: unknown): string {
    if (typeof value === 'number') {
      // Format duration with unit
      if (Number.isFinite(value) && value > 0) {
        return `${value.toFixed(2)}`;
      }
      return String(value);
    }
    if (typeof value === 'string') {
      // Truncate long strings
      if (value.length > 20) {
        return value.substring(0, 17) + '...';
      }
      return value;
    }
    return String(value);
  }

  /**
   * Get color code for log level
   */
  private getLevelColor(level: LogLevel): string {
    switch (level) {
      case LogLevel.TRACE:
        return '90'; // dim
      case LogLevel.DEBUG:
        return '36'; // cyan
      case LogLevel.INFO:
        return '32'; // green
      case LogLevel.WARN:
        return '33'; // yellow
      case LogLevel.ERROR:
        return '31'; // red
      case LogLevel.FATAL:
        return '35'; // magenta
      default:
        return '0';
    }
  }

  /**
   * Apply ANSI color code if colorize is enabled
   */
  private applyColor(text: string, colorCode: string): string {
    if (!this.colorize) {
      return text;
    }
    return `\x1b[${colorCode}m${text}\x1b[0m`;
  }
}
