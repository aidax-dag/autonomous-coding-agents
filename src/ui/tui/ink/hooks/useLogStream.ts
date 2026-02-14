/**
 * React hook for collecting log entries from ACP message bus.
 * Listens to agent:event messages containing log data.
 * @module ui/tui/ink/hooks
 */

import { useState, useEffect } from 'react';
import type { IACPMessageBus, ACPMessage } from '@/core/protocols';
import type { LogEntry } from '../../interfaces/tui.interface';

const LEVEL_ORDER: Record<LogEntry['level'], number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

export interface UseLogStreamOptions {
  maxLines?: number;
  minLevel?: LogEntry['level'];
}

export function useLogStream(
  messageBus: IACPMessageBus,
  options: UseLogStreamOptions = {},
): LogEntry[] {
  const maxLines = options.maxLines ?? 50;
  const minLevel = LEVEL_ORDER[options.minLevel ?? 'debug'];
  const [entries, setEntries] = useState<LogEntry[]>([]);

  useEffect(() => {
    const sub = messageBus.on('agent:event', async (msg: ACPMessage) => {
      const payload = msg.payload as Record<string, unknown>;
      if (payload.event !== 'log') return;

      const entry = payload.entry as LogEntry | undefined;
      if (!entry) return;
      if (LEVEL_ORDER[entry.level] < minLevel) return;

      setEntries((prev) => {
        const next = [...prev, entry];
        return next.length > maxLines ? next.slice(-maxLines) : next;
      });
    });

    return () => {
      sub.unsubscribe();
    };
  }, [messageBus, maxLines, minLevel]);

  return entries;
}
