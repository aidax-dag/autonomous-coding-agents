/**
 * Log Viewer — Ink component displaying streaming log output.
 * Preserves the exact output format of the class-based LogViewer.
 * @module ui/tui/ink/components
 */

import { Box, Text } from 'ink';
import type { LogEntry } from '../../interfaces/tui.interface';

const LEVEL_TAGS: Record<LogEntry['level'], string> = {
  debug: 'DBG',
  info: 'INF',
  warn: 'WRN',
  error: 'ERR',
};

const LEVEL_COLORS: Record<LogEntry['level'], string> = {
  debug: 'gray',
  info: 'white',
  warn: 'yellow',
  error: 'red',
};

export function LogViewer({ entries }: { entries: LogEntry[] }) {
  return (
    <Box flexDirection="column">
      <Text bold>{'=== Logs ==='}</Text>
      {entries.length === 0 ? (
        <Text dimColor>{'  (no logs)'}</Text>
      ) : (
        entries.map((entry, i) => {
          const time = entry.timestamp.substring(11, 19);
          return (
            <Text key={i} color={LEVEL_COLORS[entry.level]}>
              {`  ${time} ${LEVEL_TAGS[entry.level]} [${entry.source}] ${entry.message}`}
            </Text>
          );
        })
      )}
    </Box>
  );
}
