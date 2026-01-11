/**
 * Formatter Tests
 *
 * Feature: F0.4 - Logger Refactor
 * Tests for JSON and Pretty formatters
 */

import { describe, it, expect } from '@jest/globals';
import {
  JsonFormatter,
  PrettyFormatter,
  LogLevel,
  LogEntry,
} from '../../../src/core/logging/index.js';

// Helper to create test log entry
function createEntry(overrides: Partial<LogEntry> = {}): LogEntry {
  return {
    timestamp: new Date('2024-01-15T10:30:00.000Z'),
    level: LogLevel.INFO,
    logger: 'test',
    message: 'Test message',
    type: 'general',
    context: {},
    ...overrides,
  };
}

describe('JsonFormatter', () => {
  describe('Basic Formatting', () => {
    it('should format entry as JSON', () => {
      const formatter = new JsonFormatter();
      const entry = createEntry();

      const output = formatter.format(entry);
      const parsed = JSON.parse(output);

      expect(parsed.level).toBe('info');
      expect(parsed.logger).toBe('test');
      expect(parsed.message).toBe('Test message');
      expect(parsed.type).toBe('general');
    });

    it('should use ISO timestamp by default', () => {
      const formatter = new JsonFormatter();
      const entry = createEntry();

      const output = formatter.format(entry);
      const parsed = JSON.parse(output);

      expect(parsed.timestamp).toBe('2024-01-15T10:30:00.000Z');
    });
  });

  describe('Timestamp Formats', () => {
    it('should support unix timestamp', () => {
      const formatter = new JsonFormatter({ timestampFormat: 'unix' });
      const entry = createEntry();

      const output = formatter.format(entry);
      const parsed = JSON.parse(output);

      expect(parsed.timestamp).toBe(Math.floor(entry.timestamp.getTime() / 1000));
    });

    it('should support unix milliseconds timestamp', () => {
      const formatter = new JsonFormatter({ timestampFormat: 'unix_ms' });
      const entry = createEntry();

      const output = formatter.format(entry);
      const parsed = JSON.parse(output);

      expect(parsed.timestamp).toBe(entry.timestamp.getTime());
    });
  });

  describe('Pretty Print', () => {
    it('should format with indentation when pretty is true', () => {
      const formatter = new JsonFormatter({ pretty: true, indent: 2 });
      const entry = createEntry();

      const output = formatter.format(entry);

      expect(output).toContain('\n');
      expect(output).toContain('  "level"');
    });

    it('should format as single line when pretty is false', () => {
      const formatter = new JsonFormatter({ pretty: false });
      const entry = createEntry();

      const output = formatter.format(entry);

      expect(output).not.toContain('\n');
    });
  });

  describe('Context Handling', () => {
    it('should include context fields', () => {
      const formatter = new JsonFormatter();
      const entry = createEntry({
        context: {
          requestId: 'req-123',
          agentId: 'agent-1',
        },
      });

      const output = formatter.format(entry);
      const parsed = JSON.parse(output);

      expect(parsed.context.requestId).toBe('req-123');
      expect(parsed.context.agentId).toBe('agent-1');
    });

    it('should omit empty context', () => {
      const formatter = new JsonFormatter();
      const entry = createEntry({ context: {} });

      const output = formatter.format(entry);
      const parsed = JSON.parse(output);

      expect(parsed.context).toBeUndefined();
    });
  });

  describe('Error Handling', () => {
    it('should format error information', () => {
      const formatter = new JsonFormatter();
      const entry = createEntry({
        error: {
          name: 'Error',
          message: 'Test error',
          stack: 'Error: Test error\n    at test.ts:1:1',
        },
      });

      const output = formatter.format(entry);
      const parsed = JSON.parse(output);

      expect(parsed.error.name).toBe('Error');
      expect(parsed.error.message).toBe('Test error');
      expect(parsed.error.stack).toBeInstanceOf(Array);
    });

    it('should include error code if present', () => {
      const formatter = new JsonFormatter();
      const entry = createEntry({
        error: {
          name: 'Error',
          message: 'File not found',
          code: 'ENOENT',
        },
      });

      const output = formatter.format(entry);
      const parsed = JSON.parse(output);

      expect(parsed.error.code).toBe('ENOENT');
    });

    it('should format error cause chain', () => {
      const formatter = new JsonFormatter();
      const entry = createEntry({
        error: {
          name: 'Error',
          message: 'Outer error',
          cause: {
            name: 'Error',
            message: 'Inner error',
          },
        },
      });

      const output = formatter.format(entry);
      const parsed = JSON.parse(output);

      expect(parsed.error.cause.message).toBe('Inner error');
    });

    it('should exclude stack when includeStack is false', () => {
      const formatter = new JsonFormatter({ includeStack: false });
      const entry = createEntry({
        error: {
          name: 'Error',
          message: 'Test',
          stack: 'Error: Test\n    at test.ts:1:1',
        },
      });

      const output = formatter.format(entry);
      const parsed = JSON.parse(output);

      expect(parsed.error.stack).toBeUndefined();
    });
  });

  describe('Static Fields', () => {
    it('should include static fields in output', () => {
      const formatter = new JsonFormatter({
        staticFields: {
          service: 'my-service',
          version: '1.0.0',
        },
      });
      const entry = createEntry();

      const output = formatter.format(entry);
      const parsed = JSON.parse(output);

      expect(parsed.service).toBe('my-service');
      expect(parsed.version).toBe('1.0.0');
    });
  });

  describe('Additional Data', () => {
    it('should include additional data field', () => {
      const formatter = new JsonFormatter();
      const entry = createEntry({
        data: {
          customField: 'value',
          count: 42,
        },
      });

      const output = formatter.format(entry);
      const parsed = JSON.parse(output);

      expect(parsed.data.customField).toBe('value');
      expect(parsed.data.count).toBe(42);
    });
  });
});

