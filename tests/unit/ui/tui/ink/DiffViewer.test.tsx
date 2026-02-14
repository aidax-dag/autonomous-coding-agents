/**
 * Tests for Ink DiffViewer component
 */

import React from 'react';
import { render } from 'ink-testing-library';
import { DiffViewer } from '@/ui/tui/ink/components/DiffViewer';
import type { DiffEntry } from '@/ui/tui/interfaces/tui.interface';

describe('Ink DiffViewer', () => {
  it('should render header', () => {
    const { lastFrame } = render(React.createElement(DiffViewer, { diffs: [] }));
    expect(lastFrame()).toContain('=== Changes ===');
  });

  it('should show "No changes" when empty', () => {
    const { lastFrame } = render(React.createElement(DiffViewer, { diffs: [] }));
    expect(lastFrame()).toContain('No changes');
  });

  it('should render diff entries with hunks', () => {
    const diffs: DiffEntry[] = [
      {
        file: 'src/auth.ts',
        timestamp: '2026-02-15T12:00:00Z',
        hunks: [
          {
            oldStart: 10,
            oldLines: 3,
            newStart: 10,
            newLines: 4,
            lines: [
              { type: 'context', content: 'const config = {};' },
              { type: 'remove', content: 'const old = true;' },
              { type: 'add', content: 'const updated = true;' },
              { type: 'add', content: 'const extra = false;' },
            ],
          },
        ],
      },
    ];
    const { lastFrame } = render(React.createElement(DiffViewer, { diffs }));
    const frame = lastFrame()!;

    expect(frame).toContain('--- src/auth.ts');
    expect(frame).toContain('@@ -10,3 +10,4 @@');
    expect(frame).toContain('+const updated = true;');
    expect(frame).toContain('-const old = true;');
    expect(frame).toContain(' const config = {};');
  });
});
