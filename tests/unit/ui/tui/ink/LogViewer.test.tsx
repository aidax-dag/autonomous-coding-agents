/**
 * Tests for Ink LogViewer component
 */

import React from 'react';
import { render } from 'ink-testing-library';
import { LogViewer } from '@/ui/tui/ink/components/LogViewer';
import type { LogEntry } from '@/ui/tui/interfaces/tui.interface';

function makeEntry(overrides: Partial<LogEntry> = {}): LogEntry {
  return {
    timestamp: '2026-02-15T14:30:45.123Z',
    level: 'info',
    source: 'runner',
    message: 'Task started',
    ...overrides,
  };
}

describe('Ink LogViewer', () => {
  it('should render header', () => {
    const { lastFrame } = render(React.createElement(LogViewer, { entries: [] }));
    expect(lastFrame()).toContain('=== Logs ===');
  });

  it('should show "(no logs)" when empty', () => {
    const { lastFrame } = render(React.createElement(LogViewer, { entries: [] }));
    expect(lastFrame()).toContain('(no logs)');
  });

  it('should render log entries with time and level', () => {
    const entries = [
      makeEntry({ level: 'info', source: 'agent-1', message: 'Started processing' }),
      makeEntry({ level: 'error', source: 'agent-2', message: 'Connection failed' }),
    ];
    const { lastFrame } = render(React.createElement(LogViewer, { entries }));
    const frame = lastFrame()!;

    expect(frame).toContain('14:30:45');
    expect(frame).toContain('INF');
    expect(frame).toContain('[agent-1]');
    expect(frame).toContain('Started processing');
    expect(frame).toContain('ERR');
    expect(frame).toContain('[agent-2]');
    expect(frame).toContain('Connection failed');
  });

  it('should render all log levels', () => {
    const entries = [
      makeEntry({ level: 'debug', message: 'debug msg' }),
      makeEntry({ level: 'info', message: 'info msg' }),
      makeEntry({ level: 'warn', message: 'warn msg' }),
      makeEntry({ level: 'error', message: 'error msg' }),
    ];
    const { lastFrame } = render(React.createElement(LogViewer, { entries }));
    const frame = lastFrame()!;

    expect(frame).toContain('DBG');
    expect(frame).toContain('INF');
    expect(frame).toContain('WRN');
    expect(frame).toContain('ERR');
  });
});