describe('PrettyFormatter', () => {
  describe('Basic Formatting', () => {
    it('should format entry with human-readable output', () => {
      const formatter = new PrettyFormatter({ colorize: false });
      const entry = createEntry();

      const output = formatter.format(entry);

      expect(output).toContain('INFO');
      expect(output).toContain('[test]');
      expect(output).toContain('Test message');
    });

    it('should include level icon', () => {
      const formatter = new PrettyFormatter({ colorize: false });
      const entry = createEntry({ level: LogLevel.ERROR });

      const output = formatter.format(entry);

      expect(output).toContain('❌');
    });
  });

  describe('Timestamp Formats', () => {
    it('should format time only by default', () => {
      const formatter = new PrettyFormatter({ colorize: false });
      const entry = createEntry();

      const output = formatter.format(entry);

      expect(output).toContain('10:30:00.000');
    });

    it('should format ISO timestamp', () => {
      const formatter = new PrettyFormatter({
        colorize: false,
        timestampFormat: 'iso',
      });
      const entry = createEntry();

      const output = formatter.format(entry);

      expect(output).toContain('2024-01-15T10:30:00.000Z');
    });

    it('should format relative timestamp', () => {
      const formatter = new PrettyFormatter({
        colorize: false,
        timestampFormat: 'relative',
      });
      const entry = createEntry({ timestamp: new Date() });

      const output = formatter.format(entry);

      expect(output).toMatch(/\+\d+\.\d+s/);
    });

    it('should hide timestamp when disabled', () => {
      const formatter = new PrettyFormatter({
        colorize: false,
        timestamp: false,
      });
      const entry = createEntry();

      const output = formatter.format(entry);

      expect(output).not.toContain('10:30:00');
    });
  });

  describe('Logger Name', () => {
    it('should include logger name by default', () => {
      const formatter = new PrettyFormatter({ colorize: false });
      const entry = createEntry({ logger: 'my-module' });

      const output = formatter.format(entry);

      expect(output).toContain('[my-module]');
    });

    it('should hide logger name when disabled', () => {
      const formatter = new PrettyFormatter({
        colorize: false,
        loggerName: false,
      });
      const entry = createEntry({ logger: 'my-module' });

      const output = formatter.format(entry);

      expect(output).not.toContain('[my-module]');
    });
  });

  describe('Context Display', () => {
    it('should display context fields on second line', () => {
      const formatter = new PrettyFormatter({ colorize: false });
      const entry = createEntry({
        context: {
          requestId: 'req-123',
          durationMs: 150,
        },
      });

      const output = formatter.format(entry);
      const lines = output.split('\n');

      expect(lines.length).toBeGreaterThan(1);
      expect(lines[1]).toContain('requestId=req-123');
      expect(lines[1]).toContain('durationMs=150');
    });

    it('should respect contextFields option', () => {
      const formatter = new PrettyFormatter({
        colorize: false,
        contextFields: ['taskId'],
      });
      const entry = createEntry({
        context: {
          requestId: 'req-123',
          taskId: 'task-456',
        },
      });

      const output = formatter.format(entry);

      expect(output).toContain('taskId=task-456');
      expect(output).not.toContain('requestId');
    });

    it('should hide context when disabled', () => {
      const formatter = new PrettyFormatter({
        colorize: false,
        context: false,
      });
      const entry = createEntry({
        context: { requestId: 'req-123' },
      });

      const output = formatter.format(entry);

      expect(output).not.toContain('requestId');
    });
  });

  describe('Error Display', () => {
    it('should format error on separate lines', () => {
      const formatter = new PrettyFormatter({ colorize: false });
      const entry = createEntry({
        error: {
          name: 'Error',
          message: 'Something went wrong',
        },
      });

      const output = formatter.format(entry);

      expect(output).toContain('Error:');
      expect(output).toContain('Something went wrong');
    });

    it('should format error stack trace', () => {
      const formatter = new PrettyFormatter({ colorize: false });
      const entry = createEntry({
        error: {
          name: 'Error',
          message: 'Test',
          stack: 'Error: Test\n    at file.ts:10:5\n    at other.ts:20:3',
        },
      });

      const output = formatter.format(entry);

      expect(output).toContain('file.ts:10:5');
      expect(output).toContain('other.ts:20:3');
    });

    it('should format error cause', () => {
      const formatter = new PrettyFormatter({ colorize: false });
      const entry = createEntry({
        error: {
          name: 'Error',
          message: 'Outer',
          cause: {
            name: 'Error',
            message: 'Inner cause',
          },
        },
      });

      const output = formatter.format(entry);

      expect(output).toContain('Caused by:');
      expect(output).toContain('Inner cause');
    });
  });

  describe('Message Width', () => {
    it('should truncate long messages when maxWidth is set', () => {
      const formatter = new PrettyFormatter({
        colorize: false,
        timestamp: false,
        loggerName: false,
        maxWidth: 50,
      });
      const entry = createEntry({
        message: 'This is a very long message that should be truncated',
      });

      const output = formatter.format(entry);
      const firstLine = output.split('\n')[0];

      expect(firstLine.length).toBeLessThanOrEqual(50);
      expect(firstLine).toContain('...');
    });
  });

  describe('Colorization', () => {
    it('should include ANSI codes when colorize is true', () => {
      const formatter = new PrettyFormatter({ colorize: true });
      const entry = createEntry();

      const output = formatter.format(entry);

      expect(output).toContain('\x1b[');
    });

    it('should not include ANSI codes when colorize is false', () => {
      const formatter = new PrettyFormatter({ colorize: false });
      const entry = createEntry();

      const output = formatter.format(entry);

      expect(output).not.toContain('\x1b[');
    });
  });

  describe('Level Icons', () => {
    it('should use correct icons for each level', () => {
      const formatter = new PrettyFormatter({ colorize: false });

      const levels = [
        { level: LogLevel.TRACE, icon: '🔍' },
        { level: LogLevel.DEBUG, icon: '🐛' },
        { level: LogLevel.INFO, icon: '📋' },
        { level: LogLevel.WARN, icon: '⚠️' },
        { level: LogLevel.ERROR, icon: '❌' },
        { level: LogLevel.FATAL, icon: '💀' },
      ];

      for (const { level, icon } of levels) {
        const entry = createEntry({ level });
        const output = formatter.format(entry);
        expect(output).toContain(icon);
      }
    });
  });
});
