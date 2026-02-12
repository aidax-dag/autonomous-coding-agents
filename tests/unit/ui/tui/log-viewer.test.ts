/**
 * Tests for LogViewer TUI Component
 */

import { LogViewer, createLogViewer } from '@/ui/tui/components/log-viewer';
import type { LogEntry } from '@/ui/tui/interfaces/tui.interface';

function makeLog(overrides: Partial<LogEntry> = {}): LogEntry {
  return {
    timestamp: '2026-02-13T14:30:45Z',
    level: 'info',
    source: 'agent-1',
    message: 'Processing task',
    ...overrides,
  };
}

describe('LogViewer', () => {
  it('should render empty state', () => {
    const viewer = new LogViewer();
    const output = viewer.render();

    expect(output.lines[0]).toBe('=== Logs ===');
    expect(output.lines[1]).toBe('  (no logs)');
    expect(output.height).toBe(2);
  });

  it('should add and render log entries', () => {
    const viewer = new LogViewer();
    viewer.update(makeLog({ message: 'Started', level: 'info' }));
    viewer.update(makeLog({ message: 'Warning!', level: 'warn', timestamp: '2026-02-13T14:30:46Z' }));
    const output = viewer.render();

    expect(output.lines.length).toBe(3); // header + 2 entries
    expect(output.lines[1]).toContain('14:30:45');
    expect(output.lines[1]).toContain('INF');
    expect(output.lines[1]).toContain('Started');
    expect(output.lines[2]).toContain('WRN');
    expect(output.lines[2]).toContain('Warning!');
  });

  it('should accept batch updates via array', () => {
    const viewer = new LogViewer();
    viewer.update([
      makeLog({ message: 'Log 1' }),
      makeLog({ message: 'Log 2' }),
      makeLog({ message: 'Log 3' }),
    ]);

    expect(viewer.getEntryCount()).toBe(3);
  });

  it('should respect maxLines limit', () => {
    const viewer = new LogViewer({ maxLines: 3 });
    for (let i = 0; i < 5; i++) {
      viewer.update(makeLog({ message: `Log ${i}` }));
    }

    expect(viewer.getEntryCount()).toBe(3);
    const entries = viewer.getEntries();
    // Oldest should have been evicted
    expect(entries[0].message).toBe('Log 2');
    expect(entries[2].message).toBe('Log 4');
  });

  it('should filter by minimum level', () => {
    const viewer = new LogViewer({ minLevel: 'warn' });
    viewer.update(makeLog({ level: 'debug', message: 'debug msg' }));
    viewer.update(makeLog({ level: 'info', message: 'info msg' }));
    viewer.update(makeLog({ level: 'warn', message: 'warn msg' }));
    viewer.update(makeLog({ level: 'error', message: 'error msg' }));

    expect(viewer.getEntryCount()).toBe(2);
    const entries = viewer.getEntries();
    expect(entries[0].level).toBe('warn');
    expect(entries[1].level).toBe('error');
  });

  it('should clear all entries', () => {
    const viewer = new LogViewer();
    viewer.update(makeLog());
    viewer.update(makeLog());
    expect(viewer.getEntryCount()).toBe(2);

    viewer.clear();
    expect(viewer.getEntryCount()).toBe(0);
  });

  it('should destroy and clear entries', () => {
    const viewer = new LogViewer();
    viewer.update(makeLog());
    viewer.destroy();
    expect(viewer.getEntryCount()).toBe(0);
  });

  it('should be created via factory function', () => {
    const viewer = createLogViewer({ maxLines: 10 });
    expect(viewer).toBeInstanceOf(LogViewer);
    expect(viewer.type).toBe('log-viewer');
  });
});
