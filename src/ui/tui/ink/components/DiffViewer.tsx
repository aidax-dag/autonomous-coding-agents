/**
 * Diff Viewer — Ink component displaying code diffs.
 * Preserves the exact output format of the class-based DiffViewer.
 * @module ui/tui/ink/components
 */

import { Box, Text } from 'ink';
import type { DiffEntry, DiffLine } from '../../interfaces/tui.interface';

const LINE_PREFIXES: Record<DiffLine['type'], string> = {
  add: '+',
  remove: '-',
  context: ' ',
};

const LINE_COLORS: Record<DiffLine['type'], string> = {
  add: 'green',
  remove: 'red',
  context: 'white',
};

export function DiffViewer({ diffs }: { diffs: DiffEntry[] }) {
  return (
    <Box flexDirection="column">
      <Text bold>{'=== Changes ==='}</Text>
      {diffs.length === 0 ? (
        <Text dimColor>{'  No changes'}</Text>
      ) : (
        diffs.map((diff) => (
          <Box key={diff.file} flexDirection="column">
            <Text>{`  --- ${diff.file}`}</Text>
            {diff.hunks.map((hunk, hi) => (
              <Box key={hi} flexDirection="column">
                <Text color="cyan">
                  {`  @@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@`}
                </Text>
                {hunk.lines.map((line, li) => (
                  <Text key={li} color={LINE_COLORS[line.type]}>
                    {`  ${LINE_PREFIXES[line.type]}${line.content}`}
                  </Text>
                ))}
              </Box>
            ))}
          </Box>
        ))
      )}
    </Box>
  );
}
