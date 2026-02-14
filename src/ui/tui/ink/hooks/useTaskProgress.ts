/**
 * React hook for subscribing to task progress updates via ACP message bus.
 * Mirrors the merge logic of the class-based TaskProgressHook.
 * @module ui/tui/ink/hooks
 */

import { useState, useEffect } from 'react';
import type { IACPMessageBus, ACPMessage } from '@/core/protocols';
import type { TaskProgress } from '../../interfaces/tui.interface';

export function useTaskProgress(messageBus: IACPMessageBus): TaskProgress[] {
  const [tasks, setTasks] = useState<Map<string, TaskProgress>>(new Map());

  useEffect(() => {
    const sub = messageBus.on('task:status', async (msg: ACPMessage) => {
      const payload = msg.payload as { taskId: string } & Partial<TaskProgress>;
      if (!payload.taskId) return;

      setTasks((prev) => {
        const next = new Map(prev);
        const existing = next.get(payload.taskId);
        const updated: TaskProgress = {
          taskId: payload.taskId,
          name: payload.name ?? existing?.name ?? 'Unknown',
          status: payload.status ?? existing?.status ?? 'pending',
          progress: payload.progress ?? existing?.progress ?? 0,
          startedAt: payload.startedAt ?? existing?.startedAt,
          completedAt: payload.completedAt ?? existing?.completedAt,
          error: payload.error ?? existing?.error,
        };
        next.set(payload.taskId, updated);
        return next;
      });
    });

    return () => {
      sub.unsubscribe();
    };
  }, [messageBus]);

  return Array.from(tasks.values());
}
