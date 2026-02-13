import { useState, useCallback, useRef, useEffect } from 'react';
import { ScrollText, Trash2, ArrowDown } from 'lucide-react';
import { useSSE } from '../hooks/useSSE';

interface LogEntry {
  id: number;
  timestamp: string;
  event: string;
  data: unknown;
}

let nextId = 0;

export default function LogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [autoScroll, setAutoScroll] = useState(true);
  const [filter, setFilter] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  const onMessage = useCallback((event: string, data: unknown) => {
    setLogs((prev) => {
      const next = [
        ...prev,
        { id: nextId++, timestamp: new Date().toISOString(), event, data },
      ];
      return next.length > 500 ? next.slice(-500) : next;
    });
  }, []);

  useSSE({ url: '/api/sse', onMessage, enabled: true });

  useEffect(() => {
    if (autoScroll) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  const filtered = filter
    ? logs.filter(
        (l) =>
          l.event.toLowerCase().includes(filter.toLowerCase()) ||
          JSON.stringify(l.data).toLowerCase().includes(filter.toLowerCase()),
      )
    : logs;

  return (
    <div className="p-6 space-y-4 flex flex-col h-full">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <ScrollText className="w-5 h-5" /> Logs
        </h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={`flex items-center gap-1 px-2 py-1 text-xs rounded-md border transition-colors ${
              autoScroll
                ? 'border-blue-500 text-blue-600 bg-blue-50 dark:bg-blue-900/20'
                : 'border-gray-300 dark:border-gray-600 text-gray-500'
            }`}
          >
            <ArrowDown className="w-3 h-3" /> Auto-scroll
          </button>
          <button
            onClick={() => setLogs([])}
            className="flex items-center gap-1 px-2 py-1 text-xs text-gray-500 hover:text-red-500 rounded-md border border-gray-300 dark:border-gray-600"
          >
            <Trash2 className="w-3 h-3" /> Clear
          </button>
        </div>
      </div>

      <input
        type="text"
        placeholder="Filter logs..."
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 focus:ring-2 focus:ring-blue-500 outline-none"
      />

      <div className="flex-1 overflow-auto bg-gray-900 rounded-lg border border-gray-700 font-mono text-xs p-3 min-h-64">
        {filtered.length === 0 && (
          <div className="text-gray-500 text-center py-8">
            {logs.length === 0
              ? 'Waiting for events... (connect SSE to see real-time logs)'
              : 'No matching logs'}
          </div>
        )}
        {filtered.map((entry) => (
          <div key={entry.id} className="py-0.5 flex gap-2 text-gray-300 hover:bg-gray-800/50">
            <span className="text-gray-500 flex-shrink-0">
              {entry.timestamp.split('T')[1]?.slice(0, 12)}
            </span>
            <span className="text-blue-400 flex-shrink-0 w-24 truncate">{entry.event}</span>
            <span className="text-gray-400 truncate">
              {typeof entry.data === 'string'
                ? entry.data
                : JSON.stringify(entry.data)}
            </span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
