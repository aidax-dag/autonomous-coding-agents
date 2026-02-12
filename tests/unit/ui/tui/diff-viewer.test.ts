/**
 * Tests for DiffViewer TUI Component
 */

import { DiffViewer, createDiffViewer } from '@/ui/tui/components/diff-viewer';
import type { DiffEntry } from '@/ui/tui/interfaces/tui.interface';

function makeDiff(overrides: Partial<DiffEntry> = {}): DiffEntry {
  return {
    file: 'src/index.ts',
    timestamp: '2026-02-13T14:00:00Z',
    hunks: [
      {
        oldStart: 1,
        oldLines: 3,
        newStart: 1,
        newLines: 4,
        lines: [
          { type: 'context', content: 'import { foo } from "./foo";' },
          { type: 'remove', content: 'const old = foo();' },
          { type: 'add', content: 'const result = foo();' },
          { type: 'add', content: 'console.log(result);' },
        ],
      },
    ],
    ...overrides,
  };
}

describe('DiffViewer', () => {
  it('should render empty state', () => {
    const viewer = new DiffViewer();
    const output = viewer.render();

    expect(output.lines[0]).toBe('=== Changes ===');
    expect(output.lines[1]).toBe('  No changes');
    expect(output.height).toBe(2);
  });

  it('should add and render diffs', () => {
    const viewer = new DiffViewer();
    viewer.update(makeDiff());
    const output = viewer.render();

    expect(output.lines[0]).toBe('=== Changes ===');
    expect(output.lines[1]).toContain('--- src/index.ts');
    expect(output.lines[2]).toContain('@@ -1,3 +1,4 @@');
    // Check line prefixes
    expect(output.lines[3]).toContain(' import');    // context line with space prefix
    expect(output.lines[4]).toContain('-const old');  // remove line
    expect(output.lines[5]).toContain('+const result'); // add line
    expect(output.lines[6]).toContain('+console.log'); // add line
  });

  it('should update existing file diff', () => {
    const viewer = new DiffViewer();
    viewer.update(makeDiff({ file: 'src/a.ts' }));
    viewer.update(makeDiff({ file: 'src/b.ts' }));
    expect(viewer.getDiffCount()).toBe(2);

    // Update same file
    viewer.update(makeDiff({
      file: 'src/a.ts',
      hunks: [{
        oldStart: 10,
        oldLines: 1,
        newStart: 10,
        newLines: 1,
        lines: [{ type: 'add', content: 'new line' }],
      }],
    }));
    expect(viewer.getDiffCount()).toBe(2);

    // Verify the diff was replaced
    const diffs = viewer.getDiffs();
    const aDiff = diffs.find(d => d.file === 'src/a.ts');
    expect(aDiff?.hunks[0].oldStart).toBe(10);
  });

  it('should compute addition and deletion stats', () => {
    const viewer = new DiffViewer();
    viewer.update(makeDiff()); // 2 additions, 1 deletion from the default

    const stats = viewer.getStats();
    expect(stats.additions).toBe(2);
    expect(stats.deletions).toBe(1);
  });

  it('should respect maxDiffs limit', () => {
    const viewer = new DiffViewer({ maxDiffs: 2 });
    viewer.update(makeDiff({ file: 'a.ts' }));
    viewer.update(makeDiff({ file: 'b.ts' }));
    viewer.update(makeDiff({ file: 'c.ts' }));

    expect(viewer.getDiffCount()).toBe(2);
    // Oldest should have been evicted
    const files = viewer.getDiffs().map(d => d.file);
    expect(files).toEqual(['b.ts', 'c.ts']);
  });

  it('should accept batch updates via array', () => {
    const viewer = new DiffViewer();
    viewer.update([
      makeDiff({ file: 'x.ts' }),
      makeDiff({ file: 'y.ts' }),
    ]);
    expect(viewer.getDiffCount()).toBe(2);
  });

  it('should destroy and clear diffs', () => {
    const viewer = new DiffViewer();
    viewer.update(makeDiff());
    expect(viewer.getDiffCount()).toBe(1);

    viewer.destroy();
    expect(viewer.getDiffCount()).toBe(0);
  });

  it('should be created via factory function', () => {
    const viewer = createDiffViewer({ maxDiffs: 5 });
    expect(viewer).toBeInstanceOf(DiffViewer);
    expect(viewer.type).toBe('diff-viewer');
  });
});
