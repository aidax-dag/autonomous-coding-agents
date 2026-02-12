/**
 * Log Viewer Component
 * Streaming log output display.
 * @module ui/tui/components
 */

import type { ITUIComponent, TUIRenderOutput, LogEntry } from '../interfaces/tui.interface';

export interface LogViewerOptions {
  maxLines?: number;
  minLevel?: LogEntry['level'];
}

const LEVEL_ORDER: Record<LogEntry['level'], number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

export class LogViewer implements ITUIComponent {
  readonly type = 'log-viewer' as const;
  private entries: LogEntry[] = [];
  private readonly maxLines: number;
  private readonly minLevel: number;

  constructor(options?: LogViewerOptions) {
    this.maxLines = options?.maxLines ?? 50;
    this.minLevel = LEVEL_ORDER[options?.minLevel ?? 'debug'];
  }

  update(data: unknown): void {
    if (data && typeof data === 'object' && 'message' in (data as LogEntry)) {
      this.addEntry(data as LogEntry);
    } else if (Array.isArray(data)) {
      for (const entry of data as LogEntry[]) {
        this.addEntry(entry);
      }
    }
  }

  private addEntry(entry: LogEntry): void {
    if (LEVEL_ORDER[entry.level] >= this.minLevel) {
      this.entries.push(entry);
      if (this.entries.length > this.maxLines) {
        this.entries.shift();
      }
    }
  }

  render(): TUIRenderOutput {
    const lines: string[] = ['=== Logs ==='];
    if (this.entries.length === 0) {
      lines.push('  (no logs)');
    } else {
      for (const entry of this.entries) {
        const levelTag = this.getLevelTag(entry.level);
        const time = entry.timestamp.substring(11, 19); // HH:MM:SS
        lines.push(`  ${time} ${levelTag} [${entry.source}] ${entry.message}`);
      }
    }
    const width = Math.max(...lines.map(l => l.length));
    return { lines, width, height: lines.length };
  }

  private getLevelTag(level: LogEntry['level']): string {
    const tags: Record<LogEntry['level'], string> = {
      debug: 'DBG',
      info: 'INF',
      warn: 'WRN',
      error: 'ERR',
    };
    return tags[level];
  }

  getEntries(): LogEntry[] {
    return [...this.entries];
  }

  clear(): void {
    this.entries = [];
  }

  getEntryCount(): number {
    return this.entries.length;
  }

  destroy(): void {
    this.entries = [];
  }
}

export function createLogViewer(options?: LogViewerOptions): LogViewer {
  return new LogViewer(options);
}
