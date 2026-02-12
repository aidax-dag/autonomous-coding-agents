/**
 * Diff Viewer Component
 * Code change diff display.
 * @module ui/tui/components
 */

import type { ITUIComponent, TUIRenderOutput, DiffEntry, DiffLine } from '../interfaces/tui.interface';

export interface DiffViewerOptions {
  maxDiffs?: number;
  contextLines?: number;
}

export class DiffViewer implements ITUIComponent {
  readonly type = 'diff-viewer' as const;
  private diffs: DiffEntry[] = [];
  private readonly maxDiffs: number;

  constructor(options?: DiffViewerOptions) {
    this.maxDiffs = options?.maxDiffs ?? 10;
  }

  update(data: unknown): void {
    if (data && typeof data === 'object' && 'file' in (data as DiffEntry)) {
      this.addDiff(data as DiffEntry);
    } else if (Array.isArray(data)) {
      for (const diff of data as DiffEntry[]) {
        this.addDiff(diff);
      }
    }
  }

  private addDiff(diff: DiffEntry): void {
    const existing = this.diffs.findIndex(d => d.file === diff.file);
    if (existing >= 0) {
      this.diffs[existing] = diff;
    } else {
      this.diffs.push(diff);
      if (this.diffs.length > this.maxDiffs) {
        this.diffs.shift();
      }
    }
  }

  render(): TUIRenderOutput {
    const lines: string[] = ['=== Changes ==='];
    if (this.diffs.length === 0) {
      lines.push('  No changes');
    } else {
      for (const diff of this.diffs) {
        lines.push(`  --- ${diff.file}`);
        for (const hunk of diff.hunks) {
          lines.push(`  @@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@`);
          for (const line of hunk.lines) {
            const prefix = this.getLinePrefix(line.type);
            lines.push(`  ${prefix}${line.content}`);
          }
        }
      }
    }
    const width = Math.max(...lines.map(l => l.length));
    return { lines, width, height: lines.length };
  }

  private getLinePrefix(type: DiffLine['type']): string {
    const prefixes: Record<DiffLine['type'], string> = {
      add: '+',
      remove: '-',
      context: ' ',
    };
    return prefixes[type];
  }

  getDiffs(): DiffEntry[] {
    return [...this.diffs];
  }

  getDiffCount(): number {
    return this.diffs.length;
  }

  getStats(): { additions: number; deletions: number } {
    let additions = 0;
    let deletions = 0;
    for (const diff of this.diffs) {
      for (const hunk of diff.hunks) {
        for (const line of hunk.lines) {
          if (line.type === 'add') additions++;
          if (line.type === 'remove') deletions++;
        }
      }
    }
    return { additions, deletions };
  }

  destroy(): void {
    this.diffs = [];
  }
}

export function createDiffViewer(options?: DiffViewerOptions): DiffViewer {
  return new DiffViewer(options);
}
