/**
 * JSON Formatter Implementation
 *
 * Feature: F0.4 - Logger Refactor
 * Formats log entries as JSON for structured logging pipelines
 *
 * @module core/logging/formatters
 */

import type { ILogFormatter, LogEntry } from '../logging.interface.js';
import { LogLevelUtil } from '../logging.interface.js';

/**
 * JSON formatter options
 */
export interface JsonFormatterOptions {
  /** Pretty print with indentation */
  pretty?: boolean;
  /** Indentation spaces (for pretty print) */
  indent?: number;
  /** Include stack traces */
  includeStack?: boolean;
  /** Custom timestamp format */
  timestampFormat?: 'iso' | 'unix' | 'unix_ms';
  /** Additional static fields to include */
  staticFields?: Record<string, unknown>;
}

/**
 * JSON Formatter for structured log output
 */
export class JsonFormatter implements ILogFormatter {
  private readonly pretty: boolean;
  private readonly indent: number;
  private readonly includeStack: boolean;
  private readonly timestampFormat: 'iso' | 'unix' | 'unix_ms';
  private readonly staticFields: Record<string, unknown>;

  constructor(options: JsonFormatterOptions = {}) {
    this.pretty = options.pretty ?? false;
    this.indent = options.indent ?? 2;
    this.includeStack = options.includeStack ?? true;
    this.timestampFormat = options.timestampFormat ?? 'iso';
    this.staticFields = options.staticFields ?? {};
  }

  format(entry: LogEntry): string {
    const output: Record<string, unknown> = {
      ...this.staticFields,
      timestamp: this.formatTimestamp(entry.timestamp),
      level: LogLevelUtil.toString(entry.level),
      logger: entry.logger,
      message: entry.message,
      type: entry.type,
    };

    // Add context fields
    if (Object.keys(entry.context).length > 0) {
      output.context = entry.context;
    }

    // Add error info
    if (entry.error) {
      output.error = this.formatError(entry.error);
    }

    // Add additional data
    if (entry.data && Object.keys(entry.data).length > 0) {
      output.data = entry.data;
    }

    return this.pretty
      ? JSON.stringify(output, null, this.indent)
      : JSON.stringify(output);
  }

  /**
   * Format timestamp according to options
   */
  private formatTimestamp(date: Date): string | number {
    switch (this.timestampFormat) {
      case 'unix':
        return Math.floor(date.getTime() / 1000);
      case 'unix_ms':
        return date.getTime();
      case 'iso':
      default:
        return date.toISOString();
    }
  }

  /**
   * Format error for JSON output
   */
  private formatError(error: {
    name: string;
    message: string;
    code?: string;
    stack?: string;
    cause?: unknown;
  }): Record<string, unknown> {
    const output: Record<string, unknown> = {
      name: error.name,
      message: error.message,
    };

    if (error.code) {
      output.code = error.code;
    }

    if (this.includeStack && error.stack) {
      output.stack = error.stack.split('\n').map((line) => line.trim());
    }

    if (error.cause) {
      output.cause = this.formatError(error.cause as {
        name: string;
        message: string;
        code?: string;
        stack?: string;
        cause?: unknown;
      });
    }

    return output;
  }
}
