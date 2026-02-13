import { useEffect, useRef, useCallback } from 'react';

interface SSEOptions {
  url: string;
  onMessage: (event: string, data: unknown) => void;
  enabled?: boolean;
}

export function useSSE({ url, onMessage, enabled = true }: SSEOptions) {
  const sourceRef = useRef<EventSource | null>(null);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  const connect = useCallback(() => {
    if (sourceRef.current) {
      sourceRef.current.close();
    }
    const es = new EventSource(url);
    es.onmessage = (e) => {
      try {
        const parsed = JSON.parse(e.data);
        onMessageRef.current(parsed.event ?? 'message', parsed);
      } catch {
        onMessageRef.current('message', e.data);
      }
    };
    es.onerror = () => {
      es.close();
      setTimeout(connect, 5000);
    };
    sourceRef.current = es;
  }, [url]);

  useEffect(() => {
    if (!enabled) return;
    connect();
    return () => {
      sourceRef.current?.close();
      sourceRef.current = null;
    };
  }, [connect, enabled]);
}
